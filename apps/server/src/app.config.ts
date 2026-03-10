import type { Request, Response } from 'express';
import { defineRoom, defineServer, monitor, playground } from 'colyseus';
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

    server.get('/api/rooms/:roomCode', (req: Request, res: Response) => {
      const roomCode = String(req.params.roomCode ?? '').toUpperCase();
      const room = roomDirectory.resolve(roomCode);

      if (!room || !room.joinable) {
        res.status(404).json({ message: 'Sala nao encontrada.' });
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
