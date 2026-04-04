interface TopSeatFocusOverlayProps {
  nickname: string;
}

/** Non-blocking indicator shown on the felt when the top seat (partner) needs to play. */
export function TopSeatFocusOverlay({ nickname }: TopSeatFocusOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1 z-20 flex justify-center">
      <div className="rounded-full border border-sky-300/25 bg-sky-950/70 px-3 py-1 backdrop-blur-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200/70">
          Jogando pelo parceiro · {nickname}
        </p>
      </div>
    </div>
  );
}
