import {
  PlayerInfo,
  Rank,
  SeatId,
  TeamId,
  TrickView,
} from '@truco/contracts';
import { Crown, Minus } from 'lucide-react';
import { ResolvedTrickSpotlight } from './ResolvedTrickSpotlight.js';

interface TrickResultBannerProps {
  trick: TrickView | null;
  players: Record<SeatId, PlayerInfo>;
  viewerTeamId: TeamId;
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId };
  manilhaRank: Rank | null;
}

function getWinnerCopy(
  trick: TrickView,
  players: Record<SeatId, PlayerInfo>,
): {
  title: string;
  detail: string;
  centerLabel: string;
  winnerTeamId: TeamId | null;
} {
  if (trick.winnerSeatId === 'tie') {
    return {
      title: 'Vaza empatada',
      detail: 'A mesa empatou. Confira as cartas antes da proxima saida.',
      centerLabel: 'Empate',
      winnerTeamId: null,
    };
  }

  const winner = players[trick.winnerSeatId];
  return {
    title: `${winner.nickname} levou a vaza`,
    detail: 'A mesa fica aberta por mais tempo para leitura da jogada.',
    centerLabel: winner.nickname,
    winnerTeamId: (trick.winnerSeatId % 2) as TeamId,
  };
}

export function TrickResultBanner({
  trick,
  players,
  viewerTeamId,
  seatLayout,
  manilhaRank,
}: TrickResultBannerProps) {
  if (!trick) {
    return null;
  }

  const { title, detail, centerLabel, winnerTeamId } = getWinnerCopy(
    trick,
    players,
  );
  const toneClass =
    winnerTeamId === null
      ? 'border-white/15 bg-slate-950/82 text-white'
      : winnerTeamId === viewerTeamId
        ? 'border-emerald-300/25 bg-emerald-950/80 text-emerald-100'
        : 'border-rose-300/20 bg-rose-950/80 text-rose-100';
  const iconClass =
    winnerTeamId === null
      ? 'border-white/15 bg-white/6 text-white/80'
      : winnerTeamId === viewerTeamId
        ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200'
        : 'border-rose-300/20 bg-rose-500/10 text-rose-200';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-1/2 z-[54] flex -translate-y-1/2 items-center justify-center px-4"
      style={{
        animation: 'banner-rise 0.38s cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div
        className={`flex w-full max-w-[24rem] flex-col items-center gap-3 rounded-[28px] border px-5 py-5 text-center shadow-2xl backdrop-blur-md sm:px-6 ${toneClass}`}
      >
        <div className={`rounded-full border p-2.5 ${iconClass}`}>
          {trick.winnerSeatId === 'tie' ? (
            <Minus className="h-5 w-5" />
          ) : (
            <Crown className="h-5 w-5" />
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] opacity-50">
            Fim da vaza
          </p>
          <p className="mt-1 text-xl font-black sm:text-2xl">{title}</p>
          <p className="mt-2 text-sm opacity-75">{detail}</p>
        </div>

        <ResolvedTrickSpotlight
          trick={trick}
          players={players}
          viewerTeamId={viewerTeamId}
          seatLayout={seatLayout}
          manilhaRank={manilhaRank}
          centerLabel={centerLabel}
        />
      </div>
    </div>
  );
}
