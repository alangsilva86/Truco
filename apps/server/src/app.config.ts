import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import {
  defineRoom,
  defineServer,
  monitor,
  playground,
} from 'colyseus';
import { ApiError, isApiError } from './modules/http/apiError.js';
import { createMemoryRateLimiter } from './modules/http/rateLimit.js';
import { roomService } from './modules/rooms/room.service.js';
import { userRepository } from './modules/users/user.repository.js';
import { checkDatabaseConnection } from './db/prisma.js';
import { getRedisUri, serverRuntime } from './config/runtime.js';
import { logger } from './observability/logger.js';
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

const redisUri = getRedisUri();
const createUserRateLimit = createMemoryRateLimiter({
  limit: 8,
  windowMs: 60_000,
});
const createRoomRateLimit = createMemoryRateLimiter({
  limit: 12,
  windowMs: 60_000,
});
const joinRoomRateLimit = createMemoryRateLimiter({
  limit: 20,
  windowMs: 60_000,
});

void checkDatabaseConnection();
logger.info('server.boot', {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  redisEnabled: Boolean(redisUri),
  version: serverRuntime.version,
});

function sendFailure(res: Response, error: unknown): void {
  if (isApiError(error)) {
    res.status(error.statusCode).json(error.payload);
    return;
  }

  logger.error('http.unhandled_error', {
    message: error instanceof Error ? error.message : 'unknown error',
  });
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Nao foi possivel concluir a operacao.',
  });
}

function getLookupStatusCode(reason: string): number {
  if (reason === 'ROOM_NOT_FOUND') {
    return 404;
  }

  if (reason === 'ROOM_FINISHED') {
    return 410;
  }

  return 409;
}

const app = defineServer({
  ...(redisUri
    ? {
        driver: new RedisDriver(redisUri),
        presence: new RedisPresence(redisUri),
      }
    : {}),
  rooms: {
    truco_room: defineRoom(TrucoRoom),
  },
  express: (server) => {
    server.set('trust proxy', true);
    server.use(express.json());
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
      res.json({
        version: serverRuntime.version,
        bootId: serverRuntime.bootId,
        startedAt: serverRuntime.startedAt,
      });
    });

    server.get('/metrics', async (_req: Request, res: Response) => {
      try {
        const rooms = await listTrucoRooms();
        res.json(serverMetrics.snapshot(rooms));
      } catch (error) {
        sendFailure(res, error);
      }
    });

    server.post(
      '/api/users/guest',
      createUserRateLimit,
      async (req: Request, res: Response) => {
        try {
          const payload = await roomService.createGuestUser({
            avatarUrl: req.body?.avatarUrl,
            nickname: req.body?.nickname,
            userId: req.body?.userId,
          });

          res.status(200).json(payload);
        } catch (error) {
          sendFailure(res, error);
        }
      },
    );

    server.get('/api/users/:userId', async (req: Request, res: Response) => {
      try {
        const payload = await roomService.getUser(String(req.params.userId ?? ''));
        res.json(payload);
      } catch (error) {
        sendFailure(res, error);
      }
    });

    server.get(
      '/api/users/:userId/rooms',
      async (req: Request, res: Response) => {
        try {
          const payload = await roomService.listUserRooms(
            String(req.params.userId ?? ''),
          );
          res.json(payload);
        } catch (error) {
          sendFailure(res, error);
        }
      },
    );

    server.get('/api/rooms', async (_req: Request, res: Response) => {
      try {
        const payload = await roomService.listPublicRooms();
        res.json(payload);
      } catch (error) {
        sendFailure(res, error);
      }
    });

    server.post('/api/rooms', createRoomRateLimit, async (req: Request, res: Response) => {
      try {
        const ownerUserId = String(req.body?.ownerUserId ?? '').trim();
        if (!ownerUserId) {
          throw new ApiError(400, {
            error: 'VALIDATION_ERROR',
            message: 'ownerUserId e obrigatorio.',
          });
        }

        const owner = await userRepository.findById(ownerUserId);
        const payload = await roomService.createRoom({
          maxPlayers:
            typeof req.body?.maxPlayers === 'number'
              ? req.body.maxPlayers
              : undefined,
          nickname: String(req.body?.nickname ?? owner?.nickname ?? ''),
          ownerUserId,
          requestOrigin: req.get('origin') ?? req.get('referer') ?? undefined,
        });

        res.status(201).json(payload);
      } catch (error) {
        sendFailure(res, error);
      }
    });

    server.get('/api/rooms/:roomCode', async (req: Request, res: Response) => {
      try {
        const payload = await roomService.lookupRoom(
          String(req.params.roomCode ?? ''),
        );
        if (!payload.ok) {
          res.status(getLookupStatusCode(payload.reason)).json({
            ...payload,
            message: payload.reason,
          });
          return;
        }

        res.json(payload);
      } catch (error) {
        if (isApiError(error) && error.statusCode === 503) {
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
                res.status(410).json({
                  error: 'CLOSED',
                  message: 'Esta sala foi encerrada.',
                });
                return;
              }

              res.status(409).json({
                error: 'LOCKED',
                message: 'Esta sala ja esta cheia ou em andamento.',
              });
              return;
            }

            res.json({
              roomId: room.roomId,
              roomCode: room.roomCode,
            });
            return;
          } catch (legacyError) {
            sendFailure(res, legacyError);
            return;
          }
        }

        sendFailure(res, error);
      }
    });

    server.post(
      '/api/rooms/:roomCode/join',
      joinRoomRateLimit,
      async (req: Request, res: Response) => {
        try {
          const payload = await roomService.joinRoom({
            nickname: String(req.body?.nickname ?? ''),
            roomCode: String(req.params.roomCode ?? ''),
            userId: String(req.body?.userId ?? ''),
          });
          res.json(payload);
        } catch (error) {
          sendFailure(res, error);
        }
      }
    );

    server.use('/monitor', monitor());

    if (process.env.NODE_ENV !== 'production') {
      server.use('/', playground());
    }
  },
});

export default app;
