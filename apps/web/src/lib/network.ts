import { Client } from '@colyseus/sdk';
import { ClientStorageSnapshot } from '@truco/contracts';

const STORAGE_KEY = 'truco-online-session';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
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
