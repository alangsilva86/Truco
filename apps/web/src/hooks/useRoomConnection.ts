import { Room } from '@colyseus/sdk';
import {
  ClientGameView,
  ClientMatchEvent,
  ClientStorageSnapshot,
  GameCommand,
  getTeamForSeat,
} from '@truco/contracts';
import {
  RefObject,
  startTransition,
  useEffect,
  useRef,
  useState,
} from 'react';
import { describeEvent } from '../lib/matchEvents.js';
import {
  createColyseusClient,
  getDefaultRoomTimeoutMs,
  lookupRoom,
  retryWithBackoff,
  withTimeout,
} from '../lib/network.js';

interface UseRoomConnectionOptions {
  clearSession: () => void;
  nickname: string;
  persistSession: (snapshot: ClientStorageSnapshot) => void;
  sessionRef: RefObject<ClientStorageSnapshot | null>;
}

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function getJoinRoomError(caught: unknown): string {
  if (caught && typeof caught === 'object' && 'body' in caught) {
    const body = (caught as { body?: { error?: string } }).body;
    if (body?.error === 'NOT_FOUND') {
      return 'Sala nao encontrada ou expirada.';
    }

    if (body?.error === 'CLOSED') {
      return 'Esta sala foi encerrada.';
    }

    if (body?.error === 'LOCKED') {
      return 'Esta sala ja esta cheia ou em andamento.';
    }
  }

  return getErrorMessage(caught, 'Falha ao entrar na sala.');
}

export function useRoomConnection({
  clearSession,
  nickname,
  persistSession,
  sessionRef,
}: UseRoomConnectionOptions) {
  const [view, setView] = useState<ClientGameView | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [commandPending, setCommandPending] = useState(false);

  const connectionStateRef = useRef<ConnectionState>('disconnected');
  const playersRef = useRef<ClientGameView['players'] | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    setView((current) => (current ? { ...current, connectionState } : current));
  }, [connectionState]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeoutId = window.setTimeout(() => setError(null), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  async function attachRoom(
    room: Room,
    fallbackNickname: string,
  ): Promise<void> {
    roomRef.current = room;
    room.reconnection.minUptime = 0;
    room.reconnection.maxRetries = 6;
    room.reconnection.minDelay = 200;
    room.reconnection.maxDelay = 2_000;
    setBusy(false);
    setCommandPending(false);
    setConnectionState('connected');
    setError(null);
    setLogs([]);

    room.onMessage('game_view', (incomingView: ClientGameView) => {
      startTransition(() => {
        const nextView = {
          ...incomingView,
          connectionState: connectionStateRef.current,
        };

        playersRef.current = nextView.players;
        persistSession({
          nickname: fallbackNickname,
          roomCode: nextView.roomCode,
          roomId: room.roomId,
          ownedSeatIds: nextView.ownedSeatIds,
          viewerTeamId: getTeamForSeat(nextView.ownedSeatIds[0]),
          reconnectionToken: room.reconnectionToken,
          sessionId: room.sessionId,
        });
        setCommandPending(false);
        setView(nextView);
      });
    });

    room.onMessage('match_event', (event: ClientMatchEvent) => {
      setLogs((current) =>
        [
          describeEvent(event, playersRef.current ?? undefined),
          ...current,
        ].slice(0, 12),
      );
    });

    room.onMessage('command_rejected', (payload: { message?: string }) => {
      setCommandPending(false);
      setError(String(payload.message ?? 'Comando rejeitado pelo servidor.'));
    });

    room.onLeave(() => {
      setConnectionState('disconnected');
    });

    room.onDrop(() => {
      setConnectionState('reconnecting');
    });

    room.onReconnect(() => {
      setConnectionState('connected');
      room.send('bootstrap');
    });

    room.send('bootstrap');
  }

  async function createRoom(): Promise<void> {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Informe um apelido antes de criar a sala.');
      return;
    }

    clearSession();
    setBusy(true);
    setError(null);

    try {
      const room = await withTimeout(
        () =>
          createColyseusClient().create('truco_room', {
            nickname: trimmedNickname,
          }),
        getDefaultRoomTimeoutMs(),
        'Criacao da sala',
      );
      await attachRoom(room, trimmedNickname);
    } catch (caught) {
      setBusy(false);
      setError(getErrorMessage(caught, 'Falha ao criar a sala.'));
    }
  }

  async function joinRoom(roomCode: string): Promise<void> {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Informe um apelido antes de entrar.');
      return;
    }

    if (!roomCode.trim()) {
      setError('Informe o codigo da sala.');
      return;
    }

    clearSession();
    setBusy(true);
    setError(null);

    try {
      const { roomId } = await lookupRoom(roomCode);
      const room = await withTimeout(
        () =>
          createColyseusClient().joinById(roomId, {
            nickname: trimmedNickname,
          }),
        getDefaultRoomTimeoutMs(),
        'Entrada na sala',
      );
      await attachRoom(room, trimmedNickname);
    } catch (caught) {
      setBusy(false);
      setError(getJoinRoomError(caught));
    }
  }

  async function reconnect(reconnectionToken: string): Promise<void> {
    setBusy(true);
    setConnectionState('reconnecting');

    try {
      const room = await retryWithBackoff(
        (attempt) =>
          withTimeout(
            () => createColyseusClient().reconnect(reconnectionToken),
            getDefaultRoomTimeoutMs() + attempt * 500,
            'Reconexao da sala',
          ),
        {
          attempts: 3,
          initialDelayMs: 300,
          label: 'Reconexao',
        },
      );

      await attachRoom(
        room,
        sessionRef.current?.nickname ?? (nickname.trim() || 'Jogador'),
      );
    } catch {
      setBusy(false);
      setConnectionState('disconnected');
      clearSession();
      roomRef.current = null;
      playersRef.current = null;
      setLogs([]);
      setError(
        'Sua sessao expirou ou foi invalidada. Entre novamente pelo codigo da sala.',
      );
      setView(null);
    }
  }

  function sendCommand(command: GameCommand): void {
    setCommandPending(true);
    roomRef.current?.send('command', command);
  }

  function leaveSession(): void {
    clearSession();
    roomRef.current?.leave();
    roomRef.current = null;
    playersRef.current = null;
    setBusy(false);
    setCommandPending(false);
    setConnectionState('disconnected');
    setError(null);
    setLogs([]);
    setView(null);
  }

  return {
    busy,
    commandPending,
    connectionState,
    createRoom,
    dismissError: () => setError(null),
    error,
    joinRoom,
    leaveSession,
    logs,
    reportError: (message: string) => setError(message),
    reconnect,
    sendCommand,
    view,
  };
}
