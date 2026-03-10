type LogLevel = 'info' | 'warn' | 'error';

function write(
  level: LogLevel,
  event: string,
  data: Record<string, unknown>,
): void {
  const payload = {
    ts: new Date().toISOString(),
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
