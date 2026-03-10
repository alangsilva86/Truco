import { ClientStorageSnapshot } from '@truco/contracts';
import { useEffect, useRef, useState } from 'react';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from '../lib/network.js';

export function useRoomSession() {
  const [storedSession, setStoredSession] =
    useState<ClientStorageSnapshot | null>(() => loadStoredSession());
  const [nickname, setNickname] = useState(() => storedSession?.nickname ?? '');
  const sessionRef = useRef<ClientStorageSnapshot | null>(storedSession);

  useEffect(() => {
    sessionRef.current = storedSession;
  }, [storedSession]);

  function persistSession(snapshot: ClientStorageSnapshot): void {
    sessionRef.current = snapshot;
    setStoredSession(snapshot);
    saveStoredSession(snapshot);
  }

  function clearSession(): void {
    sessionRef.current = null;
    setStoredSession(null);
    clearStoredSession();
  }

  return {
    clearSession,
    nickname,
    persistSession,
    sessionRef,
    setNickname,
    storedSession,
  };
}
