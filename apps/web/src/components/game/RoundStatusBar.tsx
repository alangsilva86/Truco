import { Card, Rank } from '@truco/contracts';
import { LoaderCircle } from 'lucide-react';
import { TableBannerModel, TrickDotTone } from '../../lib/tablePresentation.js';

interface RoundStatusBarProps {
  banner: TableBannerModel | null;
  commandPending: boolean;
  currentRoundPoints: number;
  isWaiting: boolean;
  manilhaRank: Rank | null;
  message: string;
  trickDots: TrickDotTone[];
  vira: Card | null;
}

function dotClass(dot: TrickDotTone): string {
  if (dot === 'us') return 'bg-emerald-400 border-emerald-400';
  if (dot === 'them') return 'bg-rose-400 border-rose-400';
  if (dot === 'tie') return 'bg-white/70 border-white/70';
  return 'bg-transparent border-white/20';
}

export function RoundStatusBar({
  banner,
  commandPending,
  currentRoundPoints,
  isWaiting,
  manilhaRank,
  trickDots,
  vira,
}: RoundStatusBarProps) {
  const bannerToneClass =
    banner?.tone === 'player'
      ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200'
      : banner?.tone === 'opponent'
        ? 'border-rose-400/35 bg-rose-500/12 text-rose-200'
        : banner?.tone === 'warning'
          ? 'border-amber-300/35 bg-amber-500/12 text-amber-200'
          : banner?.tone === 'finished'
            ? 'border-sky-300/25 bg-sky-500/10 text-sky-100'
            : 'border-white/10 bg-white/5 text-white/60';

  return (
    <section className="table-surface mx-3 mt-2 flex min-h-0 items-center gap-2.5 rounded-[20px] px-3 py-2 sm:gap-3 sm:rounded-[24px] sm:px-4">
      {/* Phase/turn pill */}
      {!isWaiting && banner && (
        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${bannerToneClass}`}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
          {banner.title}
        </div>
      )}

      {/* Context detail — takes remaining space, truncated */}
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-white/55 sm:text-[13px]">
        {isWaiting ? 'Aguardando jogadores...' : (banner?.detail ?? '')}
      </p>

      {/* Inline game facts — right side */}
      {!isWaiting && (
        <div className="flex shrink-0 items-center gap-2.5">
          {/* Trick dots */}
          <div className="flex items-center gap-1">
            {trickDots.map((dot, index) => (
              <div
                key={`${dot}-${index}`}
                className={`h-2 w-2 rounded-full border ${dotClass(dot)}`}
              />
            ))}
          </div>

          {/* Vira */}
          {vira && (
            <span className="text-[10px] font-black tabular-nums text-white/50 sm:text-xs">
              {vira.rank}
              <span className="ml-0.5 font-normal text-white/30">Vira</span>
            </span>
          )}

          {/* Manilha */}
          {manilhaRank && (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-300/85">
              {manilhaRank}★
            </span>
          )}

          {/* Points */}
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black text-white/70">
            {currentRoundPoints}pt
          </span>

          {/* Sync spinner */}
          {commandPending && (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white/35" />
          )}
        </div>
      )}
    </section>
  );
}
