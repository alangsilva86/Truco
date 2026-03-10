import type { NextFunction, Request, Response } from 'express';
import {
  defineRoom,
  defineServer,
  monitor,
  playground,
} from 'colyseus';
import { serverMetrics } from './observability/metrics.js';
import {
  findTrucoRoomByCode,
  listTrucoRooms,
} from './services/matchmakingRooms.js';
import { TrucoRoom } from './rooms/TrucoRoom.js';

const DEFAULT_ALLOWED_ORIGINS = [
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOriginPattern(pattern: string): RegExp {
  return new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`, 'i');
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  const configuredOrigins = String(process.env.TRUCO_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(parseOriginPattern);

  return [...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins].some((pattern) =>
    pattern.test(origin),
  );
}

const app = defineServer({
  rooms: {
    truco_room: defineRoom(TrucoRoom),
  },
  express: (server) => {
    server.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      if (isAllowedOrigin(origin)) {
        if (origin) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Vary', 'Origin');
        }

        res.header(
          'Access-Control-Allow-Methods',
          'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        );
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept',
        );
      }

      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }

      next();
    });

    server.get('/health', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    server.get('/version', (_req: Request, res: Response) => {
      res.json({ version: '1.0.0' });
    });

    server.get('/metrics', async (_req: Request, res: Response) => {
      try {
        const rooms = await listTrucoRooms();
        res.json(serverMetrics.snapshot(rooms));
      } catch {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Nao foi possivel listar as salas.',
        });
      }
    });

    server.get('/api/rooms/:roomCode', async (req: Request, res: Response) => {
      try {
        const roomCode = String(req.params.roomCode ?? '').toUpperCase();
        const room = await findTrucoRoomByCode(roomCode);

        if (!room) {
          res.status(404).json({
            error: 'NOT_FOUND',
            message: 'Sala nao encontrada ou expirada.',
          });
          return;
        }

        if (!room.joinable) {
          if (room.lifecycle === 'CLOSED') {
            res
              .status(410)
              .json({ error: 'CLOSED', message: 'Esta sala foi encerrada.' });
          } else {
            res.status(409).json({
              error: 'LOCKED',
              message: 'Esta sala ja esta cheia ou em andamento.',
            });
          }
          return;
        }

        res.json({
          roomId: room.roomId,
          roomCode: room.roomCode,
        });
      } catch {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Nao foi possivel resolver a sala.',
        });
      }
    });

    server.use('/monitor', monitor());

    if (process.env.NODE_ENV !== 'production') {
      server.use('/', playground());
    }
  },
});

export default app;
