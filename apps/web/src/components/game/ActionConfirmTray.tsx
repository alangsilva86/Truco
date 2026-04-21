import { Card, Rank } from '@truco/contracts';
import { AlertCircle, EyeOff, Flag, LoaderCircle, Swords } from 'lucide-react';
import { ReactNode } from 'react';
import { manilhaNickname } from '../Card.js';

interface ActionConfirmTrayProps {
  activeSeatLabel: 'baixo' | 'cima' | null;
  activeSeatName: string | null;
  bannerDetail: string;
  bannerTitle: string;
  canPlayCovered: boolean;
  canRunRound: boolean;
  canRequestTruco: boolean;
  children?: ReactNode;
  commandPending: boolean;
  dimmed?: boolean;
  error: string | null;
  manilhaRank?: Rank | null;
  pendingPlay: boolean;
  runRoundHint: string;
  selectedCard: Card | null;
  trucoHint: string;
  trucoLabel: string;
  onCancelSelection: () => void;
  onConfirmCovered: () => void;
  onConfirmOpen: () => void;
  onRequestTruco: () => void;
  onRunRound: () => void;
}

function getSelectedCardLabel(
  card: Card | null,
  manilhaRank?: Rank | null,
): string {
  if (!card) return '';
  if (manilhaRank && card.rank === manilhaRank) {
    return `${manilhaNickname(card.suit)}! · ${card.rank} de ${card.suit}`;
  }
  return `${card.rank} de ${card.suit}`;
}

export function ActionConfirmTray({
  canPlayCovered,
  canRunRound,
  canRequestTruco,
  children,
  commandPending,
  dimmed = false,
  error,
  manilhaRank,
  pendingPlay,
  runRoundHint,
  selectedCard,
  trucoHint,
  trucoLabel,
  onCancelSelection,
  onConfirmCovered,
  onConfirmOpen,
  onRequestTruco,
  onRunRound,
}: ActionConfirmTrayProps) {
  const isSelectionActive = Boolean(selectedCard);

  return (
    <div
      className={`table-surface safe-bottom mt-2 overflow-visible rounded-[22px] px-3 pb-3 pt-1 transition ${dimmed ? 'pointer-events-none opacity-40' : ''}`}
    >
      {/* Player hand — primary, always at top of tray */}
      {children && <div className="-mx-1 overflow-visible">{children}</div>}

      {/* Action dock — below the hand */}
      <div className="mt-1 flex items-center gap-2">
        {isSelectionActive ? (
          /* ── Confirm row when a card is selected ── */
          <>
            <button
              type="button"
              onClick={onConfirmOpen}
              disabled={commandPending}
              className="flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-emerald-400 text-xs font-black uppercase tracking-[0.14em] text-black transition active:brightness-90"
            >
              {commandPending && pendingPlay ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                'Jogar aberta'
              )}
            </button>

            {canPlayCovered && (
              <button
                type="button"
                onClick={onConfirmCovered}
                disabled={commandPending}
                className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-amber-100/75 bg-amber-400/22 px-3.5 text-xs font-black uppercase tracking-[0.14em] text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.16)] transition active:brightness-90"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Coberta
              </button>
            )}

            <button
              type="button"
              onClick={onCancelSelection}
              disabled={commandPending}
              aria-label="Cancelar seleção"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-sm font-black text-white/55 transition active:brightness-75"
            >
              ✕
            </button>
          </>
        ) : (
          /* ── Idle row: sync status left + TRUCAR right ── */
          <>
            <div className="flex min-w-0 flex-1 items-center">
              {commandPending ? (
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  {pendingPlay ? 'Enviando' : 'Sync'}
                </div>
              ) : selectedCard ? (
                <span className="text-xs font-bold text-white/50">
                  {getSelectedCardLabel(selectedCard, manilhaRank)}
                </span>
              ) : null}
            </div>

            {/* TRUCAR — secondary pill, not dominant */}
            <button
              type="button"
              onClick={onRequestTruco}
              disabled={!canRequestTruco || commandPending}
              title={trucoHint}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                canRequestTruco
                  ? 'border-amber-100/70 bg-amber-400/18 text-amber-50 active:bg-amber-400/24'
                  : 'border-white/10 bg-transparent text-white/35'
              }`}
            >
              <Swords className="h-3.5 w-3.5 shrink-0" />
              {trucoLabel}
            </button>

            <button
              type="button"
              onClick={onRunRound}
              disabled={!canRunRound || commandPending}
              title={runRoundHint}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                canRunRound
                  ? 'border-rose-100/75 bg-rose-500/16 text-rose-100 active:bg-rose-500/24'
                  : 'border-white/10 bg-transparent text-white/35'
              }`}
            >
              <Flag className="h-3.5 w-3.5 shrink-0" />
              Correr
            </button>
          </>
        )}
      </div>

      {/* Selected card label */}
      {isSelectionActive && (
        <p className="mt-1.5 text-center text-[11px] font-bold text-white/40">
          {getSelectedCardLabel(selectedCard, manilhaRank)}
        </p>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-[14px] border border-rose-100/70 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-50 shadow-[0_0_16px_rgba(244,63,94,0.14)]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
