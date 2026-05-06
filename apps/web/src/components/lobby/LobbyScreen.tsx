import { AlertCircle, Copy, Crown, Link2, RefreshCcw, Sparkles } from 'lucide-react';
import {
  ClientStorageSnapshot,
  PublicRoom,
  RoomMatchFormat,
  UserProfile,
} from '@truco/contracts';

interface LobbyScreenProps {
  busy: boolean;
  copiedRoomCode: string | null;
  error: string | null;
  lobbyMode: 'create' | 'join';
  matchFormat: RoomMatchFormat;
  nickname: string;
  onCopyRoomLink: (roomCode: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenRoom: (roomCode: string) => void;
  onReconnect: (reconnectionToken: string, roomCode: string) => void;
  publicRooms: PublicRoom[];
  roomCodeInput: string;
  roomsLoading: boolean;
  routeRoomCode: string | null;
  setLobbyMode: (mode: 'create' | 'join') => void;
  setMatchFormat: (value: RoomMatchFormat) => void;
  setNickname: (value: string) => void;
  setRoomCodeInput: (value: string) => void;
  storedSession: ClientStorageSnapshot | null;
  storedUser: UserProfile | null;
  userRooms: PublicRoom[];
}

function getMatchFormatLabel(matchFormat: RoomMatchFormat): string {
  return matchFormat === 'best_of_3'
    ? 'Melhor de 3 partidas'
    : '1 partida';
}

function getStatusLabel(status: PublicRoom['status']): string {
  switch (status) {
    case 'waiting':
      return 'Aguardando';
    case 'playing':
      return 'Em jogo';
    case 'finished':
      return 'Finalizada';
    case 'abandoned':
      return 'Encerrada';
    default:
      return status;
  }
}

function RoomListCard({
  copiedRoomCode,
  onCopyRoomLink,
  onOpenRoom,
  room,
}: {
  copiedRoomCode: string | null;
  onCopyRoomLink: (roomCode: string) => void;
  onOpenRoom: (roomCode: string) => void;
  room: PublicRoom;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-black tracking-[0.18em] text-white">
            {room.roomCode}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
            {getStatusLabel(room.status)} · {room.players}/{room.maxPlayers} ·{' '}
            {getMatchFormatLabel(room.matchFormat)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCopyRoomLink(room.roomCode)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:text-white"
          title="Copiar link"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenRoom(room.roomCode)}
          disabled={!room.canJoin}
          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition ${
            room.canJoin
              ? 'bg-emerald-400 text-black'
              : 'border border-white/10 bg-white/5 text-white/40'
          }`}
        >
          {room.status === 'playing' ? 'Continuar' : 'Entrar'}
        </button>
        <span className="min-w-24 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
          {copiedRoomCode === room.roomCode ? 'Link copiado' : 'Copiar link'}
        </span>
      </div>
    </div>
  );
}

export function LobbyScreen({
  busy,
  copiedRoomCode,
  error,
  lobbyMode,
  matchFormat,
  nickname,
  onCopyRoomLink,
  onCreateRoom,
  onJoinRoom,
  onOpenRoom,
  onReconnect,
  publicRooms,
  roomCodeInput,
  roomsLoading,
  routeRoomCode,
  setLobbyMode,
  setMatchFormat,
  setNickname,
  setRoomCodeInput,
  storedSession,
  storedUser,
  userRooms,
}: LobbyScreenProps) {
  const primaryLabel =
    lobbyMode === 'create'
      ? busy
        ? 'Criando sala...'
        : 'Criar sala'
      : busy
        ? 'Entrando...'
        : routeRoomCode
          ? `Entrar na sala ${routeRoomCode}`
          : 'Entrar por codigo';

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Truco online em producao
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Crie a sala, compartilhe o link e volte para a mesa quando quiser.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-white/65 sm:text-base">
              O jogo continua sendo 1x1 em dupla, com servidor autoritativo,
              reconexao basica e salas persistidas para voce retomar o fluxo sem
              depender de suporte tecnico.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                  Perfil
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {storedUser?.nickname ?? 'Visitante'}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                  Minhas salas
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {userRooms.length}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                  Salas abertas
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {publicRooms.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-black/35 p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                  Area do usuario
                </p>
                <h2 className="text-xl font-black text-white">
                  {storedUser ? `Ola, ${storedUser.nickname}` : 'Entrar na plataforma'}
                </h2>
              </div>
            </div>

            {routeRoomCode && (
              <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Convite direto detectado para a sala{' '}
                <span className="font-mono font-black tracking-[0.18em]">
                  {routeRoomCode}
                </span>
                .
              </div>
            )}

            <div className="mt-5 flex rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setLobbyMode('create')}
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
                onClick={() => setLobbyMode('join')}
                className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  lobbyMode === 'join'
                    ? 'bg-emerald-400 text-black'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Entrar por codigo
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && lobbyMode === 'create') {
                    onCreateRoom();
                  }
                }}
                placeholder="Seu apelido"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
              />

              {lobbyMode === 'create' && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                    Formato da sala
                  </p>
                  <p className="mt-2 text-sm text-white/60">
                    Escolha se quem criar a sala vai jogar uma partida unica ou
                    uma serie melhor de 3 partidas.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setMatchFormat('single')}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        matchFormat === 'single'
                          ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/10 bg-white/5 text-white/60'
                      }`}
                    >
                      <span className="block text-sm font-black uppercase tracking-[0.14em]">
                        1 partida
                      </span>
                      <span className="mt-1 block text-xs text-current/75">
                        A sala termina quando a partida atual acabar.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFormat('best_of_3')}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        matchFormat === 'best_of_3'
                          ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/10 bg-white/5 text-white/60'
                      }`}
                    >
                      <span className="block text-sm font-black uppercase tracking-[0.14em]">
                        Melhor de 3 partidas
                      </span>
                      <span className="mt-1 block text-xs text-current/75">
                        Vence quem ganhar 2 partidas primeiro.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {lobbyMode === 'join' && (
                <input
                  value={roomCodeInput}
                  onChange={(event) =>
                    setRoomCodeInput(
                      event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onJoinRoom();
                    }
                  }}
                  placeholder="Codigo da sala"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm uppercase tracking-[0.18em] outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
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
              {lobbyMode === 'create' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                  Sala sera criada como: {getMatchFormatLabel(matchFormat)}
                </div>
              )}

              <button
                type="button"
                onClick={lobbyMode === 'create' ? onCreateRoom : onJoinRoom}
                disabled={busy}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black disabled:opacity-60"
              >
                {primaryLabel}
              </button>

              {storedSession && (
                <button
                  type="button"
                  onClick={() =>
                    onReconnect(
                      storedSession.reconnectionToken,
                      storedSession.roomCode,
                    )
                  }
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-200 disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reconectar · {storedSession.roomCode}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[32px] border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                  Minhas salas
                </p>
                <h3 className="text-2xl font-black text-white">
                  Criadas ou participadas
                </h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/55">
                {roomsLoading ? 'Atualizando...' : `${userRooms.length} salas`}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {userRooms.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
                  Suas salas vao aparecer aqui assim que voce criar ou entrar em
                  uma partida.
                </div>
              )}

              {userRooms.map((room) => (
                <RoomListCard
                  key={`user-${room.id}`}
                  copiedRoomCode={copiedRoomCode}
                  onCopyRoomLink={onCopyRoomLink}
                  onOpenRoom={onOpenRoom}
                  room={room}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                  Salas abertas
                </p>
                <h3 className="text-2xl font-black text-white">
                  Entrar por lista
                </h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/55">
                <Link2 className="mr-2 inline h-4 w-4" />
                {publicRooms.length} disponiveis
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {!roomsLoading && publicRooms.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
                  Nenhuma sala aguardando jogadores agora. Crie uma nova mesa e
                  compartilhe o link.
                </div>
              )}

              {publicRooms.map((room) => (
                <RoomListCard
                  key={`public-${room.id}`}
                  copiedRoomCode={copiedRoomCode}
                  onCopyRoomLink={onCopyRoomLink}
                  onOpenRoom={onOpenRoom}
                  room={room}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
