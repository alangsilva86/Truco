import { ReactNode } from 'react';

interface TopSeatFocusOverlayProps {
  children: ReactNode;
  nickname: string;
}

export function TopSeatFocusOverlay({
  children,
  nickname,
}: TopSeatFocusOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-0 rounded-[26px] bg-black/60 backdrop-blur-[2px]" />

      <div className="relative z-10 flex h-full flex-col items-center px-2 pt-2">
        <div className="pointer-events-auto w-full max-w-sm rounded-[22px] border border-sky-300/20 bg-sky-500/10 px-4 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-100/70">
            Assento do topo em foco
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {nickname} joga diretamente no topo.
          </p>
        </div>

        <div className="pointer-events-auto mt-3 flex w-full justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
