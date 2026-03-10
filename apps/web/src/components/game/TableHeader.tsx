import { ConnectionState } from '@truco/contracts';
import { Check, Copy, LogOut } from 'lucide-react';

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
    const connectionDot =
      connectionState === 'reconnecting'
        ? 'bg-amber-400 animate-pulse'
        : connectionState === 'disconnected'
          ? 'bg-rose-400'
          : 'bg-emerald-400';

    return (
      <header className="table-surface safe-top flex items-center gap-2 rounded-[20px] px-3 py-2">
        {/* Room code as compact copy pill — takes remaining space */}
        <button
          type="button"
          onClick={onCopyCode}
          title="Copiar código da sala"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/10 bg-white/5 px-2.5 py-1.5 text-left"
        >
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${connectionDot}`} />
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-black uppercase tracking-[0.14em] text-white/80">
            {roomCode}
          </span>
          {codeCopied ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0 text-white/35" />
          )}
        </button>

        {/* Score — compact monospace */}
        <div className="flex shrink-0 items-center gap-1 font-mono text-sm font-black tabular-nums">
          <span className="text-emerald-300">{scoreUs}</span>
          <span className="text-white/25">–</span>
          <span className="text-rose-300">{scoreThem}</span>
        </div>

        {/* Leave */}
        <button
          type="button"
          onClick={onLeave}
          title="Sair da sala"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-white/55"
        >
          <LogOut className="h-4 w-4" />
        </button>
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
