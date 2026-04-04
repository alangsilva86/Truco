import { AlertCircle, List, LoaderCircle, Swords, Users } from 'lucide-react';
import { ConnectionState } from '@truco/contracts';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  shareMessage: string;
  logCount: number;
  logsOpen: boolean;
  onToggleLogs: () => void;
}

export function ConnectionStatus({
  connectionState,
  shareMessage,
  logCount,
  logsOpen,
  onToggleLogs,
}: ConnectionStatusProps) {
  const connectionClass =
    connectionState === 'reconnecting'
      ? 'border-amber-100/70 bg-amber-400/20 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.16)]'
      : connectionState === 'disconnected'
        ? 'border-rose-100/70 bg-rose-500/20 text-rose-50 shadow-[0_0_16px_rgba(244,63,94,0.16)]'
        : 'border-emerald-100/70 bg-emerald-500/18 text-emerald-50 shadow-[0_0_16px_rgba(16,185,129,0.16)]';

  return (
    <div className="table-surface mx-3 mb-3 mt-2 flex items-center justify-between gap-2 rounded-[20px] px-3 py-2 sm:rounded-[24px] sm:px-4 sm:py-2.5">
      <div className="hidden min-w-0 items-center gap-2 text-sm text-white/82 sm:flex">
        <Users className="h-4 w-4 shrink-0 text-emerald-100" />
        <span className="truncate">{shareMessage}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {logCount > 0 && (
          <button
            type="button"
            onClick={onToggleLogs}
            className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition sm:min-h-11 sm:rounded-2xl sm:text-xs sm:tracking-[0.18em] ${
              logsOpen
                ? 'border-emerald-100/70 bg-emerald-500/18 text-emerald-50'
                : 'border-white/14 bg-white/8 text-white/78 hover:text-white'
            }`}
          >
            <List className="h-4 w-4" />
            Log {logCount > 9 ? '9+' : logCount}
          </button>
        )}

        <div
          className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] sm:min-h-11 sm:rounded-2xl sm:text-xs sm:tracking-[0.18em] ${connectionClass}`}
        >
          {connectionState === 'reconnecting' && (
            <LoaderCircle className="h-4 w-4 animate-spin text-amber-50" />
          )}
          {connectionState === 'disconnected' && (
            <AlertCircle className="h-4 w-4 text-rose-50" />
          )}
          {connectionState === 'connected' && (
            <Swords className="h-4 w-4 text-emerald-50" />
          )}
          {connectionState}
        </div>
      </div>
    </div>
  );
}
