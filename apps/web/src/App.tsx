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
  getSeatLayoutForTeam,
} from '@truco/contracts';
import {
  AlertCircle,
  Check,
  Copy,
  Crown,
  EyeOff,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { CardView } from './components/Card.js';
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

  const seatLayout = useMemo(() => (
    viewerTeamId === null ? null : getSeatLayoutForTeam(viewerTeamId)
  ), [viewerTeamId]);

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

  // ── Lobby screen ──────────────────────────────────────────────────────────────

  if (!view || !seatLayout) {
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

  // ── Game view ──────────────────────────────────────────────────────────────────

  const teamId: TeamId = viewerTeamId ?? 0;
  const bottomCards = view.visibleHands[seatLayout.bottom] ?? [];
  const topCards = view.visibleHands[seatLayout.top] ?? [];
  const leftCount = view.opponentHandCounts[seatLayout.left] ?? 0;
  const rightCount = view.opponentHandCounts[seatLayout.right] ?? 0;
  const isBottomTurn = playAction?.seatId === seatLayout.bottom;
  const isTopTurn = playAction?.seatId === seatLayout.top;
  const isOpponentLeftTurn = view.gamePhase === 'PLAYING' && view.turnSeatId === seatLayout.left;
  const isOpponentRightTurn = view.gamePhase === 'PLAYING' && view.turnSeatId === seatLayout.right;
  const isWaiting = view.gamePhase === 'WAITING_PLAYERS';
  const isGameEnd = view.gamePhase === 'GAME_END';
  const isPausedReconnect = view.roomLifecycle === 'PAUSED_RECONNECT';
  const scoreUs = teamId === 0 ? view.scores[0] : view.scores[1];
  const scoreThem = teamId === 0 ? view.scores[1] : view.scores[0];
  const gameWon = isGameEnd && scoreUs >= 12;
  const trucoRequesterName = view.trucoPending
    ? (view.players[view.trucoPending.requestedBySeatId]?.nickname ?? 'Adversario')
    : null;
  const raiseTarget = view.trucoPending ? view.trucoPending.requestedValue + 3 : null;

  // Vaza tracker: 3 dots per round (emerald=us, rose=them, white=tie, outlined=unplayed)
  const trickDots = Array.from({ length: 3 }).map((_, i) => {
    const trick = view.trickHistory[i];
    if (!trick) return 'empty';
    if (trick.winnerSeatId === 'tie') return 'tie';
    return (trick.winnerSeatId as number) % 2 === teamId ? 'us' : 'them';
  });

  return (
    <div className="min-h-screen px-3 py-3 sm:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-black/20 shadow-2xl shadow-black/50">

        {/* Header */}
        <header className="glass flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-300/70">Truco online</p>
              <h1 className="text-2xl font-black text-white">Sala {view.roomCode}</h1>
            </div>
            <button
              type="button"
              onClick={() => handleCopyCode(view.roomCode)}
              title="Copiar codigo da sala"
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              {codeCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-2">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Nos</p>
              <p className="font-mono text-3xl font-black text-emerald-300">{scoreUs}</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Eles</p>
              <p className="font-mono text-3xl font-black text-rose-300">{scoreThem}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] ${
              isPausedReconnect ? 'text-amber-300' : isGameEnd ? 'text-emerald-300' : 'text-white/60'
            }`}>
              {view.roomLifecycle}
            </div>
            <button
              type="button"
              onClick={leaveSession}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col overflow-hidden felt-noise">

          {/* Status bar */}
          <div className="glass mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[26px] px-4 py-3">
            <h2 className="text-lg font-black text-white">{view.message}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {!isWaiting && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Vazas</p>
                  <div className="flex gap-1">
                    {trickDots.map((dot, i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full border transition ${
                          dot === 'us'
                            ? 'border-emerald-400 bg-emerald-400'
                            : dot === 'them'
                              ? 'border-rose-400 bg-rose-400'
                              : dot === 'tie'
                                ? 'border-white/60 bg-white/60'
                                : 'border-white/20 bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {view.vira && (
                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Vira</p>
                  <p className="text-sm font-black text-white">{view.vira.rank} de {view.vira.suit}</p>
                </div>
              )}
              {view.manilhaRank && (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-amber-100">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/60">Manilha</p>
                  <p className="text-sm font-black">{view.manilhaRank}</p>
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Vale</p>
                <p className="text-sm font-black text-white">{view.currentRoundPoints}</p>
              </div>
            </div>
          </div>

          {/* Turn banners */}
          {(isBottomTurn || isTopTurn) && (
            <div className="mx-3 mt-2 flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                {isBottomTurn
                  ? `Sua vez · ${view.players[seatLayout.bottom].nickname}`
                  : `Sua vez · ${view.players[seatLayout.top].nickname}`}
              </span>
            </div>
          )}
          {(isOpponentLeftTurn || isOpponentRightTurn) && (
            <div className="mx-3 mt-2 flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                {isOpponentLeftTurn
                  ? `Vez deles · ${view.players[seatLayout.left].nickname}`
                  : `Vez deles · ${view.players[seatLayout.right].nickname}`}
              </span>
            </div>
          )}

          {/* Command pending indicator */}
          {commandPending && (
            <div className="mx-3 mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-2">
              <LoaderCircle className="h-4 w-4 animate-spin text-white/50" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-white/50">Aguardando servidor...</span>
            </div>
          )}

          {/* Game error banner (auto-dismisses in 5s) */}
          {error && (
            <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-lg p-1 text-rose-200/60 transition hover:text-rose-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex flex-1 items-center justify-center overflow-x-hidden px-4 py-3">
            <div className="relative flex h-full w-full max-w-6xl items-center justify-center">

              {/* Left opponent */}
              {!isWaiting && (
                <div className={`absolute left-0 top-1/2 flex max-w-[6rem] -translate-y-1/2 flex-col items-center gap-3 rounded-[20px] p-2 transition sm:max-w-none ${isOpponentLeftTurn ? 'ring-1 ring-rose-400/30' : ''}`}>
                  <div className="rounded-full border border-rose-300/20 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
                    <span className="block max-w-[4rem] truncate sm:max-w-none">
                      {view.players[seatLayout.left].nickname}
                    </span>
                    {view.dealerSeatId === seatLayout.left && <span className="ml-1 text-amber-300/70">·D</span>}
                  </div>
                  <div className="flex -space-x-5">
                    {Array.from({ length: leftCount }).map((_, index) => (
                      <div key={index} className="h-16 w-11 rounded-xl border border-white/10 bg-slate-950 shadow-xl sm:h-20 sm:w-14 sm:rounded-2xl" />
                    ))}
                  </div>
                </div>
              )}

              {/* Right opponent */}
              {!isWaiting && (
                <div className={`absolute right-0 top-1/2 flex max-w-[6rem] -translate-y-1/2 flex-col items-center gap-3 rounded-[20px] p-2 transition sm:max-w-none ${isOpponentRightTurn ? 'ring-1 ring-rose-400/30' : ''}`}>
                  <div className="rounded-full border border-rose-300/20 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
                    <span className="block max-w-[4rem] truncate sm:max-w-none">
                      {view.players[seatLayout.right].nickname}
                    </span>
                    {view.dealerSeatId === seatLayout.right && <span className="ml-1 text-amber-300/70">·D</span>}
                  </div>
                  <div className="flex -space-x-5">
                    {Array.from({ length: rightCount }).map((_, index) => (
                      <div key={index} className="h-16 w-11 rounded-xl border border-white/10 bg-slate-950 shadow-xl sm:h-20 sm:w-14 sm:rounded-2xl" />
                    ))}
                  </div>
                </div>
              )}

              {/* Top partner */}
              {!isWaiting && (
                <div className="absolute top-0 flex w-full flex-col items-center gap-3 pt-2">
                  <div className="rounded-full border border-indigo-300/20 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-100">
                    {view.players[seatLayout.top].nickname}
                    {view.dealerSeatId === seatLayout.top && <span className="ml-1 text-amber-300/70">·D</span>}
                  </div>
                  <div className="flex gap-2">
                    {topCards.map((card) => (
                      <CardView
                        key={card.id}
                        card={card}
                        manilhaRank={view.manilhaRank}
                        onClick={isTopTurn && !commandPending ? () => handleCardPlay(seatLayout.top, card) : undefined}
                        active={isTopTurn && !commandPending}
                        compact
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Center: GAME_END card, waiting invite, or table */}
              {isGameEnd ? (
                <div className="glass flex flex-col items-center gap-4 rounded-[28px] px-8 py-7 text-center">
                  {gameWon ? (
                    <Trophy className="h-10 w-10 text-emerald-300" />
                  ) : (
                    <Swords className="h-10 w-10 text-rose-300" />
                  )}
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
                      {gameWon ? 'Vitoria!' : 'Derrota'}
                    </p>
                    <p className="text-3xl font-black text-white">{scoreUs} × {scoreThem}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (rematchRequested) return;
                      setRematchRequested(true);
                      sendCommand(createCommand('REMATCH', { requestedBySeatId: view.ownedSeatIds[0] }));
                    }}
                    disabled={commandPending}
                    className={`rounded-2xl border px-6 py-3 text-sm font-black uppercase tracking-[0.18em] transition disabled:opacity-50 ${
                      rematchRequested
                        ? 'border-white/20 bg-white/5 text-white/50'
                        : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {rematchRequested
                        ? <><LoaderCircle className="h-4 w-4 animate-spin" />Aguardando adversario...</>
                        : <><RefreshCcw className="h-4 w-4" />Revanche</>
                      }
                    </span>
                  </button>
                </div>
              ) : isWaiting ? (
                <div className="glass flex flex-col items-center gap-4 rounded-[28px] px-8 py-7 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">Compartilhe o codigo</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-4xl font-black tracking-[0.22em] text-white">{view.roomCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(view.roomCode)}
                      title="Copiar codigo"
                      className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/60 transition hover:text-white"
                    >
                      {codeCopied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-white/40">Aguardando o segundo jogador...</p>
                </div>
              ) : (
                <div className="glass flex h-60 w-60 items-center justify-center rounded-full">
                  <div className="relative h-44 w-44">
                    {view.roundCards.map((playedCard) => {
                      const position = playedCard.seatId === seatLayout.bottom
                        ? 'left-1/2 top-[58%] -translate-x-1/2'
                        : playedCard.seatId === seatLayout.top
                          ? 'left-1/2 top-[4%] -translate-x-1/2'
                          : playedCard.seatId === seatLayout.left
                            ? 'left-[2%] top-1/2 -translate-y-1/2'
                            : 'right-[2%] top-1/2 -translate-y-1/2';

                      return (
                        <div key={`${playedCard.seatId}-${playedCard.card?.id ?? 'covered'}`} className={`absolute ${position}`}>
                          <CardView
                            card={playedCard.card}
                            hidden={playedCard.hidden}
                            manilhaRank={view.manilhaRank}
                            compact
                          />
                        </div>
                      );
                    })}

                    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-center">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Mesa</span>
                      <span className="text-sm font-black text-white">{view.message}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom player */}
              <div className="absolute bottom-0 flex w-full flex-col items-center gap-4 pb-4">
                {!isGameEnd && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCoveredMode((current) => !current)}
                      disabled={!playAction?.canPlayCovered || commandPending}
                      className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.18em] ${
                        coveredMode
                          ? 'border-amber-300/50 bg-amber-400 text-black'
                          : 'border-white/10 bg-white/5 text-white/75'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4" />
                        Coberta
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestTrucoAction && sendCommand(createCommand('REQUEST_TRUCO', { seatId: playAction?.seatId ?? view.ownedSeatIds[0] }))}
                      disabled={!requestTrucoAction || commandPending}
                      className="rounded-2xl bg-amber-400 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black disabled:opacity-50"
                    >
                      Trucar
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  {bottomCards.map((card) => (
                    <CardView
                      key={card.id}
                      card={card}
                      manilhaRank={view.manilhaRank}
                      onClick={isBottomTurn && !commandPending ? () => handleCardPlay(seatLayout.bottom, card) : undefined}
                      active={isBottomTurn && !commandPending}
                    />
                  ))}
                </div>

                <div className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                  isBottomTurn
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-emerald-300/20 bg-black/30 text-emerald-200'
                }`}>
                  {view.players[seatLayout.bottom].nickname}
                  {view.dealerSeatId === seatLayout.bottom && <span className="ml-1 text-amber-300/70">·D</span>}
                </div>
              </div>

            </div>
          </div>

          {/* Footer status */}
          <div className="glass mx-3 mb-3 grid gap-3 rounded-[26px] px-4 py-3 lg:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Users className="h-4 w-4 shrink-0 text-emerald-200" />
              {isWaiting
                ? 'Compartilhe o codigo da sala com um amigo para comecar a partida.'
                : `${view.players[seatLayout.bottom].nickname} e ${view.players[seatLayout.top].nickname} compartilham as cartas visiveis da dupla.`
              }
            </div>
            <div className="flex items-center gap-2 text-sm">
              {connectionState === 'reconnecting' && <LoaderCircle className="h-4 w-4 animate-spin text-amber-300" />}
              {connectionState === 'disconnected' && <AlertCircle className="h-4 w-4 text-rose-300" />}
              {connectionState === 'connected' && <Swords className="h-4 w-4 text-emerald-300" />}
              <span className="font-medium text-white/70">{connectionState}</span>
            </div>
          </div>
        </main>

        {logs.length > 0 && (
          <aside className="glass mx-3 mb-3 rounded-[26px] px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white/35">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Log da partida
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {logs.map((log, index) => (
                <div key={`${log}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white/65">
                  {log}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Truco decision modal — hidden while game is paused */}
      {respondTrucoAction && view.trucoPending && !isPausedReconnect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-[28px] border border-amber-300/25 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-400/15 p-3 text-amber-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100/60">Decisao</p>
                <h3 className="text-xl font-black text-amber-100">
                  {trucoRequesterName} pediu truco!
                </h3>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'accept' }))}
                disabled={commandPending}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black disabled:opacity-50"
              >
                Aceitar · {view.trucoPending.requestedValue} pts
              </button>
              {respondTrucoAction.actions.includes('raise') && raiseTarget !== null && raiseTarget <= 12 && (
                <button
                  type="button"
                  onClick={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'raise' }))}
                  disabled={commandPending}
                  className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-100 disabled:opacity-50"
                >
                  Aumentar → {raiseTarget} pts
                </button>
              )}
              <button
                type="button"
                onClick={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'run' }))}
                disabled={commandPending}
                className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 disabled:opacity-50"
              >
                Correr · {view.trucoPending.acceptedValue} pts para eles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAUSED_RECONNECT overlay — opponent disconnected */}
      {isPausedReconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="glass flex w-full max-w-sm flex-col items-center gap-5 rounded-[28px] px-8 py-8 text-center shadow-2xl shadow-black/60">
            <div className="rounded-full border border-amber-300/20 bg-amber-500/10 p-4">
              <LoaderCircle className="h-8 w-8 animate-spin text-amber-300" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">Conexao interrompida</p>
              <h3 className="mt-1 text-xl font-black text-white">Adversario desconectou</h3>
              <p className="mt-2 text-sm text-white/55">
                Aguardando reconexao. O jogo continuara automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={leaveSession}
              className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/60 transition hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair da sala
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
