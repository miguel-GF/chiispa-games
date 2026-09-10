import type { PlayerView, RoomSnapshot, ServerMessage } from '@chispa/protocol';
import { GAME_INFO, type BombWire } from '@chispa/game-core';
import { createSocket } from './socket';

const STORAGE_KEY = 'chispa-player';

interface SavedSeat { code: string; playerId: string; resumeToken: string }

export function renderController(root: HTMLElement): void {
  let connected = false;
  let snapshot: RoomSnapshot | undefined;
  let playerId = '';
  let resumeToken = '';
  let feedback: 'none' | 'tap' | 'early' = 'none';
  let lastRoundId = -1;
  const queryCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
  let saved = readSeat();

  const socket = createSocket(handleMessage, (status) => {
    connected = status;
    if (status && saved && (!queryCode || saved.code === queryCode)) {
      socket.send({ type: 'controller.resume', code: saved.code, resumeToken: saved.resumeToken });
    }
    draw();
  });

  function handleMessage(message: ServerMessage) {
    if (message.type === 'server.error') {
      if (message.code === 'INVALID_TOKEN' || message.code === 'ROOM_NOT_FOUND') {
        saved = null;
        localStorage.removeItem(STORAGE_KEY);
      }
      showError(message.message);
      return;
    }
    snapshot = message.snapshot;
    if (snapshot.roundId !== lastRoundId) {
      lastRoundId = snapshot.roundId;
      feedback = 'none';
    }
    if (message.type === 'server.joined' || message.type === 'server.resumed') {
      playerId = message.playerId;
      resumeToken = message.resumeToken;
      saved = { code: snapshot.code, playerId, resumeToken };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
    if (snapshot.earlyPlayerIds?.includes(playerId)) feedback = 'early';
    draw();
  }

  function player(): PlayerView | undefined {
    return snapshot?.players.find((candidate) => candidate.id === playerId);
  }

  function showError(message: string) {
    const error = root.querySelector<HTMLElement>('.form-error');
    if (error) error.textContent = message;
    else {
      snapshot = undefined;
      playerId = '';
      resumeToken = '';
      draw(message);
    }
  }

  function join(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const code = String(form.get('code') ?? '').trim().toUpperCase();
    const name = String(form.get('name') ?? '').trim();
    if (code.length !== 4 || !name) return showError('Pon un código de 4 letras y tu nombre.');
    socket.send({ type: 'controller.join', code, name });
  }

  function tap(value?: number) {
    if (!snapshot || snapshot.phase !== 'playing' || !resumeToken || feedback === 'early') return;
    feedback = 'tap';
    navigator.vibrate?.(35);
    draw();
    socket.send({
      type: 'controller.input',
      code: snapshot.code,
      resumeToken,
      roundId: snapshot.roundId,
      input: 'tap',
      clientTime: Date.now(),
      ...(value === undefined ? {} : { value })
    });
    window.setTimeout(() => {
      if (feedback === 'tap') feedback = 'none';
      draw();
    }, 180);
  }

  function cutWire(wire: BombWire) {
    if (!snapshot || snapshot.phase !== 'bossPlaying' || !resumeToken) return;
    navigator.vibrate?.([40, 30, 40]);
    socket.send({ type: 'controller.bombCut', code: snapshot.code, resumeToken, wire });
  }

  function draw(errorMessage = '') {
    const me = player();
    if (!me) {
      root.innerHTML = `<main class="controller join-page">
        <div class="mini-logo">CHISPA<span>✦</span></div>
        <section class="join-card"><p class="eyebrow">ÚNETE A LA FIESTA</p><h1>¿Quién eres?</h1>
          <form><label>CÓDIGO<input name="code" value="${escapeHtml(queryCode)}" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="RAYO" /></label>
          <label>TU NOMBRE<input name="name" maxlength="16" autocomplete="nickname" placeholder="Chispa López" /></label>
          <p class="form-error">${escapeHtml(errorMessage)}</p><button ${connected ? '' : 'disabled'}>${connected ? 'ENTRAR ⚡' : 'CONECTANDO…'}</button></form>
        </section></main>`;
      root.querySelector('form')?.addEventListener('submit', join);
      return;
    }

    if (snapshot?.phase === 'bossCountdown' || snapshot?.phase === 'bossPlaying' || snapshot?.phase === 'bossReveal') {
      const active = snapshot.phase === 'bossPlaying';
      root.innerHTML = `<main class="controller bomb-control" style="--player:${me.color}">
        <header><span>MANUAL PRIVADO</span><b>${escapeHtml(me.name)}</b></header>
        <section class="manual"><p class="eyebrow">TU PEDAZO DEL MANUAL</p><h1>${escapeHtml(snapshot.privateHint ?? 'Hablen entre todos.')}</h1><p>Grítalo. No enseñes la pantalla.</p></section>
        <section class="wire-buttons">${(['rojo', 'azul', 'amarillo'] as const).map((wire) => `<button data-wire="${wire}" class="${wire}" ${active && !snapshot.bomb?.cutWires.includes(wire) ? '' : 'disabled'}><i></i><b>${snapshot.bomb?.cutWires.includes(wire) ? 'CORTADO' : `CORTAR ${wire.toUpperCase()}`}</b></button>`).join('')}</section>
        <footer><span>${snapshot.phase === 'bossReveal' ? snapshot.bomb?.status === 'defused' ? '¡LO LOGRARON!' : 'MIRA LA EXPLOSIÓN' : active ? `${snapshot.bomb?.strikes ?? 0}/2 ERRORES` : 'PREPÁRENSE'}</span></footer>
      </main>`;
      root.querySelectorAll<HTMLButtonElement>('[data-wire]').forEach((button) => {
        button.addEventListener('pointerdown', () => cutWire(button.dataset.wire as BombWire));
      });
      return;
    }

    const playing = snapshot?.phase === 'playing';
    const early = feedback === 'early';
    const gameId = snapshot?.gameId ?? 'reaction';
    const info = GAME_INFO[gameId];
    const symbols = ['★', '●', '▲', '◆'];
    const actionLabel = gameId === 'mash' ? '¡ATACA!' : gameId === 'precision' ? '¡CLAVA!' : gameId === 'avoid' ? 'NO TOQUES' : info.instruction;
    const choicePad = playing && gameId === 'choose'
      ? `<div class="choice-grid">${symbols.map((symbol, index) => `<button data-value="${index}">${symbol}</button>`).join('')}</div>`
      : `<button class="tap-zone" ${playing && !early ? '' : 'disabled'}>
        <span class="tap-icon">${early ? '×' : gameId === 'avoid' ? '🍰' : playing ? '✹' : '⚡'}</span>
        <strong>${early ? '¡MUY PRONTO!' : playing ? actionLabel : snapshot?.phase === 'countdown' ? 'PREPÁRATE' : snapshot?.phase === 'reveal' ? 'MIRA LA PANTALLA' : snapshot?.phase === 'podium' ? '¡SE ACABÓ!' : 'LISTO'}</strong>
        <small>${early ? 'Esta ronda ya fue.' : playing && gameId === 'avoid' ? 'EN SERIO. NO.' : playing ? info.hint : 'La acción ocurre allá arriba'}</small>
      </button>`;
    root.innerHTML = `<main class="controller pad ${feedback === 'tap' ? 'pressed' : ''} ${early ? 'too-early' : ''}" style="--player:${me.color}">
      <header><span>${me.shape}</span><b>${escapeHtml(me.name)}</b><em>${connected ? '● EN LÍNEA' : 'RECONECTANDO'}</em></header>
      ${choicePad}
      <footer><span>TUS CHISPAS</span><b>${me.score}</b></footer>
    </main>`;
    root.querySelector('.tap-zone')?.addEventListener('pointerdown', () => tap());
    root.querySelectorAll<HTMLButtonElement>('.choice-grid button').forEach((button) => {
      button.addEventListener('pointerdown', () => tap(Number(button.dataset.value)));
    });
  }

  window.addEventListener('beforeunload', () => socket.close());
  draw();
}

function readSeat(): SavedSeat | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SavedSeat | null;
    return value?.code && value.playerId && value.resumeToken ? value : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}
