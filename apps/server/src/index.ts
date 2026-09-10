import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  applyInput,
  createBomb,
  createRound,
  cutBombWire,
  GAME_IDS,
  publicRound,
  resolveRound,
  type PlayerResult,
  type BombState,
  type RoundState
} from '@chispa/game-core';
import {
  parseClientMessage,
  PLAYER_COLORS,
  PLAYER_SHAPES,
  type PlayerView,
  type RoomSnapshot,
  type ServerMessage
} from '@chispa/protocol';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 6;

interface Player extends PlayerView {
  resumeToken: string;
  socket?: WebSocket;
}

interface Room {
  code: string;
  screen?: WebSocket;
  players: Map<string, Player>;
  phase: RoomSnapshot['phase'];
  roundId: number;
  rallyRound: number;
  round?: RoundState;
  results?: Record<string, PlayerResult>;
  bomb?: BombState;
  bombHints: Map<string, string>;
  revealTimer?: NodeJS.Timeout;
  resetTimer?: NodeJS.Timeout;
  bossTimer?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();
const socketRoom = new WeakMap<WebSocket, { code: string; role: 'screen' | 'controller'; playerId?: string }>();
const rateLimits = new WeakMap<WebSocket, { startedAt: number; count: number }>();

function token(bytes = 18): string {
  return randomBytes(bytes).toString('base64url');
}

function roomCode(): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    for (let index = 0; index < 4; index += 1) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('No fue posible crear una sala');
}

function snapshot(room: Room, viewerPlayerId?: string): RoomSnapshot {
  const base: RoomSnapshot = {
    code: room.code,
    phase: room.phase,
    players: [...room.players.values()].map(({ resumeToken: _resumeToken, socket: _socket, ...player }) => player),
    roundId: room.roundId,
    rallyRound: room.rallyRound,
    rallyLength: GAME_IDS.length
  };
  if (room.bomb) {
    return {
      ...base,
      bomb: {
        startsAt: room.bomb.startsAt,
        endsAt: room.bomb.endsAt,
        cutWires: room.bomb.cutWires,
        strikes: room.bomb.strikes,
        status: room.bomb.status
      },
      ...(viewerPlayerId ? { privateHint: room.bombHints.get(viewerPlayerId) ?? 'Hablen entre todos antes de cortar.' } : {})
    };
  }
  if (!room.round) return base;
  const publicState = publicRound(room.round);
  return {
    ...base,
    gameId: publicState.gameId,
    startsAt: publicState.startsAt,
    endsAt: publicState.endsAt,
    actionAt: publicState.actionAt,
    ...(publicState.winnerId ? { winnerId: publicState.winnerId } : {}),
    earlyPlayerIds: publicState.earlyPlayerIds,
    progress: publicState.progress,
    ...(publicState.targetValue !== undefined ? { targetValue: publicState.targetValue } : {}),
    ...(room.results ? { results: room.results } : {})
  };
}

function send(socket: WebSocket | undefined, message: ServerMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(room: Room): void {
  const message: ServerMessage = { type: 'server.roomSnapshot', snapshot: snapshot(room) };
  send(room.screen, message);
  for (const player of room.players.values()) {
    send(player.socket, { type: 'server.roomSnapshot', snapshot: snapshot(room, player.id) });
  }
}

function error(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: 'server.error', code, message });
}

function findPlayer(room: Room, resumeToken: string): Player | undefined {
  return [...room.players.values()].find((player) => player.resumeToken === resumeToken);
}

function startRound(room: Room): void {
  clearTimeout(room.revealTimer);
  clearTimeout(room.resetTimer);
  delete room.results;
  room.roundId += 1;
  room.rallyRound += 1;
  const gameId = GAME_IDS[(room.rallyRound - 1) % GAME_IDS.length] ?? GAME_IDS[0];
  room.round = createRound(gameId, room.roundId, Date.now());
  room.phase = 'countdown';
  broadcast(room);

  const playingDelay = Math.max(0, room.round.startsAt - Date.now());
  setTimeout(() => {
    if (room.round?.roundId !== room.roundId) return;
    room.phase = 'playing';
    broadcast(room);
  }, playingDelay);

  room.revealTimer = setTimeout(() => reveal(room), Math.max(0, room.round.endsAt - Date.now()));
}

