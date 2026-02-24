import React from 'react';
import { motion } from 'motion/react';
import { Card as CardType } from '../types';
import { Heart, Spade, Club, Diamond } from 'lucide-react';

interface CardProps {
  card: CardType | null;
  hidden?: boolean;
  onClick?: () => void;
  className?: string;
  isPartner?: boolean;
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

export const CardComponent: React.FC<CardProps> = ({ card, hidden, onClick, className, isPartner }) => {
  if (!card && !hidden) return null;

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -10, scale: 1.05 } : {}}
      onClick={onClick}
      className={`
        relative w-16 h-24 xs:w-20 xs:h-28 sm:w-24 sm:h-36 rounded-lg sm:rounded-xl shadow-2xl cursor-pointer overflow-hidden
        ${hidden ? 'bg-gradient-to-br from-indigo-900 to-slate-900 border-2 border-indigo-400/30' : 'bg-white border border-slate-200'}
        ${isPartner ? 'opacity-60 scale-90' : ''}
        ${className}
      `}
    >
      {hidden ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-12 sm:w-12 sm:h-16 border-2 border-indigo-400/20 rounded-lg flex items-center justify-center">
            <div className="w-4 h-6 sm:w-8 sm:h-10 bg-indigo-400/10 rounded-md" />
          </div>
        </div>
      ) : card ? (
        <div className="p-1.5 sm:p-2 h-full flex flex-col justify-between select-none">
          <div className="flex flex-col items-start">
            <span className={`text-sm xs:text-base sm:text-lg font-bold leading-none ${['Copas', 'Ouros'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} className="w-3 h-3 xs:w-4 xs:h-4 mt-0.5" />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <SuitIcon suit={card.suit} className="w-10 h-10 xs:w-16 xs:h-16" />
          </div>

          <div className="flex flex-col items-end rotate-180">
             <span className={`text-sm xs:text-base sm:text-lg font-bold leading-none ${['Copas', 'Ouros'].includes(card.suit) ? 'text-red-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} className="w-3 h-3 xs:w-4 xs:h-4 mt-0.5" />
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};
