import { randomUUID } from 'node:crypto';

const DEFAULT_RECONNECT_WINDOW_SECONDS = 60;
const DEFAULT_SERVER_VERSION = '1.0.0';

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfiguredRedisUri(): string | null {
  const value = String(process.env.REDIS_URI ?? '').trim();
  return value.length > 0 ? value : null;
}

export const serverRuntime = {
  bootId: randomUUID(),
  startedAt: new Date().toISOString(),
  version: process.env.npm_package_version ?? DEFAULT_SERVER_VERSION,
};

export function getReconnectWindowSeconds(): number {
  return parsePositiveInteger(
    process.env.RECONNECT_WINDOW_SECONDS,
    DEFAULT_RECONNECT_WINDOW_SECONDS,
  );
}

export function getRedisUri(): string | null {
  return getConfiguredRedisUri();
}

export function isRedisEnabled(): boolean {
  return getConfiguredRedisUri() !== null;
}
