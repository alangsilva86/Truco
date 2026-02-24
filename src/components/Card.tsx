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
    case 'Copas': return <Heart className={`fill-red-500 text-red-500 ${className}`} />;
    case 'Espadas': return <Spade className={`fill-slate-800 text-slate-800 ${className}`} />;
    case 'Paus': return <Club className={`fill-emerald-800 text-emerald-800 ${className}`} />;
    case 'Ouros': return <Diamond className={`fill-red-500 text-red-500 ${className}`} />;
    default: return null;
  }
};

export const CardComponent: React.FC<CardProps> = ({ card, hidden, onClick, className, isPartner, manilhaRank }) => {
  if (!card && !hidden) return null;

  const isRed = card && ['Copas', 'Ouros'].includes(card.suit);
  const isManilha = card && manilhaRank && card.rank === manilhaRank;

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -10, scale: 1.05, rotateZ: 2 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={`
        relative w-16 h-24 xs:w-20 xs:h-28 sm:w-24 sm:h-36 rounded-lg sm:rounded-xl shadow-2xl cursor-pointer overflow-hidden transition-shadow
        ${hidden 
          ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-black border border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]' 
          : 'bg-gradient-to-br from-white via-slate-50 to-slate-200 border border-white'}
        ${isPartner ? 'opacity-60 scale-90' : ''}
        ${isManilha ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : ''}
        ${className}
      `}
    >
      {isManilha && (
        <div className="absolute top-0 right-0 bg-amber-400 text-black text-[6px] sm:text-[8px] font-black px-1 py-0.5 rounded-bl-lg z-20 uppercase tracking-tighter">
          Manilha
        </div>
      )}
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center p-2">
          <div className="w-full h-full border border-white/5 rounded-lg flex items-center justify-center bg-white/[0.02]">
             <div className="w-8 h-12 sm:w-12 sm:h-16 border-2 border-emerald-500/20 rounded-lg flex items-center justify-center rotate-12">
                <div className="w-4 h-6 sm:w-8 sm:h-10 bg-emerald-500/10 rounded-md" />
             </div>
          </div>
        </div>
      ) : card ? (
        <div className="p-1.5 sm:p-2 h-full flex flex-col justify-between select-none relative">
          {/* Subtle card texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] opacity-10 pointer-events-none" />
          
          <div className="flex flex-col items-start z-10">
            <span className={`text-sm xs:text-base sm:text-lg font-black leading-none tracking-tighter ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} className="w-3 h-3 xs:w-4 xs:h-4 mt-0.5" />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
            <SuitIcon suit={card.suit} className="w-12 h-12 xs:w-20 xs:h-20" />
          </div>

          <div className="flex flex-col items-end rotate-180 z-10">
             <span className={`text-sm xs:text-base sm:text-lg font-black leading-none tracking-tighter ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} className="w-3 h-3 xs:w-4 xs:h-4 mt-0.5" />
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};
