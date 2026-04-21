import { getTeamForSeat } from '@truco/contracts';
import { useRef, useState } from 'react';
import { GameTable } from './components/game/GameTable.js';
import { LobbyScreen } from './components/lobby/LobbyScreen.js';
import { useGameCommands } from './hooks/useGameCommands.js';
import { useRoomConnection } from './hooks/useRoomConnection.js';
import { useRoomSession } from './hooks/useRoomSession.js';

export default function App() {
  const [codeCopied, setCodeCopied] = useState(false);
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('create');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  const {
    clearSession,
    nickname,
    persistSession,
    sessionRef,
    setNickname,
    storedSession,
  } = useRoomSession();

  const {
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
    reportError,
    reconnect,
    reconnectStatus,
    retryReconnectNow,
    sendCommand,
    sendReaction,
    sendPatoTaunt,
    abandonRecovery,
    view,
  } = useRoomConnection({
    clearSession,
    nickname,
    persistSession,
    sessionRef,
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

  function handleCopyCode(code: string): void {
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCodeCopied(true);
        window.setTimeout(() => setCodeCopied(false), 2_000);
      })
      .catch(() => {
        reportError('Nao foi possivel copiar o codigo da sala.');
      });
  }

  if (!view) {
    return (
      <LobbyScreen
        busy={busy}
        codeInputRef={codeInputRef}
        error={error}
        lobbyMode={lobbyMode}
        nickname={nickname}
        onCreateRoom={() => void createRoom()}
        onJoinRoom={() => void joinRoom(roomCodeInput)}
        onReconnect={(reconnectionToken) => void reconnect(reconnectionToken)}
        roomCodeInput={roomCodeInput}
        setLobbyMode={(mode) => {
          setLobbyMode(mode);
          dismissError();
        }}
        setNickname={setNickname}
        setRoomCodeInput={setRoomCodeInput}
        storedSession={storedSession}
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
      codeCopied={codeCopied}
      rematchRequested={rematchRequested}
      playAction={playAction}
      respondHandOfElevenAction={respondHandOfElevenAction}
      requestTrucoAction={requestTrucoAction}
      runRoundAction={runRoundAction}
      respondTrucoAction={respondTrucoAction}
      onDismissError={dismissError}
      onCopyCode={handleCopyCode}
      onLeave={leaveSession}
      onReturnToLobby={abandonRecovery}
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
