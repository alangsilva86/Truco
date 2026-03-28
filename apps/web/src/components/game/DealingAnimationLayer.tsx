import { type CSSProperties } from 'react';
import { SeatId } from '@truco/contracts';

interface DealingAnimationLayerProps {
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId };
}

type SeatDirection = 'bottom' | 'top' | 'left' | 'right';

const DEAL_TARGETS: Record<
  SeatDirection,
  { x: string; y: string; rotation: string; pulseClass: string }
> = {
  bottom: {
    x: '0rem',
    y: '5.8rem',
    rotation: '6deg',
    pulseClass: 'bottom-[10%] left-1/2 -translate-x-1/2',
  },
  top: {
    x: '0rem',
    y: '-5.8rem',
    rotation: '-6deg',
    pulseClass: 'top-[10%] left-1/2 -translate-x-1/2',
  },
  left: {
    x: '-6.4rem',
    y: '0.3rem',
    rotation: '-14deg',
    pulseClass: 'left-[8%] top-1/2 -translate-y-1/2',
  },
  right: {
    x: '6.4rem',
    y: '0.3rem',
    rotation: '14deg',
    pulseClass: 'right-[8%] top-1/2 -translate-y-1/2',
  },
};

function getSeatDirection(
  seatId: SeatId,
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId },
): SeatDirection {
  if (seatId === seatLayout.bottom) {
    return 'bottom';
  }

  if (seatId === seatLayout.top) {
    return 'top';
  }

  if (seatId === seatLayout.left) {
    return 'left';
  }

  return 'right';
}

export function DealingAnimationLayer({
  seatLayout,
}: DealingAnimationLayerProps) {
  const cycle: SeatId[] = [
    seatLayout.bottom,
    seatLayout.right,
    seatLayout.top,
    seatLayout.left,
    seatLayout.bottom,
    seatLayout.right,
    seatLayout.top,
    seatLayout.left,
    seatLayout.bottom,
    seatLayout.right,
    seatLayout.top,
    seatLayout.left,
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[32] overflow-hidden">
      <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-emerald-400/8 via-transparent to-transparent" />

      {(['bottom', 'top', 'left', 'right'] as const).map((direction, index) => (
        <div
          key={direction}
          className={`absolute h-14 w-10 rounded-full border border-emerald-300/15 bg-emerald-300/6 blur-[2px] sm:h-20 sm:w-14 ${DEAL_TARGETS[direction].pulseClass}`}
          style={{
            animation: `deal-seat-pulse 1.15s ease-in-out ${index * 0.08}s infinite`,
          }}
        />
      ))}

      <div className="absolute left-1/2 top-1/2 flex h-16 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] border border-white/12 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl sm:h-20 sm:w-14">
        <div className="h-10 w-7 rounded-xl border border-emerald-300/15 bg-emerald-400/8 sm:h-12 sm:w-9" />
      </div>

      <div className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/72 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-100/75 shadow-lg backdrop-blur-sm">
        Distribuindo
      </div>

      {cycle.map((seatId, index) => {
        const direction = getSeatDirection(seatId, seatLayout);
        const target = DEAL_TARGETS[direction];
        const style = {
          '--deal-x': target.x,
          '--deal-y': target.y,
          '--deal-r': target.rotation,
          animationDelay: `${index * 75}ms`,
        } as CSSProperties & {
          '--deal-r': string;
          '--deal-x': string;
          '--deal-y': string;
        };

        return (
          <div
            key={`${seatId}-${index}`}
            className="absolute left-1/2 top-1/2 h-14 w-10 -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl sm:h-20 sm:w-14 sm:rounded-[22px]"
            style={{
              ...style,
              animation:
                'deal-card-flight 0.64s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <div className="m-1.5 flex h-[calc(100%-0.75rem)] items-center justify-center rounded-xl border border-emerald-300/12 bg-emerald-400/8 sm:m-2">
              <div className="h-7 w-5 rounded-md border border-emerald-200/10 bg-emerald-200/8 sm:h-10 sm:w-7" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
