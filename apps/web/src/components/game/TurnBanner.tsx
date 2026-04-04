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

  const toneClass =
    banner?.tone === 'player'
      ? 'border-emerald-100/75 bg-emerald-500/20 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.18)]'
      : banner?.tone === 'opponent'
        ? 'border-rose-100/75 bg-rose-500/20 text-rose-50 shadow-[0_0_18px_rgba(244,63,94,0.16)]'
        : banner?.tone === 'warning'
          ? 'border-amber-100/80 bg-amber-400/22 text-amber-50 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
          : banner?.tone === 'finished'
            ? 'border-sky-100/75 bg-sky-500/18 text-sky-50 shadow-[0_0_18px_rgba(14,165,233,0.16)]'
            : 'border-white/14 bg-white/8 text-white/88';

  return (
    <div
      className={`mx-3 mt-2 rounded-[20px] border px-3 py-2.5 sm:rounded-[24px] sm:px-4 sm:py-3 ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 sm:text-[11px] sm:tracking-[0.24em]">
            {banner?.title ?? 'Mesa'}
          </p>
          {banner?.detail && (
            <p className="mt-1 text-xs font-semibold text-white sm:truncate sm:text-base">
              {banner.detail}
            </p>
          )}
        </div>

        {commandPending && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/14 bg-white/8 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/82 sm:px-3 sm:text-xs sm:tracking-[0.18em]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            sincronizando
          </div>
        )}
      </div>
    </div>
  );
}