function startBoss(room: Room): void {
  clearTimeout(room.resetTimer);
  room.bomb = createBomb(Date.now());
  room.bombHints.clear();
  const [first, second, last] = room.bomb.sequence;
  const hints = [
    `El primer cable es ${first?.toUpperCase()}.`,
    `${second?.toUpperCase()} va justo después de ${first?.toUpperCase()}.`,
    `El cable ${last?.toUpperCase()} es el último.`
  ];
  [...room.players.values()].forEach((player, index) => {
    room.bombHints.set(player.id, room.players.size === 1
      ? `Orden completo: ${room.bomb?.sequence.map((wire) => wire.toUpperCase()).join(', ')}.`
      : hints[index % hints.length] ?? hints[0]!);
  });
  room.phase = 'bossCountdown';
  broadcast(room);
  setTimeout(() => {
    if (!room.bomb || room.bomb.status !== 'playing') return;
    room.phase = 'bossPlaying';
    broadcast(room);
  }, Math.max(0, room.bomb.startsAt - Date.now()));
  room.bossTimer = setTimeout(() => {
    if (!room.bomb || room.bomb.status !== 'playing') return;
    room.bomb.status = 'exploded';
    finishBoss(room);
  }, Math.max(0, room.bomb.endsAt - Date.now()));
}

function finishBoss(room: Room): void {
  if (!room.bomb) return;
  clearTimeout(room.bossTimer);
  room.phase = 'bossReveal';
  if (room.bomb.status === 'defused') {
    for (const player of room.players.values()) player.score += 150;
  }
  broadcast(room);
  room.resetTimer = setTimeout(() => {
    room.phase = 'podium';
    delete room.bomb;
    room.bombHints.clear();
    broadcast(room);
  }, 5_000);
}

function reveal(room: Room): void {
  if (!room.round || room.phase === 'reveal') return;
  room.phase = 'reveal';
  room.results = resolveRound(room.round, [...room.players.keys()]);
  for (const [playerId, result] of Object.entries(room.results)) {
    const player = room.players.get(playerId);
    if (player) player.score += result.score;
  }
  broadcast(room);
  room.resetTimer = setTimeout(() => {
    if (room.rallyRound >= GAME_IDS.length) {
      delete room.round;
      delete room.results;
      startBoss(room);
    } else {
      startRound(room);
    }
  }, 3_500);
}

