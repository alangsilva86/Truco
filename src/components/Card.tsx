import React from 'react';
import { motion } from 'motion/react';
import { Card as CardType, Rank } from '../types';
import { Heart, Spade, Club, Diamond } from 'lucide-react';

interface CardProps {
  card: CardType | null;
  hidden?: boolean;
  onClick?: () => void;
  className?: string;
  isPartner?: boolean;
  manilhaRank?: Rank | null;
}

const SuitIcon = ({ suit, className }: { suit: string; className?: string }) => {
  switch (suit) {
    case 'Copas':   return <Heart   className={`fill-red-500 text-red-500 ${className}`} />;
    case 'Espadas': return <Spade   className={`fill-slate-800 text-slate-800 ${className}`} />;
    case 'Paus':    return <Club    className={`fill-emerald-800 text-emerald-800 ${className}`} />;
    case 'Ouros':   return <Diamond className={`fill-red-500 text-red-500 ${className}`} />;
    default: return null;
  }
};

export const CardComponent: React.FC<CardProps> = ({
  card,
  hidden,
  onClick,
  className,
  isPartner,
  manilhaRank,
}) => {
  if (!card && !hidden) return null;

  const isRed = card && ['Copas', 'Ouros'].includes(card.suit);
  const isManilha = card && manilhaRank && card.rank === manilhaRank;

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -12, scale: 1.07, rotateZ: 2 } : {}}
      whileTap={onClick ? { scale: 0.93 } : {}}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={card && onClick ? `Jogar ${card.rank} de ${card.suit}` : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`
        relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl shadow-2xl overflow-hidden select-none
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${hidden
          ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-black border border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]'
          : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-white/80'}
        ${isPartner ? 'opacity-60 scale-90' : ''}
        ${isManilha ? 'ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]' : ''}
        ${className ?? ''}
      `}
    >
      {isManilha && (
        <div className="absolute top-0 right-0 bg-amber-400 text-black text-[7px] sm:text-[8px] font-black px-1 py-0.5 rounded-bl-lg z-20 uppercase tracking-tighter leading-none">
          ★
        </div>
      )}

      {hidden ? (
        <div className="w-full h-full flex items-center justify-center p-2">
          <div className="w-full h-full border border-white/5 rounded-lg flex items-center justify-center bg-white/[0.02]">
            <div className="w-8 h-11 border-2 border-emerald-500/20 rounded-lg flex items-center justify-center rotate-12">
              <div className="w-4 h-6 bg-emerald-500/10 rounded-md" />
            </div>
          </div>
        </div>
      ) : card ? (
        <div className="p-1.5 sm:p-2 h-full flex flex-col justify-between relative">
          {/* Depth gradient — no external URL */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-black/8 pointer-events-none" />

          {/* Top corner */}
          <div className="flex flex-col items-start z-10 relative">
            <span className={`text-sm sm:text-base font-black leading-none tracking-tighter ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} className="w-3 h-3 sm:w-3.5 sm:h-3.5 mt-0.5" />
          </div>

          {/* Center suit watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
            <SuitIcon suit={card.suit} className="w-14 h-14 sm:w-16 sm:h-16" />
          </div>

          {/* Bottom corner (rotated) */}
          <div className="flex flex-col items-end rotate-180 z-10 relative">
            <span className={`text-sm sm:text-base font-black leading-none tracking-tighter ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} className="w-3 h-3 sm:w-3.5 sm:h-3.5 mt-0.5" />
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};
