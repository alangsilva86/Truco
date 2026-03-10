import { Client } from '@colyseus/sdk';
import { ClientStorageSnapshot } from '@truco/contracts';

const STORAGE_KEY = 'truco-online-session';
const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
const DEFAULT_ROOM_TIMEOUT_MS = 6_000;

interface RetryOptions {
  attempts: number;
  initialDelayMs: number;
  label: string;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getServerHttpUrl(): string {
  const configuredUrl = import.meta.env.VITE_SERVER_HTTP_URL;
  return configuredUrl ? trimTrailingSlash(configuredUrl) : '';
}

export function getServerWsUrl(): string {
  const configuredUrl = import.meta.env.VITE_SERVER_WS_URL;
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:2567`;
}

export function createColyseusClient(): Client {
  return new Client(getServerWsUrl());
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} excedeu o limite de ${timeoutMs}ms.`));
    }, timeoutMs);

    void operation()
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let delayMs = options.initialDelayMs;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) {
        break;
      }

      await delay(delayMs);
      delayMs *= 2;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${options.label} falhou apos ${options.attempts} tentativas.`);
}

export async function fetchJson<T>(
  path: string,
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw Object.assign(new Error('HTTP request failed.'), {
        body,
        status: response.status,
      });
    }

    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Requisicao excedeu o limite de ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function lookupRoom(
  roomCode: string,
): Promise<{ roomId: string }> {
  return fetchJson<{ roomId: string }>(
    `${getServerHttpUrl()}/api/rooms/${roomCode.trim().toUpperCase()}`,
  );
}

export function getDefaultRoomTimeoutMs(): number {
  return DEFAULT_ROOM_TIMEOUT_MS;
}

export function loadStoredSession(): ClientStorageSnapshot | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ClientStorageSnapshot;
  } catch {
    return null;
  }
}

export function saveStoredSession(snapshot: ClientStorageSnapshot): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
