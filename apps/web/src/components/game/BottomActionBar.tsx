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
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onToggleCovered}
        disabled={!coveredEnabled || commandPending}
        title={coveredHint}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-150 ${
          coveredActive
            ? 'border-amber-300/60 bg-amber-400/15 text-amber-300'
            : 'border-white/12 bg-white/5 text-white/45 hover:border-white/25 hover:text-white/80'
        }`}
      >
        <EyeOff className="h-3.5 w-3.5 shrink-0" />
        Coberta
      </button>

      <button
        type="button"
        onClick={onRequestTruco}
        disabled={!trucoEnabled || commandPending}
        title={trucoHint}
        className="flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300/70 transition-all duration-150 hover:border-amber-400/60 hover:bg-amber-400/18 hover:text-amber-200"
      >
        <Swords className="h-3.5 w-3.5 shrink-0" />
        {trucoLabel}
      </button>
    </div>
  );
}
