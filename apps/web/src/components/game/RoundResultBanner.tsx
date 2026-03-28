import { TeamId, TrickView } from '@truco/contracts';
import { Crown } from 'lucide-react';

interface RoundResultBannerProps {
  trickHistory: TrickView[];
  viewerTeamId: TeamId;
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
  viewerTeamId,
  awardedPoints,
  scoreUs,
  scoreThem,
}: RoundResultBannerProps) {
  if (trickHistory.length === 0) {
    return null;
  }

  const { us, them } = countTricks(trickHistory, viewerTeamId);
  const weWon = us > them;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-1/2 z-[55] flex -translate-y-1/2 items-center justify-center px-4"
      style={{
        animation: 'banner-rise 0.38s cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div
        className={`flex flex-col items-center gap-3 rounded-[28px] border px-7 py-5 text-center shadow-2xl backdrop-blur-md ${
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

        <p className="text-sm font-black tabular-nums opacity-70">
          {scoreUs} x {scoreThem}
        </p>
      </div>
    </div>
  );
}
