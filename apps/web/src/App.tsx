import { Room } from '@colyseus/sdk';
import {
  AvailableAction,
  Card,
  ClientGameView,
  ClientMatchEvent,
  GameCommand,
  SeatId,
  TeamId,
  getSeatLayoutForTeam,
} from '@truco/contracts';
import {
  AlertCircle,
  Crown,
  EyeOff,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { CardView } from './components/Card.js';
import { clearStoredSession, createColyseusClient, getServerHttpUrl, loadStoredSession, saveStoredSession } from './lib/network.js';
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

function getRoomStatusTone(view: ClientGameView | null): string {
  if (!view) {
    return 'text-white/60';
  }

  if (view.roomLifecycle === 'PAUSED_RECONNECT') {
    return 'text-amber-300';
  }

  if (view.gamePhase === 'GAME_END') {
    return 'text-emerald-300';
  }

  return 'text-white/60';
}

export default function App() {
  const [nickname, setNickname] = useState(() => loadStoredSession()?.nickname ?? '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [view, setView] = useState<ClientGameView | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coveredMode, setCoveredMode] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef(loadStoredSession());

  const viewerTeamId = useMemo<TeamId | null>(() => {
    if (!view) {
      return null;
    }

    return view.ownedSeatIds[0] % 2 === 0 ? 0 : 1;
  }, [view]);

  const seatLayout = useMemo(() => (
    viewerTeamId === null ? null : getSeatLayoutForTeam(viewerTeamId)
  ), [viewerTeamId]);

  const playAction = view ? getAction(view.availableActions, 'PLAY_CARD') : null;
  const requestTrucoAction = view ? getAction(view.availableActions, 'REQUEST_TRUCO') : null;
  const respondTrucoAction = view ? getAction(view.availableActions, 'RESPOND_TRUCO') : null;

  useEffect(() => {
    const snapshot = loadStoredSession();
    if (!snapshot) {
      return;
    }

    void reconnect(snapshot.reconnectionToken);
  }, []);

  useEffect(() => {
    if (!playAction?.canPlayCovered && coveredMode) {
      setCoveredMode(false);
    }
  }, [coveredMode, playAction?.canPlayCovered]);

  useEffect(() => {
    setView((current) => (current ? { ...current, connectionState } : current));
  }, [connectionState]);

  async function attachRoom(room: Room, fallbackNickname: string): Promise<void> {
    roomRef.current = room;
    setConnectionState('connected');
    setBusy(false);

    room.onMessage('match_event', (event: ClientMatchEvent) => {
      setLogs((current) => [describeEvent(event), ...current].slice(0, 12));
    });

    room.onMessage('command_rejected', (payload) => {
      setError(String(payload.message ?? 'Comando rejeitado.'));
    });

    room.onStateChange((state) => {
      startTransition(() => {
        const nextView = buildClientView(state, 'connected');
        if (nextView) {
          const snapshot = {
            nickname: fallbackNickname,
            roomCode: nextView.roomCode,
            roomId: room.roomId,
            ownedSeatIds: nextView.ownedSeatIds,
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
        throw new Error('Sala nao encontrada ou indisponivel.');
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

    try {
      const client = createColyseusClient();
      const room = await client.reconnect(reconnectionToken);
      await attachRoom(room, (sessionRef.current?.nickname ?? nickname.trim()) || 'Jogador');
    } catch {
      setBusy(false);
      setConnectionState('disconnected');
      clearStoredSession();
    }
  }

  function sendCommand(command: GameCommand): void {
    roomRef.current?.send('command', command);
  }

  function handleCardPlay(seatId: SeatId, card: Card): void {
    if (!playAction || playAction.seatId !== seatId) {
      return;
    }

    sendCommand(createCommand('PLAY_CARD', {
      seatId,
      cardId: card.id,
      mode: coveredMode ? 'covered' : 'open',
    }));
    setCoveredMode(false);
  }

  function leaveSession(): void {
    clearStoredSession();
    roomRef.current?.leave();
    roomRef.current = null;
    setView(null);
    setLogs([]);
    setConnectionState('disconnected');
  }

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
              Cada jogador controla dois assentos opostos. O servidor resolve toda a regra, sincroniza a mesa e preserva a visibilidade das cartas da propria dupla.
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

            <div className="space-y-3">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Seu apelido"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
              />
              <input
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                placeholder="Codigo da sala"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
              />
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
                onClick={() => void createRoom()}
                disabled={busy}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black"
              >
                {busy ? 'Conectando...' : 'Criar sala'}
              </button>
              <button
                type="button"
                onClick={() => void joinRoom()}
                disabled={busy}
                className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white"
              >
                Entrar por codigo
              </button>
              {storedSession && (
                <button
                  type="button"
                  onClick={() => void reconnect(storedSession.reconnectionToken)}
                  disabled={busy}
                  className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-200"
                >
                  Reconectar na ultima sala
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bottomCards = view.visibleHands[seatLayout.bottom] ?? [];
  const topCards = view.visibleHands[seatLayout.top] ?? [];
  const leftCount = view.opponentHandCounts[seatLayout.left] ?? 0;
  const rightCount = view.opponentHandCounts[seatLayout.right] ?? 0;
  const isBottomTurn = playAction?.seatId === seatLayout.bottom;
  const isTopTurn = playAction?.seatId === seatLayout.top;
  const scoreUs = viewerTeamId === 0 ? view.scores[0] : view.scores[1];
  const scoreThem = viewerTeamId === 0 ? view.scores[1] : view.scores[0];

  return (
    <div className="min-h-screen px-3 py-3 sm:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-black/20 shadow-2xl shadow-black/50">
        <header className="glass flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-300/70">Truco online</p>
            <h1 className="text-2xl font-black text-white">Sala {view.roomCode}</h1>
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
            <div className={`rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] ${getRoomStatusTone(view)}`}>
              {view.gamePhase} · {view.roomLifecycle}
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
          <div className="glass mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[26px] px-4 py-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/35">Estado</p>
              <h2 className="text-lg font-black text-white">{view.message}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex flex-1 items-center justify-center px-4 py-3">
            <div className="relative flex h-full w-full max-w-6xl items-center justify-center">
              <div className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
                <div className="rounded-full border border-rose-300/20 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
                  {view.players[seatLayout.left].nickname}
                </div>
                <div className="flex -space-x-5">
                  {Array.from({ length: leftCount }).map((_, index) => (
                    <div key={index} className="h-20 w-14 rounded-2xl border border-white/10 bg-slate-950 shadow-2xl" />
                  ))}
                </div>
              </div>

              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
                <div className="rounded-full border border-rose-300/20 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
                  {view.players[seatLayout.right].nickname}
                </div>
                <div className="flex -space-x-5">
                  {Array.from({ length: rightCount }).map((_, index) => (
                    <div key={index} className="h-20 w-14 rounded-2xl border border-white/10 bg-slate-950 shadow-2xl" />
                  ))}
                </div>
              </div>

              <div className="absolute top-0 flex w-full flex-col items-center gap-3 pt-2">
                <div className="rounded-full border border-indigo-300/20 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-100">
                  {view.players[seatLayout.top].nickname}
                </div>
                <div className="flex gap-2">
                  {topCards.map((card) => (
                    <CardView
                      key={card.id}
                      card={card}
                      manilhaRank={view.manilhaRank}
                      onClick={isTopTurn ? () => handleCardPlay(seatLayout.top, card) : undefined}
                      active={isTopTurn}
                      compact
                    />
                  ))}
                </div>
              </div>

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

              <div className="absolute bottom-0 flex w-full flex-col items-center gap-4 pb-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCoveredMode((current) => !current)}
                    disabled={!playAction?.canPlayCovered}
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
                    disabled={!requestTrucoAction}
                    className="rounded-2xl bg-amber-400 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black"
                  >
                    Trucar
                  </button>
                  {view.gamePhase === 'GAME_END' && (
                    <button
                      type="button"
                      onClick={() => sendCommand(createCommand('REMATCH', { requestedBySeatId: view.ownedSeatIds[0] }))}
                      className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-200"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Revanche
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  {bottomCards.map((card) => (
                    <CardView
                      key={card.id}
                      card={card}
                      manilhaRank={view.manilhaRank}
                      onClick={isBottomTurn ? () => handleCardPlay(seatLayout.bottom, card) : undefined}
                      active={isBottomTurn}
                    />
                  ))}
                </div>

                <div className="rounded-full border border-emerald-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                  {view.players[seatLayout.bottom].nickname}
                </div>
              </div>
            </div>
          </div>

          <div className="glass mx-3 mb-3 grid gap-3 rounded-[26px] px-4 py-3 lg:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Users className="h-4 w-4 text-emerald-200" />
              {view.players[seatLayout.bottom].nickname} e {view.players[seatLayout.top].nickname} compartilham as cartas visiveis da dupla.
            </div>
            <div className="flex items-center gap-2 text-sm">
              {connectionState === 'reconnecting' && <LoaderCircle className="h-4 w-4 animate-spin text-amber-300" />}
              {connectionState === 'disconnected' && <AlertCircle className="h-4 w-4 text-rose-300" />}
              {connectionState === 'connected' && <Swords className="h-4 w-4 text-emerald-300" />}
              <span className="font-medium text-white/70">{connectionState}</span>
            </div>
          </div>
        </main>

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
      </div>

      {respondTrucoAction && view.trucoPending && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-[28px] border border-amber-300/25 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-400/15 p-3 text-amber-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100/60">Decisao</p>
                <h3 className="text-xl font-black text-amber-100">Rodada valendo {view.trucoPending.requestedValue}</h3>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'accept' }))}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black"
              >
                Aceitar
              </button>
              {respondTrucoAction.actions.includes('raise') && (
                <button
                  type="button"
                  onClick={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'raise' }))}
                  className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-100"
                >
                  Aumentar
                </button>
              )}
              <button
                type="button"
                onClick={() => sendCommand(createCommand('RESPOND_TRUCO', { action: 'run' }))}
                className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100"
              >
                Correr
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
