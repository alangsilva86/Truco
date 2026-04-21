import { Card, Rank } from '@truco/contracts';
import { CardView } from '../Card.js';

type SeatOrientation = 'left' | 'right' | 'top' | 'bottom';
type SeatTone = 'player' | 'partner' | 'opponent';

interface BaseSeatPanelProps {
  orientation: SeatOrientation;
  tone: SeatTone;
  nickname: string;
  connected: boolean;
  dealer: boolean;
  active: boolean;
  roundRole: 'mao' | 'pe' | null;
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
    return 'border-emerald-200/80 bg-emerald-400/24 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.36)]';
  }

  if (active && tone === 'partner') {
    return 'border-emerald-100/75 bg-emerald-300/22 text-emerald-50 shadow-[0_0_18px_rgba(52,211,153,0.32)]';
  }

  if (active && tone === 'opponent') {
    return 'border-rose-200/80 bg-rose-500/22 text-rose-50 shadow-[0_0_18px_rgba(244,63,94,0.34)]';
  }

  if (tone === 'partner') {
    return 'border-sky-200/32 bg-sky-400/14 text-sky-50';
  }

  if (tone === 'opponent') {
    return 'border-rose-300/28 bg-rose-500/10 text-rose-100/92';
  }

  return 'border-emerald-300/28 bg-emerald-500/10 text-emerald-100/92';
}

function getRoleLabel(
  roundRole: 'mao' | 'pe' | null,
  dealer: boolean,
): string | null {
  if (roundRole === 'mao') {
    return 'Mao';
  }

  if (roundRole === 'pe') {
    return 'Pe';
  }

  if (dealer) {
    return 'D';
  }

  return null;
}

function getConnectionClass(connected: boolean): string {
  return connected
    ? 'bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.42)]'
    : 'bg-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.42)]';
}

export function SeatPanel(props: SeatPanelProps) {
  const badgeClass = getToneClass(props.tone, props.active);
  const roleLabel = getRoleLabel(props.roundRole, props.dealer);

  if (props.mode === 'hidden') {
    return (
      <div
        data-seat-orientation={props.orientation}
        className={`flex flex-col items-center gap-1.5 ${props.orientation === 'left' || props.orientation === 'right' ? 'max-w-[4.75rem] sm:max-w-none' : ''}`}
      >
        <div
          className={`flex flex-col items-center gap-1 rounded-2xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] sm:px-3 sm:text-xs sm:tracking-[0.18em] ${badgeClass}`}
        >
          <span className="block max-w-[4rem] truncate sm:max-w-[7rem]">
            {props.nickname}
          </span>
          <div className="flex items-center gap-1.5">
            {roleLabel && (
              <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[8px] tracking-[0.2em] text-white/78 sm:text-[9px]">
                {roleLabel}
              </span>
            )}
            <span
              aria-label={props.connected ? 'online' : 'offline'}
              className={`h-1.5 w-1.5 rounded-full ${getConnectionClass(props.connected)}`}
            />
          </div>
        </div>

        <div
          className="relative flex h-12 items-end justify-center sm:h-20"
          style={{ minWidth: `${props.count * 1.4 + 0.8}rem` }}
        >
          {Array.from({ length: props.count }).map((_, index) => {
            const total = props.count;
            const spread = Math.min((total - 1) * 5, 30);
            const step = total > 1 ? spread / (total - 1) : 0;
            const rotation = -spread / 2 + index * step;
            const liftY = Math.abs(rotation) * 0.04;

            return (
              <div
                key={`hidden-${props.orientation}-${index}`}
                className="absolute h-12 w-8 rounded-[14px] border border-white/10 bg-gradient-to-br from-slate-800 via-slate-950 to-black shadow-xl sm:h-20 sm:w-14 sm:rounded-2xl"
                style={{
                  transform: `rotate(${rotation}deg) translateY(-${liftY}rem)`,
                  transformOrigin: 'bottom center',
                  left: `${index * 1.4}rem`,
                  zIndex: index,
                }}
              />
            );
          })}
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
      data-seat-orientation={props.orientation}
      className={`flex flex-col items-center gap-1.5 sm:gap-2 ${isBottom || isTop ? 'w-full' : ''}`}
    >
      <div
        className={`flex flex-col items-center gap-1 rounded-2xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] sm:px-3 sm:text-xs sm:tracking-[0.18em] ${badgeClass}`}
      >
        <span className="block max-w-[9rem] truncate sm:max-w-[10rem]">
          {props.nickname}
        </span>
        <div className="flex items-center gap-1.5">
          {roleLabel && (
            <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[8px] tracking-[0.2em] text-white/78 sm:text-[9px]">
              {roleLabel}
            </span>
          )}
          <span
            aria-label={props.connected ? 'online' : 'offline'}
            className={`h-1.5 w-1.5 rounded-full ${getConnectionClass(props.connected)}`}
          />
        </div>
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
