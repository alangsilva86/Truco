import { useEffect, useState } from 'react';

function normalizeRoomCode(rawRoomCode: string): string {
  return rawRoomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function readRouteRoomCode(): string | null {
  const match = window.location.pathname.match(/^\/sala\/([^/]+)$/i);
  if (!match) {
    return null;
  }

  const roomCode = normalizeRoomCode(match[1]);
  return roomCode.length > 0 ? roomCode : null;
}

export function useRoomRoute() {
  const [routeRoomCode, setRouteRoomCode] = useState<string | null>(() =>
    readRouteRoomCode(),
  );

  useEffect(() => {
    function handlePopState() {
      setRouteRoomCode(readRouteRoomCode());
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigateToLobby(): void {
    window.history.pushState({}, '', '/');
    setRouteRoomCode(null);
  }

  function navigateToRoom(roomCode: string): void {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    window.history.pushState({}, '', `/sala/${normalizedRoomCode}`);
    setRouteRoomCode(normalizedRoomCode);
  }

  return {
    navigateToLobby,
    navigateToRoom,
    routeRoomCode,
  };
}
