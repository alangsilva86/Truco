import {
  AvailableAction,
  Card,
  CardPlayMode,
  ClientGameView,
  ConnectionState,
  SeatId,
  TeamId,
} from '@truco/contracts';
import {
  AlertCircle,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { manilhaNickname } from '../Card.js';
import { usePhoneLayout } from '../../hooks/usePhoneLayout.js';
import { triggerHaptic } from '../../lib/haptics.js';
import { playTrucoSound } from '../../lib/sounds.js';
import { createTablePresentation } from '../../lib/tablePresentation.js';
import { ActionConfirmTray } from './ActionConfirmTray.js';
import { BottomActionBar } from './BottomActionBar.js';
import { CenterTable } from './CenterTable.js';
import { MatchLogDrawer } from './MatchLogDrawer.js';
import { RoundContextRail } from './RoundContextRail.js';
import { RoundStatusBar } from './RoundStatusBar.js';
import { SeatPanel } from './SeatPanel.js';
import { TableHeader } from './TableHeader.js';
import { TopSeatFocusOverlay } from './TopSeatFocusOverlay.js';
import { TrucoDecisionSheet } from './TrucoDecisionSheet.js';

type PlayAction = Extract<AvailableAction, { type: 'PLAY_CARD' }>;
type TrucoAction = Extract<AvailableAction, { type: 'REQUEST_TRUCO' }>;
type TrucoResponseAction = Extract<AvailableAction, { type: 'RESPOND_TRUCO' }>;

interface GameTableProps {
  view: ClientGameView;
  viewerTeamId: TeamId;
  connectionState: ConnectionState;
  logs: string[];
  error: string | null;
  coveredMode: boolean;
  commandPending: boolean;
  codeCopied: boolean;
  rematchRequested: boolean;
  playAction: PlayAction | null;
  requestTrucoAction: TrucoAction | null;
  respondTrucoAction: TrucoResponseAction | null;
  onDismissError: () => void;
  onCopyCode: (code: string) => void;
  onLeave: () => void;
  onToggleCovered: () => void;
  onPlayCard: (seatId: SeatId, card: Card, mode?: CardPlayMode) => void;
  onRequestTruco: () => void;
  onRequestRematch: () => void;
  onAcceptTruco: () => void;
  onRaiseTruco: () => void;
  onRunTruco: () => void;
}

interface SelectedPlayState {
  card: Card;
  seatId: SeatId;
}

function formatCompactSuit(suit: Card['suit']): string {
  if (suit === 'Espadas') {
    return 'Esp.';
  }

  if (suit === 'Ouros') {
    return 'Our.';
  }

  if (suit === 'Copas') {
    return 'Cop.';
  }

  return 'Paus';
}

function formatCompactTrickDots(
  trickDots: ReturnType<typeof createTablePresentation>['trickDots'],
): string {
  return trickDots
    .map((dot) =>
      dot === 'us' ? '●' : dot === 'them' ? '◐' : dot === 'tie' ? '◆' : '○',
    )
    .join(' ');
}

export function GameTable({
  view,
  viewerTeamId,
  connectionState,
  logs,
  error,
  coveredMode,
  commandPending,
  codeCopied,
  rematchRequested,
  playAction,
  requestTrucoAction,
  respondTrucoAction,
  onDismissError,
  onCopyCode,
  onLeave,
  onToggleCovered,
  onPlayCard,
  onRequestTruco,
  onRequestRematch,
  onAcceptTruco,
  onRaiseTruco,
  onRunTruco,
}: GameTableProps) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [pendingPlayCardId, setPendingPlayCardId] = useState<string | null>(
    null,
  );
  const [selectedPlay, setSelectedPlay] = useState<SelectedPlayState | null>(
    null,
  );
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [trucoShout, setTrucoShout] = useState<{ label: string; id: number } | null>(null);
  const { isCompactContext, isPhoneLayout } = usePhoneLayout();
  const lastPhaseRef = useRef(view.gamePhase);
  const prevRoundCardsLenRef = useRef(view.roundCards.length);
  const prevTrickHistoryLenRef = useRef(view.trickHistory.length);
  const maoDeOnzeShownForRef = useRef<number | null>(null);
  const prevTrucoSheetOpenRef = useRef(false);

  const showToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const showTrucoShout = useCallback((label: string) => {
    const id = Date.now();
    setTrucoShout({ label, id });
    playTrucoSound();
    triggerHaptic([60, 30, 60, 30, 120]);
    setTimeout(() => {
      setTrucoShout((curr) => (curr?.id === id ? null : curr));
    }, 1500);
  }, []);

  const presentation = useMemo(
    () =>
      createTablePresentation({
        view,
        viewerTeamId,
        playAction,
        requestTrucoAction,
      }),
    [playAction, requestTrucoAction, view, viewerTeamId],
  );

  useEffect(() => {
    if (logs.length === 0 || presentation.isWaiting) {
      setLogsOpen(false);
    }
  }, [logs.length, presentation.isWaiting]);

  useEffect(() => {
    if (!isPhoneLayout) {
      setSelectedPlay(null);
      setPendingPlayCardId(null);
    }
  }, [isPhoneLayout]);

  useEffect(() => {
    const previousPhase = lastPhaseRef.current;

    if (
      previousPhase !== view.gamePhase &&
      (view.gamePhase === 'TRICK_END' || view.gamePhase === 'ROUND_END')
    ) {
      triggerHaptic([18, 48, 18]);
    }

    lastPhaseRef.current = view.gamePhase;
  }, [view.gamePhase]);

  // Toast: ZAP! / COPAS! / ESPADA! / MOLE! when a manilha lands on the table
  useEffect(() => {
    const prev = prevRoundCardsLenRef.current;
    const curr = view.roundCards.length;
    if (curr > prev && view.manilhaRank) {
      const newest = view.roundCards[curr - 1];
      if (newest?.card && newest.card.rank === view.manilhaRank) {
        showToast(manilhaNickname(newest.card.suit) + '!');
      }
    }
    prevRoundCardsLenRef.current = curr;
  }, [showToast, view.manilhaRank, view.roundCards]);

  // Toast: FERRO! when our team wins a trick
  useEffect(() => {
    const prev = prevTrickHistoryLenRef.current;
    const curr = view.trickHistory.length;
    if (curr > prev) {
      const latestTrick = view.trickHistory[curr - 1];
      if (
        latestTrick &&
        latestTrick.winnerSeatId !== 'tie' &&
        (latestTrick.winnerSeatId as number) % 2 === viewerTeamId
      ) {
        showToast('FERRO!');
      }
    }
    prevTrickHistoryLenRef.current = curr;
  }, [showToast, view.trickHistory, viewerTeamId]);

  // Toast: MÃO DE ONZE when either team reaches 11 (once per score)
  useEffect(() => {
    const scoreKey = presentation.scoreUs * 100 + presentation.scoreThem;
    if (
      maoDeOnzeShownForRef.current !== scoreKey &&
      (presentation.scoreUs === 11 || presentation.scoreThem === 11)
    ) {
      maoDeOnzeShownForRef.current = scoreKey;
      if (presentation.scoreUs === 11 && presentation.scoreThem === 11) {
        showToast('MÃO DE FERRO!');
      } else {
        showToast('MÃO DE ONZE!');
      }
    }
  }, [showToast, presentation.scoreUs, presentation.scoreThem]);

  // Truco shout: when opponent calls truco (sheet opens from their side)
  useEffect(() => {
    const wasOpen = prevTrucoSheetOpenRef.current;
    const isOpen = Boolean(
      respondTrucoAction && view.trucoPending && !presentation.isPausedReconnect,
    );
    if (!wasOpen && isOpen && view.trucoPending) {
      const v = view.trucoPending.requestedValue;
      const label = v === 3 ? 'TRUCO!' : v === 6 ? 'SEIS!' : v === 9 ? 'NOVE!' : 'DOZE!';
      showTrucoShout(label);
    }
    prevTrucoSheetOpenRef.current = isOpen;
  }, [respondTrucoAction, view.trucoPending, presentation.isPausedReconnect, showTrucoShout]);

  const statusTone = presentation.isPausedReconnect
    ? 'warning'
    : presentation.isGameEnd
      ? 'success'
      : 'neutral';

  const showBottomActions = !presentation.isWaiting && !presentation.isGameEnd;
  const trucoSheetOpen = Boolean(
    respondTrucoAction && view.trucoPending && !presentation.isPausedReconnect,
  );
  const selectedCard = selectedPlay?.card ?? null;
  const activeSeatName =
    presentation.activeOwnedSeatId !== null
      ? (view.players[presentation.activeOwnedSeatId]?.nickname ?? null)
      : null;

  useEffect(() => {
    if (trucoSheetOpen) {
      setSelectedPlay(null);
      setPendingPlayCardId(null);
    }
  }, [trucoSheetOpen]);

  useEffect(() => {
    if (!selectedPlay) {
      return;
    }

    const visibleCards = view.visibleHands[selectedPlay.seatId] ?? [];
    const cardStillVisible = visibleCards.some(
      (card) => card.id === selectedPlay.card.id,
    );

    if (pendingPlayCardId) {
      if (!cardStillVisible) {
        setPendingPlayCardId(null);
        setSelectedPlay(null);
        return;
      }

      if (!commandPending) {
        setPendingPlayCardId(null);
      }

      return;
    }

    const playStillAvailable =
      playAction?.seatId === selectedPlay.seatId &&
      playAction.cardIds.includes(selectedPlay.card.id);

    if (!cardStillVisible || !playStillAvailable) {
      setSelectedPlay(null);
    }
  }, [
    commandPending,
    pendingPlayCardId,
    playAction,
    selectedPlay,
    view.stateVersion,
    view.visibleHands,
  ]);

  function handleSelectCard(seatId: SeatId, card: Card): void {
    if (
      !isPhoneLayout ||
      commandPending ||
      trucoSheetOpen ||
      playAction?.seatId !== seatId ||
      !playAction.cardIds.includes(card.id)
    ) {
      return;
    }

    triggerHaptic(12);
    setPendingPlayCardId(null);
    setSelectedPlay((current) =>
      current?.seatId === seatId && current.card.id === card.id
        ? null
        : { seatId, card },
    );
  }

  function handleConfirmPlay(mode: CardPlayMode): void {
    if (!selectedPlay || commandPending) {
      return;
    }

    setPendingPlayCardId(selectedPlay.card.id);
    triggerHaptic([24]);
    onPlayCard(selectedPlay.seatId, selectedPlay.card, mode);
  }

  function handleRequestTrucoPress(): void {
    setSelectedPlay(null);
    setPendingPlayCardId(null);
    showTrucoShout(presentation.trucoLabel.toUpperCase());
    onRequestTruco();
  }

  function handleAcceptTrucoPress(): void {
    triggerHaptic([28]);
    onAcceptTruco();
  }

  function handleRaiseTrucoPress(): void {
    triggerHaptic([28]);
    onRaiseTruco();
  }

  function handleRunTrucoPress(): void {
    triggerHaptic([12, 40, 12]);
    onRunTruco();
  }

  const phoneTrayHand =
    !presentation.isWaiting && !presentation.isGameEnd ? (
      presentation.topSeatFocus ? (
        // Partner's turn: bring PARTNER cards to the bottom tray so the
        // felt (played cards) stays fully visible for decision-making.
        <SeatPanel
          mode="visible"
          orientation="bottom"
          tone="partner"
          nickname={presentation.topSeat.nickname}
          dealer={presentation.topSeat.dealer}
          active={presentation.topSeat.active}
          cards={presentation.topCards}
          manilhaRank={view.manilhaRank}
          onPlayCard={(card) =>
            handleSelectCard(presentation.topSeat.seatId, card)
          }
          disabled={
            !presentation.topSeat.active || commandPending || trucoSheetOpen
          }
          highlightCards={false}
          pendingCardId={pendingPlayCardId}
          selectedCardId={selectedCard?.id ?? null}
        />
      ) : (
        <SeatPanel
          mode="visible"
          orientation="bottom"
          tone="player"
          nickname={presentation.bottomSeat.nickname}
          dealer={presentation.bottomSeat.dealer}
          active={presentation.bottomSeat.active}
          cards={presentation.bottomCards}
          manilhaRank={view.manilhaRank}
          onPlayCard={(card) =>
            isPhoneLayout
              ? handleSelectCard(presentation.bottomSeat.seatId, card)
              : onPlayCard(presentation.bottomSeat.seatId, card)
          }
          disabled={
            !presentation.bottomSeat.active || commandPending || trucoSheetOpen
          }
          highlightCards={false}
          pendingCardId={pendingPlayCardId}
          selectedCardId={selectedCard?.id ?? null}
        />
      )
    ) : null;

  return (
    <div className="min-h-[100dvh] overflow-x-hidden px-2 py-2 sm:h-[100dvh] sm:max-h-[100dvh] sm:overflow-hidden sm:px-4 sm:py-4">
      <div className="table-shell mx-auto flex min-h-[calc(100dvh-1rem)] max-w-7xl flex-col overflow-hidden rounded-[28px] border p-2 sm:h-full sm:min-h-0 sm:rounded-[32px] sm:p-3">
        <TableHeader
          roomCode={view.roomCode}
          codeCopied={codeCopied}
          scoreUs={presentation.scoreUs}
          scoreThem={presentation.scoreThem}
          roomLifecycle={view.roomLifecycle}
          statusTone={statusTone}
          onCopyCode={() => onCopyCode(view.roomCode)}
          onLeave={onLeave}
          connectionState={connectionState}
          logCount={logs.length}
          logsOpen={logsOpen}
          onToggleLogs={() => setLogsOpen((current) => !current)}
          phoneMode={isPhoneLayout}
        />

        <main className="felt-noise relative mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[26px] border border-white/8 sm:rounded-[30px]">
          {isPhoneLayout ? (
            <>
              <RoundContextRail
                activeSeatLabel={presentation.activeOwnedSeatLabel}
                activeSeatName={activeSeatName}
                banner={presentation.banner}
                currentRoundPoints={view.currentRoundPoints}
                dimmed={trucoSheetOpen}
                manilhaRank={view.manilhaRank}
                trickDots={presentation.trickDots}
                vira={view.vira}
              />

              {presentation.isWaiting && error && (
                <div className="mx-2 mt-2 flex items-center justify-between gap-2 rounded-[22px] border border-rose-400/20 bg-rose-500/10 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-rose-100">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-100/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-1.5">
                {!presentation.isWaiting && !presentation.isGameEnd && (
                  <div className="relative z-10 flex justify-center pt-1">
                    {presentation.topSeatFocus ? (
                      // When partner plays: show PLAYER's own cards at the top as reference.
                      // Partner's interactive cards move to the bottom tray.
                      <SeatPanel
                        mode="visible"
                        orientation="top"
                        tone="player"
                        nickname={presentation.bottomSeat.nickname}
                        dealer={presentation.bottomSeat.dealer}
                        active={false}
                        cards={presentation.bottomCards}
                        manilhaRank={view.manilhaRank}
                        disabled
                        highlightCards={false}
                      />
                    ) : (
                      // Normal: show partner's cards at the top as reference.
                      <SeatPanel
                        mode="visible"
                        orientation="top"
                        tone="partner"
                        nickname={presentation.topSeat.nickname}
                        dealer={presentation.topSeat.dealer}
                        active={presentation.topSeat.active}
                        cards={presentation.topCards}
                        manilhaRank={view.manilhaRank}
                        disabled
                        highlightCards={false}
                        pendingCardId={pendingPlayCardId}
                      />
                    )}
                  </div>
                )}

                <div className="relative mt-1 flex min-h-0 flex-1 items-center justify-center">
                  {!presentation.isWaiting && !presentation.isGameEnd && (
                    <>
                      <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2">
                        <SeatPanel
                          mode="hidden"
                          orientation="left"
                          tone="opponent"
                          nickname={presentation.leftSeat.nickname}
                          dealer={presentation.leftSeat.dealer}
                          active={presentation.leftSeat.active}
                          count={presentation.leftSeat.hiddenCount}
                        />
                      </div>

                      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2">
                        <SeatPanel
                          mode="hidden"
                          orientation="right"
                          tone="opponent"
                          nickname={presentation.rightSeat.nickname}
                          dealer={presentation.rightSeat.dealer}
                          active={presentation.rightSeat.active}
                          count={presentation.rightSeat.hiddenCount}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex h-full w-full items-center justify-center px-[4.25rem]">
                    <CenterTable
                      mode={presentation.isWaiting ? 'waiting' : 'table'}
                      roomCode={view.roomCode}
                      codeCopied={codeCopied}
                      onCopyCode={() => onCopyCode(view.roomCode)}
                      roundCards={view.roundCards}
                      manilhaRank={view.manilhaRank}
                    />
                  </div>

                  {presentation.topSeatFocus && !trucoSheetOpen && (
                    <TopSeatFocusOverlay
                      nickname={presentation.topSeat.nickname}
                    />
                  )}
                </div>

                {!presentation.isWaiting && !presentation.isGameEnd && (
                  <ActionConfirmTray
                    activeSeatLabel={presentation.activeOwnedSeatLabel}
                    activeSeatName={activeSeatName}
                    bannerDetail={presentation.banner?.detail ?? view.message}
                    bannerTitle={presentation.banner?.title ?? 'Mesa'}
                    canPlayCovered={Boolean(
                      selectedPlay &&
                      playAction?.seatId === selectedPlay.seatId &&
                      playAction.canPlayCovered,
                    )}
                    canRequestTruco={presentation.canRequestTruco}
                    commandPending={commandPending}
                    dimmed={trucoSheetOpen}
                    manilhaRank={view.manilhaRank}
                    error={error}
                    pendingPlay={Boolean(
                      pendingPlayCardId &&
                      selectedCard?.id === pendingPlayCardId,
                    )}
                    selectedCard={selectedCard}
                    trucoHint={presentation.trucoHint}
                    trucoLabel={presentation.trucoLabel}
                    onCancelSelection={() =>
                      !commandPending ? setSelectedPlay(null) : undefined
                    }
                    onConfirmCovered={() => handleConfirmPlay('covered')}
                    onConfirmOpen={() => handleConfirmPlay('open')}
                    onRequestTruco={handleRequestTrucoPress}
                  >
                    {phoneTrayHand}
                  </ActionConfirmTray>
                )}
              </div>
            </>
          ) : (
            <>
              <RoundStatusBar
                banner={presentation.banner}
                commandPending={commandPending}
                connectionState={connectionState}
                currentRoundPoints={view.currentRoundPoints}
                isWaiting={presentation.isWaiting}
                logCount={logs.length}
                logsOpen={logsOpen}
                manilhaRank={view.manilhaRank}
                trickDots={presentation.trickDots}
                vira={view.vira}
                onToggleLogs={() => setLogsOpen((current) => !current)}
              />

              {error && (
                <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-rose-100">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-100/60 transition hover:text-rose-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-y-2 px-3 pb-2 pt-2 sm:gap-y-3 sm:px-4 sm:pt-3">
                {!presentation.isWaiting && !presentation.isGameEnd ? (
                  <div className="relative z-10 flex justify-center pb-1 sm:pb-2">
                    <SeatPanel
                      mode="visible"
                      orientation="top"
                      tone="partner"
                      nickname={presentation.topSeat.nickname}
                      dealer={presentation.topSeat.dealer}
                      active={presentation.topSeat.active}
                      cards={presentation.topCards}
                      manilhaRank={view.manilhaRank}
                      onPlayCard={(card) =>
                        onPlayCard(presentation.topSeat.seatId, card)
                      }
                      disabled={!presentation.topSeat.active || commandPending}
                    />
                  </div>
                ) : (
                  <div />
                )}

                <div className="relative min-h-0">
                  {!presentation.isWaiting && !presentation.isGameEnd && (
                    <>
                      <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2">
                        <SeatPanel
                          mode="hidden"
                          orientation="left"
                          tone="opponent"
                          nickname={presentation.leftSeat.nickname}
                          dealer={presentation.leftSeat.dealer}
                          active={presentation.leftSeat.active}
                          count={presentation.leftSeat.hiddenCount}
                        />
                      </div>

                      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2">
                        <SeatPanel
                          mode="hidden"
                          orientation="right"
                          tone="opponent"
                          nickname={presentation.rightSeat.nickname}
                          dealer={presentation.rightSeat.dealer}
                          active={presentation.rightSeat.active}
                          count={presentation.rightSeat.hiddenCount}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex h-full items-center justify-center px-[5.5rem] sm:px-36">
                    <CenterTable
                      mode={presentation.isWaiting ? 'waiting' : 'table'}
                      roomCode={view.roomCode}
                      codeCopied={codeCopied}
                      onCopyCode={() => onCopyCode(view.roomCode)}
                      roundCards={view.roundCards}
                      manilhaRank={view.manilhaRank}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                  {!presentation.isWaiting && !presentation.isGameEnd && (
                    <SeatPanel
                      mode="visible"
                      orientation="bottom"
                      tone="player"
                      nickname={presentation.bottomSeat.nickname}
                      dealer={presentation.bottomSeat.dealer}
                      active={presentation.bottomSeat.active}
                      cards={presentation.bottomCards}
                      manilhaRank={view.manilhaRank}
                      onPlayCard={(card) =>
                        onPlayCard(presentation.bottomSeat.seatId, card)
                      }
                      disabled={
                        !presentation.bottomSeat.active || commandPending
                      }
                    />
                  )}

                  <BottomActionBar
                    show={showBottomActions}
                    coveredActive={coveredMode}
                    coveredEnabled={presentation.canToggleCovered}
                    coveredHint={presentation.coveredHint}
                    trucoEnabled={presentation.canRequestTruco}
                    trucoHint={presentation.trucoHint}
                    trucoLabel={presentation.trucoLabel}
                    commandPending={commandPending}
                    onToggleCovered={onToggleCovered}
                    onRequestTruco={handleRequestTrucoPress}
                  />
                </div>
              </div>

            </>
          )}
        </main>

        <MatchLogDrawer
          logs={logs}
          open={logsOpen}
          onClose={() => setLogsOpen(false)}
        />
      </div>

      {presentation.isGameEnd && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="table-surface safe-bottom flex w-full max-w-sm flex-col items-center gap-5 rounded-[30px] px-6 py-7 text-center shadow-2xl shadow-black/60">
            <div
              className={`rounded-full border p-4 ${presentation.gameWon ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-200' : 'border-rose-300/20 bg-rose-500/10 text-rose-200'}`}
            >
              {presentation.gameWon ? (
                <Trophy className="h-8 w-8" />
              ) : (
                <Swords className="h-8 w-8" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
                {presentation.gameWon ? 'Vitoria' : 'Fim de jogo'}
              </p>
              <h3 className="mt-2 text-3xl font-black text-white">
                {presentation.scoreUs} × {presentation.scoreThem}
              </h3>
              <p className="mt-2 text-sm text-white/55">
                {presentation.gameWon
                  ? 'Sua dupla venceu a partida.'
                  : 'A partida terminou. Peça revanche ou saia da sala.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onRequestRematch}
              disabled={commandPending || rematchRequested}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                rematchRequested
                  ? 'border border-white/15 bg-white/5 text-white/50'
                  : 'bg-emerald-400 text-black hover:brightness-105'
              }`}
            >
              {rematchRequested ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {rematchRequested ? 'Aguardando adversario...' : 'Pedir revanche'}
            </button>

            <button
              type="button"
              onClick={onLeave}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/70 transition hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair da sala
            </button>
          </div>
        </div>
      )}

      {presentation.isPausedReconnect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="table-surface safe-bottom flex w-full max-w-sm flex-col items-center gap-5 rounded-[30px] px-6 py-7 text-center shadow-2xl shadow-black/60">
            <div className="rounded-full border border-amber-300/20 bg-amber-500/10 p-4 text-amber-200">
              <LoaderCircle className="h-8 w-8 animate-spin" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
                Conexao interrompida
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Adversario desconectou
              </h3>
              <p className="mt-2 text-sm text-white/55">
                O jogo continua automaticamente assim que ele reconectar.
              </p>
            </div>
            <button
              type="button"
              onClick={onLeave}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/70 transition hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair da sala
            </button>
          </div>
        </div>
      )}

      <TrucoDecisionSheet
        open={trucoSheetOpen}
        requesterName={
          view.trucoPending
            ? (view.players[view.trucoPending.requestedBySeatId]?.nickname ??
              'Adversario')
            : 'Adversario'
        }
        requestedValue={view.trucoPending?.requestedValue ?? 0}
        acceptedValue={view.trucoPending?.acceptedValue ?? 0}
        raiseTarget={
          view.trucoPending ? view.trucoPending.requestedValue + 3 : null
        }
        canRaise={Boolean(respondTrucoAction?.actions.includes('raise'))}
        commandPending={commandPending}
        onAccept={handleAcceptTrucoPress}
        onRaise={handleRaiseTrucoPress}
        onRun={handleRunTrucoPress}
      />

      {/* Truco shout overlay */}
      {trucoShout && (
        <div
          key={trucoShout.id}
          className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center"
          style={{ animation: 'truco-screen-shake 0.45s ease-out' }}
        >
          {/* Radial glow burst */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.18) 0%, transparent 65%)',
              animation: 'truco-fade-out 1.5s ease-out forwards',
            }}
          />
          {/* The shout text */}
          <span
            className="relative font-mono font-black uppercase text-amber-300"
            style={{
              fontSize: 'clamp(3.5rem, 16vw, 8rem)',
              letterSpacing: '0.08em',
              textShadow: '0 0 60px rgba(251,191,36,0.9), 0 0 120px rgba(251,191,36,0.5), 0 4px 20px rgba(0,0,0,0.8)',
              animation: 'truco-slam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both, truco-fade-out 1.5s ease-out forwards',
            }}
          >
            {trucoShout.label}
          </span>
        </div>
      )}

      {/* Toast overlay */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-in fade-in slide-in-from-top-2 rounded-full border border-amber-300/40 bg-amber-400/15 px-5 py-2 font-mono text-sm font-black uppercase tracking-[0.22em] text-amber-200 shadow-lg backdrop-blur-sm duration-300"
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
