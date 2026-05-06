import { Room } from '@colyseus/sdk';
import {
  ChatBubble,
  ClientGameView,
  ClientMatchEvent,
  ClientStorageSnapshot,
  GameCommand,
  REACTION_PHRASES,
  SeatId,
  UserProfile,
  getTeamForSeat,
} from '@truco/contracts';
import type { ConnectionState } from '@truco/contracts';
import { RefObject, startTransition, useEffect, useRef, useState } from 'react';
import { describeEvent } from '../lib/matchEvents.js';
import {
  createOrUpdateGuestUser,
  createColyseusClient,
  createRoomRequest,
  fetchServerVersion,
  getClientReconnectBudgetMs,
  getDefaultRoomTimeoutMs,
  joinRoomRequest,
  withTimeout,
} from '../lib/network.js';
import type { ServerVersionInfo } from '../lib/network.js';
import {
  classifyReconnectError,
  createIdleReconnectStatus,
  getReconnectBackoffDelayMs,
  getReconnectMessage,
  isNavigatorOnline,
} from '../lib/reconnect.js';
import type {
  ReconnectFailureReason,
  ReconnectStatus,
  ReconnectStrategy,
} from '../lib/reconnect.js';

interface UseRoomConnectionOptions {
  clearSession: () => void;
  nickname: string;
  persistSession: (snapshot: ClientStorageSnapshot) => void;
  persistUser: (user: UserProfile) => void;
  sessionRef: RefObject<ClientStorageSnapshot | null>;
  userRef: RefObject<UserProfile | null>;
}

interface RecoverySnapshot {
  bootIdAtDrop: string | null;
  reconnectionToken: string;
  startedAt: number;
}

