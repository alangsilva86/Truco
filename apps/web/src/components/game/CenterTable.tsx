import { PlayedCardView, Rank } from '@truco/contracts';
import { Check, Copy, Sparkles } from 'lucide-react';
import { CardView } from '../Card.js';

interface CenterTableProps {
  mode: 'waiting' | 'table';
  roomCode: string;
  codeCopied: boolean;
  onCopyCode: () => void;
  roundCards: PlayedCardView[];
  manilhaRank: Rank | null;
}

export function CenterTable({
  mode,
  roomCode,
  codeCopied,
  onCopyCode,
  roundCards,
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

  // Table mode: played cards arranged as a fan (leque) on the felt.
  // x, y: offset from center in rem; r: rotation in degrees.
  // z-index = i+1, so the last-played card (highest index) is always on top.
  const FAN: { x: number; y: number; r: number }[][] = [
    [{ x: 0, y: 0, r: 0 }],
    [{ x: -1.5, y: 0.5, r: -12 }, { x: 1.5, y: 0.5, r: 12 }],
    [{ x: -2.5, y: 0.75, r: -18 }, { x: 0, y: -0.25, r: 3 }, { x: 2.5, y: 0.75, r: 18 }],
    [{ x: -3.25, y: 1, r: -24 }, { x: -1.1, y: 0.15, r: -8 }, { x: 1.1, y: 0.15, r: 8 }, { x: 3.25, y: 1, r: 24 }],
  ];

  const n = roundCards.length;

  return (
    <div className="relative h-full w-full">
      {/* Ambient felt glow — purely decorative */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-full rounded-full bg-emerald-950/60 blur-3xl sm:h-36" />
      </div>

      {/* Played cards fan */}
      {n > 0 && roundCards.map((playedCard, i) => {
        const slots = FAN[Math.min(n, FAN.length) - 1];
        const pos = slots[i] ?? { x: 0, y: 0, r: 0 };
        return (
          <div
            key={`${playedCard.seatId}-${playedCard.card?.id ?? 'covered'}`}
            className="absolute transition-all duration-500"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${pos.x}rem), calc(-50% + ${pos.y}rem)) rotate(${pos.r}deg)`,
              zIndex: i + 1,
            }}
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
    </div>
  );
}
