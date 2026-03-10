import { Card, Rank } from '@truco/contracts';
import { TrickDotTone } from '../../lib/tablePresentation.js';

interface RoundStatusBarProps {
  message: string;
  trickDots: TrickDotTone[];
  isWaiting: boolean;
  vira: Card | null;
  manilhaRank: Rank | null;
  currentRoundPoints: number;
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent';
}) {
  const className =
    tone === 'accent'
      ? 'border-amber-300/30 bg-amber-400/12 text-amber-100'
      : 'border-white/10 bg-black/25 text-white';

  return (
    <div
      className={`rounded-[18px] border px-3 py-2.5 sm:rounded-[22px] sm:py-3 ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-black leading-none sm:mt-2 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

export function RoundStatusBar({
  message,
  trickDots,
  isWaiting,
  vira,
  manilhaRank,
  currentRoundPoints,
}: RoundStatusBarProps) {
  return (
    <section className="table-surface mx-3 mt-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-5 sm:py-4">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_minmax(0,1fr)] xl:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/35">
            Estado da rodada
          </p>
          <h2 className="mt-1.5 text-lg font-black leading-tight text-white sm:mt-2 sm:text-[2rem]">
            {message}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {!isWaiting && (
            <div className="col-span-2 rounded-[18px] border border-white/10 bg-black/25 px-3 py-2.5 sm:col-span-1 sm:rounded-[22px] sm:py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">
                Vazas
              </p>
              <div className="mt-2 flex items-center gap-2 sm:mt-3">
                {trickDots.map((dot, index) => (
                  <div
                    key={`${dot}-${index}`}
                    className={`h-3.5 w-3.5 rounded-full border ${
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
            </div>
          )}

          {vira && (
            <StatCard label="Vira" value={`${vira.rank} de ${vira.suit}`} />
          )}

          {manilhaRank && (
            <StatCard label="Manilha" value={manilhaRank} tone="accent" />
          )}

          <StatCard label="Vale" value={String(currentRoundPoints)} />
        </div>
      </div>
    </section>
  );
}
