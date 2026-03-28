export type ReconnectPhase =
  | 'idle'
  | 'transport_reconnecting'
  | 'session_recovering'
  | 'offline'
  | 'terminal_failure';

export type ReconnectStrategy = 'native' | 'supervisor';

export type ReconnectFailureReason =
  | 'offline'
  | 'server_unavailable'
  | 'transport_timeout'
  | 'boot_changed'
  | 'token_invalid'
  | 'room_closed'
  | 'room_not_found'
  | 'unknown';

export interface ReconnectStatus {
  attempts: number;
  lastFailureReason: ReconnectFailureReason | null;
  message: string | null;
  nextRetryAt: number | null;
  phase: ReconnectPhase;
  startedAt: number | null;
  strategy: ReconnectStrategy | null;
}

function getBodyError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('body' in error)) {
    return null;
  }

  const body = (error as { body?: { error?: unknown } }).body;
  return typeof body?.error === 'string' ? body.error : null;
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function createIdleReconnectStatus(): ReconnectStatus {
  return {
    attempts: 0,
    lastFailureReason: null,
    message: null,
    nextRetryAt: null,
    phase: 'idle',
    startedAt: null,
    strategy: null,
  };
}

export function classifyReconnectError(error: unknown): {
  reason: ReconnectFailureReason;
  terminal: boolean;
} {
  const bodyError = getBodyError(error);
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error ?? '').toLowerCase();

  if (bodyError === 'CLOSED') {
    return { reason: 'room_closed', terminal: true };
  }

  if (bodyError === 'NOT_FOUND') {
    return { reason: 'room_not_found', terminal: true };
  }

  if (
    includesAny(message, [
      'expired',
      'invalid',
      'reconnection token',
      'session expired',
      'token',
    ])
  ) {
    return { reason: 'token_invalid', terminal: true };
  }

  if (includesAny(message, ['room closed', 'encerrada'])) {
    return { reason: 'room_closed', terminal: true };
  }

  if (includesAny(message, ['not found', 'nao encontrada', 'não encontrada'])) {
    return { reason: 'room_not_found', terminal: true };
  }

  if (
    includesAny(message, [
      'timeout',
      'limite',
      'abort',
      'aborted',
      'timed out',
    ])
  ) {
    return { reason: 'transport_timeout', terminal: false };
  }

  if (
    includesAny(message, [
      'network',
      'fetch',
      'socket',
      'econnrefused',
      'closed before the connection is established',
      'failed to connect',
    ])
  ) {
    return { reason: 'server_unavailable', terminal: false };
  }

  return { reason: 'unknown', terminal: false };
}

export function getReconnectBackoffDelayMs(attempt: number): number {
  if (attempt <= 1) {
    return 500;
  }

  return Math.min(500 * 2 ** (attempt - 1), 3_000);
}

export function isNavigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export function getReconnectMessage(
  phase: ReconnectPhase,
  reason: ReconnectFailureReason | null,
): string {
  if (phase === 'transport_reconnecting') {
    return 'Reconectando o transporte realtime...';
  }

  if (phase === 'offline' || reason === 'offline') {
    return 'Voce esta offline. Assim que a conexao voltar, vamos retomar a tentativa.';
  }

  switch (reason) {
    case 'boot_changed':
      return 'O servidor reiniciou durante a reconexao. Esta partida nao pode ser retomada nesta sessao.';
    case 'token_invalid':
      return 'Sua sessao expirou ou foi invalidada. Entre novamente pelo codigo da sala.';
    case 'room_closed':
      return 'A sala foi encerrada. Entre novamente pelo codigo da sala.';
    case 'room_not_found':
      return 'A sala nao foi encontrada ou expirou.';
    case 'transport_timeout':
      return 'A reconexao excedeu o tempo esperado. Seguiremos tentando dentro da janela de recuperacao.';
    case 'server_unavailable':
      return 'O backend ainda nao respondeu. Seguiremos tentando enquanto a janela de recuperacao estiver aberta.';
    case 'unknown':
      return 'A reconexao falhou temporariamente. Vamos continuar tentando.';
    default:
      return 'Recuperando sua sessao da mesa...';
  }
}