interface RecoveryRunOptions {
  fallbackNickname: string;
  manual: boolean;
  preserveViewOnFailure: boolean;
}

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function getJoinRoomError(caught: unknown): string {
  if (caught && typeof caught === 'object' && 'body' in caught) {
    const body = (caught as {
      body?: { message?: string; reason?: string };
    }).body;
    if (typeof body?.message === 'string' && body.message.length > 0) {
      return body.message;
    }

    if (body?.reason === 'ROOM_NOT_FOUND') {
      return 'Nao encontramos essa sala. Confira o codigo ou peca um novo link para quem criou a sala.';
    }
  }

  return getErrorMessage(caught, 'Falha ao entrar na sala.');
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function logReconnectEvent(
  event: string,
  data: Record<string, unknown> = {},
): void {
  console.info(
    `[truco.reconnect] ${JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data,
    })}`,
  );
}

export function useRoomConnection({
  clearSession,
  nickname,
  persistSession,
  persistUser,
  sessionRef,
  userRef,
}: UseRoomConnectionOptions) {
  const [view, setView] = useState<ClientGameView | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [commandPending, setCommandPending] = useState(false);
  const [patoTauntCount, setPatoTauntCount] = useState(0);
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);
  const [reconnectStatus, setReconnectStatus] = useState<ReconnectStatus>(() =>
    createIdleReconnectStatus(),
  );

  const connectionStateRef = useRef<ConnectionState>('disconnected');
  const playersRef = useRef<ClientGameView['players'] | null>(null);
  const reconnectStatusRef = useRef<ReconnectStatus>(createIdleReconnectStatus());
  const roomRef = useRef<Room | null>(null);
  const viewRef = useRef<ClientGameView | null>(null);
  const recoveryRunIdRef = useRef(0);
  const dropSnapshotRef = useRef<RecoverySnapshot | null>(null);
  const intentionalLeaveRef = useRef(false);
  const serverVersionRef = useRef<ServerVersionInfo | null>(null);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    reconnectStatusRef.current = reconnectStatus;
  }, [reconnectStatus]);

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

  async function refreshServerVersion(): Promise<ServerVersionInfo | null> {
    try {
      const versionInfo = await fetchServerVersion();
      serverVersionRef.current = versionInfo;
      return versionInfo;
    } catch (caught) {
      logReconnectEvent('server.version.unavailable', {
        error: getErrorMessage(caught, 'version lookup failed'),
      });
      return null;
    }
  }

  function cancelRecoverySupervisor(): void {
    recoveryRunIdRef.current += 1;
  }

  function resetLiveRoomState(): void {
    roomRef.current = null;
    playersRef.current = null;
    setBusy(false);
    setCommandPending(false);
    setConnectionState('disconnected');
    setLogs([]);
    setChatBubbles([]);
    setView(null);
  }

  function buildReconnectStatus(
    phase: ReconnectStatus['phase'],
    reason: ReconnectFailureReason | null,
    attempts: number,
    startedAt: number,
    strategy: ReconnectStrategy,
    nextRetryAt: number | null = null,
  ): ReconnectStatus {
    return {
      attempts,
      lastFailureReason: reason,
      message: getReconnectMessage(phase, reason),
      nextRetryAt,
      phase,
      startedAt,
      strategy,
    };
  }

  function finalizeRecoverySuccess(
    strategy: ReconnectStrategy,
    room: Room,
    startedAt: number,
  ): void {
    const durationMs = Math.max(0, Date.now() - startedAt);
    dropSnapshotRef.current = null;
    setBusy(false);
    setCommandPending(false);
    setConnectionState('connected');
    setReconnectStatus(createIdleReconnectStatus());
    setError(null);
    logReconnectEvent('recovery.succeeded', {
      roomId: room.roomId,
      sessionId: room.sessionId,
      strategy,
      durationMs,
    });
    room.send('client_reconnect_telemetry', {
      strategy,
      durationMs,
    });
    void refreshServerVersion();
  }

  function applyTerminalRecoveryFailure(
    reason: ReconnectFailureReason,
    options: RecoveryRunOptions,
  ): void {
    const currentStatus = reconnectStatusRef.current;
    const startedAt =
      currentStatus.startedAt ??
      dropSnapshotRef.current?.startedAt ??
      Date.now();

    setBusy(false);
    setCommandPending(false);
    setConnectionState('disconnected');
    setReconnectStatus(
      buildReconnectStatus(
        'terminal_failure',
        reason,
        currentStatus.attempts,
        startedAt,
        'supervisor',
      ),
    );

    logReconnectEvent('recovery.failed_terminal', {
      attempts: currentStatus.attempts,
      preserveViewOnFailure: options.preserveViewOnFailure,
      reason,
      startedAt,
    });

    if (
      reason === 'token_invalid' ||
      reason === 'room_closed' ||
      reason === 'room_not_found'
    ) {
      clearSession();
      resetLiveRoomState();
      setReconnectStatus(createIdleReconnectStatus());
      setError(getReconnectMessage('terminal_failure', reason));
      return;
    }

    if (options.preserveViewOnFailure && viewRef.current) {
      setError(null);
      return;
    }

    setError(getReconnectMessage('terminal_failure', reason));
  }

  async function attachRoom(
    room: Room,
    fallbackNickname: string,
    fallbackUserId?: string,
  ): Promise<void> {
    roomRef.current = room;
    room.reconnection.minUptime = 0;
    room.reconnection.maxRetries = 6;
    room.reconnection.minDelay = 200;
    room.reconnection.maxDelay = 2_000;
    setBusy(false);
    setCommandPending(false);
    setConnectionState('connected');
    setReconnectStatus(createIdleReconnectStatus());
    setError(null);
    setLogs([]);
    setChatBubbles([]);

    const isCurrentRoom = () => roomRef.current === room;

    room.onMessage('game_view', (incomingView: ClientGameView) => {
      if (!isCurrentRoom()) {
        return;
      }

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
          userId: fallbackUserId,
        });
        setCommandPending(false);
        setView(nextView);
      });
    });

    room.onMessage('match_event', (event: ClientMatchEvent) => {
      if (!isCurrentRoom()) {
        return;
      }

      setLogs((current) =>
        [
          describeEvent(event, playersRef.current ?? undefined),
          ...current,
        ].slice(0, 12),
      );
    });

    room.onMessage('command_rejected', (payload: { message?: string }) => {
      if (!isCurrentRoom()) {
        return;
      }

      setCommandPending(false);
      setError(String(payload.message ?? 'Comando rejeitado pelo servidor.'));
    });

    room.onMessage('pato_taunt', () => {
      if (!isCurrentRoom()) {
        return;
      }

      setPatoTauntCount((n) => n + 1);
    });

    room.onMessage(
      'player_reaction',
      (payload: { seatId: SeatId; phraseId: number }) => {
        if (!isCurrentRoom()) {
          return;
        }

        const phraseExists = REACTION_PHRASES.some(
          (phrase) => phrase.id === payload.phraseId,
        );
        if (!phraseExists) {
          return;
        }

        const id = Date.now() + Math.random();
        setChatBubbles((prev) => [
          ...prev.slice(-6),
          {
            id,
            seatId: payload.seatId,
            phraseId: payload.phraseId,
            timestamp: Date.now(),
          },
        ]);

        window.setTimeout(() => {
          setChatBubbles((prev) => prev.filter((bubble) => bubble.id !== id));
        }, 3_600);
      },
    );

    room.onLeave(() => {
      if (!isCurrentRoom()) {
        return;
      }

      roomRef.current = null;
      setBusy(false);
      setCommandPending(false);

      if (intentionalLeaveRef.current) {
        intentionalLeaveRef.current = false;
        setConnectionState('disconnected');
        setReconnectStatus(createIdleReconnectStatus());
        return;
      }

      const reconnectionToken =
        room.reconnectionToken ??
        dropSnapshotRef.current?.reconnectionToken ??
        sessionRef.current?.reconnectionToken;

      if (!reconnectionToken) {
        resetLiveRoomState();
        setReconnectStatus(createIdleReconnectStatus());
        setError(
          'A conexao foi encerrada e a sessao de reconexao nao esta mais disponivel.',
        );
        return;
      }

      const recoverySnapshot: RecoverySnapshot = {
        bootIdAtDrop:
          dropSnapshotRef.current?.bootIdAtDrop ??
          serverVersionRef.current?.bootId ??
          null,
        reconnectionToken,
        startedAt: dropSnapshotRef.current?.startedAt ?? Date.now(),
      };

      dropSnapshotRef.current = recoverySnapshot;
      setConnectionState('reconnecting');
      setReconnectStatus(
        buildReconnectStatus(
          isNavigatorOnline() ? 'session_recovering' : 'offline',
          isNavigatorOnline() ? null : 'offline',
          0,
          recoverySnapshot.startedAt,
          'supervisor',
        ),
      );
      logReconnectEvent('native.retries.exhausted', {
        roomId: room.roomId,
        sessionId: room.sessionId,
      });

      void runRecoverySupervisor(recoverySnapshot, {
        fallbackNickname,
        manual: false,
        preserveViewOnFailure: true,
      });
    });

    room.onDrop(() => {
      if (!isCurrentRoom()) {
        return;
      }

      const snapshot: RecoverySnapshot = {
        bootIdAtDrop: serverVersionRef.current?.bootId ?? null,
        reconnectionToken:
          room.reconnectionToken ?? sessionRef.current?.reconnectionToken ?? '',
        startedAt: Date.now(),
      };

      dropSnapshotRef.current = snapshot;
      setConnectionState('reconnecting');
      setReconnectStatus(
        buildReconnectStatus(
          isNavigatorOnline() ? 'transport_reconnecting' : 'offline',
          isNavigatorOnline() ? null : 'offline',
          0,
          snapshot.startedAt,
          'native',
        ),
      );
      logReconnectEvent('transport.dropped', {
        bootIdAtDrop: snapshot.bootIdAtDrop,
        roomId: room.roomId,
        sessionId: room.sessionId,
      });
    });

    room.onReconnect(() => {
      if (!isCurrentRoom()) {
        return;
      }

      finalizeRecoverySuccess(
        'native',
        room,
        dropSnapshotRef.current?.startedAt ?? Date.now(),
      );
      room.send('bootstrap');
    });

    room.send('bootstrap');
    void refreshServerVersion();
  }

  async function runRecoverySupervisor(
    snapshot: RecoverySnapshot,
    options: RecoveryRunOptions,
  ): Promise<void> {
    const runId = recoveryRunIdRef.current + 1;
    recoveryRunIdRef.current = runId;
    dropSnapshotRef.current = snapshot;
    setBusy(options.manual);
    setConnectionState('reconnecting');
    setReconnectStatus(
      buildReconnectStatus(
        isNavigatorOnline() ? 'session_recovering' : 'offline',
        isNavigatorOnline() ? null : 'offline',
        0,
        snapshot.startedAt,
        'supervisor',
      ),
    );

    logReconnectEvent('recovery.started', {
      bootIdAtDrop: snapshot.bootIdAtDrop,
      manual: options.manual,
      preserveViewOnFailure: options.preserveViewOnFailure,
      startedAt: snapshot.startedAt,
    });

    const deadline = snapshot.startedAt + getClientReconnectBudgetMs();
    let attempt = 0;
    let lastReason: ReconnectFailureReason =
      isNavigatorOnline() ? 'unknown' : 'offline';

    while (recoveryRunIdRef.current === runId) {
      const now = Date.now();
      if (attempt > 0 && now >= deadline) {
        break;
      }

      const online = isNavigatorOnline();
      if (!online) {
        lastReason = 'offline';
        const delayMs = getReconnectBackoffDelayMs(attempt + 1);
        const nextRetryAt = Math.min(Date.now() + delayMs, deadline);
        setReconnectStatus(
          buildReconnectStatus(
            'offline',
            'offline',
            attempt,
            snapshot.startedAt,
            'supervisor',
            nextRetryAt,
          ),
        );
        logReconnectEvent('recovery.waiting_offline', {
          attempt,
          nextRetryAt,
        });

        if (nextRetryAt >= deadline) {
          break;
        }

        await wait(delayMs);
        continue;
      }

      const versionInfo = await refreshServerVersion();
      if (recoveryRunIdRef.current !== runId) {
        return;
      }

      if (
        versionInfo &&
        snapshot.bootIdAtDrop &&
        versionInfo.bootId !== snapshot.bootIdAtDrop
      ) {
        applyTerminalRecoveryFailure('boot_changed', options);
        return;
      }

      attempt += 1;
      setReconnectStatus(
        buildReconnectStatus(
          'session_recovering',
          attempt === 1 ? null : lastReason,
          attempt,
          snapshot.startedAt,
          'supervisor',
        ),
      );
      logReconnectEvent('recovery.attempt', {
        attempt,
        budgetRemainingMs: Math.max(0, deadline - Date.now()),
      });

      try {
        const room = await withTimeout(
          () => createColyseusClient().reconnect(snapshot.reconnectionToken),
          getDefaultRoomTimeoutMs() + attempt * 500,
          'Reconexao da sala',
        );

        if (recoveryRunIdRef.current !== runId) {
          return;
        }

        await attachRoom(
          room,
          sessionRef.current?.nickname ?? options.fallbackNickname,
          sessionRef.current?.userId ?? userRef.current?.id,
        );
        finalizeRecoverySuccess('supervisor', room, snapshot.startedAt);
        return;
      } catch (caught) {
        const classified = classifyReconnectError(caught);
        lastReason = classified.reason;
        logReconnectEvent('recovery.attempt_failed', {
          attempt,
          error: getErrorMessage(caught, 'unknown reconnect error'),
          reason: classified.reason,
          terminal: classified.terminal,
        });

        if (classified.terminal) {
          applyTerminalRecoveryFailure(classified.reason, options);
          return;
        }
      }

      const delayMs = getReconnectBackoffDelayMs(attempt + 1);
      const nextRetryAt = Math.min(Date.now() + delayMs, deadline);
      setReconnectStatus(
        buildReconnectStatus(
          'session_recovering',
          lastReason,
          attempt,
          snapshot.startedAt,
          'supervisor',
          nextRetryAt,
        ),
      );

      if (nextRetryAt >= deadline) {
        break;
      }

      await wait(delayMs);
    }

    const terminalReason = isNavigatorOnline()
      ? lastReason === 'transport_timeout'
        ? 'transport_timeout'
        : 'server_unavailable'
      : 'offline';

    applyTerminalRecoveryFailure(terminalReason, options);
  }

  async function ensureGuestProfile(): Promise<UserProfile> {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      throw new Error('Informe um apelido antes de continuar.');
    }

    const response = await createOrUpdateGuestUser({
      nickname: trimmedNickname,
      userId: userRef.current?.id,
    });
    persistUser(response.user);
    return response.user;
  }

  async function connectToReservedRoom(
    reservation: {
      colyseus: {
        assignedTeamId?: number;
        roomCode: string;
        roomId: string;
      };
    },
    user: UserProfile,
  ): Promise<void> {
    const room = await withTimeout(
      () =>
        createColyseusClient().joinById(reservation.colyseus.roomId, {
          assignedTeamId: reservation.colyseus.assignedTeamId,
          nickname: user.nickname,
          roomCode: reservation.colyseus.roomCode,
          userId: user.id,
        }),
      getDefaultRoomTimeoutMs(),
      'Entrada na sala',
    );
    await attachRoom(room, user.nickname, user.id);
  }

  async function createRoom(): Promise<string | null> {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Informe um apelido antes de criar a sala.');
      return null;
    }

    cancelRecoverySupervisor();
    dropSnapshotRef.current = null;
    setBusy(true);
    setError(null);
    setReconnectStatus(createIdleReconnectStatus());

    try {
      const user = await ensureGuestProfile();
      clearSession();
      const createdRoom = await createRoomRequest({
        maxPlayers: 2,
        nickname: user.nickname,
        ownerUserId: user.id,
      });
      await connectToReservedRoom(createdRoom, user);
      return createdRoom.room.roomCode;
    } catch (caught) {
      setBusy(false);
      setError(getErrorMessage(caught, 'Falha ao criar a sala.'));
      return null;
    }
  }

  async function joinRoom(roomCode: string): Promise<string | null> {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Informe um apelido antes de entrar.');
      return null;
    }

    if (!roomCode.trim()) {
      setError('Informe o codigo da sala.');
      return null;
    }

    cancelRecoverySupervisor();
    dropSnapshotRef.current = null;
    setBusy(true);
    setError(null);
    setReconnectStatus(createIdleReconnectStatus());

    try {
      const user = await ensureGuestProfile();
      clearSession();
      const joinedRoom = await joinRoomRequest({
        nickname: user.nickname,
        roomCode,
        userId: user.id,
      });
      await connectToReservedRoom(joinedRoom, user);
      return joinedRoom.room.roomCode;
    } catch (caught) {
      setBusy(false);
      setError(getJoinRoomError(caught));
      return null;
    }
  }

  async function reconnect(reconnectionToken: string): Promise<void> {
    const trimmedToken = reconnectionToken.trim();
    if (!trimmedToken) {
      clearSession();
      setError(
        'Sua sessao de reconexao nao esta mais disponivel. Entre novamente pelo codigo da sala.',
      );
      return;
    }

    cancelRecoverySupervisor();
    const snapshot: RecoverySnapshot = {
      bootIdAtDrop:
        serverVersionRef.current?.bootId ??
        dropSnapshotRef.current?.bootIdAtDrop ??
        null,
      reconnectionToken: trimmedToken,
      startedAt: Date.now(),
    };

    await runRecoverySupervisor(snapshot, {
      fallbackNickname:
        sessionRef.current?.nickname ?? (nickname.trim() || 'Jogador'),
      manual: true,
      preserveViewOnFailure: Boolean(viewRef.current),
    });
  }

  function retryReconnectNow(): void {
    const token =
      sessionRef.current?.reconnectionToken ??
      dropSnapshotRef.current?.reconnectionToken;

    if (!token) {
      setError('Nao existe uma sessao de reconexao disponivel no momento.');
      return;
    }

    void reconnect(token);
  }

  function abandonRecovery(): void {
    cancelRecoverySupervisor();
    dropSnapshotRef.current = null;
    setReconnectStatus(createIdleReconnectStatus());
    if (sessionRef.current) {
      setError(
        'Recuperacao pausada. Voce pode tentar reconectar novamente pelo lobby.',
      );
    }
    resetLiveRoomState();
  }

  function sendCommand(command: GameCommand): void {
    setCommandPending(true);
    roomRef.current?.send('command', command);
  }

  function sendPatoTaunt(): void {
    roomRef.current?.send('pato_taunt');
  }

  function sendReaction(phraseId: number): void {
    roomRef.current?.send('player_reaction', { phraseId });
  }

  function leaveSession(): void {
    cancelRecoverySupervisor();
    dropSnapshotRef.current = null;
    setReconnectStatus(createIdleReconnectStatus());
    clearSession();
    intentionalLeaveRef.current = true;
    roomRef.current?.leave();
    resetLiveRoomState();
    setError(null);
  }

  return {
    abandonRecovery,
    busy,
    chatBubbles,
    commandPending,
    connectionState,
    createRoom,
    dismissError: () => setError(null),
    error,
    joinRoom,
    leaveSession,
    logs,
    patoTauntCount,
    reconnect,
    reconnectStatus,
    reportError: (message: string) => setError(message),
    retryReconnectNow,
    sendCommand,
    sendReaction,
    sendPatoTaunt,
    view,
  };
}
