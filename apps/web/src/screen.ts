import type { RoomSnapshot, ServerMessage } from '@chispa/protocol';
import { GAME_INFO } from '@chispa/game-core';
import QRCode from 'qrcode';
import { createSocket } from './socket';

function playerShape(shape: string): string {
  return ({ círculo: '●', triángulo: '▲', estrella: '★', rombo: '◆', cuadrado: '■', luna: '☾' })[shape] ?? '●';
}

export function renderScreen(root: HTMLElement): void {
  let room: RoomSnapshot | undefined;
  let connected = false;
  let qrSvg = '';
  let clockTimer = 0;

  const socket = createSocket(handleMessage, (status) => {
    connected = status;
    if (status) {
      room = undefined;
      qrSvg = '';
      socket.send({ type: 'screen.createRoom' });
    }
    draw();
  });

  function handleMessage(message: ServerMessage) {
    if (message.type === 'server.error') {
      showToast(message.message);
      return;
    }
    room = message.snapshot;
    if (message.type === 'server.roomCreated') void makeQr(room.code);
    draw();
  }

  async function makeQr(code: string) {
    const url = new URL('/controller', window.location.origin);
    url.searchParams.set('room', code);
    qrSvg = await QRCode.toString(url.toString(), { type: 'svg', margin: 1, color: { dark: '#171511', light: '#fffdf6' } });
    draw();
  }

  function showToast(text: string) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2_500);
  }

  function gameContent(snapshot: RoomSnapshot): string {
    if (snapshot.phase === 'bossCountdown') {
      return `<section class="game-stage bomb-stage"><p class="eyebrow">JEFE COOPERATIVO</p><div class="bomb-icon">💣</div><h2>¡HABLEN!</h2><p>Cada teléfono tiene un pedazo del manual.</p></section>`;
    }
    if ((snapshot.phase === 'bossPlaying' || snapshot.phase === 'bossReveal') && snapshot.bomb) {
      const seconds = Math.max(0, Math.ceil((snapshot.bomb.endsAt - Date.now()) / 1_000));
      const finished = snapshot.phase === 'bossReveal';
      return `<section class="game-stage bomb-stage ${snapshot.bomb.status}">
        <p class="eyebrow">MINI BOMBA · ${snapshot.bomb.strikes}/2 ERRORES</p>
        <div class="bomb-clock">${finished ? snapshot.bomb.status === 'defused' ? '00:00' : 'BOOM' : `00:${String(seconds).padStart(2, '0')}`}</div>
        <div class="screen-wires">${(['rojo', 'azul', 'amarillo'] as const).map((wire) => `<div class="wire ${wire} ${snapshot.bomb?.cutWires.includes(wire) ? 'cut' : ''}"><i></i><b>${wire.toUpperCase()}</b></div>`).join('')}</div>
        <h2>${finished ? snapshot.bomb.status === 'defused' ? '¡SALVADOS!' : '¡BOOM!' : '¡DESACTIVEN!'}</h2>
        <p>${finished ? snapshot.bomb.status === 'defused' ? '+150 para toda la banda' : 'Dos cables equivocados. Fin.' : 'Griten las pistas. Corten desde los celulares.'}</p>
      </section>`;
    }
    if (snapshot.phase === 'podium') {
      const ranking = [...snapshot.players].sort((a, b) => b.score - a.score);
      return `<section class="game-stage podium"><p class="eyebrow">RALLY TERMINADO</p><h2>PODIO</h2><div class="podium-list">${ranking.slice(0, 3).map((player, index) => `<article style="--player:${player.color}"><b>${index + 1}</b><span>${playerShape(player.shape)}</span><strong>${escapeHtml(player.name)}</strong><em>${player.score}</em></article>`).join('')}</div></section>`;
    }
    const gameId = snapshot.gameId ?? 'reaction';
    const info = GAME_INFO[gameId];
    if (snapshot.phase === 'countdown') {
      return `<section class="game-stage countdown"><p class="eyebrow">RONDA ${snapshot.rallyRound} DE ${snapshot.rallyLength}</p><h2>${info.instruction}</h2><p>${info.hint}</p></section>`;
    }
    if (snapshot.phase === 'playing') {
      if (gameId === 'reaction') {
        const waiting = Date.now() < (snapshot.actionAt ?? 0);
        return `<section class="game-stage ${waiting ? 'waiting' : 'go'}"><p class="eyebrow">${waiting ? 'OJOS ABIERTOS' : '¡AHORA!'}</p><div class="target">${waiting ? '…' : '✹'}</div><h2>${waiting ? 'ESPERA' : '¡APLASTA!'}</h2></section>`;
      }
      if (gameId === 'mash') {
        const best = Math.max(1, ...Object.values(snapshot.progress ?? {}));
        return `<section class="game-stage"><p class="eyebrow">SIN PIEDAD</p><h2>¡ATACA!</h2><div class="battle-bars">${snapshot.players.map((player) => `<div style="--player:${player.color};--fill:${Math.round((snapshot.progress?.[player.id] ?? 0) / best * 100)}%"><span>${escapeHtml(player.name)}</span><i></i><b>${snapshot.progress?.[player.id] ?? 0}</b></div>`).join('')}</div></section>`;
      }
      if (gameId === 'precision') {
        const duration = (snapshot.endsAt ?? 1) - (snapshot.startsAt ?? 0);
        const position = Math.max(0, Math.min(100, (Date.now() - (snapshot.startsAt ?? 0)) / duration * 100));
        return `<section class="game-stage"><p class="eyebrow">EN EL CENTRO</p><h2>¡CLAVA!</h2><div class="precision-track"><i style="left:${position}%"></i><b></b></div></section>`;
      }
      if (gameId === 'avoid') return `<section class="game-stage trap"><p class="eyebrow">NO CAIGAS</p><div class="target">🍰</div><h2>¡NI LO TOQUES!</h2></section>`;
      const symbols = ['★', '●', '▲', '◆'];
      return `<section class="game-stage"><p class="eyebrow">ENCUENTRA ESTE</p><div class="target symbol-target">${symbols[snapshot.targetValue ?? 0]}</div><h2>¡ELIGE!</h2></section>`;
    }
    const winner = snapshot.players.find((player) => player.id === snapshot.winnerId);
    const topResult = [...snapshot.players].sort((a, b) => (snapshot.results?.[b.id]?.score ?? 0) - (snapshot.results?.[a.id]?.score ?? 0))[0];
    const featured = winner ?? topResult;
    return `<section class="game-stage reveal">
      <p class="eyebrow">RESULTADOS · RONDA ${snapshot.rallyRound}</p>
      <div class="winner-mark" style="--player:${featured?.color ?? '#171511'}">${featured ? playerShape(featured.shape) : '💨'}</div>
      <h2>${featured ? escapeHtml(featured.name) : 'NADIE'}</h2>
      <div class="result-row">${snapshot.players.map((player) => `<span class="${snapshot.results?.[player.id]?.success ? 'success' : ''}"><b>${escapeHtml(player.name)}</b><em>+${snapshot.results?.[player.id]?.score ?? 0}</em><small>${snapshot.results?.[player.id]?.detail ?? ''}</small></span>`).join('')}</div>
    </section>`;
  }

  function draw() {
    window.clearTimeout(clockTimer);
    if (!room) {
      root.innerHTML = `<main class="screen loading"><div class="logo">CHISPA<span>✦</span></div><p>${connected ? 'Encendiendo la sala…' : 'Buscando señal…'}</p></main>`;
      return;
    }

    const lobby = room.phase === 'lobby';
    const canStart = lobby || room.phase === 'podium';
    root.innerHTML = `<main class="screen">
      <header class="screen-header"><div class="logo">CHISPA<span>✦</span></div><div class="connection ${connected ? 'online' : ''}">${connected ? 'EN VIVO' : 'RECONECTANDO'}</div></header>
      ${lobby ? `<section class="lobby">
        <div class="join-copy"><p class="eyebrow">ENTRA CON TU CELULAR</p><h1>chispa.mx</h1><div class="room-code">${room.code}</div><p class="hint">Escanea o entra con el código</p></div>
        <div class="qr-card">${qrSvg || '<div class="qr-loading">QR</div>'}</div>
      </section>` : gameContent(room)}
      <footer class="player-strip">
        ${room.players.length ? room.players.map((player) => `<article class="player-chip ${player.connected ? '' : 'offline'}" style="--player:${player.color}"><span class="shape">${playerShape(player.shape)}</span><strong>${escapeHtml(player.name)}</strong><b>${player.score}</b></article>`).join('') : '<p class="empty-players">Esperando a la pandilla…</p>'}
      </footer>
      ${canStart ? `<button class="start-button" ${room.players.length === 0 ? 'disabled' : ''}>${room.players.length === 0 ? 'FALTA LA BANDA' : room.phase === 'podium' ? 'OTRO RALLY ⚡' : 'EMPEZAR RALLY ⚡'}</button>` : ''}
    </main>`;
    root.querySelector<HTMLButtonElement>('.start-button')?.addEventListener('click', () => socket.send({ type: 'screen.startRound', code: room!.code }));
    if (room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'bossPlaying') clockTimer = window.setTimeout(draw, 50);
  }

  window.addEventListener('beforeunload', () => socket.close());
  draw();
}

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}
