import { LoaderCircle } from 'lucide-react';
import { TableBannerModel } from '../../lib/tablePresentation.js';

interface TurnBannerProps {
  banner: TableBannerModel | null;
  commandPending: boolean;
}

export function TurnBanner({ banner, commandPending }: TurnBannerProps) {
  if (!banner && !commandPending) {
    return null;
  }

  const toneClass = banner?.tone === 'player'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    : banner?.tone === 'opponent'
      ? 'border-rose-400/25 bg-rose-500/10 text-rose-200'
      : banner?.tone === 'warning'
        ? 'border-amber-300/30 bg-amber-500/10 text-amber-200'
        : banner?.tone === 'finished'
          ? 'border-sky-300/20 bg-sky-500/10 text-sky-100'
          : 'border-white/10 bg-white/5 text-white/75';

  return (
    <div className={`mx-3 mt-2 rounded-[24px] border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] opacity-70">
            {banner?.title ?? 'Mesa'}
          </p>
          {banner?.detail && (
            <p className="mt-1 truncate text-sm font-medium text-white/85 sm:text-base">
              {banner.detail}
            </p>
          )}
        </div>

        {commandPending && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/55">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            sincronizando
          </div>
        )}
      </div>
    </div>
  );
}
