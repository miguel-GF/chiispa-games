import { describe, expect, it } from 'vitest';
import { applyInput, createBomb, createRound, cutBombWire, publicRound, resolveRound } from './index';

describe('game rounds', () => {
  it('penalizes early reaction taps and accepts the first valid player', () => {
    const round = createRound('reaction', 1, 0, () => 0);
    expect(round.actionAt).toBe(2_200);
    expect(applyInput(round, 'early', { action: 'tap' }, 2_000)).toBe('early');
    expect(applyInput(round, 'winner', { action: 'tap' }, 2_200)).toBe('winner');
    expect(applyInput(round, 'second', { action: 'tap' }, 2_201)).toBe('ignored');
  });

  it('scores mash rounds relative to the busiest player', () => {
    const round = createRound('mash', 1, 0);
    applyInput(round, 'fast', { action: 'tap' }, 1_600);
    applyInput(round, 'fast', { action: 'tap' }, 1_700);
    applyInput(round, 'slow', { action: 'tap' }, 1_600);
    expect(resolveRound(round, ['fast', 'slow'])).toMatchObject({ fast: { score: 100 }, slow: { score: 50 } });
  });

  it('rewards abstaining in avoid rounds', () => {
    const round = createRound('avoid', 1, 0);
    applyInput(round, 'tempted', { action: 'tap' }, 1_600);
    expect(resolveRound(round, ['calm', 'tempted'])).toMatchObject({
      calm: { success: true, score: 100 },
      tempted: { success: false, score: 0 }
    });
  });

  it('keeps raw precision timing private in the public projection', () => {
    const round = createRound('precision', 1, 0);
    applyInput(round, 'player', { action: 'tap' }, 2_000);
    expect(publicRound(round).progress.player).toBe(1);
    expect(JSON.stringify(publicRound(round))).not.toContain('2000');
  });
});

describe('mini bomb', () => {
  it('defuses only when the group cuts the public wires in the secret order', () => {
    const bomb = createBomb(0, () => 0.999);
    expect(cutBombWire(bomb, 'rojo', 2_000)).toBe('correct');
    expect(cutBombWire(bomb, 'azul', 2_100)).toBe('correct');
    expect(cutBombWire(bomb, 'amarillo', 2_200)).toBe('defused');
    expect(bomb.status).toBe('defused');
  });

  it('explodes after two incorrect cuts', () => {
    const bomb = createBomb(0, () => 0.999);
    expect(cutBombWire(bomb, 'azul', 2_000)).toBe('wrong');
    expect(cutBombWire(bomb, 'amarillo', 2_100)).toBe('wrong');
    expect(bomb).toMatchObject({ strikes: 2, status: 'exploded', cutWires: [] });
  });
});