function isRateLimited(socket: WebSocket): boolean {
  const now = Date.now();
  const current = rateLimits.get(socket);
  if (!current || now - current.startedAt > 1_000) {
    rateLimits.set(socket, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 30;
}

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  response.writeHead(404).end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    if (isRateLimited(socket)) {
      error(socket, 'RATE_LIMIT', 'Demasiados mensajes. Respira tantito.');
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(raw.toString());
    } catch {
      error(socket, 'INVALID_MESSAGE', 'El mensaje no es JSON válido.');
      return;
    }
    const message = parseClientMessage(json);
    if (!message) {
      error(socket, 'INVALID_MESSAGE', 'El mensaje no cumple el protocolo.');
      return;
    }

    if (message.type === 'screen.createRoom') {
      const code = roomCode();
      const room: Room = { code, screen: socket, players: new Map(), phase: 'lobby', roundId: 0, rallyRound: 0, bombHints: new Map() };
      rooms.set(code, room);
      socketRoom.set(socket, { code, role: 'screen' });
      send(socket, { type: 'server.roomCreated', snapshot: snapshot(room) });
      return;
    }

    const code = message.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      error(socket, 'ROOM_NOT_FOUND', 'Esa sala no existe o ya terminó.');
      return;
    }

    if (message.type === 'screen.startRound') {
      if (room.screen !== socket) return error(socket, 'FORBIDDEN', 'Solo la pantalla puede iniciar.');
      if (room.players.size === 0) return error(socket, 'NO_PLAYERS', 'Falta al menos un jugador.');
      if (room.phase !== 'lobby' && room.phase !== 'podium') return;
      room.rallyRound = 0;
      for (const player of room.players.values()) player.score = 0;
      startRound(room);
      return;
    }

    if (message.type === 'controller.join') {
      if (room.phase !== 'lobby') return error(socket, 'GAME_IN_PROGRESS', 'La partida ya empezó. Entra en el siguiente Rally.');
      if (room.players.size >= MAX_PLAYERS) return error(socket, 'ROOM_FULL', 'La sala ya está llena.');
      const id = token(9);
      const position = room.players.size;
      const player: Player = {
        id,
        name: message.name,
        color: PLAYER_COLORS[position] ?? PLAYER_COLORS[0],
        shape: PLAYER_SHAPES[position] ?? PLAYER_SHAPES[0],
        score: 0,
        connected: true,
        ready: false,
        resumeToken: token(),
        socket
      };
      room.players.set(id, player);
      socketRoom.set(socket, { code, role: 'controller', playerId: id });
      send(socket, { type: 'server.joined', playerId: id, resumeToken: player.resumeToken, snapshot: snapshot(room, id) });
      broadcast(room);
      return;
    }

    const player = findPlayer(room, message.resumeToken);
    if (!player) return error(socket, 'INVALID_TOKEN', 'No pudimos recuperar tu lugar.');

    if (message.type === 'controller.resume') {
      player.socket?.close(4001, 'Sesión recuperada en otro dispositivo');
      player.socket = socket;
      player.connected = true;
      socketRoom.set(socket, { code, role: 'controller', playerId: player.id });
      send(socket, { type: 'server.resumed', playerId: player.id, resumeToken: player.resumeToken, snapshot: snapshot(room, player.id) });
      broadcast(room);
      return;
    }

    if (player.socket !== socket) return error(socket, 'STALE_CONNECTION', 'Esta conexión ya no controla el asiento.');

    if (message.type === 'controller.ready') {
      player.ready = true;
      broadcast(room);
      return;
    }

    if (message.type === 'controller.bombCut') {
      if (room.phase !== 'bossPlaying' || !room.bomb) return;
      const result = cutBombWire(room.bomb, message.wire, Date.now());
      broadcast(room);
      if (result === 'defused' || room.bomb.status === 'exploded') finishBoss(room);
      return;
    }

    if (message.roundId !== room.roundId || room.phase !== 'playing' || !room.round) return;
    const input = message.value === undefined ? { action: 'tap' as const } : { action: 'tap' as const, value: message.value };
    const result = applyInput(room.round, player.id, input, Date.now());
    if (result === 'winner') reveal(room);
    else if (result === 'early' || room.round.gameId === 'mash') broadcast(room);
  });

  socket.on('close', () => {
    const identity = socketRoom.get(socket);
    if (!identity) return;
    const room = rooms.get(identity.code);
    if (!room) return;
    if (identity.role === 'screen' && room.screen === socket) {
      clearTimeout(room.revealTimer);
      clearTimeout(room.resetTimer);
      clearTimeout(room.bossTimer);
      rooms.delete(room.code);
      for (const player of room.players.values()) player.socket?.close(4000, 'La pantalla cerró la sala');
      return;
    }
    const player = identity.playerId ? room.players.get(identity.playerId) : undefined;
    if (player?.socket === socket) {
      player.connected = false;
      delete player.socket;
      broadcast(room);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`CHISPA server listo en ws://localhost:${PORT}`);
});
