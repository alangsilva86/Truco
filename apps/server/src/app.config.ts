import type { Request, Response } from 'express';
import { defineRoom, defineServer, monitor, playground } from 'colyseus';
import { serverMetrics } from './observability/metrics.js';
import { roomDirectory } from './services/roomDirectory.js';
import { TrucoRoom } from './rooms/TrucoRoom.js';

const app = defineServer({
  rooms: {
    truco_room: defineRoom(TrucoRoom),
  },
  express: (server) => {
    server.get('/health', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    server.get('/version', (_req: Request, res: Response) => {
      res.json({ version: '1.0.0' });
    });

    server.get('/metrics', (_req: Request, res: Response) => {
      res.json(serverMetrics.snapshot());
    });

    server.get('/api/rooms/:roomCode', (req: Request, res: Response) => {
      const roomCode = String(req.params.roomCode ?? '').toUpperCase();
      const room = roomDirectory.resolve(roomCode);

      if (!room) {
        res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Sala nao encontrada.' });
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
    });

    server.use('/monitor', monitor());

    if (process.env.NODE_ENV !== 'production') {
      server.use('/', playground());
    }
  },
});

export default app;
