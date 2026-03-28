import { ShieldAlert } from 'lucide-react';

interface HandOfElevenDecisionSheetProps {
  open: boolean;
  playValue: number;
  runPenalty: number;
  commandPending: boolean;
  onPlay: () => void;
  onRun: () => void;
}

export function HandOfElevenDecisionSheet({
  open,
  playValue,
  runPenalty,
  commandPending,
  onPlay,
  onRun,
}: HandOfElevenDecisionSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-3 pb-3 sm:items-center sm:px-4 sm:pb-0">
      <div
        role="dialog"
        aria-modal="true"
        className="table-surface safe-bottom w-full max-w-md rounded-[30px] px-5 py-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/12 p-3 text-amber-200">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/60">
              Decisao
            </p>
            <h3 className="mt-1 text-xl font-black text-white">Mao de 11</h3>
            <p className="mt-2 text-sm text-white/60">
              Sua dupla chegou a 11. Escolha jogar valendo {playValue} ou correr
              e perder apenas {runPenalty} ponto.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={onPlay}
            disabled={commandPending}
            className="min-h-12 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black disabled:opacity-45"
          >
            Jogar · vale {playValue}
          </button>

          <button
            type="button"
            onClick={onRun}
            disabled={commandPending}
            className="min-h-12 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 disabled:opacity-45"
          >
            Correr · perder {runPenalty}
          </button>
        </div>
      </div>
    </div>
  );
}
