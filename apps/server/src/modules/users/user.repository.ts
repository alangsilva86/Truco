import type { User } from '@prisma/client';
import { getPrismaClient } from '../../db/prisma.js';

interface UpsertGuestUserInput {
  avatarUrl?: string | null;
  nickname: string;
  userId?: string;
}

export class UserRepository {
  async findById(userId: string): Promise<User | null> {
    return getPrismaClient().user.findUnique({
      where: { id: userId },
    });
  }

  async touch(userId: string): Promise<void> {
    await getPrismaClient().user.update({
      where: { id: userId },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  async upsertGuestUser({
    avatarUrl = null,
    nickname,
    userId,
  }: UpsertGuestUserInput): Promise<User> {
    const now = new Date();

    if (userId) {
      return getPrismaClient().user.upsert({
        where: { id: userId },
        update: {
          avatarUrl,
          isGuest: true,
          lastSeenAt: now,
          nickname,
        },
        create: {
          avatarUrl,
          id: userId,
          isGuest: true,
          lastSeenAt: now,
          nickname,
        },
      });
    }

    return getPrismaClient().user.create({
      data: {
        avatarUrl,
        isGuest: true,
        lastSeenAt: now,
        nickname,
      },
    });
  }
}

export const userRepository = new UserRepository();
