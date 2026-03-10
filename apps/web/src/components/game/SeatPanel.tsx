import { Card, Rank } from '@truco/contracts';
import { CardView } from '../Card.js';

type SeatOrientation = 'left' | 'right' | 'top' | 'bottom';
type SeatTone = 'player' | 'partner' | 'opponent';

interface BaseSeatPanelProps {
  orientation: SeatOrientation;
  tone: SeatTone;
  nickname: string;
  dealer: boolean;
  active: boolean;
}

interface HiddenSeatPanelProps extends BaseSeatPanelProps {
  mode: 'hidden';
  count: number;
}

interface VisibleSeatPanelProps extends BaseSeatPanelProps {
  mode: 'visible';
  cards: Card[];
  manilhaRank: Rank | null;
  onPlayCard?: (card: Card) => void;
  disabled?: boolean;
}

type SeatPanelProps = HiddenSeatPanelProps | VisibleSeatPanelProps;

function getToneClass(tone: SeatTone, active: boolean): string {
  if (active && tone === 'player') {
    return 'border-emerald-400/45 bg-emerald-500/12 text-emerald-100';
  }

  if (active && tone === 'opponent') {
    return 'border-rose-400/35 bg-rose-500/12 text-rose-100';
  }

  if (tone === 'partner') {
    return 'border-sky-300/25 bg-sky-500/10 text-sky-100';
  }

  if (tone === 'opponent') {
    return 'border-rose-300/20 bg-black/25 text-rose-100';
  }

  return 'border-emerald-300/25 bg-black/25 text-emerald-100';
}

export function SeatPanel(props: SeatPanelProps) {
  const badgeClass = getToneClass(props.tone, props.active);

  if (props.mode === 'hidden') {
    return (
      <div className={`flex flex-col items-center gap-2 ${props.orientation === 'left' || props.orientation === 'right' ? 'max-w-[5.5rem] sm:max-w-none' : ''}`}>
        <div className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${badgeClass}`}>
          <span className="block max-w-[4.5rem] truncate sm:max-w-none">{props.nickname}</span>
          {props.dealer && <span className="ml-1 text-amber-300/80">·D</span>}
        </div>

        <div className="flex -space-x-3 sm:-space-x-4">
          {Array.from({ length: props.count }).map((_, index) => (
            <div
              key={`${props.orientation}-card-${index}`}
              className="h-16 w-11 rounded-xl border border-white/10 bg-slate-950 shadow-xl sm:h-20 sm:w-14 sm:rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  const compact = props.orientation !== 'bottom';

  return (
    <div className={`flex flex-col items-center gap-2 ${props.orientation === 'bottom' ? 'w-full' : ''}`}>
      <div className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${badgeClass}`}>
        <span className="block max-w-[10rem] truncate">{props.nickname}</span>
        {props.dealer && <span className="ml-1 text-amber-300/80">·D</span>}
      </div>

      <div className={`flex items-center justify-center ${props.orientation === 'bottom' ? 'gap-2 sm:gap-3' : 'gap-1.5 sm:gap-2'}`}>
        {props.cards.map((card) => (
          <CardView
            key={card.id}
            card={card}
            manilhaRank={props.manilhaRank}
            compact={compact}
            onClick={!props.disabled && props.onPlayCard ? () => props.onPlayCard?.(card) : undefined}
            active={props.active && !props.disabled}
            muted={!props.active}
          />
        ))}
      </div>
    </div>
  );
}
