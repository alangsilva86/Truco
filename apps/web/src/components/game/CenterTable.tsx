import { PlayedCardView, Rank, SeatId, TeamId } from '@truco/contracts';
import { Check, Copy, Crown, Sparkles } from 'lucide-react';
import { type CSSProperties, useRef } from 'react';
import { CardView } from '../Card.js';

const RANK_VALUE: Record<string, number> = {
  4: 0,
  5: 1,
  6: 2,
  7: 3,
  Q: 4,
  J: 5,
  K: 6,
  A: 7,
  2: 8,
  3: 9,
};

const SUIT_VALUE: Record<string, number> = {
  Ouros: 0,
  Espadas: 1,
  Copas: 2,
  Paus: 3,
};

/** Returns the array index of the leading card, or null if trick is tied / no visible cards. */
function getWinningIndex(
  cards: PlayedCardView[],
  manilhaRank: Rank | null,
): number | null {
  const revealed = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.hidden && c.card !== null);

  if (revealed.length === 0) {
    return null;
  }

  let bestIdx = revealed[0].i;
  let isTied = false;

  for (let j = 1; j < revealed.length; j += 1) {
    const { c: curr, i: currIdx } = revealed[j];
    const bestCard = cards[bestIdx].card!;
    const currCard = curr.card!;
    const bestIsManilha = manilhaRank !== null && bestCard.rank === manilhaRank;
    const currIsManilha = manilhaRank !== null && currCard.rank === manilhaRank;

    if (currIsManilha && !bestIsManilha) {
      bestIdx = currIdx;
      isTied = false;
    } else if (!currIsManilha && bestIsManilha) {
      // best stays
    } else if (currIsManilha && bestIsManilha) {
      if (SUIT_VALUE[currCard.suit] > SUIT_VALUE[bestCard.suit]) {
        bestIdx = currIdx;
        isTied = false;
      }
    } else {
      const bestValue = RANK_VALUE[bestCard.rank] ?? -1;
      const currentValue = RANK_VALUE[currCard.rank] ?? -1;

      if (currentValue > bestValue) {
        bestIdx = currIdx;
        isTied = false;
      } else if (currentValue === bestValue) {
        isTied = true;
      }
    }
  }

  return isTied ? null : bestIdx;
}

// ── Spatial card positions (by seat direction) ──
// x/y: offset from table center in rem; positive y = toward viewer (bottom)
const SEAT_CARD_POS = {
  bottom: { x: 0, y: 3.1 },
  top: { x: 0, y: -3.1 },
  left: { x: -2.9, y: 0.4 },
  right: { x: 2.9, y: 0.4 },
} as const;

// Natural rotation ranges per direction (emulating a thrown card)
const SEAT_ROTATION_RANGE = {
  bottom: [-7, 7],
  top: [-7, 7],
  left: [-16, -4],
  right: [4, 16],
} as const;

type SeatDirection = keyof typeof SEAT_CARD_POS;

const Z_BY_DIRECTION: Record<SeatDirection, number> = {
  bottom: 4,
  top: 3,
  left: 2,
  right: 1,
};

function getSeatDirection(
  seatId: SeatId,
  layout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId },
): SeatDirection {
  if (seatId === layout.bottom) return 'bottom';
  if (seatId === layout.top) return 'top';
  if (seatId === layout.left) return 'left';
  return 'right';
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

interface CenterTableProps {
  mode: 'waiting' | 'table';
  roomCode: string;
  codeCopied: boolean;
  onCopyCode: () => void;
  roundCards: PlayedCardView[];
  manilhaRank: Rank | null;
  viewerTeamId: TeamId;
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId };
  resolutionPhase: 'TRICK_END' | 'ROUND_END' | null;
}

export function CenterTable({
  mode,
  roomCode,
  codeCopied,
  onCopyCode,
  roundCards,
  manilhaRank,
  viewerTeamId,
  seatLayout,
  resolutionPhase,
}: CenterTableProps) {
  const rotationCacheRef = useRef<Map<string, number>>(new Map());

  function getRotation(cardKey: string, direction: SeatDirection): number {
    if (!rotationCacheRef.current.has(cardKey)) {
      const [min, max] = SEAT_ROTATION_RANGE[direction];
      rotationCacheRef.current.set(cardKey, randomInRange(min, max));
    }

    return rotationCacheRef.current.get(cardKey)!;
  }

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

  const winningIndex = getWinningIndex(roundCards, manilhaRank);

  return (
    <div className="relative h-full w-full">
      {/* Ambient felt glow — purely decorative */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-full rounded-full bg-emerald-950/60 blur-3xl sm:h-36" />
      </div>

      {roundCards.length > 0 &&
        roundCards.map((playedCard, i) => {
          const direction = getSeatDirection(playedCard.seatId, seatLayout);
          const pos = SEAT_CARD_POS[direction];
          const cardKey = `${playedCard.seatId}-${playedCard.card?.id ?? 'covered'}`;
          const rotation = getRotation(cardKey, direction);
          const isOurTeam = playedCard.seatId % 2 === viewerTeamId;
          const isWinning = winningIndex === i;
          const zIndex = Z_BY_DIRECTION[direction];

          const ringClass = isWinning
            ? 'ring-2 ring-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.35),0_0_16px_rgba(251,191,36,0.25)]'
            : isOurTeam
              ? 'ring-2 ring-emerald-400/60 shadow-[0_0_0_2px_rgba(52,211,153,0.25)]'
              : 'ring-2 ring-rose-400/60 shadow-[0_0_0_2px_rgba(251,113,133,0.25)]';

          const flyInStyle: CSSProperties = {
            animation: `card-enter-${direction} 0.42s cubic-bezier(0.22, 1, 0.36, 1) both`,
          };
          const resolutionStyle: CSSProperties | undefined = resolutionPhase
            ? {
                animation:
                  'resolved-table-zoom 2s cubic-bezier(0.22, 1, 0.36, 1) both',
                transformOrigin: 'center center',
              }
            : undefined;

          return (
            <div
              key={cardKey}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${pos.x}rem), calc(-50% + ${pos.y}rem)) rotate(${rotation}deg)`,
                zIndex,
              }}
            >
              <div style={flyInStyle}>
                <div
                  className="relative"
                  data-resolution-phase={resolutionPhase ?? undefined}
                  style={resolutionStyle}
                >
                  {isWinning && (
                    <div className="absolute -top-5 left-1/2 z-10 -translate-x-1/2">
                      <Crown className="h-4 w-4 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                    </div>
                  )}
                  <div
                    className={`rounded-[18px] transition-all duration-300 sm:rounded-[22px] ${ringClass}`}
                  >
                    <CardView
                      card={playedCard.card}
                      hidden={playedCard.hidden}
                      manilhaRank={manilhaRank}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
