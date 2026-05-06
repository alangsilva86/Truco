import type { Prisma, RoomParticipant } from '@prisma/client';
import { getPrismaClient } from '../../db/prisma.js';

const roomWithParticipantsInclude = {
  owner: true,
  participants: {
    orderBy: {
      joinedAt: 'asc',
    },
  },
} satisfies Prisma.RoomInclude;

export type RoomWithParticipants = Prisma.RoomGetPayload<{
  include: typeof roomWithParticipantsInclude;
}>;

interface CreateRoomInput {
  maxPlayers: number;
  matchFormat: string;
  ownerNickname: string;
  ownerUserId: string;
  roomCode: string;
}

interface UpsertParticipantInput {
  nickname: string;
  roomId: string;
  sessionId?: string | null;
  status: string;
  team?: number | null;
  seat?: number | null;
  userId: string;
}

export class RoomRepository {
  async createRoom({
    maxPlayers,
    matchFormat,
    ownerNickname,
    ownerUserId,
    roomCode,
  }: CreateRoomInput): Promise<RoomWithParticipants> {
    return getPrismaClient().room.create({
      data: {
        maxPlayers,
        matchFormat,
        ownerUserId,
        roomCode,
        participants: {
          create: {
            nickname: ownerNickname,
            seat: 0,
            status: 'joined',
            team: 0,
            userId: ownerUserId,
          },
        },
      },
      include: roomWithParticipantsInclude,
    });
  }

  async countActiveParticipants(roomId: string): Promise<number> {
    return getPrismaClient().roomParticipant.count({
      where: {
        roomId,
        status: {
          in: ['joined', 'disconnected'],
        },
      },
    });
  }

  async findByCode(roomCode: string): Promise<RoomWithParticipants | null> {
    return getPrismaClient().room.findUnique({
      where: { roomCode },
      include: roomWithParticipantsInclude,
    });
  }

  async findById(roomId: string): Promise<RoomWithParticipants | null> {
    return getPrismaClient().room.findUnique({
      where: { id: roomId },
      include: roomWithParticipantsInclude,
    });
  }

  async listPublicRooms(limit = 20): Promise<RoomWithParticipants[]> {
    return getPrismaClient().room.findMany({
      where: {
        status: 'waiting',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: roomWithParticipantsInclude,
    });
  }

  async listUserRooms(userId: string): Promise<RoomWithParticipants[]> {
    return getPrismaClient().room.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          {
            participants: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: roomWithParticipantsInclude,
    });
  }

  async setColyseusRoomId(roomId: string, colyseusRoomId: string): Promise<void> {
    await getPrismaClient().room.update({
      where: { id: roomId },
      data: {
        colyseusRoomId,
      },
    });
  }

  async setRoomStatus(
    roomId: string,
    status: 'waiting' | 'playing' | 'finished' | 'abandoned',
  ): Promise<void> {
    await getPrismaClient().room.update({
      where: { id: roomId },
      data: {
        finishedAt:
          status === 'finished' || status === 'abandoned' ? new Date() : null,
        startedAt: status === 'playing' ? new Date() : undefined,
        status,
      },
    });
  }

  async touchRoom(roomId: string): Promise<void> {
    await getPrismaClient().room.update({
      where: { id: roomId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  async findParticipant(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipant | null> {
    return getPrismaClient().roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });
  }

  async upsertParticipant({
    nickname,
    roomId,
    sessionId = null,
    status,
    team = null,
    seat = null,
    userId,
  }: UpsertParticipantInput): Promise<RoomParticipant> {
    return getPrismaClient().roomParticipant.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      update: {
        leftAt: status === 'left' ? new Date() : null,
        nickname,
        seat,
        sessionId,
        status,
        team,
      },
      create: {
        leftAt: status === 'left' ? new Date() : null,
        nickname,
        roomId,
        seat,
        sessionId,
        status,
        team,
        userId,
      },
    });
  }
}

export const roomRepository = new RoomRepository();
