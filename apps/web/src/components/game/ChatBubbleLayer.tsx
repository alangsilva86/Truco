import { ChatBubble, REACTION_PHRASES, SeatId, TeamId } from '@truco/contracts';

interface ChatBubbleLayerProps {
  bubbles: ChatBubble[];
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId };
  viewerTeamId: TeamId;
}

const phraseById = new Map(
  REACTION_PHRASES.map((phrase) => [phrase.id, phrase]),
);

function getSeatAnchor(
  seatId: SeatId,
  seatLayout: { bottom: SeatId; top: SeatId; left: SeatId; right: SeatId },
): { className: string; transform: string } {
  if (seatId === seatLayout.bottom) {
    return {
      className: 'bottom-[8%] left-1/2',
      transform: '-translate-x-1/2',
    };
  }

  if (seatId === seatLayout.top) {
    return {
      className: 'top-[8%] left-1/2',
      transform: '-translate-x-1/2',
    };
  }

  if (seatId === seatLayout.left) {
    return {
      className: 'top-[42%] left-[6%]',
      transform: '',
    };
  }

  return {
    className: 'top-[42%] right-[6%]',
    transform: '',
  };
}

export function ChatBubbleLayer({
  bubbles,
  seatLayout,
  viewerTeamId,
}: ChatBubbleLayerProps) {
  const bubblesBySeat = new Map<SeatId, ChatBubble[]>();

  for (const bubble of bubbles) {
    const existing = bubblesBySeat.get(bubble.seatId) ?? [];
    bubblesBySeat.set(bubble.seatId, [...existing.slice(-2), bubble]);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-hidden">
      {Array.from(bubblesBySeat.entries()).map(([seatId, seatBubbles]) => {
        const anchor = getSeatAnchor(seatId, seatLayout);
        const isOurTeam = seatId % 2 === viewerTeamId;

        return (
          <div
            key={seatId}
            className={`absolute flex flex-col items-center gap-1.5 ${anchor.className} ${anchor.transform}`}
          >
            {seatBubbles.map((bubble) => {
              const phrase = phraseById.get(bubble.phraseId);
              if (!phrase) {
                return null;
              }

              return (
                <div
                  key={bubble.id}
                  className={`flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-sm font-semibold shadow-md backdrop-blur-sm ${
                    isOurTeam
                      ? 'border-emerald-400/40 bg-slate-900/85 text-emerald-100'
                      : 'border-rose-400/40 bg-slate-900/85 text-rose-100'
                  }`}
                  style={{
                    animation: 'chat-bubble-pop 3.5s ease-out forwards',
                  }}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isOurTeam ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  {phrase.text}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
