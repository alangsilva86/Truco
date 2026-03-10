import { Sparkles } from 'lucide-react';

interface TrucoDecisionSheetProps {
  open: boolean;
  requesterName: string;
  requestedValue: number;
  acceptedValue: number;
  raiseTarget: number | null;
  canRaise: boolean;
  commandPending: boolean;
  onAccept: () => void;
  onRaise: () => void;
  onRun: () => void;
}

export function TrucoDecisionSheet({
  open,
  requesterName,
  requestedValue,
  acceptedValue,
  raiseTarget,
  canRaise,
  commandPending,
  onAccept,
  onRaise,
  onRun,
}: TrucoDecisionSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-3 pb-3 sm:items-center sm:px-4 sm:pb-0">
      <div className="table-surface safe-bottom w-full max-w-md rounded-[30px] px-5 py-6 shadow-2xl shadow-black/60">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/12 p-3 text-amber-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/60">
              Decisao
            </p>
            <h3 className="mt-1 text-xl font-black text-white">
              {requesterName} pediu truco
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Escolha como sua dupla quer responder antes da rodada continuar.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={commandPending}
            className="min-h-12 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black disabled:opacity-45"
          >
            Aceitar · vale {requestedValue}
          </button>

          {canRaise && raiseTarget !== null && raiseTarget <= 12 && (
            <button
              type="button"
              onClick={onRaise}
              disabled={commandPending}
              className="min-h-12 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-100 disabled:opacity-45"
            >
              Aumentar · levar para {raiseTarget}
            </button>
          )}

          <button
            type="button"
            onClick={onRun}
            disabled={commandPending}
            className="min-h-12 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 disabled:opacity-45"
          >
            Correr · dar {acceptedValue} para eles
          </button>
        </div>
      </div>
    </div>
  );
}
