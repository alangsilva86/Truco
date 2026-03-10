import { X } from 'lucide-react';

interface MatchLogDrawerProps {
  logs: string[];
  open: boolean;
  onClose: () => void;
}

export function MatchLogDrawer({ logs, open, onClose }: MatchLogDrawerProps) {
  if (!open || logs.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-3 pb-3 backdrop-blur-sm sm:items-end sm:justify-end sm:bg-transparent sm:px-6 sm:pb-6">
      <button
        type="button"
        aria-label="Fechar log"
        onClick={onClose}
        className="absolute inset-0 sm:hidden"
      />

      <div className="table-surface safe-bottom relative z-10 w-full max-w-xl rounded-[28px] px-4 py-4 shadow-2xl shadow-black/50 sm:max-w-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
              Log da partida
            </p>
            <p className="mt-1 text-sm text-white/55">
              Eventos recentes da mesa em ordem decrescente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
          {logs.map((log, index) => (
            <div
              key={`${log}-${index}`}
              className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white/75"
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
