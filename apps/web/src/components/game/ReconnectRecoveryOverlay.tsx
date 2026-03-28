import {
  AlertTriangle,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  ServerCrash,
  WifiOff,
} from 'lucide-react';
import type { ReconnectStatus } from '../../lib/reconnect.js';

interface ReconnectRecoveryOverlayProps {
  onRetry: () => void;
  onReturnToLobby: () => void;
  status: ReconnectStatus;
}

function getOverlayCopy(status: ReconnectStatus): {
  description: string;
  eyebrow: string;
  icon: 'loading' | 'offline' | 'terminal';
  title: string;
} {
  if (status.phase === 'transport_reconnecting') {
    return {
      description:
        status.message ?? 'Estamos retomando o websocket da partida.',
      eyebrow: 'Reconexao',
      icon: 'loading',
      title: 'Reconectando transporte',
    };
  }

  if (status.phase === 'offline') {
    return {
      description:
        status.message ??
        'Sua conexao caiu. Assim que ela voltar, retomamos as tentativas.',
      eyebrow: 'Modo offline',
      icon: 'offline',
      title: 'Voce esta offline',
    };
  }

  if (status.phase === 'session_recovering') {
    return {
      description:
        status.message ??
        'Ainda estamos dentro da janela de recuperacao da sessao.',
      eyebrow: 'Recuperacao',
      icon: 'loading',
      title: 'Recuperando sessao',
    };
  }

  return {
    description:
      status.message ??
      'A recuperacao nao conseguiu retomar a partida nesta tentativa.',
    eyebrow: 'Falha terminal',
    icon: 'terminal',
    title:
      status.lastFailureReason === 'boot_changed'
        ? 'Servidor reiniciou'
        : 'Sessao indisponivel',
  };
}

export function ReconnectRecoveryOverlay({
  onRetry,
  onReturnToLobby,
  status,
}: ReconnectRecoveryOverlayProps) {
  const copy = getOverlayCopy(status);
  const elapsedSeconds = status.startedAt
    ? Math.max(1, Math.ceil((Date.now() - status.startedAt) / 1_000))
    : 0;
  const canRetry = status.lastFailureReason !== 'boot_changed';

  return (
    <div className="fixed inset-0 z-[46] flex items-center justify-center bg-black/78 px-4 backdrop-blur-sm">
      <div className="table-surface safe-bottom flex w-full max-w-sm flex-col items-center gap-5 rounded-[30px] px-6 py-7 text-center shadow-2xl shadow-black/60">
        <div className="rounded-full border border-amber-300/20 bg-amber-500/10 p-4 text-amber-200">
          {copy.icon === 'loading' ? (
            <LoaderCircle className="h-8 w-8 animate-spin" />
          ) : copy.icon === 'offline' ? (
            <WifiOff className="h-8 w-8" />
          ) : (
            <ServerCrash className="h-8 w-8" />
          )}
        </div>

        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
            {copy.eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-black text-white">{copy.title}</h3>
          <p className="mt-2 text-sm text-white/55">{copy.description}</p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
            {status.attempts} tentativas · {elapsedSeconds}s
          </p>
        </div>

        {canRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:brightness-105"
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar agora
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            A sessao anterior nao pode ser retomada apos o restart do backend.
          </div>
        )}

        <button
          type="button"
          onClick={onReturnToLobby}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/70 transition hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Voltar ao lobby
        </button>
      </div>
    </div>
  );
}
