import { GamePhase, REACTION_PHRASES, ReactionPhrase } from '@truco/contracts';
import { MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ReactionPickerProps {
  onSend: (phraseId: number) => void;
  gamePhase: GamePhase;
  justWonTrick: boolean;
  justLostTrick: boolean;
  trucoPending: boolean;
}

const QUICK_REACTION_IDS = [0, 1, 2] as const;
const QUICK_REACTIONS = QUICK_REACTION_IDS.map((id) =>
  REACTION_PHRASES.find((phrase) => phrase.id === id),
).filter((phrase): phrase is ReactionPhrase => Boolean(phrase));

function getOrderedPhrases(
  phase: GamePhase,
  justWonTrick: boolean,
  justLostTrick: boolean,
  trucoPending: boolean,
): ReactionPhrase[] {
  const pinnedIds: number[] = [];

  if (justWonTrick || phase === 'TRICK_END') {
    pinnedIds.push(0, 1, 2);
  }

  if (justLostTrick) {
    pinnedIds.push(17, 18, 19);
  }

  if (trucoPending || phase === 'TRUCO_DECISION') {
    pinnedIds.push(4, 6, 9, 11);
  }

  const uniquePinnedIds = Array.from(new Set(pinnedIds));
  const pinned = uniquePinnedIds
    .map((id) => REACTION_PHRASES.find((phrase) => phrase.id === id) ?? null)
    .filter((phrase): phrase is ReactionPhrase => phrase !== null);
  const rest = REACTION_PHRASES.filter(
    (phrase) => !uniquePinnedIds.includes(phrase.id),
  );

  return [...pinned, ...rest];
}

export function ReactionPicker({
  onSend,
  gamePhase,
  justWonTrick,
  justLostTrick,
  trucoPending,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [showQuickRow, setShowQuickRow] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const quickRowTimerRef = useRef<number | null>(null);

  const orderedPhrases = useMemo(
    () =>
      getOrderedPhrases(gamePhase, justWonTrick, justLostTrick, trucoPending),
    [gamePhase, justLostTrick, justWonTrick, trucoPending],
  );
  const isCoolingDown = cooldownUntil > 0;

  useEffect(() => {
    if (!justWonTrick) {
      return;
    }

    setShowQuickRow(true);
    if (quickRowTimerRef.current !== null) {
      window.clearTimeout(quickRowTimerRef.current);
    }

    quickRowTimerRef.current = window.setTimeout(() => {
      setShowQuickRow(false);
      quickRowTimerRef.current = null;
    }, 3_500);
  }, [justWonTrick]);

  useEffect(
    () => () => {
      if (cooldownTimerRef.current !== null) {
        window.clearTimeout(cooldownTimerRef.current);
      }

      if (quickRowTimerRef.current !== null) {
        window.clearTimeout(quickRowTimerRef.current);
      }
    },
    [],
  );

  function handleSend(phraseId: number): void {
    if (cooldownUntil > Date.now()) {
      return;
    }

    onSend(phraseId);
    setCooldownUntil(Date.now() + 2_500);
    setIsOpen(false);
    setShowQuickRow(false);

    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
    }

    if (quickRowTimerRef.current !== null) {
      window.clearTimeout(quickRowTimerRef.current);
      quickRowTimerRef.current = null;
    }

    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownUntil(0);
      cooldownTimerRef.current = null;
    }, 2_500);
  }

  return (
    <>
      {showQuickRow && QUICK_REACTIONS.length > 0 && (
        <div className="pointer-events-none fixed bottom-[4.5rem] left-1/2 z-[44] -translate-x-1/2">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-slate-950/85 px-3 py-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
            {QUICK_REACTIONS.map((phrase) => (
              <button
                key={phrase.id}
                type="button"
                onClick={() => handleSend(phrase.id)}
                disabled={isCoolingDown}
                className="rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100 transition active:scale-95"
              >
                {phrase.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-[5.5rem] right-4 z-[44]">
        <div className="relative flex flex-col items-end gap-2">
          {isOpen && (
            <div className="absolute bottom-12 right-0 w-[min(18rem,90vw)] rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/30">
                Reações da mesa
              </p>
              <div className="flex flex-wrap gap-1.5">
                {orderedPhrases.map((phrase) => (
                  <button
                    key={phrase.id}
                    type="button"
                    onClick={() => handleSend(phrase.id)}
                    disabled={isCoolingDown}
                    className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-left text-xs font-semibold text-white/80 transition active:scale-95"
                  >
                    {phrase.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            disabled={isCoolingDown}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Fechar reações' : 'Abrir reações'}
            className="rounded-full border border-white/15 bg-white/8 p-2.5 text-lg text-white/90 shadow-lg backdrop-blur-sm transition hover:bg-white/12"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
