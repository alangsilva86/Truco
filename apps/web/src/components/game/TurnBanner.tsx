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
    <div className={`mx-3 mt-2 rounded-[20px] border px-3 py-2.5 sm:rounded-[24px] sm:px-4 sm:py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 sm:text-[11px] sm:tracking-[0.24em]">
            {banner?.title ?? 'Mesa'}
          </p>
          {banner?.detail && (
            <p className="mt-1 text-xs font-medium text-white/85 sm:truncate sm:text-base">
              {banner.detail}
            </p>
          )}
        </div>

        {commandPending && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/55 sm:px-3 sm:text-xs sm:tracking-[0.18em]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            sincronizando
          </div>
        )}
      </div>
    </div>
  );
}
