import {
  PlayerInfo,
  Rank,
  SeatId,
  TeamId,
  TrickView,
} from '@truco/contracts';
import { Crown } from 'lucide-react';
import { CardView } from '../Card.js';

interface ResolvedTrickSpotlightProps {
  trick: TrickView;
  players: Record<SeatId, PlayerInfo>;
  viewerTeamId: TeamId;
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId };
  manilhaRank: Rank | null;
  centerLabel: string;
}

type SeatDirection = 'bottom' | 'top' | 'left' | 'right';

const SPOTLIGHT_CLASS: Record<SeatDirection, string> = {
  bottom: 'bottom-0 left-1/2 -translate-x-1/2',
  top: 'top-0 left-1/2 -translate-x-1/2',
  left: 'left-0 top-1/2 -translate-y-1/2',
  right: 'right-0 top-1/2 -translate-y-1/2',
};

function getSeatDirection(
  seatId: SeatId,
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId },
): SeatDirection {
  if (seatId === seatLayout.bottom) {
    return 'bottom';
  }

  if (seatId === seatLayout.top) {
    return 'top';
  }

  if (seatId === seatLayout.left) {
    return 'left';
  }

  return 'right';
}

function sortCardsByLayout(
  cards: TrickView['cards'],
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId },
): TrickView['cards'] {
  const order = [seatLayout.top, seatLayout.left, seatLayout.right, seatLayout.bottom];
  return [...cards].sort(
    (left, right) => order.indexOf(left.seatId) - order.indexOf(right.seatId),
  );
}

export function ResolvedTrickSpotlight({
  trick,
  players,
  viewerTeamId,
  seatLayout,
  manilhaRank,
  centerLabel,
}: ResolvedTrickSpotlightProps) {
  const orderedCards = sortCardsByLayout(trick.cards, seatLayout);

  return (
    <div className="relative h-44 w-full max-w-[20rem] sm:h-48 sm:max-w-[22rem]">
      {orderedCards.map((playedCard) => {
        const direction = getSeatDirection(playedCard.seatId, seatLayout);
        const isWinner =
          trick.winnerSeatId !== 'tie' && trick.winnerSeatId === playedCard.seatId;
        const isOurTeam = playedCard.seatId % 2 === viewerTeamId;

        return (
          <div
            key={`${playedCard.seatId}-${playedCard.card?.id ?? 'covered'}`}
            className={`absolute flex flex-col items-center gap-1.5 ${SPOTLIGHT_CLASS[direction]}`}
          >
            <div className="relative">
              {isWinner && (
                <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2">
                  <Crown className="h-4 w-4 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
                </div>
              )}
              <div
                className={`rounded-[18px] ${
                  isWinner
                    ? 'ring-2 ring-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.35),0_0_18px_rgba(251,191,36,0.22)]'
                    : isOurTeam
                      ? 'ring-1 ring-emerald-400/55 shadow-[0_0_0_1px_rgba(52,211,153,0.22)]'
                      : 'ring-1 ring-rose-400/55 shadow-[0_0_0_1px_rgba(251,113,133,0.22)]'
                }`}
              >
                <CardView
                  card={playedCard.card}
                  hidden={playedCard.hidden}
                  manilhaRank={manilhaRank}
                  compact
                />
              </div>
            </div>

            <p
              className={`max-w-[5.5rem] truncate text-center text-[10px] font-black uppercase tracking-[0.12em] ${
                isOurTeam ? 'text-emerald-100/80' : 'text-rose-100/80'
              }`}
            >
              {players[playedCard.seatId].nickname}
            </p>
          </div>
        );
      })}

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-full border border-white/10 bg-slate-950/82 px-4 py-2 text-center shadow-xl backdrop-blur-sm">
        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/35">
          Mesa
        </span>
        <span className="mt-1 max-w-[8rem] text-xs font-black uppercase tracking-[0.16em] text-white/85">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}
