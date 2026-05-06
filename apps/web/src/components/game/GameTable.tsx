import {
  AvailableAction,
  Card,
  CardPlayMode,
  ChatBubble,
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
import { playPatoSound, playTrucoSound } from '../../lib/sounds.js';
import { createTablePresentation } from '../../lib/tablePresentation.js';
import type { ReconnectStatus } from '../../lib/reconnect.js';
import { ActionConfirmTray } from './ActionConfirmTray.js';
import { BottomActionBar } from './BottomActionBar.js';
import { CenterTable } from './CenterTable.js';
import { ChatBubbleLayer } from './ChatBubbleLayer.js';
import { DealingAnimationLayer } from './DealingAnimationLayer.js';
import { HandOfElevenDecisionSheet } from './HandOfElevenDecisionSheet.js';
import { MatchLogDrawer } from './MatchLogDrawer.js';
import { ReactionPicker } from './ReactionPicker.js';
import { ReconnectRecoveryOverlay } from './ReconnectRecoveryOverlay.js';
import { RoundContextRail } from './RoundContextRail.js';
import { RoundStatusBar } from './RoundStatusBar.js';
import { SeatPanel } from './SeatPanel.js';
import { TableHeader } from './TableHeader.js';
import { TopSeatFocusOverlay } from './TopSeatFocusOverlay.js';
import { TrucoDecisionSheet } from './TrucoDecisionSheet.js';

type PlayAction = Extract<AvailableAction, { type: 'PLAY_CARD' }>;
type TrucoAction = Extract<AvailableAction, { type: 'REQUEST_TRUCO' }>;
type RunRoundAction = Extract<AvailableAction, { type: 'RUN_ROUND' }>;
type TrucoResponseAction = Extract<AvailableAction, { type: 'RESPOND_TRUCO' }>;
type HandOfElevenResponseAction = Extract<
  AvailableAction,
  { type: 'RESPOND_HAND_OF_ELEVEN' }
>;

interface GameTableProps {
  view: ClientGameView;
  viewerTeamId: TeamId;
  connectionState: ConnectionState;
  logs: string[];
  error: string | null;
  chatBubbles: ChatBubble[];
  reconnectStatus: ReconnectStatus;
  coveredMode: boolean;
  commandPending: boolean;
  codeCopied: boolean;
  rematchRequested: boolean;
  playAction: PlayAction | null;
  respondHandOfElevenAction: HandOfElevenResponseAction | null;
  requestTrucoAction: TrucoAction | null;
  runRoundAction: RunRoundAction | null;
  respondTrucoAction: TrucoResponseAction | null;
  onDismissError: () => void;
  onCopyCode: (code: string) => void;
  onLeave: () => void;
  onReturnToLobby: () => void;
  onRetryReconnect: () => void;
  onToggleCovered: () => void;
  onPlayHandOfEleven: () => void;
  onPlayCard: (seatId: SeatId, card: Card, mode?: CardPlayMode) => void;
  onRequestTruco: () => void;
  onRequestRematch: () => void;
  onRunRound: () => void;
  onAcceptTruco: () => void;
  onRunHandOfEleven: () => void;
  onRaiseTruco: () => void;
  onRunTruco: () => void;
  patoTauntCount: number;
  onSendReaction: (phraseId: number) => void;
  onSendPatoTaunt: () => void;
}

interface SelectedPlayState {
  card: Card;
  seatId: SeatId;
}

function getTrucoAcceptedLabel(value: number): string {
  switch (value) {
    case 3:
      return 'TRUCO';
    case 6:
      return 'SEIS';
    case 9:
      return 'NOVE';
    case 12:
      return 'DOZE';
    default:
      return `${value}`;
  }
}

function getNextRaiseTarget(requestedValue: number): number | null {
  switch (requestedValue) {
    case 3:
      return 6;
    case 6:
      return 9;
    case 9:
      return 12;
    default:
      return null;
  }
}

export function GameTable({
  view,
  viewerTeamId,
  connectionState,
  logs,
  error,
  chatBubbles,
  reconnectStatus,
  coveredMode,
  commandPending,
  codeCopied,
  rematchRequested,
  playAction,
  respondHandOfElevenAction,
  requestTrucoAction,
  runRoundAction,
  respondTrucoAction,
  onDismissError,
  onCopyCode,
  onLeave,
  onReturnToLobby,
  onRetryReconnect,
  onToggleCovered,
  onPlayHandOfEleven,
  onPlayCard,
  onRequestTruco,
  onRequestRematch,
  onRunRound,
  onAcceptTruco,
  onRunHandOfEleven,
  onRaiseTruco,
  onRunTruco,
  patoTauntCount,
  onSendReaction,
  onSendPatoTaunt,
}: GameTableProps) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [pendingPlayCardId, setPendingPlayCardId] = useState<string | null>(
    null,
  );
  const [selectedPlay, setSelectedPlay] = useState<SelectedPlayState | null>(
    null,
  );
  const [toasts, setToasts] = useState<
    { id: number; text: string; tone: 'amber' | 'emerald' | 'rose' }[]
  >([]);
  const [trucoShout, setTrucoShout] = useState<{
    label: string;
    id: number;
  } | null>(null);
  const [justWonTrick, setJustWonTrick] = useState(false);
  const [incomingPatoKey, setIncomingPatoKey] = useState(0);
  const prevPatoTauntCountRef = useRef(patoTauntCount);
  const prevTrickWinnerRef = useRef(view.trickHistory.length);
  const justWonTrickTimeoutRef = useRef<number | null>(null);
  const { isPhoneLayout } = usePhoneLayout();
  const lastPhaseRef = useRef(view.gamePhase);
  const prevRoundCardsLenRef = useRef(view.roundCards.length);
  const prevTrickHistoryLenRef = useRef(view.trickHistory.length);
  const maoDeOnzeShownForRef = useRef<number | null>(null);
  const prevTrucoSheetOpenRef = useRef(false);
  const prevTrucoPendingRef = useRef(view.trucoPending);

  const showToast = useCallback(
    (text: string, tone: 'amber' | 'emerald' | 'rose' = 'amber') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2800);
    },
    [],
  );

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
  const matchFormat = view.matchFormat ?? 'single';
  const seriesScore = view.seriesScore ?? { 0: 0, 1: 0 };
  const seriesWinnerTeam = view.seriesWinnerTeam ?? null;
  const seriesTargetWins = view.seriesTargetWins ?? 1;

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

  useEffect(
    () => () => {
      if (justWonTrickTimeoutRef.current !== null) {
        window.clearTimeout(justWonTrickTimeoutRef.current);
      }
    },
    [],
  );

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

  useEffect(() => {
    const curr = view.trickHistory.length;

    if (curr > prevTrickWinnerRef.current) {
      prevTrickWinnerRef.current = curr;
      const latestTrick = view.trickHistory[curr - 1];
      if (
        latestTrick &&
        latestTrick.winnerSeatId !== 'tie' &&
        latestTrick.winnerSeatId % 2 === viewerTeamId
      ) {
        setJustWonTrick(true);
        if (justWonTrickTimeoutRef.current !== null) {
          window.clearTimeout(justWonTrickTimeoutRef.current);
        }

        justWonTrickTimeoutRef.current = window.setTimeout(() => {
          setJustWonTrick(false);
          justWonTrickTimeoutRef.current = null;
        }, 3_600);
      } else {
        setJustWonTrick(false);
        if (justWonTrickTimeoutRef.current !== null) {
          window.clearTimeout(justWonTrickTimeoutRef.current);
          justWonTrickTimeoutRef.current = null;
        }
      }
    } else if (curr < prevTrickWinnerRef.current) {
      prevTrickWinnerRef.current = curr;
      setJustWonTrick(false);
      if (justWonTrickTimeoutRef.current !== null) {
        window.clearTimeout(justWonTrickTimeoutRef.current);
        justWonTrickTimeoutRef.current = null;
      }
    }
  }, [view.trickHistory, viewerTeamId]);

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
      respondTrucoAction &&
      view.trucoPending &&
      !presentation.isPausedReconnect,
    );
    if (!wasOpen && isOpen && view.trucoPending) {
      const v = view.trucoPending.requestedValue;
      const label =
        v === 3 ? 'TRUCO!' : v === 6 ? 'SEIS!' : v === 9 ? 'NOVE!' : 'DOZE!';
      showTrucoShout(label);
    }
    prevTrucoSheetOpenRef.current = isOpen;
  }, [
    respondTrucoAction,
    view.trucoPending,
    presentation.isPausedReconnect,
    showTrucoShout,
  ]);

  // Incoming PATO taunt from opponent
  useEffect(() => {
    if (patoTauntCount > prevPatoTauntCountRef.current) {
      prevPatoTauntCountRef.current = patoTauntCount;
      playPatoSound();
      triggerHaptic([40, 60, 40]);
      setIncomingPatoKey((k) => k + 1);
    }
  }, [patoTauntCount]);

  // Toast: accepted truco escalation when play resumes
  useEffect(() => {
    const prevPending = prevTrucoPendingRef.current;
    const currPending = view.trucoPending;

    if (prevPending && !currPending && view.gamePhase === 'PLAYING') {
      const requestedByUs = view.ownedSeatIds.includes(
        prevPending.requestedBySeatId,
      );
      const trucoLabel = getTrucoAcceptedLabel(prevPending.requestedValue);
      showToast(
        `${trucoLabel} ACEITO! Vale ${prevPending.requestedValue}pts`,
        requestedByUs ? 'emerald' : 'rose',
      );
    }

    prevTrucoPendingRef.current = currPending;
  }, [showToast, view.gamePhase, view.ownedSeatIds, view.trucoPending]);

  const statusTone = presentation.isPausedReconnect
    ? 'warning'
    : presentation.isGameEnd
      ? 'success'
      : 'neutral';

  const showBottomActions = !presentation.isWaiting && !presentation.isGameEnd;
  const handOfElevenSheetOpen = Boolean(
    respondHandOfElevenAction &&
    view.gamePhase === 'HAND_OF_ELEVEN_DECISION' &&
    !presentation.isPausedReconnect,
  );
  const trucoSheetOpen = Boolean(
    respondTrucoAction && view.trucoPending && !presentation.isPausedReconnect,
  );
  const decisionSheetOpen = handOfElevenSheetOpen || trucoSheetOpen;
  // We called truco and the opponent is deciding → show PATO taunt button
  const canSendPatoTaunt = Boolean(
    view.trucoPending &&
    !trucoSheetOpen &&
    view.ownedSeatIds.includes(view.trucoPending.requestedBySeatId),
  );
  const selectedCard = selectedPlay?.card ?? null;
  const activeSeatName =
    presentation.activeOwnedSeatId !== null
      ? (view.players[presentation.activeOwnedSeatId]?.nickname ?? null)
      : null;
  const disconnectedOpponentNames = [
    presentation.leftSeat,
    presentation.rightSeat,
  ]
    .filter((seat) => !seat.connected)
    .map((seat) => seat.nickname);
  const pausedReconnectTitle =
    disconnectedOpponentNames.length === 1
      ? `${disconnectedOpponentNames[0]} desconectou`
      : disconnectedOpponentNames.length > 1
        ? 'Adversarios desconectados'
        : 'Adversario desconectou';
  const seriesScoreUs = viewerTeamId === 0 ? seriesScore[0] : seriesScore[1];
  const seriesScoreThem =
    viewerTeamId === 0 ? seriesScore[1] : seriesScore[0];
  const roomClosed = view.roomLifecycle === 'CLOSED';
  const runRoundAwardedPoints = runRoundAction?.awardedPoints ?? 1;
  const runRoundHint = `Desiste da rodada atual e concede ${runRoundAwardedPoints} ponto${runRoundAwardedPoints !== 1 ? 's' : ''} ao adversario.`;
  const autoSeriesContinuationPending =
    presentation.isGameEnd &&
    matchFormat === 'best_of_3' &&
    seriesWinnerTeam === null;
  const rematchDisabled =
    commandPending ||
    rematchRequested ||
    roomClosed ||
    autoSeriesContinuationPending;
  const canRunRound = Boolean(runRoundAction) && !presentation.isPausedReconnect;

  useEffect(() => {
    if (decisionSheetOpen) {
      setSelectedPlay(null);
      setPendingPlayCardId(null);
    }
  }, [decisionSheetOpen]);

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
      decisionSheetOpen ||
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

  function handleRunRoundPress(): void {
    triggerHaptic([18, 35, 18]);
    onRunRound();
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

  function handlePlayHandOfElevenPress(): void {
    triggerHaptic([28]);
    onPlayHandOfEleven();
  }

  function handleRunHandOfElevenPress(): void {
    triggerHaptic([12, 40, 12]);
    onRunHandOfEleven();
  }

  const phoneTrayHand =
    !presentation.isWaiting && !presentation.isGameEnd ? (
      <SeatPanel
        mode="visible"
        orientation="bottom"
        tone="player"
        nickname={presentation.bottomSeat.nickname}
        connected={presentation.bottomSeat.connected}
        dealer={presentation.bottomSeat.dealer}
        active={presentation.bottomSeat.active}
        roundRole={presentation.bottomSeat.roundRole}
        cards={presentation.bottomCards}
        manilhaRank={view.manilhaRank}
        onPlayCard={(card) =>
          isPhoneLayout
            ? handleSelectCard(presentation.bottomSeat.seatId, card)
            : onPlayCard(presentation.bottomSeat.seatId, card)
        }
        disabled={
          !presentation.bottomSeat.active || commandPending || decisionSheetOpen
        }
        highlightCards={false}
        pendingCardId={pendingPlayCardId}
        selectedCardId={selectedCard?.id ?? null}
      />
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
                dimmed={decisionSheetOpen}
                manilhaRank={view.manilhaRank}
                trickDots={presentation.trickDots}
                vira={view.vira}
              />

              {presentation.isWaiting && error && (
                <div className="mx-2 mt-2 flex items-center justify-between gap-2 rounded-[22px] border border-rose-100/70 bg-rose-500/20 px-3 py-2.5 shadow-[0_0_18px_rgba(244,63,94,0.12)]">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose-50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-50/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-1.5">
                {!presentation.isWaiting && !presentation.isGameEnd && (
                  <div className="relative z-10 flex justify-center pt-1">
                    <SeatPanel
                      mode="visible"
                      orientation="top"
                      tone="partner"
                      nickname={presentation.topSeat.nickname}
                      connected={presentation.topSeat.connected}
                      dealer={presentation.topSeat.dealer}
                      active={presentation.topSeat.active}
                      roundRole={presentation.topSeat.roundRole}
                      cards={presentation.topCards}
                      manilhaRank={view.manilhaRank}
                      onPlayCard={(card) =>
                        handleSelectCard(presentation.topSeat.seatId, card)
                      }
                      disabled={
                        !presentation.topSeat.active ||
                        commandPending ||
                        decisionSheetOpen
                      }
                      highlightCards={false}
                      pendingCardId={pendingPlayCardId}
                      selectedCardId={selectedCard?.id ?? null}
                    />
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
                          connected={presentation.leftSeat.connected}
                          dealer={presentation.leftSeat.dealer}
                          active={presentation.leftSeat.active}
                          roundRole={presentation.leftSeat.roundRole}
                          count={presentation.leftSeat.hiddenCount}
                        />
                      </div>

                      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2">
                        <SeatPanel
                          mode="hidden"
                          orientation="right"
                          tone="opponent"
                          nickname={presentation.rightSeat.nickname}
                          connected={presentation.rightSeat.connected}
                          dealer={presentation.rightSeat.dealer}
                          active={presentation.rightSeat.active}
                          roundRole={presentation.rightSeat.roundRole}
                          count={presentation.rightSeat.hiddenCount}
                        />
                      </div>
                    </>
                  )}

                  <ChatBubbleLayer
                    bubbles={chatBubbles}
                    seatLayout={presentation.seatLayout}
                    viewerTeamId={viewerTeamId}
                  />

                  {view.gamePhase === 'DEALING' && (
                    <DealingAnimationLayer
                      seatLayout={presentation.seatLayout}
                    />
                  )}

                  <div className="flex h-full w-full items-center justify-center px-[4.25rem]">
                    <CenterTable
                      mode={presentation.isWaiting ? 'waiting' : 'table'}
                      roomCode={view.roomCode}
                      matchFormat={matchFormat}
                      codeCopied={codeCopied}
                      onCopyCode={() => onCopyCode(view.roomCode)}
                      roundCards={view.roundCards}
                      manilhaRank={view.manilhaRank}
                      viewerTeamId={viewerTeamId}
                      seatLayout={presentation.seatLayout}
                      resolutionPhase={
                        view.gamePhase === 'TRICK_END' ||
                        view.gamePhase === 'ROUND_END'
                          ? view.gamePhase
                          : null
                      }
                    />
                  </div>

                  {presentation.topSeatFocus && !decisionSheetOpen && (
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
                    dimmed={decisionSheetOpen}
                    manilhaRank={view.manilhaRank}
                    error={error}
                    pendingPlay={Boolean(
                      pendingPlayCardId &&
                      selectedCard?.id === pendingPlayCardId,
                    )}
                    selectedCard={selectedCard}
                    trucoHint={presentation.trucoHint}
                    trucoLabel={presentation.trucoLabel}
                    canRunRound={canRunRound}
                    runRoundHint={runRoundHint}
                    onCancelSelection={() =>
                      !commandPending ? setSelectedPlay(null) : undefined
                    }
                    onConfirmCovered={() => handleConfirmPlay('covered')}
                    onConfirmOpen={() => handleConfirmPlay('open')}
                    onRequestTruco={handleRequestTrucoPress}
                    onRunRound={handleRunRoundPress}
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
                <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-[24px] border border-rose-100/70 bg-rose-500/20 px-3 py-2.5 shadow-[0_0_18px_rgba(244,63,94,0.12)]">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose-50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-50/80 transition hover:text-rose-50"
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
                      connected={presentation.topSeat.connected}
                      dealer={presentation.topSeat.dealer}
                      active={presentation.topSeat.active}
                      roundRole={presentation.topSeat.roundRole}
                      cards={presentation.topCards}
                      manilhaRank={view.manilhaRank}
                      onPlayCard={(card) =>
                        onPlayCard(presentation.topSeat.seatId, card)
                      }
                      disabled={
                        !presentation.topSeat.active ||
                        commandPending ||
                        decisionSheetOpen
                      }
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
                          connected={presentation.leftSeat.connected}
                          dealer={presentation.leftSeat.dealer}
                          active={presentation.leftSeat.active}
                          roundRole={presentation.leftSeat.roundRole}
                          count={presentation.leftSeat.hiddenCount}
                        />
                      </div>

                      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2">
                        <SeatPanel
                          mode="hidden"
                          orientation="right"
                          tone="opponent"
                          nickname={presentation.rightSeat.nickname}
                          connected={presentation.rightSeat.connected}
                          dealer={presentation.rightSeat.dealer}
                          active={presentation.rightSeat.active}
                          roundRole={presentation.rightSeat.roundRole}
                          count={presentation.rightSeat.hiddenCount}
                        />
                      </div>
                    </>
                  )}

                  <ChatBubbleLayer
                    bubbles={chatBubbles}
                    seatLayout={presentation.seatLayout}
                    viewerTeamId={viewerTeamId}
                  />

                  {view.gamePhase === 'DEALING' && (
                    <DealingAnimationLayer
                      seatLayout={presentation.seatLayout}
                    />
                  )}

                  <div className="flex h-full items-center justify-center px-[5.5rem] sm:px-36">
                    <CenterTable
                      mode={presentation.isWaiting ? 'waiting' : 'table'}
                      roomCode={view.roomCode}
                      matchFormat={matchFormat}
                      codeCopied={codeCopied}
                      onCopyCode={() => onCopyCode(view.roomCode)}
                      roundCards={view.roundCards}
                      manilhaRank={view.manilhaRank}
                      viewerTeamId={viewerTeamId}
                      seatLayout={presentation.seatLayout}
                      resolutionPhase={
                        view.gamePhase === 'TRICK_END' ||
                        view.gamePhase === 'ROUND_END'
                          ? view.gamePhase
                          : null
                      }
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
                      connected={presentation.bottomSeat.connected}
                      dealer={presentation.bottomSeat.dealer}
                      active={presentation.bottomSeat.active}
                      roundRole={presentation.bottomSeat.roundRole}
                      cards={presentation.bottomCards}
                      manilhaRank={view.manilhaRank}
                      onPlayCard={(card) =>
                        onPlayCard(presentation.bottomSeat.seatId, card)
                      }
                      disabled={
                        !presentation.bottomSeat.active ||
                        commandPending ||
                        decisionSheetOpen
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
                    runRoundEnabled={canRunRound}
                    runRoundHint={runRoundHint}
                    commandPending={commandPending}
                    onToggleCovered={onToggleCovered}
                    onRequestTruco={handleRequestTrucoPress}
                    onRunRound={handleRunRoundPress}
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
                {seriesWinnerTeam !== null && matchFormat === 'best_of_3'
                  ? 'Serie encerrada'
                  : presentation.gameWon
                    ? 'Vitoria'
                    : 'Fim de jogo'}
              </p>
              <h3 className="mt-2 text-3xl font-black text-white">
                {presentation.scoreUs} × {presentation.scoreThem}
              </h3>
              {matchFormat === 'best_of_3' && (
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200/80">
                  Melhor de 3 partidas · {seriesScoreUs} × {seriesScoreThem} ·
                  primeiro a {seriesTargetWins}
                </p>
              )}
              <p className="mt-2 text-sm text-white/55">
                {autoSeriesContinuationPending
                  ? 'A proxima partida da serie comeca automaticamente em instantes.'
                  : presentation.gameWon
                  ? 'Sua dupla venceu a partida.'
                  : roomClosed
                    ? 'A sala foi encerrada. Voce pode voltar ao lobby.'
                    : 'A partida terminou. Peca revanche ou saia da sala.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onRequestRematch}
              disabled={rematchDisabled}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                rematchDisabled
                  ? 'border border-white/15 bg-white/5 text-white/50'
                  : 'bg-emerald-400 text-black hover:brightness-105'
              }`}
            >
              {rematchRequested ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {rematchRequested
                ? 'Aguardando adversario...'
                : autoSeriesContinuationPending
                  ? 'Proxima partida...'
                : roomClosed
                  ? 'Sala encerrada'
                  : 'Pedir revanche'}
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
                {pausedReconnectTitle}
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

      {reconnectStatus.phase !== 'idle' && (
        <ReconnectRecoveryOverlay
          status={reconnectStatus}
          onRetry={onRetryReconnect}
          onReturnToLobby={onReturnToLobby}
        />
      )}

      {!presentation.isWaiting &&
        !presentation.isGameEnd &&
        !presentation.isPausedReconnect &&
        reconnectStatus.phase === 'idle' && (
          <ReactionPicker
            onSend={onSendReaction}
            gamePhase={view.gamePhase}
            justWonTrick={justWonTrick}
            justLostTrick={false}
            trucoPending={Boolean(view.trucoPending)}
          />
        )}

      {/* PATO taunt button — shown to the player who called truco */}
      {canSendPatoTaunt && reconnectStatus.phase === 'idle' && (
        <div className="fixed bottom-8 left-1/2 z-[45] -translate-x-1/2">
          <button
            type="button"
            onClick={() => {
              playPatoSound();
              onSendPatoTaunt();
            }}
            className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/15 px-5 py-2.5 font-mono text-sm font-black uppercase tracking-[0.2em] text-amber-200 shadow-lg backdrop-blur-sm transition active:scale-95"
          >
            <span
              style={{
                display: 'inline-block',
                animation: 'pato-wobble 1.2s ease-in-out infinite',
              }}
            >
              🦆
            </span>
            Pato!
          </button>
        </div>
      )}

      <HandOfElevenDecisionSheet
        open={handOfElevenSheetOpen}
        playValue={respondHandOfElevenAction?.playValue ?? 3}
        runPenalty={respondHandOfElevenAction?.runPenalty ?? 1}
        commandPending={commandPending}
        playerCards={presentation.bottomCards}
        partnerCards={presentation.topCards}
        manilhaRank={view.manilhaRank}
        onPlay={handlePlayHandOfElevenPress}
        onRun={handleRunHandOfElevenPress}
      />

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
          view.trucoPending
            ? getNextRaiseTarget(view.trucoPending.requestedValue)
            : null
        }
        canRaise={Boolean(respondTrucoAction?.actions.includes('raise'))}
        canRunRound={canRunRound}
        runRoundAwardedPoints={runRoundAwardedPoints}
        commandPending={commandPending}
        playerCards={presentation.bottomCards}
        partnerCards={presentation.topCards}
        manilhaRank={view.manilhaRank}
        onAccept={handleAcceptTrucoPress}
        onRaise={handleRaiseTrucoPress}
        onRun={handleRunTrucoPress}
        onRunRound={handleRunRoundPress}
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
              background:
                'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.18) 0%, transparent 65%)',
              animation: 'truco-fade-out 1.5s ease-out forwards',
            }}
          />
          {/* The shout text */}
          <span
            className="relative font-mono font-black uppercase text-amber-300"
            style={{
              fontSize: 'clamp(3.5rem, 16vw, 8rem)',
              letterSpacing: '0.08em',
              textShadow:
                '0 0 60px rgba(251,191,36,0.9), 0 0 120px rgba(251,191,36,0.5), 0 4px 20px rgba(0,0,0,0.8)',
              animation:
                'truco-slam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both, truco-fade-out 1.5s ease-out forwards',
            }}
          >
            {trucoShout.label}
          </span>
        </div>
      )}

      {/* Incoming PATO taunt overlay */}
      {incomingPatoKey > 0 && (
        <div
          key={incomingPatoKey}
          className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center"
        >
          <span
            className="font-mono font-black"
            style={{
              fontSize: 'clamp(4rem, 22vw, 10rem)',
              animation:
                'truco-slam 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both, truco-fade-out 1.2s ease-out forwards',
              filter: 'drop-shadow(0 0 40px rgba(251,191,36,0.7))',
            }}
          >
            🦆
          </span>
        </div>
      )}

      {/* Toast overlay */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in fade-in slide-in-from-top-2 rounded-full border px-5 py-2 font-mono text-sm font-black uppercase tracking-[0.22em] shadow-lg backdrop-blur-sm duration-300 ${
              toast.tone === 'emerald'
                ? 'border-emerald-200/70 bg-emerald-400/26 text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.32)]'
                : toast.tone === 'rose'
                  ? 'border-rose-200/70 bg-rose-500/24 text-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.28)]'
                  : 'border-amber-100/80 bg-amber-400/24 text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.26)]'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
