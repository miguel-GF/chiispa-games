export const GAME_IDS = ['reaction', 'mash', 'precision', 'avoid', 'choose'] as const;
export type GameId = (typeof GAME_IDS)[number];
export type GameInput = { action: 'tap'; value?: number };

export interface PlayerResult {
  success: boolean;
  score: number;
  detail: string;
}

export interface RoundState {
  gameId: GameId;
  roundId: number;
  startsAt: number;
  actionAt: number;
  endsAt: number;
  winnerId?: string;
  earlyPlayerIds: string[];
  inputs: Record<string, number[]>;
  targetValue?: number;
}

export interface PublicRoundState {
  gameId: GameId;
  roundId: number;
  startsAt: number;
  actionAt: number;
  endsAt: number;
  winnerId?: string;
  earlyPlayerIds: string[];
  progress: Record<string, number>;
  targetValue?: number;
}

export const GAME_INFO: Record<GameId, { instruction: string; hint: string }> = {
  reaction: { instruction: '¡APLASTA!', hint: 'Espera a que aparezca la mosca' },
  mash: { instruction: '¡ATACA!', hint: 'Toca tantas veces como puedas' },
  precision: { instruction: '¡CLAVA!', hint: 'Toca cuando el medidor esté al centro' },
  avoid: { instruction: '¡NI LO TOQUES!', hint: 'No caigas en la trampa' },
  choose: { instruction: '¡ELIGE!', hint: 'Toca el símbolo que ves en la pantalla' }
};

export function createRound(
  gameId: GameId,
  roundId: number,
  now: number,
  random = Math.random
): RoundState {
  const startsAt = now + 1_500;
  const actionAt = gameId === 'reaction'
    ? startsAt + 700 + Math.floor(random() * 1_200)
    : startsAt;
  const durations: Record<GameId, number> = {
    reaction: actionAt - startsAt + 2_000,
    mash: 4_000,
    precision: 4_000,
    avoid: 3_500,
    choose: 3_500
  };
  return {
    gameId,
    roundId,
    startsAt,
    actionAt,
    endsAt: startsAt + durations[gameId],
    earlyPlayerIds: [],
    inputs: {},
    ...(gameId === 'choose' ? { targetValue: Math.floor(random() * 4) } : {})
  };
}

export type InputResult = 'ignored' | 'early' | 'accepted' | 'winner' | 'late';

export function applyInput(state: RoundState, playerId: string, input: GameInput, serverTime: number): InputResult {
  if (serverTime < state.startsAt || serverTime > state.endsAt) return 'late';
  if (state.gameId === 'reaction' && serverTime < state.actionAt) {
    if (!state.earlyPlayerIds.includes(playerId)) state.earlyPlayerIds.push(playerId);
    return 'early';
  }
  if (state.gameId === 'reaction') {
    if (state.winnerId || state.earlyPlayerIds.includes(playerId)) return 'ignored';
    state.winnerId = playerId;
    return 'winner';
  }
  const inputs = state.inputs[playerId] ?? [];
  if (state.gameId !== 'mash' && inputs.length > 0) return 'ignored';
  inputs.push(input.value ?? serverTime);
  state.inputs[playerId] = inputs;
  return 'accepted';
}

export function resolveRound(state: RoundState, playerIds: readonly string[]): Record<string, PlayerResult> {
  if (state.gameId === 'reaction') {
    return Object.fromEntries(playerIds.map((id) => [id, {
      success: state.winnerId === id,
      score: state.winnerId === id ? 100 : 0,
      detail: state.winnerId === id ? 'PRIMER MANOTAZO' : state.earlyPlayerIds.includes(id) ? 'MUY PRONTO' : 'SE ESCAPÓ'
    }]));
  }
  if (state.gameId === 'mash') {
    const counts = playerIds.map((id) => state.inputs[id]?.length ?? 0);
    const best = Math.max(1, ...counts);
    return Object.fromEntries(playerIds.map((id) => {
      const count = state.inputs[id]?.length ?? 0;
      return [id, { success: count === best, score: Math.round(count / best * 100), detail: `${count} GOLPES` }];
    }));
  }
  if (state.gameId === 'precision') {
    const targetTime = state.startsAt + (state.endsAt - state.startsAt) / 2;
    return Object.fromEntries(playerIds.map((id) => {
      const tapTime = state.inputs[id]?.[0];
      const distance = tapTime === undefined ? 2_000 : Math.abs(tapTime - targetTime);
      const score = Math.max(0, Math.round(100 - distance / 12));
      return [id, { success: score >= 75, score, detail: tapTime === undefined ? 'SIN TOCAR' : `${Math.round(distance)} ms` }];
    }));
  }
  if (state.gameId === 'avoid') {
    return Object.fromEntries(playerIds.map((id) => {
      const avoided = !state.inputs[id]?.length;
      return [id, { success: avoided, score: avoided ? 100 : 0, detail: avoided ? 'SANGRE FRÍA' : 'CAÍSTE' }];
    }));
  }
  return Object.fromEntries(playerIds.map((id) => {
    const correct = state.inputs[id]?.[0] === state.targetValue;
    return [id, { success: correct, score: correct ? 100 : 0, detail: correct ? 'CORRECTO' : 'EQUIVOCADO' }];
  }));
}

export function publicRound(state: RoundState): PublicRoundState {
  return {
    gameId: state.gameId,
    roundId: state.roundId,
    startsAt: state.startsAt,
    actionAt: state.actionAt,
    endsAt: state.endsAt,
    ...(state.winnerId ? { winnerId: state.winnerId } : {}),
    earlyPlayerIds: state.earlyPlayerIds,
    progress: Object.fromEntries(Object.entries(state.inputs).map(([id, inputs]) => [id, inputs.length])),
    ...(state.targetValue !== undefined ? { targetValue: state.targetValue } : {})
  };
}

export const BOMB_WIRES = ['rojo', 'azul', 'amarillo'] as const;
export type BombWire = (typeof BOMB_WIRES)[number];

export interface BombState {
  startsAt: number;
  endsAt: number;
  sequence: BombWire[];
  cutWires: BombWire[];
  strikes: number;
  status: 'playing' | 'defused' | 'exploded';
}

export type BombCutResult = 'correct' | 'wrong' | 'defused' | 'finished';

export function createBomb(now: number, random = Math.random): BombState {
  const sequence: BombWire[] = [...BOMB_WIRES];
  for (let index = sequence.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [sequence[index], sequence[swapIndex]] = [sequence[swapIndex]!, sequence[index]!];
  }
  return {
    startsAt: now + 2_000,
    endsAt: now + 22_000,
    sequence,
    cutWires: [],
    strikes: 0,
    status: 'playing'
  };
}

export function cutBombWire(state: BombState, wire: BombWire, serverTime: number): BombCutResult {
  if (state.status !== 'playing') return 'finished';
  if (serverTime < state.startsAt) return 'finished';
  if (serverTime > state.endsAt) {
    state.status = 'exploded';
    return 'finished';
  }
  const expected = state.sequence[state.cutWires.length];
  if (wire !== expected) {
    state.strikes += 1;
    if (state.strikes >= 2) state.status = 'exploded';
    return 'wrong';
  }
  state.cutWires.push(wire);
  if (state.cutWires.length === state.sequence.length) {
    state.status = 'defused';
    return 'defused';
  }
  return 'correct';
}
