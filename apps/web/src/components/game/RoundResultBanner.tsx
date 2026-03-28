import {
  PlayerInfo,
  Rank,
  SeatId,
  TeamId,
  TrickView,
} from '@truco/contracts';
import { Crown } from 'lucide-react';
import { ResolvedTrickSpotlight } from './ResolvedTrickSpotlight.js';

interface RoundResultBannerProps {
  trickHistory: TrickView[];
  players: Record<SeatId, PlayerInfo>;
  viewerTeamId: TeamId;
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId };
  manilhaRank: Rank | null;
  awardedPoints: number;
  scoreUs: number;
  scoreThem: number;
}

function countTricks(
  history: TrickView[],
  viewerTeamId: TeamId,
): { us: number; them: number } {
  let us = 0;
  let them = 0;

  for (const trick of history) {
    if (trick.winnerSeatId === 'tie') {
      continue;
    }

    if (trick.winnerSeatId % 2 === viewerTeamId) {
      us += 1;
      continue;
    }

    them += 1;
  }

  return { us, them };
}

export function RoundResultBanner({
  trickHistory,
  players,
  viewerTeamId,
  seatLayout,
  manilhaRank,
  awardedPoints,
  scoreUs,
  scoreThem,
}: RoundResultBannerProps) {
  if (trickHistory.length === 0) {
    return null;
  }

  const { us, them } = countTricks(trickHistory, viewerTeamId);
  const weWon = us > them;
  const focusTrick = trickHistory[trickHistory.length - 1];
  const focusWinnerName =
    focusTrick.winnerSeatId === 'tie'
      ? 'Vaza empatada'
      : players[focusTrick.winnerSeatId].nickname;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-1/2 z-[55] flex -translate-y-1/2 items-center justify-center px-4"
      style={{
        animation: 'banner-rise 0.38s cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div
        className={`flex w-full max-w-[26rem] flex-col items-center gap-3 rounded-[28px] border px-5 py-5 text-center shadow-2xl backdrop-blur-md sm:px-7 ${
          weWon
            ? 'border-emerald-300/25 bg-emerald-950/80 text-emerald-100'
            : 'border-rose-300/20 bg-rose-950/80 text-rose-100'
        }`}
      >
        <div
          className={`rounded-full border p-2.5 ${
            weWon
              ? 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200'
              : 'border-rose-300/20 bg-rose-500/10 text-rose-200'
          }`}
        >
          <Crown className="h-5 w-5" />
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] opacity-50">
            {weWon ? 'Rodada ganha' : 'Rodada perdida'}
          </p>
          <p className="mt-1 text-2xl font-black">
            {weWon
              ? `+${awardedPoints} ponto${awardedPoints !== 1 ? 's' : ''}`
              : 'Sem pontos'}
          </p>
          <p className="mt-2 text-sm opacity-75">
            {focusTrick.winnerSeatId === 'tie'
              ? 'A ultima vaza empatou, mas a rodada ja estava decidida.'
              : `${focusWinnerName} fechou a mesa. Veja a mao final antes da proxima distribuicao.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {trickHistory.map((trick, index) => {
            const wonByUs =
              trick.winnerSeatId !== 'tie' &&
              trick.winnerSeatId % 2 === viewerTeamId;
            const tie = trick.winnerSeatId === 'tie';

            return (
              <div
                key={`${index}-${trick.winnerSeatId}`}
                className={`h-2.5 w-2.5 rounded-full border ${
                  tie
                    ? 'border-white/50 bg-white/50'
                    : wonByUs
                      ? 'border-emerald-400 bg-emerald-400'
                      : 'border-rose-400 bg-rose-400'
                }`}
              />
            );
          })}
        </div>

        <ResolvedTrickSpotlight
          trick={focusTrick}
          players={players}
          viewerTeamId={viewerTeamId}
          seatLayout={seatLayout}
          manilhaRank={manilhaRank}
          centerLabel={focusWinnerName}
        />

        <p className="text-sm font-black tabular-nums opacity-70">
          {scoreUs} x {scoreThem}
        </p>
      </div>
    </div>
  );
}
