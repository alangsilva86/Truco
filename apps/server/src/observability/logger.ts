import { serverRuntime } from '../config/runtime.js';

type LogLevel = 'info' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
  error: 3,
  info: 1,
  warn: 2,
};

function getConfiguredLevel(): LogLevel {
  const rawLevel = String(process.env.LOG_LEVEL ?? 'info')
    .trim()
    .toLowerCase();

  if (rawLevel === 'warn' || rawLevel === 'error') {
    return rawLevel;
  }

  return 'info';
}

function write(
  level: LogLevel,
  event: string,
  data: Record<string, unknown>,
): void {
  const configuredLevel = getConfiguredLevel();
  if (levelPriority[level] < levelPriority[configuredLevel]) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    bootId: serverRuntime.bootId,
    level,
    event,
    ...data,
  };

  const message = JSON.stringify(payload);
  if (level === 'error') {
    console.error(message);
    return;
  }

  if (level === 'warn') {
    console.warn(message);
    return;
  }

  console.info(message);
}

export const logger = {
  error(event: string, data: Record<string, unknown> = {}): void {
    write('error', event, data);
  },
  info(event: string, data: Record<string, unknown> = {}): void {
    write('info', event, data);
  },
  warn(event: string, data: Record<string, unknown> = {}): void {
    write('warn', event, data);
  },
};
