import { Client } from '@colyseus/sdk';
import type {
  ClientStorageSnapshot,
  CreateGuestUserInput,
  CreateRoomResponse,
  GuestUserResponse,
  JoinRoomResponse,
  RoomListResponse,
  RoomLookupResponse,
  UserProfile,
} from '@truco/contracts';

const SESSION_STORAGE_KEY = 'truco-online-session';
const USER_STORAGE_KEY = 'truco-online-user';
const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
const DEFAULT_RECONNECT_BUDGET_MS = 55_000;
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

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ServerVersionInfo {
  bootId: string;
  startedAt: string;
  version: string;
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

export async function sendJson<T>(
  path: string,
  init: {
    body?: unknown;
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  },
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      body: init.body ? JSON.stringify(init.body) : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
      method: init.method ?? 'POST',
      signal: controller.signal,
    });
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

export async function createOrUpdateGuestUser(
  input: CreateGuestUserInput,
): Promise<GuestUserResponse> {
  return sendJson<GuestUserResponse>(`${getServerHttpUrl()}/api/users/guest`, {
    body: input,
    method: 'POST',
  });
}

export async function createRoomRequest(input: {
  maxPlayers?: number;
  nickname: string;
  ownerUserId: string;
}): Promise<CreateRoomResponse> {
  return sendJson<CreateRoomResponse>(`${getServerHttpUrl()}/api/rooms`, {
    body: input,
    method: 'POST',
  });
}

export async function lookupRoom(
  roomCode: string,
): Promise<RoomLookupResponse> {
  return fetchJson<RoomLookupResponse>(
    `${getServerHttpUrl()}/api/rooms/${roomCode.trim().toUpperCase()}`,
  );
}

export async function joinRoomRequest(input: {
  nickname: string;
  roomCode: string;
  userId: string;
}): Promise<JoinRoomResponse> {
  return sendJson<JoinRoomResponse>(
    `${getServerHttpUrl()}/api/rooms/${input.roomCode.trim().toUpperCase()}/join`,
    {
      body: {
        nickname: input.nickname,
        userId: input.userId,
      },
      method: 'POST',
    },
  );
}

export async function fetchUserRooms(userId: string): Promise<RoomListResponse> {
  return fetchJson<RoomListResponse>(
    `${getServerHttpUrl()}/api/users/${userId}/rooms`,
  );
}

export async function fetchPublicRooms(): Promise<RoomListResponse> {
  return fetchJson<RoomListResponse>(`${getServerHttpUrl()}/api/rooms`);
}

export async function fetchUser(userId: string): Promise<{
  ok: true;
  user: UserProfile;
}> {
  return fetchJson<{ ok: true; user: UserProfile }>(
    `${getServerHttpUrl()}/api/users/${userId}`,
  );
}

export async function fetchServerVersion(): Promise<ServerVersionInfo> {
  return fetchJson<ServerVersionInfo>(`${getServerHttpUrl()}/version`);
}

export function getClientReconnectBudgetMs(): number {
  return parsePositiveInteger(
    import.meta.env.VITE_CLIENT_RECONNECT_BUDGET_MS,
    DEFAULT_RECONNECT_BUDGET_MS,
  );
}

export function getDefaultRoomTimeoutMs(): number {
  return DEFAULT_ROOM_TIMEOUT_MS;
}

export function loadStoredSession(): ClientStorageSnapshot | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
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
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function loadStoredUser(): UserProfile | null {
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: UserProfile): void {
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
