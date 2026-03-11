import { Card, Rank, Suit } from '@truco/contracts';
import { Club, Diamond, Heart, Spade } from 'lucide-react';

// Manilha strength order: Paus > Copas > Espadas > Ouros
export const MANILHA_SUITS: Suit[] = ['Paus', 'Copas', 'Espadas', 'Ouros'];

function suitSymbol(suit: Suit): string {
  if (suit === 'Copas') return '♥';
  if (suit === 'Espadas') return '♠';
  if (suit === 'Paus') return '♣';
  return '♦';
}

function suitColor(suit: Suit): string {
  if (suit === 'Copas' || suit === 'Ouros') return 'text-rose-600';
  if (suit === 'Paus') return 'text-emerald-800';
  return 'text-slate-900';
}

/** Tiny card chip — rank + suit symbol, no icons, fits inline in HUD bars */
export function MiniCard({
  rank,
  suit,
  size = 'sm',
}: {
  rank: string;
  suit: Suit;
  size?: 'xs' | 'sm';
}) {
  const color = suitColor(suit);
  const sym = suitSymbol(suit);
  if (size === 'xs') {
    return (
      <div className="inline-flex h-6 w-4 flex-col items-start justify-between rounded-[5px] border border-slate-300/70 bg-white px-0.5 pt-0.5 pb-px shadow-sm">
        <span className={`text-[8px] font-black leading-none ${color}`}>{rank}</span>
        <span className={`self-end text-[8px] leading-none rotate-180 ${color}`}>{sym}</span>
      </div>
    );
  }
  return (
    <div className="inline-flex h-8 w-[1.375rem] flex-col items-start justify-between rounded-[6px] border border-slate-300/70 bg-white px-0.5 pt-0.5 pb-px shadow-sm">
      <span className={`text-[10px] font-black leading-none ${color}`}>{rank}</span>
      <span className={`self-end text-[10px] leading-none rotate-180 ${color}`}>{sym}</span>
    </div>
  );
}

/** Row of 4 overlapping MiniCards — one per suit — for the manilha rank */
export function ManilhaFan({
  rank,
  size = 'sm',
}: {
  rank: string;
  size?: 'xs' | 'sm';
}) {
  return (
    <div className={`flex items-end ${size === 'xs' ? '-space-x-1.5' : '-space-x-2'}`}>
      {MANILHA_SUITS.map((suit) => (
        <MiniCard key={suit} rank={rank} suit={suit} size={size} />
      ))}
    </div>
  );
}

interface CardProps {
  card: Card | null;
  hidden?: boolean;
  onClick?: () => void;
  active?: boolean;
  muted?: boolean;
  pending?: boolean;
  selected?: boolean;
  manilhaRank?: Rank | null;
  compact?: boolean;
  className?: string;
}

function SuitIcon({ suit, compact }: { suit: Card['suit']; compact: boolean }) {
  const cls = compact
    ? 'h-3 w-3 sm:h-4 sm:w-4'
    : 'h-3.5 w-3.5 sm:h-4 sm:w-4';

  if (suit === 'Copas') {
    return <Heart className={`${cls} fill-rose-500 text-rose-500`} />;
  }

  if (suit === 'Espadas') {
    return <Spade className={`${cls} fill-slate-900 text-slate-900`} />;
  }

  if (suit === 'Paus') {
    return <Club className={`${cls} fill-emerald-900 text-emerald-900`} />;
  }

  return <Diamond className={`${cls} fill-rose-500 text-rose-500`} />;
}

export function CardView({
  card,
  hidden = false,
  onClick,
  active = false,
  muted = false,
  pending = false,
  selected = false,
  manilhaRank,
  compact = false,
  className = '',
}: CardProps) {
  // compact = reference cards (top/side): smaller, simplified layout (no bottom section)
  // non-compact = interactive hand: original mobile size, full layout
  const sizeClass = compact
    ? 'h-14 w-10 sm:h-24 sm:w-16'
    : 'h-20 w-14 sm:h-32 sm:w-20';
  const isRed = card ? card.suit === 'Copas' || card.suit === 'Ouros' : false;
  const isManilha = Boolean(card && manilhaRank && card.rank === manilhaRank);
  const interactive = Boolean(onClick) && !pending;
  const stateClass = selected
    ? 'border-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.3),0_0_40px_rgba(34,211,238,0.18),0_8px_24px_rgba(0,0,0,0.35)] ring-2 ring-sky-300/80 -translate-y-2.5 scale-[1.04]'
    : active
      ? 'border-amber-300 shadow-[0_0_0_3px_rgba(250,204,21,0.45),0_0_52px_rgba(250,204,21,0.32),0_8px_24px_rgba(0,0,0,0.4)] ring-2 ring-amber-400/75 -translate-y-2.5 scale-[1.04]'
      : interactive
        ? 'border-white/80 hover:-translate-y-1.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.4)] active:translate-y-0'
        : 'border-white/60';
  const mutedClass = muted ? 'opacity-70 saturate-75' : '';
  const pendingClass = pending ? 'opacity-55 saturate-75 grayscale-[0.08]' : '';

  if (hidden) {
    return (
      <button
        type="button"
        aria-label="Carta coberta"
        onClick={onClick}
        disabled={!interactive}
        className={`${sizeClass} ${className} ${mutedClass} ${pendingClass} rounded-[18px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl transition-all duration-200 sm:rounded-[22px] ${active ? 'ring-2 ring-amber-400/75 shadow-[0_0_0_3px_rgba(250,204,21,0.4),0_0_40px_rgba(250,204,21,0.28)] -translate-y-2.5 scale-[1.04]' : interactive ? 'hover:-translate-y-1.5 active:translate-y-0' : ''}`}
      >
        <div className="m-2 flex h-[calc(100%-1rem)] items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
          <div className="h-8 w-6 rounded-md border border-emerald-300/20 bg-emerald-300/10" />
        </div>
      </button>
    );
  }

  if (!card) {
    return (
      <div
        className={`${sizeClass} rounded-2xl border border-dashed border-white/10 bg-white/5`}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`${card.rank} de ${card.suit}`}
      onClick={onClick}
      disabled={!interactive}
      className={`${sizeClass} ${className} ${mutedClass} ${pendingClass} ${stateClass} relative overflow-hidden rounded-[18px] bg-gradient-to-br from-white via-slate-50 to-slate-200 text-slate-950 shadow-2xl transition-all duration-200 sm:rounded-[22px] ${compact ? 'p-1 sm:p-2' : 'p-1.5 sm:p-2'}`}
    >
      {isManilha && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-black">
          ★
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-black/10" />

      {compact ? (
        /* Compact layout: top-left corner + faint center — no overflow risk */
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex flex-col items-start">
            <span className={`text-xs font-black leading-none sm:text-base ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} compact />
          </div>
          <div className="flex items-center justify-center opacity-10">
            <SuitIcon suit={card.suit} compact />
          </div>
        </div>
      ) : (
        /* Full layout: top, center, rotated bottom */
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex flex-col items-start">
            <span className={`text-sm font-black leading-none sm:text-lg ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} compact={false} />
          </div>
          <div className="flex items-center justify-center opacity-10">
            <SuitIcon suit={card.suit} compact={false} />
          </div>
          <div className="flex rotate-180 flex-col items-end">
            <span className={`text-sm font-black leading-none sm:text-lg ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} compact={false} />
          </div>
        </div>
      )}
    </button>
  );
}
