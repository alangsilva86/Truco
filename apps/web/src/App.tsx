import { Room } from '@colyseus/sdk';
import {
  AvailableAction,
  Card,
  ClientGameView,
  ClientMatchEvent,
  GameCommand,
  SeatId,
  SessionInfo,
  TeamId,
} from '@truco/contracts';
import {
  AlertCircle,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState, startTransition } from 'react';
import { GameTable } from './components/game/GameTable.js';
import {
  clearStoredSession,
  createColyseusClient,
  getServerHttpUrl,
  loadStoredSession,
  saveStoredSession,
} from './lib/network.js';
import { buildClientView, describeEvent } from './lib/view.js';

function createCommand<T extends GameCommand['type']>(
  type: T,
  payload: Extract<GameCommand, { type: T }>['payload'],
): Extract<GameCommand, { type: T }> {
  return {
    commandId: crypto.randomUUID(),
    issuedAt: Date.now(),
    type,
    payload,
  } as Extract<GameCommand, { type: T }>;
}

function getAction<T extends AvailableAction['type']>(
  actions: AvailableAction[],
  type: T,
): Extract<AvailableAction, { type: T }> | null {
  return (actions.find((action) => action.type === type) ?? null) as Extract<AvailableAction, { type: T }> | null;
}

export default function App() {
  const [nickname, setNickname] = useState(() => loadStoredSession()?.nickname ?? '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('create');
  const [view, setView] = useState<ClientGameView | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coveredMode, setCoveredMode] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [commandPending, setCommandPending] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef(loadStoredSession());
  const codeInputRef = useRef<HTMLInputElement>(null);
  // Stores the latest player map for rich event descriptions.
  const playersRef = useRef<ClientGameView['players'] | null>(null);
  // viewerTeamId is set authoritatively from the server's session_info message —
  // never inferred from schema heuristics.
  const [viewerTeamId, setViewerTeamId] = useState<TeamId | null>(null);
  const viewerTeamIdRef = useRef<TeamId | null>(null);

  const playAction = view ? getAction(view.availableActions, 'PLAY_CARD') : null;
  const requestTrucoAction = view ? getAction(view.availableActions, 'REQUEST_TRUCO') : null;
  const respondTrucoAction = view ? getAction(view.availableActions, 'RESPOND_TRUCO') : null;

  // Auto-reconnect on mount.
  useEffect(() => {
    const snapshot = loadStoredSession();
    if (!snapshot) return;
    void reconnect(snapshot.reconnectionToken);
  }, []);

  // Clear covered mode if the action becomes unavailable.
  useEffect(() => {
    if (!playAction?.canPlayCovered && coveredMode) {
      setCoveredMode(false);
    }
  }, [coveredMode, playAction?.canPlayCovered]);

  // Propagate connection state into the view.
  useEffect(() => {
    setView((current) => (current ? { ...current, connectionState } : current));
  }, [connectionState]);

  // Auto-dismiss game errors after 5s.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error]);

  // Reset rematch button when a new round starts (game phase leaves GAME_END).
  useEffect(() => {
    if (view?.gamePhase !== 'GAME_END') setRematchRequested(false);
  }, [view?.gamePhase]);

  async function attachRoom(room: Room, fallbackNickname: string): Promise<void> {
    roomRef.current = room;
    setConnectionState('connected');
    setBusy(false);

    // Receive canonical identity from the server — no client-side heuristics.
    room.onMessage('session_info', (info: SessionInfo) => {
      console.log('[session_info]', { teamId: info.teamId, ownedSeatIds: info.ownedSeatIds, roomCode: info.roomCode });
      viewerTeamIdRef.current = info.teamId;
      setViewerTeamId(info.teamId);
    });

    room.onMessage('match_event', (event: ClientMatchEvent) => {
      console.log('[match_event]', { type: event.type, cursor: event.cursor, stateVersion: event.stateVersion });
      setLogs((current) => [describeEvent(event, playersRef.current ?? undefined), ...current].slice(0, 12));
    });

    room.onMessage('command_rejected', (payload: { message?: string; commandId?: string }) => {
      console.warn('[command_rejected]', payload);
      setCommandPending(false);
      setError(String(payload.message ?? 'Comando rejeitado pelo servidor.'));
    });

    room.onStateChange((state) => {
      const teamId = viewerTeamIdRef.current;
      if (teamId === null) {
        // session_info hasn't arrived yet; safe to skip — next patch will have it.
        console.log('[onStateChange] skipped — awaiting session_info');
        return;
      }
      console.log('[onStateChange]', {
        teamId,
        phase: (state as Record<string, unknown>)?.gamePhase,
        stateVersion: (state as Record<string, unknown>)?.stateVersion,
      });
      startTransition(() => {
        setCommandPending(false);
        const nextView = buildClientView(state, 'connected', teamId);
        if (nextView) {
          playersRef.current = nextView.players;
          const snapshot = {
            nickname: fallbackNickname,
            roomCode: nextView.roomCode,
            roomId: room.roomId,
            ownedSeatIds: nextView.ownedSeatIds,
            viewerTeamId: teamId,
            reconnectionToken: room.reconnectionToken,
            sessionId: room.sessionId,
          };
          sessionRef.current = snapshot;
          saveStoredSession(snapshot);
        }
        setView(nextView);
      });
    });

    room.onLeave(() => {
      setConnectionState('disconnected');
    });
  }

  async function createRoom(): Promise<void> {
    if (!nickname.trim()) {
      setError('Informe um apelido antes de criar a sala.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const client = createColyseusClient();
      const room = await client.create('truco_room', { nickname: nickname.trim() });
      await attachRoom(room, nickname.trim());
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : 'Falha ao criar a sala.');
    }
  }

  async function joinRoom(): Promise<void> {
    if (!nickname.trim()) {
      setError('Informe um apelido antes de entrar.');
      return;
    }

    if (!roomCodeInput.trim()) {
      setError('Informe o codigo da sala.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${getServerHttpUrl()}/api/rooms/${roomCodeInput.trim().toUpperCase()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (body.error === 'CLOSED') {
          throw new Error('Esta sala foi encerrada.');
        } else if (body.error === 'LOCKED') {
          throw new Error('Esta sala ja esta cheia ou em andamento.');
        } else {
          throw new Error('Sala nao encontrada. Verifique o codigo e tente novamente.');
        }
      }

      const { roomId } = await response.json() as { roomId: string };
      const client = createColyseusClient();
      const room = await client.joinById(roomId, { nickname: nickname.trim() });
      await attachRoom(room, nickname.trim());
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : 'Falha ao entrar na sala.');
    }
  }

  async function reconnect(reconnectionToken: string): Promise<void> {
    setBusy(true);
    setConnectionState('reconnecting');

    // Restore teamId before onStateChange fires (allowReconnection doesn't re-send session_info).
    const snap = sessionRef.current;
    if (snap) {
      const restoredTeamId: TeamId = snap.viewerTeamId ?? (snap.ownedSeatIds[0] % 2 === 0 ? 0 : 1);
      console.log('[reconnect] restoring teamId from snapshot', { restoredTeamId, roomCode: snap.roomCode });
      viewerTeamIdRef.current = restoredTeamId;
      setViewerTeamId(restoredTeamId);
    }

    try {
      const client = createColyseusClient();
      const room = await client.reconnect(reconnectionToken);
      await attachRoom(room, (snap?.nickname ?? nickname.trim()) || 'Jogador');
    } catch {
      setBusy(false);
      setConnectionState('disconnected');
      viewerTeamIdRef.current = null;
      setViewerTeamId(null);
      clearStoredSession();
    }
  }

  function sendCommand(command: GameCommand): void {
    console.log('[sendCommand]', { type: command.type, commandId: command.commandId });
    setCommandPending(true);
    roomRef.current?.send('command', command);
  }

  function handleCardPlay(seatId: SeatId, card: Card): void {
    if (!playAction || playAction.seatId !== seatId) return;

    sendCommand(createCommand('PLAY_CARD', {
      seatId,
      cardId: card.id,
      mode: coveredMode ? 'covered' : 'open',
    }));
    setCoveredMode(false);
  }

  function handleCopyCode(code: string): void {
    void navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {
      setError('Nao foi possivel copiar o codigo da sala.');
    });
  }

  function leaveSession(): void {
    clearStoredSession();
    roomRef.current?.leave();
    roomRef.current = null;
    viewerTeamIdRef.current = null;
    setViewerTeamId(null);
    setView(null);
    setLogs([]);
    setCommandPending(false);
    setConnectionState('disconnected');
  }

  function handleRequestTruco(): void {
    if (!requestTrucoAction || !view) {
      return;
    }

    sendCommand(createCommand('REQUEST_TRUCO', {
      seatId: playAction?.seatId ?? view.ownedSeatIds[0],
    }));
  }

  function handleRequestRematch(): void {
    if (!view || rematchRequested) {
      return;
    }

    setRematchRequested(true);
    sendCommand(createCommand('REMATCH', {
      requestedBySeatId: view.ownedSeatIds[0],
    }));
  }

  // ── Lobby screen ──────────────────────────────────────────────────────────────

  if (!view || viewerTeamId === null) {
    const storedSession = sessionRef.current;

    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center gap-10 rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:flex-row lg:items-center lg:p-10">
          <div className="max-w-xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Truco online autoritativo
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Sala privada, dupla visivel, partida em tempo real.
            </h1>
            <p className="max-w-lg text-sm text-white/65 sm:text-base">
              Cada jogador controla dois assentos opostos.
            </p>
          </div>

          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-black/35 p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">Lobby</p>
                <h2 className="text-xl font-black text-white">Entrar na mesa</h2>
              </div>
            </div>

            {/* Tabs: Criar / Entrar */}
            <div className="mb-4 flex rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => { setLobbyMode('create'); setError(null); }}
                className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  lobbyMode === 'create'
                    ? 'bg-emerald-400 text-black'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Criar sala
              </button>
              <button
                type="button"
                onClick={() => { setLobbyMode('join'); setError(null); }}
                className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  lobbyMode === 'join'
                    ? 'bg-emerald-400 text-black'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Entrar por codigo
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    if (lobbyMode === 'create') void createRoom();
                    else codeInputRef.current?.focus();
                  }
                }}
                placeholder="Seu apelido"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
              />
              {lobbyMode === 'join' && (
                <input
                  ref={codeInputRef}
                  value={roomCodeInput}
                  onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                  onKeyDown={(event) => { if (event.key === 'Enter') void joinRoom(); }}
                  placeholder="Codigo da sala"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
                />
              )}
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => void (lobbyMode === 'create' ? createRoom() : joinRoom())}
                disabled={busy}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black disabled:opacity-60"
              >
                {busy ? 'Conectando...' : lobbyMode === 'create' ? 'Criar sala' : 'Entrar por codigo'}
              </button>
              {storedSession && (
                <button
                  type="button"
                  onClick={() => void reconnect(storedSession.reconnectionToken)}
                  disabled={busy}
                  className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-200 disabled:opacity-60"
                >
                  Reconectar · {storedSession.roomCode}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameTable
      view={view}
      viewerTeamId={viewerTeamId}
      connectionState={connectionState}
      logs={logs}
      error={error}
      coveredMode={coveredMode}
      commandPending={commandPending}
      codeCopied={codeCopied}
      rematchRequested={rematchRequested}
      playAction={playAction}
      requestTrucoAction={requestTrucoAction}
      respondTrucoAction={respondTrucoAction}
      onDismissError={() => setError(null)}
      onCopyCode={handleCopyCode}
      onLeave={leaveSession}
      onToggleCovered={() => setCoveredMode((current) => !current)}
      onPlayCard={handleCardPlay}
      onRequestTruco={handleRequestTruco}
      onRequestRematch={handleRequestRematch}
      onAcceptTruco={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'accept' }))}
      onRaiseTruco={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'raise' }))}
      onRunTruco={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'run' }))}
    />
  );
}
