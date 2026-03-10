import { PlayedCardView, Rank, SeatId } from '@truco/contracts';
import { Check, Copy, Sparkles } from 'lucide-react';
import { CardView } from '../Card.js';

interface CenterTableProps {
  mode: 'waiting' | 'table';
  roomCode: string;
  codeCopied: boolean;
  onCopyCode: () => void;
  roundCards: PlayedCardView[];
  seatLayout: {
    bottom: SeatId;
    top: SeatId;
    left: SeatId;
    right: SeatId;
  };
  message: string;
  phaseLabel: string;
  manilhaRank: Rank | null;
}

export function CenterTable({
  mode,
  roomCode,
  codeCopied,
  onCopyCode,
  roundCards,
  seatLayout,
  message,
  phaseLabel,
  manilhaRank,
}: CenterTableProps) {
  if (mode === 'waiting') {
    return (
      <div className="table-surface table-glow flex w-full max-w-sm flex-col items-center gap-4 rounded-[32px] px-6 py-8 text-center">
        <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 p-3 text-emerald-200">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
            Compartilhe o codigo
          </p>
          <h3 className="mt-3 font-mono text-4xl font-black tracking-[0.22em] text-white sm:text-5xl">
            {roomCode}
          </h3>
          <p className="mt-3 text-sm text-white/55">
            Envie este codigo para o segundo jogador entrar direto na mesa.
          </p>
        </div>
        <button
          type="button"
          onClick={onCopyCode}
          className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          {codeCopied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {codeCopied ? 'Codigo copiado' : 'Copiar codigo'}
        </button>
      </div>
    );
  }

  // Table mode: transparent zone — cards float on the felt, no opaque box
  return (
    <div className="relative h-full w-full">
      {/* Ambient felt highlight — purely decorative, no height constraints */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-full rounded-full bg-emerald-950/60 blur-3xl sm:h-36" />
      </div>

      {/* Played cards — absolutely positioned on the felt */}
      {roundCards.map((playedCard) => {
        const position =
          playedCard.seatId === seatLayout.bottom
            ? 'left-1/2 bottom-[8%] -translate-x-1/2'
            : playedCard.seatId === seatLayout.top
              ? 'left-1/2 top-[8%] -translate-x-1/2'
              : playedCard.seatId === seatLayout.left
                ? 'left-[4%] top-1/2 -translate-y-1/2'
                : 'right-[4%] top-1/2 -translate-y-1/2';

        return (
          <div
            key={`${playedCard.seatId}-${playedCard.card?.id ?? 'covered'}`}
            className={`absolute ${position} transition-all duration-200`}
          >
            <CardView
              card={playedCard.card}
              hidden={playedCard.hidden}
              manilhaRank={manilhaRank}
              compact
            />
          </div>
        );
      })}

      {/* Message badge — centered, compact, semi-transparent */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 w-max max-w-[9.5rem] rounded-[18px] border border-white/8 bg-black/50 px-3 py-2 text-center shadow-xl backdrop-blur-md sm:max-w-[11rem] sm:rounded-[22px] sm:px-4 sm:py-2.5">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30 sm:text-[10px] sm:tracking-[0.24em]">
          {phaseLabel}
        </p>
        <p className="mt-0.5 text-xs font-bold leading-snug text-white/65 sm:text-sm">
          {message}
        </p>
      </div>
    </div>
  );
}
