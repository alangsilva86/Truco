import { Card } from '@truco/contracts';
import { AlertCircle, EyeOff, LoaderCircle, Swords } from 'lucide-react';
import { ReactNode } from 'react';

interface ActionConfirmTrayProps {
  activeSeatLabel: 'baixo' | 'cima' | null;
  activeSeatName: string | null;
  bannerDetail: string;
  bannerTitle: string;
  canPlayCovered: boolean;
  canRequestTruco: boolean;
  children?: ReactNode;
  commandPending: boolean;
  dimmed?: boolean;
  error: string | null;
  pendingPlay: boolean;
  selectedCard: Card | null;
  trucoHint: string;
  trucoLabel: string;
  onCancelSelection: () => void;
  onConfirmCovered: () => void;
  onConfirmOpen: () => void;
  onRequestTruco: () => void;
}

function getSelectedCardLabel(card: Card | null): string {
  if (!card) {
    return '';
  }

  return `${card.rank} de ${card.suit}`;
}

export function ActionConfirmTray({
  activeSeatLabel,
  activeSeatName,
  bannerDetail,
  bannerTitle,
  canPlayCovered,
  canRequestTruco,
  children,
  commandPending,
  dimmed = false,
  error,
  pendingPlay,
  selectedCard,
  trucoHint,
  trucoLabel,
  onCancelSelection,
  onConfirmCovered,
  onConfirmOpen,
  onRequestTruco,
}: ActionConfirmTrayProps) {
  const isSelectionActive = Boolean(selectedCard);
  const contextLine =
    activeSeatName && activeSeatLabel
      ? `${activeSeatName} joga no assento ${activeSeatLabel}.`
      : bannerDetail;

  return (
    <div
      className={`table-surface safe-bottom mt-2 rounded-[24px] px-3 py-3 transition ${dimmed ? 'pointer-events-none opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
            {isSelectionActive ? 'Carta selecionada' : bannerTitle}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-white">
            {isSelectionActive
              ? getSelectedCardLabel(selectedCard)
              : contextLine}
          </p>
        </div>

        {commandPending && (
          <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {pendingPlay ? 'Enviando jogada' : 'Sincronizando'}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isSelectionActive ? (
          <>
            <button
              type="button"
              onClick={onConfirmOpen}
              disabled={commandPending}
              className="min-h-12 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-black"
            >
              Jogar aberta
            </button>

            {canPlayCovered && (
              <button
                type="button"
                onClick={onConfirmCovered}
                disabled={commandPending}
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-amber-100"
              >
                <EyeOff className="h-4 w-4" />
                Jogar coberta
              </button>
            )}

            <button
              type="button"
              onClick={onCancelSelection}
              disabled={commandPending}
              className="min-h-12 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white/70"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onRequestTruco}
            disabled={!canRequestTruco || commandPending}
            title={trucoHint}
            className="flex min-h-12 items-center gap-2 rounded-2xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-amber-100"
          >
            <Swords className="h-4 w-4" />
            {trucoLabel}
          </button>
        )}
      </div>

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
