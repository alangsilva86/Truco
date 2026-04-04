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
  logCount: _logCount = 0,
  logsOpen: _logsOpen = false,
  onToggleLogs: _onToggleLogs,
  phoneMode = false,
}: TableHeaderProps) {
  const statusClass =
    statusTone === 'warning'
      ? 'border-amber-100/80 bg-amber-400/24 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
      : statusTone === 'success'
        ? 'border-emerald-100/75 bg-emerald-500/20 text-emerald-50 shadow-[0_0_16px_rgba(16,185,129,0.18)]'
        : 'border-white/14 bg-white/8 text-white/88';

  if (phoneMode) {
    const connectionDot =
      connectionState === 'reconnecting'
        ? 'bg-amber-300 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.55)]'
        : connectionState === 'disconnected'
          ? 'bg-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.45)]'
          : 'bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]';

    return (
      <header className="table-surface safe-top flex items-center gap-2 rounded-[20px] px-3 py-2">
        {/* Room code as compact copy pill — takes remaining space */}
        <button
          type="button"
          onClick={onCopyCode}
          title="Copiar código da sala"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/14 bg-white/8 px-2.5 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <div
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${connectionDot}`}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-black uppercase tracking-[0.14em] text-white/80">
            {roomCode}
          </span>
          {codeCopied ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0 text-white/55" />
          )}
        </button>

        {/* Score — compact monospace */}
        <div className="flex shrink-0 items-center gap-1 rounded-[14px] border border-white/14 bg-white/8 px-2.5 py-1.5 font-mono text-sm font-black tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="text-emerald-200">{scoreUs}</span>
          <span className="text-white/25">–</span>
          <span className="text-rose-200">{scoreThem}</span>
        </div>

        {/* Leave */}
        <button
          type="button"
          onClick={onLeave}
          title="Sair da sala"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-white/14 bg-white/8 text-white/72"
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
            <Check className="h-3.5 w-3.5 text-emerald-200" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Score — compact blocks */}
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-[14px] border border-white/10 bg-black/30">
        <div className="px-3 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">
            Nós
          </p>
          <p className="font-mono text-xl font-black leading-none text-emerald-200">
            {scoreUs}
          </p>
        </div>
        <div className="border-l border-white/10 px-3 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">
            Eles
          </p>
          <p className="font-mono text-xl font-black leading-none text-rose-200">
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
