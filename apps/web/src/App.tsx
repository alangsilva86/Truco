import { PublicRoom, RoomMatchFormat, getTeamForSeat } from '@truco/contracts';
import { useEffect, useRef, useState } from 'react';
import { GameTable } from './components/game/GameTable.js';
import { LobbyScreen } from './components/lobby/LobbyScreen.js';
import { useGameCommands } from './hooks/useGameCommands.js';
import { useRoomConnection } from './hooks/useRoomConnection.js';
import { useRoomRoute } from './hooks/useRoomRoute.js';
import { useRoomSession } from './hooks/useRoomSession.js';
import { fetchPublicRooms, fetchUserRooms } from './lib/network.js';

function buildRoomLink(roomCode: string): string {
  return new URL(`/sala/${roomCode}`, window.location.origin).toString();
}

export default function App() {
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('create');
  const [matchFormat, setMatchFormat] = useState<RoomMatchFormat>('single');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [userRooms, setUserRooms] = useState<PublicRoom[]>([]);
  const autoReconnectKeyRef = useRef<string | null>(null);

  const { navigateToLobby, navigateToRoom, routeRoomCode } = useRoomRoute();
  const {
    clearSession,
    nickname,
    persistSession,
    persistUser,
    sessionRef,
    setNickname,
    storedSession,
    storedUser,
    userRef,
  } = useRoomSession();

  const {
    abandonRecovery,
    busy,
    chatBubbles,
    commandPending,
    connectionState,
    createRoom,
    dismissError,
    error,
    joinRoom,
    leaveSession,
    logs,
    patoTauntCount,
    reconnect,
    reconnectStatus,
    retryReconnectNow,
    sendCommand,
    sendReaction,
    sendPatoTaunt,
    reportError,
    view,
  } = useRoomConnection({
    clearSession,
    nickname,
    persistSession,
    persistUser,
    sessionRef,
    userRef,
  });

  const {
    coveredMode,
    onAcceptTruco,
    onPlayHandOfEleven,
    onPlayCard,
    onRaiseTruco,
    onRequestRematch,
    onRunRound,
    onRequestTruco,
    onRunHandOfEleven,
    onRunTruco,
    onToggleCovered,
    playAction,
    rematchRequested,
    respondHandOfElevenAction,
    requestTrucoAction,
    runRoundAction,
    respondTrucoAction,
  } = useGameCommands({
    sendCommand,
    view,
  });

  useEffect(() => {
    if (!routeRoomCode) {
      autoReconnectKeyRef.current = null;
      return;
    }

    setLobbyMode('join');
    setRoomCodeInput((current) =>
      current === routeRoomCode ? current : routeRoomCode,
    );
  }, [routeRoomCode]);

  useEffect(() => {
    if (!routeRoomCode || view || busy) {
      return;
    }

    if (
      storedSession?.roomCode !== routeRoomCode ||
      !storedSession.reconnectionToken
    ) {
      return;
    }

    const recoveryKey = `${storedSession.roomCode}:${storedSession.reconnectionToken}`;
    if (autoReconnectKeyRef.current === recoveryKey) {
      return;
    }

    autoReconnectKeyRef.current = recoveryKey;
    void reconnect(storedSession.reconnectionToken);
  }, [
    busy,
    reconnect,
    routeRoomCode,
    storedSession?.reconnectionToken,
    storedSession?.roomCode,
    view,
  ]);

  useEffect(() => {
    if (view) {
      return;
    }

    let cancelled = false;

    async function loadRooms() {
      setRoomsLoading(true);

      try {
        const [publicResponse, userResponse] = await Promise.all([
          fetchPublicRooms(),
          storedUser?.id
            ? fetchUserRooms(storedUser.id)
            : Promise.resolve({ ok: true as const, rooms: [] }),
        ]);

        if (cancelled) {
          return;
        }

        setPublicRooms(publicResponse.rooms);
        setUserRooms(userResponse.rooms);
      } catch {
        if (!cancelled) {
          setPublicRooms([]);
          setUserRooms([]);
        }
      } finally {
        if (!cancelled) {
          setRoomsLoading(false);
        }
      }
    }

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [storedUser?.id, view]);

  function handleCopyRoomLink(roomCode: string): void {
    void navigator.clipboard
      .writeText(buildRoomLink(roomCode))
      .then(() => {
        setCopiedRoomCode(roomCode);
        window.setTimeout(() => {
          setCopiedRoomCode((current) =>
            current === roomCode ? null : current,
          );
        }, 2_000);
      })
      .catch(() => {
        reportError('Nao foi possivel copiar o link da sala.');
      });
  }

  async function handleCreateRoom(): Promise<void> {
    const roomCode = await createRoom(matchFormat);
    if (roomCode) {
      navigateToRoom(roomCode);
    }
  }

  async function handleJoinRoom(targetRoomCode = roomCodeInput): Promise<void> {
    const roomCode = await joinRoom(targetRoomCode);
    if (roomCode) {
      navigateToRoom(roomCode);
    }
  }

  async function handleReconnect(
    reconnectionToken: string,
    roomCode: string,
  ): Promise<void> {
    navigateToRoom(roomCode);
    await reconnect(reconnectionToken);
  }

  function handleLeaveToLobby(): void {
    leaveSession();
    navigateToLobby();
  }

  function handleAbandonRecovery(): void {
    abandonRecovery();
    navigateToLobby();
  }

  if (!view) {
    return (
      <LobbyScreen
        busy={busy}
        copiedRoomCode={copiedRoomCode}
        error={error}
        lobbyMode={lobbyMode}
        matchFormat={matchFormat}
        nickname={nickname}
        onCopyRoomLink={handleCopyRoomLink}
        onCreateRoom={() => void handleCreateRoom()}
        onJoinRoom={() => void handleJoinRoom()}
        onOpenRoom={(roomCode) => void handleJoinRoom(roomCode)}
        onReconnect={(reconnectionToken, roomCode) =>
          void handleReconnect(reconnectionToken, roomCode)
        }
        publicRooms={publicRooms}
        roomCodeInput={roomCodeInput}
        roomsLoading={roomsLoading}
        routeRoomCode={routeRoomCode}
        setLobbyMode={(mode) => {
          setLobbyMode(mode);
          dismissError();
        }}
        setMatchFormat={setMatchFormat}
        setNickname={setNickname}
        setRoomCodeInput={setRoomCodeInput}
        storedSession={storedSession}
        storedUser={storedUser}
        userRooms={userRooms}
      />
    );
  }

  return (
    <GameTable
      view={view}
      viewerTeamId={getTeamForSeat(view.ownedSeatIds[0])}
      connectionState={connectionState}
      logs={logs}
      error={error}
      chatBubbles={chatBubbles}
      reconnectStatus={reconnectStatus}
      coveredMode={coveredMode}
      commandPending={commandPending}
      codeCopied={copiedRoomCode === view.roomCode}
      rematchRequested={rematchRequested}
      playAction={playAction}
      respondHandOfElevenAction={respondHandOfElevenAction}
      requestTrucoAction={requestTrucoAction}
      runRoundAction={runRoundAction}
      respondTrucoAction={respondTrucoAction}
      onDismissError={dismissError}
      onCopyCode={handleCopyRoomLink}
      onLeave={handleLeaveToLobby}
      onReturnToLobby={handleAbandonRecovery}
      onRetryReconnect={retryReconnectNow}
      onSendReaction={sendReaction}
      onToggleCovered={onToggleCovered}
      onPlayHandOfEleven={onPlayHandOfEleven}
      onPlayCard={onPlayCard}
      onRequestTruco={onRequestTruco}
      onRequestRematch={onRequestRematch}
      onRunRound={onRunRound}
      onAcceptTruco={onAcceptTruco}
      onRunHandOfEleven={onRunHandOfEleven}
      onRaiseTruco={onRaiseTruco}
      onRunTruco={onRunTruco}
      patoTauntCount={patoTauntCount}
      onSendPatoTaunt={sendPatoTaunt}
    />
  );
}
