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
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">Compartilhe o codigo</p>
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
          {codeCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {codeCopied ? 'Codigo copiado' : 'Copiar codigo'}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-[11.5rem] w-[15.5rem] items-center justify-center sm:h-[15rem] sm:w-[21rem]">
      <div className="table-surface table-glow absolute inset-0 rounded-[40px]" />
      <div className="absolute inset-x-10 top-6 h-12 rounded-full bg-white/6 blur-2xl sm:inset-x-14 sm:top-7" />

      {roundCards.map((playedCard) => {
        const position = playedCard.seatId === seatLayout.bottom
          ? 'left-1/2 top-[62%] -translate-x-1/2'
          : playedCard.seatId === seatLayout.top
            ? 'left-1/2 top-[2%] -translate-x-1/2'
            : playedCard.seatId === seatLayout.left
              ? 'left-[1%] top-1/2 -translate-y-1/2'
              : 'right-[1%] top-1/2 -translate-y-1/2';

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

      <div className="relative z-10 max-w-[10rem] rounded-[24px] border border-white/10 bg-black/45 px-4 py-3 text-center shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
          {phaseLabel}
        </p>
        <p className="mt-1 text-sm font-black leading-tight text-white">
          {message}
        </p>
      </div>
    </div>
  );
}
