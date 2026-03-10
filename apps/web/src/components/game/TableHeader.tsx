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
    <header className="table-surface safe-top flex items-center gap-3 rounded-[24px] px-3 py-2 sm:rounded-[28px] sm:px-4 sm:py-2.5">
      {/* Room code + copy — takes remaining space */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate font-mono text-lg font-black leading-none text-white sm:text-xl">
          {roomCode}
        </h1>
        <button
          type="button"
          onClick={onCopyCode}
          title="Copiar codigo da sala"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          {codeCopied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Score — compact blocks */}
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-[14px] border border-white/10 bg-black/30">
        <div className="px-3 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">Nós</p>
          <p className="font-mono text-xl font-black leading-none text-emerald-300">
            {scoreUs}
          </p>
        </div>
        <div className="border-l border-white/10 px-3 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">Eles</p>
          <p className="font-mono text-xl font-black leading-none text-rose-300">
            {scoreThem}
          </p>
        </div>
      </div>

      {/* Status + Leave */}
      <div className="flex shrink-0 items-center gap-2">
        <div
          className={`rounded-xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${statusClass}`}
        >
          {roomLifecycle}
        </div>
        <button
          type="button"
          onClick={onLeave}
          title="Sair da sala"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
