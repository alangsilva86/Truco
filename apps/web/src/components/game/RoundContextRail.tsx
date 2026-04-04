import { Card, Rank } from '@truco/contracts';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ManilhaFan, MiniCard } from '../Card.js';
import { TableBannerModel, TrickDotTone } from '../../lib/tablePresentation.js';

interface RoundContextRailProps {
  activeSeatLabel: 'baixo' | 'cima' | null;
  activeSeatName: string | null;
  banner: TableBannerModel | null;
  currentRoundPoints: number;
  dimmed?: boolean;
  manilhaRank: Rank | null;
  trickDots: TrickDotTone[];
  vira: Card | null;
}

function dotClass(dot: TrickDotTone): string {
  if (dot === 'us')
    return 'border-emerald-100 bg-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]';
  if (dot === 'them')
    return 'border-rose-100 bg-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.28)]';
  if (dot === 'tie') return 'bg-white/70 border-white/70';
  return 'bg-transparent border-white/25';
}

export function RoundContextRail({
  activeSeatLabel,
  activeSeatName,
  banner,
  currentRoundPoints,
  dimmed = false,
  manilhaRank,
  trickDots,
  vira,
}: RoundContextRailProps) {
  const [expanded, setExpanded] = useState(false);

  const identityLine =
    activeSeatName && activeSeatLabel
      ? `${activeSeatName} · assento ${activeSeatLabel}`
      : (banner?.detail ?? banner?.title ?? '');

  const titleLabel = banner?.title ?? 'Mesa';

  return (
    <section
      className={`table-surface mx-2 mt-2 overflow-hidden rounded-[18px] transition ${dimmed ? 'opacity-45' : ''}`}
    >
      {/* Compact single-line strip — always visible */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((s) => !s)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5"
      >
        {/* Tone dot */}
        <div
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            banner?.tone === 'player'
              ? 'bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : banner?.tone === 'opponent'
                ? 'bg-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.45)]'
                : banner?.tone === 'warning'
                  ? 'bg-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                  : 'bg-white/55'
          }`}
        />

        {/* Context line */}
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
            {titleLabel}
          </span>
          {identityLine && (
            <span className="min-w-0 truncate text-xs font-semibold text-white/88">
              {identityLine}
            </span>
          )}
        </div>

        {/* Inline fact summary */}
        <div className="flex shrink-0 items-center gap-2">
          {/* VALE */}
          <span className="rounded-full border border-white/14 bg-white/8 px-2 py-0.5 text-[10px] font-black tabular-nums text-white/95">
            {currentRoundPoints}
            <span className="ml-0.5 text-white/30">pts</span>
          </span>

          {/* Manilha fan mini */}
          {manilhaRank && <ManilhaFan rank={manilhaRank} size="xs" />}

          {/* Trick dots mini */}
          <div className="flex items-center gap-0.5">
            {trickDots.map((dot, index) => (
              <div
                key={`${dot}-${index}`}
                className={`h-1.5 w-1.5 rounded-full border ${dotClass(dot)}`}
              />
            ))}
          </div>

          {/* Expand chevron */}
          <ChevronDown
            className={`h-3.5 w-3.5 text-white/55 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable detail drawer */}
      {expanded && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/12 px-3 pb-3 pt-2.5">
          {/* VALE chip */}
          <div className="rounded-[14px] border border-white/14 bg-white/8 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">
              Vale
            </p>
            <p className="mt-0.5 text-sm font-black leading-none text-white">
              {currentRoundPoints}
            </p>
          </div>

          {/* Manilha chip — fan of 4 cards */}
          {manilhaRank && (
            <div className="rounded-[14px] border border-amber-100/65 bg-amber-400/20 px-3 py-2 text-amber-50 shadow-[0_0_18px_rgba(245,158,11,0.16)]">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-50/80">
                Manilha
              </p>
              <div className="mt-1.5">
                <ManilhaFan rank={manilhaRank} size="sm" />
              </div>
            </div>
          )}

          {/* Vira — mini card */}
          {vira && (
            <div className="rounded-[14px] border border-white/14 bg-white/8 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">
                Vira
              </p>
              <div className="mt-1.5">
                <MiniCard rank={vira.rank} suit={vira.suit} size="sm" />
              </div>
            </div>
          )}

          {/* Vazas */}
          <div className="rounded-[14px] border border-white/14 bg-white/8 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">
              Vazas
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {trickDots.map((dot, index) => (
                <div
                  key={`big-${dot}-${index}`}
                  className={`h-2.5 w-2.5 rounded-full border ${dotClass(dot)}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
