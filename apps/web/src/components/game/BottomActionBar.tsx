import { EyeOff, Swords } from 'lucide-react';

interface BottomActionBarProps {
  show: boolean;
  coveredActive: boolean;
  coveredEnabled: boolean;
  coveredHint: string;
  trucoEnabled: boolean;
  trucoHint: string;
  trucoLabel: string;
  commandPending: boolean;
  onToggleCovered: () => void;
  onRequestTruco: () => void;
}

export function BottomActionBar({
  show,
  coveredActive,
  coveredEnabled,
  coveredHint,
  trucoEnabled,
  trucoHint,
  trucoLabel,
  commandPending,
  onToggleCovered,
  onRequestTruco,
}: BottomActionBarProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="table-surface safe-bottom w-full max-w-xl rounded-[28px] px-3 py-3 sm:px-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
        <button
          type="button"
          onClick={onToggleCovered}
          disabled={!coveredEnabled || commandPending}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
            coveredActive
              ? 'border-amber-300/55 bg-amber-400 text-black'
              : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
          }`}
        >
          <EyeOff className="h-4 w-4" />
          Coberta
        </button>

        <button
          type="button"
          onClick={onRequestTruco}
          disabled={!trucoEnabled || commandPending}
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:brightness-105 disabled:opacity-45"
        >
          <Swords className="h-4 w-4" />
          {trucoLabel}
        </button>
      </div>

      <div className="mt-2 grid gap-1 text-[11px] font-medium text-white/45 sm:grid-cols-2">
        <p className="truncate">{coveredHint}</p>
        <p className="truncate sm:text-right">{trucoHint}</p>
      </div>
    </div>
  );
}
