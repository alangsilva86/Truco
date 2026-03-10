import { AlertCircle, Crown, Sparkles } from 'lucide-react';
import { ClientStorageSnapshot } from '@truco/contracts';
import { RefObject } from 'react';

interface LobbyScreenProps {
  busy: boolean;
  codeInputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  lobbyMode: 'create' | 'join';
  nickname: string;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onReconnect: (reconnectionToken: string) => void;
  roomCodeInput: string;
  setLobbyMode: (mode: 'create' | 'join') => void;
  setNickname: (value: string) => void;
  setRoomCodeInput: (value: string) => void;
  storedSession: ClientStorageSnapshot | null;
}

export function LobbyScreen({
  busy,
  codeInputRef,
  error,
  lobbyMode,
  nickname,
  onCreateRoom,
  onJoinRoom,
  onReconnect,
  roomCodeInput,
  setLobbyMode,
  setNickname,
  setRoomCodeInput,
  storedSession,
}: LobbyScreenProps) {
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                Lobby
              </p>
              <h2 className="text-xl font-black text-white">Entrar na mesa</h2>
            </div>
          </div>

          <div className="mb-4 flex rounded-2xl border border-white/10 bg-white/5 p-1">
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

          <div className="space-y-3">
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  if (lobbyMode === 'create') {
                    onCreateRoom();
                    return;
                  }

                  codeInputRef.current?.focus();
                }
              }}
              placeholder="Seu apelido"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
            />

            {lobbyMode === 'join' && (
              <input
                ref={codeInputRef}
                value={roomCodeInput}
                onChange={(event) =>
                  setRoomCodeInput(event.target.value.toUpperCase())
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onJoinRoom();
                  }
                }}
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
              onClick={lobbyMode === 'create' ? onCreateRoom : onJoinRoom}
              disabled={busy}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black disabled:opacity-60"
            >
              {busy
                ? 'Conectando...'
                : lobbyMode === 'create'
                  ? 'Criar sala'
                  : 'Entrar por codigo'}
            </button>

            {storedSession && (
              <button
                type="button"
                onClick={() => onReconnect(storedSession.reconnectionToken)}
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
