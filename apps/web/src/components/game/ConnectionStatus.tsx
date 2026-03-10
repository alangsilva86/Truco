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
  return (
    <div className="table-surface mx-3 mb-3 mt-2 flex items-center justify-between gap-2 rounded-[20px] px-3 py-2 sm:rounded-[24px] sm:px-4 sm:py-2.5">
      <div className="hidden min-w-0 items-center gap-2 text-sm text-white/60 sm:flex">
        <Users className="h-4 w-4 shrink-0 text-emerald-200" />
        <span className="truncate">{shareMessage}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {logCount > 0 && (
          <button
            type="button"
            onClick={onToggleLogs}
            className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition sm:min-h-11 sm:rounded-2xl sm:text-xs sm:tracking-[0.18em] ${
              logsOpen
                ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100'
                : 'border-white/10 bg-white/5 text-white/65 hover:text-white'
            }`}
          >
            <List className="h-4 w-4" />
            Log {logCount > 9 ? '9+' : logCount}
          </button>
        )}

        <div className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/65 sm:min-h-11 sm:rounded-2xl sm:text-xs sm:tracking-[0.18em]">
          {connectionState === 'reconnecting' && (
            <LoaderCircle className="h-4 w-4 animate-spin text-amber-300" />
          )}
          {connectionState === 'disconnected' && (
            <AlertCircle className="h-4 w-4 text-rose-300" />
          )}
          {connectionState === 'connected' && (
            <Swords className="h-4 w-4 text-emerald-300" />
          )}
          {connectionState}
        </div>
      </div>
    </div>
  );
}
