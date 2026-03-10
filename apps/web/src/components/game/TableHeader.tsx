import { ConnectionState } from '@truco/contracts';
import {
  AlertCircle,
  Check,
  Copy,
  List,
  LoaderCircle,
  LogOut,
  Swords,
} from 'lucide-react';

interface TableHeaderProps {
  roomCode: string;
  codeCopied: boolean;
  scoreUs: number;
  scoreThem: number;
  roomLifecycle: string;
  statusTone: 'neutral' | 'warning' | 'success';
  onCopyCode: () => void;
  onLeave: () => void;
  connectionState?: ConnectionState;
  logCount?: number;
  logsOpen?: boolean;
  onToggleLogs?: () => void;
  phoneMode?: boolean;
}

export function TableHeader({
  roomCode,
  codeCopied,
  scoreUs,
  scoreThem,
  roomLifecycle,
  statusTone,
  onCopyCode,
  onLeave,
  connectionState = 'connected',
  logCount = 0,
  logsOpen = false,
  onToggleLogs,
  phoneMode = false,
}: TableHeaderProps) {
  const statusClass =
    statusTone === 'warning'
      ? 'border-amber-300/30 bg-amber-500/10 text-amber-200'
      : statusTone === 'success'
        ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-200'
        : 'border-white/10 bg-white/5 text-white/60';

  if (phoneMode) {
    const connectionIcon =
      connectionState === 'reconnecting' ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-300" />
      ) : connectionState === 'disconnected' ? (
        <AlertCircle className="h-3.5 w-3.5 text-rose-300" />
      ) : (
        <Swords className="h-3.5 w-3.5 text-emerald-300" />
      );

    return (
      <header className="table-surface safe-top flex flex-col gap-2 rounded-[22px] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300/70">
              Truco online
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-lg font-black leading-none text-white">
                Sala {roomCode}
              </h1>
              <button
                type="button"
                onClick={onCopyCode}
                title="Copiar codigo da sala"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65"
              >
                {codeCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onLeave}
            title="Sair da sala"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="grid min-w-[6.25rem] grid-cols-2 overflow-hidden rounded-[18px] border border-white/10 bg-black/30">
            <div className="px-2.5 py-2 text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">
                Nos
              </p>
              <p className="font-mono text-2xl font-black leading-none text-emerald-300">
                {scoreUs}
              </p>
            </div>
            <div className="border-l border-white/10 px-2.5 py-2 text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">
                Eles
              </p>
              <p className="font-mono text-2xl font-black leading-none text-rose-300">
                {scoreThem}
              </p>
            </div>
          </div>

          <div
            className={`rounded-xl border px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${statusClass}`}
          >
            {roomLifecycle}
          </div>

          {logCount > 0 && onToggleLogs && (
            <button
              type="button"
              onClick={onToggleLogs}
              className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                logsOpen
                  ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-white/65'
              }`}
            >
              <List className="h-4 w-4" />
              Log {logCount > 9 ? '9+' : logCount}
            </button>
          )}

          <div className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
            {connectionIcon}
            {connectionState}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="table-surface safe-top flex flex-wrap items-start justify-between gap-2.5 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-300/70">
              Truco online
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-[1.45rem] font-black leading-none text-white sm:text-[2.3rem]">
                Sala {roomCode}
              </h1>
              <button
                type="button"
                onClick={onCopyCode}
                title="Copiar codigo da sala"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white sm:h-11 sm:w-11 sm:rounded-2xl"
              >
                {codeCopied ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-start justify-between gap-2 sm:w-auto sm:items-center">
        <div className="grid min-w-[8.5rem] grid-cols-2 overflow-hidden rounded-[18px] border border-white/10 bg-black/30 sm:min-w-[10rem] sm:rounded-[24px]">
          <div className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
              Nos
            </p>
            <p className="font-mono text-3xl font-black leading-none text-emerald-300 sm:text-4xl">
              {scoreUs}
            </p>
          </div>
          <div className="border-l border-white/10 px-3 py-2.5 text-center sm:px-4 sm:py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
              Eles
            </p>
            <p className="font-mono text-3xl font-black leading-none text-rose-300 sm:text-4xl">
              {scoreThem}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`rounded-xl border px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] sm:rounded-2xl sm:px-3 sm:text-xs sm:tracking-[0.22em] ${statusClass}`}
          >
            {roomLifecycle}
          </div>
          <button
            type="button"
            onClick={onLeave}
            title="Sair da sala"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white sm:h-11 sm:w-11 sm:rounded-2xl"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
