import { ClientStorageSnapshot, UserProfile } from '@truco/contracts';
import { useEffect, useRef, useState } from 'react';
import {
  clearStoredSession,
  clearStoredUser,
  loadStoredSession,
  loadStoredUser,
  saveStoredSession,
  saveStoredUser,
} from '../lib/network.js';

export function useRoomSession() {
  const [storedSession, setStoredSession] =
    useState<ClientStorageSnapshot | null>(() => loadStoredSession());
  const [storedUser, setStoredUser] = useState<UserProfile | null>(() =>
    loadStoredUser(),
  );
  const [nickname, setNickname] = useState(
    () => storedUser?.nickname ?? storedSession?.nickname ?? '',
  );
  const sessionRef = useRef<ClientStorageSnapshot | null>(storedSession);
  const userRef = useRef<UserProfile | null>(storedUser);

  useEffect(() => {
    sessionRef.current = storedSession;
  }, [storedSession]);

  useEffect(() => {
    userRef.current = storedUser;
  }, [storedUser]);

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

  function persistUser(user: UserProfile): void {
    userRef.current = user;
    setStoredUser(user);
    setNickname(user.nickname);
    saveStoredUser(user);
  }

  function clearUser(): void {
    userRef.current = null;
    setStoredUser(null);
    clearStoredUser();
  }

  return {
    clearSession,
    clearUser,
    nickname,
    persistSession,
    persistUser,
    sessionRef,
    setNickname,
    storedSession,
    storedUser,
    userRef,
  };
}
