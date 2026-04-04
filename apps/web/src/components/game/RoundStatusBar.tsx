import { Card, ConnectionState, Rank } from '@truco/contracts';
import { AlertCircle, List, LoaderCircle, Swords } from 'lucide-react';
import { ManilhaFan, MiniCard } from '../Card.js';
import { TableBannerModel, TrickDotTone } from '../../lib/tablePresentation.js';

interface RoundStatusBarProps {
  banner: TableBannerModel | null;
  commandPending: boolean;
  connectionState?: ConnectionState;
  currentRoundPoints: number;
  isWaiting: boolean;
  logCount?: number;
  logsOpen?: boolean;
  manilhaRank: Rank | null;
  trickDots: TrickDotTone[];
  vira: Card | null;
  onToggleLogs?: () => void;
}

function dotClass(dot: TrickDotTone): string {
  if (dot === 'us')
    return 'border-emerald-100 bg-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]';
  if (dot === 'them')
    return 'border-rose-100 bg-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.28)]';
  if (dot === 'tie') return 'bg-white/70 border-white/70';
  return 'bg-transparent border-white/20';
}

export function RoundStatusBar({
  banner,
  commandPending,
  connectionState = 'connected',
  currentRoundPoints,
  isWaiting,
  logCount = 0,
  logsOpen = false,
  manilhaRank,
  trickDots,
  vira,
  onToggleLogs,
}: RoundStatusBarProps) {
  const bannerToneClass =
    banner?.tone === 'player'
      ? 'border-emerald-100/75 bg-emerald-500/22 text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.22)]'
      : banner?.tone === 'opponent'
        ? 'border-rose-100/75 bg-rose-500/22 text-rose-50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
        : banner?.tone === 'warning'
          ? 'border-amber-100/80 bg-amber-400/24 text-amber-50 shadow-[0_0_20px_rgba(245,158,11,0.22)]'
          : banner?.tone === 'finished'
            ? 'border-sky-100/75 bg-sky-500/18 text-sky-50 shadow-[0_0_18px_rgba(14,165,233,0.18)]'
            : 'border-white/14 bg-white/8 text-white/85';

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
      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/82 sm:text-[13px]">
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

          {/* Vira — mini card */}
          {vira && (
            <div className="flex items-center gap-1">
              <MiniCard rank={vira.rank} suit={vira.suit} size="xs" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Vira
              </span>
            </div>
          )}

          {/* Manilha — 4-suit fan */}
          {manilhaRank && (
            <div className="flex items-center gap-1">
              <ManilhaFan rank={manilhaRank} size="xs" />
            </div>
          )}

          {/* Points */}
          <span className="rounded-full border border-white/16 bg-white/10 px-2.5 py-0.5 text-[10px] font-black text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {currentRoundPoints}pt
          </span>

          {/* Sync spinner */}
          {commandPending && (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white/35" />
          )}
        </div>
      )}

      {/* LOG button — only when there are entries */}
      {logCount > 0 && onToggleLogs && (
        <button
          type="button"
          onClick={onToggleLogs}
          className={`flex h-7 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
            logsOpen
              ? 'border-emerald-100/70 bg-emerald-500/20 text-emerald-50'
              : 'border-white/14 bg-white/8 text-white/72 hover:text-white'
          }`}
        >
          <List className="h-3 w-3" />
          {logCount > 9 ? '9+' : logCount}
        </button>
      )}

      {/* Connection alert — only when not connected */}
      {connectionState === 'reconnecting' && (
        <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-200" />
      )}
      {connectionState === 'disconnected' && (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-200" />
      )}
      {connectionState === 'connected' && (
        <Swords className="h-3.5 w-3.5 shrink-0 text-emerald-200/75" />
      )}
    </section>
  );
}
