import { Card, Rank } from '@truco/contracts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TableBannerModel, TrickDotTone } from '../../lib/tablePresentation.js';

interface RoundContextRailProps {
  activeSeatLabel: 'baixo' | 'cima' | null;
  activeSeatName: string | null;
  banner: TableBannerModel | null;
  compactFactsInFelt: boolean;
  currentRoundPoints: number;
  defaultCollapsed: boolean;
  dimmed?: boolean;
  manilhaRank: Rank | null;
  trickDots: TrickDotTone[];
  vira: Card | null;
}

function FactChip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'accent' | 'default';
}) {
  const className =
    tone === 'accent'
      ? 'border-amber-300/30 bg-amber-400/12 text-amber-100'
      : 'border-white/10 bg-black/20 text-white/85';

  return (
    <div className={`rounded-full border px-3 py-2 ${className}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/45">
        {label}
      </p>
      <p className="mt-1 text-sm font-black leading-none">{value}</p>
    </div>
  );
}

function TrickDots({ trickDots }: { trickDots: TrickDotTone[] }) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      {trickDots.map((dot, index) => (
        <div
          key={`${dot}-${index}`}
          className={`h-2.5 w-2.5 rounded-full border ${
            dot === 'us'
              ? 'border-emerald-400 bg-emerald-400'
              : dot === 'them'
                ? 'border-rose-400 bg-rose-400'
                : dot === 'tie'
                  ? 'border-white/70 bg-white/70'
                  : 'border-white/20 bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

export function RoundContextRail({
  activeSeatLabel,
  activeSeatName,
  banner,
  compactFactsInFelt,
  currentRoundPoints,
  defaultCollapsed,
  dimmed = false,
  manilhaRank,
  trickDots,
  vira,
}: RoundContextRailProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  useEffect(() => {
    setExpanded(!defaultCollapsed);
  }, [defaultCollapsed]);

  const canToggle = Boolean(vira || trickDots.length > 0);
  const showExpandedFacts = expanded || !compactFactsInFelt;
  const identityLine =
    activeSeatName && activeSeatLabel
      ? `Jogando agora: ${activeSeatName} · assento ${activeSeatLabel}`
      : (banner?.detail ?? '');

  return (
    <section
      className={`table-surface mx-2 mt-2 rounded-[22px] px-3 py-3 transition sm:mx-3 ${dimmed ? 'opacity-45' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
            {banner?.title ?? 'Mesa'}
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-white">
            {identityLine}
          </p>
        </div>

        {canToggle && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? 'Ocultar detalhes da rodada'
                : 'Mostrar detalhes da rodada'
            }
            onClick={() => setExpanded((current) => !current)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FactChip label="Vale" value={String(currentRoundPoints)} />
        {manilhaRank && (
          <FactChip label="Manilha" value={manilhaRank} tone="accent" />
        )}
      </div>

      {showExpandedFacts && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {vira && (
            <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40">
                Vira
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {vira.rank} de {vira.suit}
              </p>
            </div>
          )}

          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40">
              Vazas
            </p>
            <TrickDots trickDots={trickDots} />
          </div>
        </div>
      )}
    </section>
  );
}
