import { Card, Rank } from '@truco/contracts';
import { Club, Diamond, Heart, Spade } from 'lucide-react';

interface CardProps {
  card: Card | null;
  hidden?: boolean;
  onClick?: () => void;
  active?: boolean;
  manilhaRank?: Rank | null;
  compact?: boolean;
}

function SuitIcon({ suit }: { suit: Card['suit'] }) {
  if (suit === 'Copas') {
    return <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />;
  }

  if (suit === 'Espadas') {
    return <Spade className="h-4 w-4 fill-slate-900 text-slate-900" />;
  }

  if (suit === 'Paus') {
    return <Club className="h-4 w-4 fill-emerald-900 text-emerald-900" />;
  }

  return <Diamond className="h-4 w-4 fill-rose-500 text-rose-500" />;
}

export function CardView({ card, hidden = false, onClick, active = false, manilhaRank, compact = false }: CardProps) {
  const sizeClass = compact ? 'h-20 w-14 sm:h-24 sm:w-16' : 'h-24 w-16 sm:h-32 sm:w-20';
  const isRed = card ? card.suit === 'Copas' || card.suit === 'Ouros' : false;
  const isManilha = Boolean(card && manilhaRank && card.rank === manilhaRank);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${sizeClass} rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl ${active ? 'ring-2 ring-amber-400' : ''}`}
      >
        <div className="m-2 flex h-[calc(100%-1rem)] items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
          <div className="h-8 w-6 rounded-md border border-emerald-300/20 bg-emerald-300/10" />
        </div>
      </button>
    );
  }

  if (!card) {
    return (
      <div className={`${sizeClass} rounded-2xl border border-dashed border-white/10 bg-white/5`} />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sizeClass} relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-white via-slate-50 to-slate-200 p-2 text-slate-950 shadow-2xl transition-transform hover:-translate-y-1 ${active ? 'ring-2 ring-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.25)]' : ''}`}
    >
      {isManilha && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-black">
          ★
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-black/10" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex flex-col items-start">
          <span className={`text-lg font-black leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
            {card.rank}
          </span>
          <SuitIcon suit={card.suit} />
        </div>
        <div className="flex items-center justify-center opacity-10">
          <SuitIcon suit={card.suit} />
        </div>
        <div className="flex rotate-180 flex-col items-end">
          <span className={`text-lg font-black leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
            {card.rank}
          </span>
          <SuitIcon suit={card.suit} />
        </div>
      </div>
    </button>
  );
}
