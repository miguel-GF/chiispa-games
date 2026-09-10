import { z } from 'zod';
import type { BombWire, GameId, PlayerResult } from '@chispa/game-core';

export const PLAYER_COLORS = ['#ff5d4a', '#ffbf2f', '#26d7a0', '#43a5ff', '#b56cff', '#ff70b8'] as const;
export const PLAYER_SHAPES = ['círculo', 'triángulo', 'estrella', 'rombo', 'cuadrado', 'luna'] as const;

export type RoomPhase =
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'reveal'
  | 'bossCountdown'
  | 'bossPlaying'
  | 'bossReveal'
  | 'podium';

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  shape: string;
  score: number;
  connected: boolean;
  ready: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  players: PlayerView[];
  roundId: number;
  rallyRound: number;
  rallyLength: number;
  gameId?: GameId;
  startsAt?: number;
  endsAt?: number;
  actionAt?: number;
  winnerId?: string;
  earlyPlayerIds?: string[];
  progress?: Record<string, number>;
  targetValue?: number;
  results?: Record<string, PlayerResult>;
  bomb?: {
    startsAt: number;
    endsAt: number;
    cutWires: BombWire[];
    strikes: number;
    status: 'playing' | 'defused' | 'exploded';
  };
  privateHint?: string;
}

const name = z.string().trim().min(1).max(16);
const token = z.string().min(16).max(128);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('screen.createRoom') }),
  z.object({ type: z.literal('screen.startRound'), code: z.string().length(4) }),
  z.object({ type: z.literal('controller.join'), code: z.string().length(4), name }),
  z.object({ type: z.literal('controller.resume'), code: z.string().length(4), resumeToken: token }),
  z.object({ type: z.literal('controller.ready'), code: z.string().length(4), resumeToken: token }),
  z.object({
    type: z.literal('controller.bombCut'),
    code: z.string().length(4),
    resumeToken: token,
    wire: z.enum(['rojo', 'azul', 'amarillo'])
  }),
  z.object({
    type: z.literal('controller.input'),
    code: z.string().length(4),
    resumeToken: token,
    roundId: z.number().int().nonnegative(),
    input: z.literal('tap'),
    value: z.number().int().min(0).max(3).optional(),
    clientTime: z.number().finite()
  })
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { type: 'server.roomCreated'; snapshot: RoomSnapshot }
  | { type: 'server.joined'; playerId: string; resumeToken: string; snapshot: RoomSnapshot }
  | { type: 'server.resumed'; playerId: string; resumeToken: string; snapshot: RoomSnapshot }
  | { type: 'server.roomSnapshot'; snapshot: RoomSnapshot }
  | { type: 'server.error'; code: string; message: string };

export function parseClientMessage(value: unknown): ClientMessage | null {
  const result = clientMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}
