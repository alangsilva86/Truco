import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger.js';

let prisma: PrismaClient | null = null;
let connectionLogged = false;

function getDatabaseUrl(): string | null {
  const value = String(process.env.DATABASE_URL ?? '').trim();
  return value.length > 0 ? value : null;
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseUrl() !== null;
}

export function getPrismaClient(): PrismaClient {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    logger.warn('db.unconfigured', {});
    return false;
  }

  try {
    const client = getPrismaClient();
    await client.$queryRawUnsafe('SELECT 1');

    if (!connectionLogged) {
      logger.info('db.connected', {});
      connectionLogged = true;
    }

    return true;
  } catch (error) {
    logger.error('db.connection_failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return false;
  }
}
