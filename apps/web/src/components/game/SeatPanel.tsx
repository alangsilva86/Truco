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
  highlightCards?: boolean;
  pendingCardId?: string | null;
  selectedCardId?: string | null;
}

type SeatPanelProps = HiddenSeatPanelProps | VisibleSeatPanelProps;

function getToneClass(tone: SeatTone, active: boolean): string {
  if (active && tone === 'player') {
    return 'border-emerald-400/55 bg-emerald-500/15 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.22)]';
  }

  if (active && tone === 'partner') {
    return 'border-emerald-300/55 bg-emerald-400/12 text-emerald-100 shadow-[0_0_14px_rgba(110,231,183,0.22)]';
  }

  if (active && tone === 'opponent') {
    return 'border-rose-400/45 bg-rose-500/15 text-rose-100 shadow-[0_0_12px_rgba(251,113,133,0.18)]';
  }

  if (tone === 'partner') {
    return 'border-sky-300/20 bg-sky-500/8 text-sky-100';
  }

  if (tone === 'opponent') {
    return 'border-rose-300/18 bg-black/20 text-rose-100/80';
  }

  return 'border-emerald-300/20 bg-black/20 text-emerald-100/80';
}

export function SeatPanel(props: SeatPanelProps) {
  const badgeClass = getToneClass(props.tone, props.active);

  if (props.mode === 'hidden') {
    return (
      <div
        className={`flex flex-col items-center gap-1.5 ${props.orientation === 'left' || props.orientation === 'right' ? 'max-w-[4.75rem] sm:max-w-none' : ''}`}
      >
        <div
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] sm:px-3 sm:text-xs sm:tracking-[0.18em] ${badgeClass}`}
        >
          <span className="block max-w-[4rem] truncate sm:max-w-[7rem]">
            {props.nickname}
          </span>
          {props.dealer && <span className="ml-1 text-amber-300/80">·D</span>}
        </div>

        <div className="flex -space-x-2.5 sm:-space-x-4">
          {Array.from({ length: props.count }).map((_, index) => (
            <div
              key={`${props.orientation}-card-${index}`}
              className="h-12 w-8 rounded-[14px] border border-white/10 bg-slate-950 shadow-xl sm:h-20 sm:w-14 sm:rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  const compact = props.orientation !== 'bottom';
  const isBottom = props.orientation === 'bottom';
  const isTop = props.orientation === 'top';
  const highlightCards = props.highlightCards ?? true;

  return (
    <div
      className={`flex flex-col items-center gap-1.5 sm:gap-2 ${isBottom || isTop ? 'w-full' : ''}`}
    >
      <div
        className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] sm:px-3 sm:text-xs sm:tracking-[0.18em] ${badgeClass}`}
      >
        <span className="block max-w-[9rem] truncate sm:max-w-[10rem]">
          {props.nickname}
        </span>
        {props.dealer && <span className="ml-1 text-amber-300/80">·D</span>}
      </div>

      <div
        className={`flex w-full items-center justify-center pt-3 pb-2 ${isBottom ? 'gap-1.5 sm:gap-3' : 'gap-1.5 sm:gap-2.5'} ${isTop ? 'max-w-[20rem] sm:max-w-none' : ''}`}
      >
        {props.cards.map((card) => (
          <CardView
            key={card.id}
            card={card}
            manilhaRank={props.manilhaRank}
            compact={compact}
            onClick={
              !props.disabled && props.onPlayCard
                ? () => props.onPlayCard?.(card)
                : undefined
            }
            active={highlightCards && props.active && !props.disabled}
            muted={!props.active}
            pending={props.pendingCardId === card.id}
            selected={props.selectedCardId === card.id}
          />
        ))}
      </div>
    </div>
  );
}
