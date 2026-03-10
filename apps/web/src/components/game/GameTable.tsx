import { AvailableAction, Card, ClientGameView, ConnectionState, SeatId, TeamId } from '@truco/contracts';
import { AlertCircle, LoaderCircle, LogOut, RefreshCcw, Swords, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createTablePresentation } from '../../lib/tablePresentation.js';
import { BottomActionBar } from './BottomActionBar.js';
import { CenterTable } from './CenterTable.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { MatchLogDrawer } from './MatchLogDrawer.js';
import { RoundStatusBar } from './RoundStatusBar.js';
import { SeatPanel } from './SeatPanel.js';
import { TableHeader } from './TableHeader.js';
import { TrucoDecisionSheet } from './TrucoDecisionSheet.js';
import { TurnBanner } from './TurnBanner.js';

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
  onPlayCard: (seatId: SeatId, card: Card) => void;
  onRequestTruco: () => void;
  onRequestRematch: () => void;
  onAcceptTruco: () => void;
  onRaiseTruco: () => void;
  onRunTruco: () => void;
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

  const presentation = useMemo(() => createTablePresentation({
    view,
    viewerTeamId,
    playAction,
    requestTrucoAction,
  }), [playAction, requestTrucoAction, view, viewerTeamId]);

  useEffect(() => {
    if (logs.length === 0 || presentation.isWaiting) {
      setLogsOpen(false);
    }
  }, [logs.length, presentation.isWaiting]);

  const statusTone = presentation.isPausedReconnect
    ? 'warning'
    : presentation.isGameEnd
      ? 'success'
      : 'neutral';

  const showBottomActions = !presentation.isWaiting && !presentation.isGameEnd;

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
        />

        <main className="felt-noise relative mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[26px] border border-white/8 sm:rounded-[30px]">
          <RoundStatusBar
            message={view.message}
            trickDots={presentation.trickDots}
            isWaiting={presentation.isWaiting}
            vira={view.vira}
            manilhaRank={view.manilhaRank}
            currentRoundPoints={view.currentRoundPoints}
          />

          <TurnBanner
            banner={presentation.banner}
            commandPending={commandPending}
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

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2 sm:px-4 sm:pt-3">
            {!presentation.isWaiting && !presentation.isGameEnd && (
              <div className="flex shrink-0 justify-center">
                <SeatPanel
                  mode="visible"
                  orientation="top"
                  tone="partner"
                  nickname={presentation.topSeat.nickname}
                  dealer={presentation.topSeat.dealer}
                  active={presentation.topSeat.active}
                  cards={presentation.topCards}
                  manilhaRank={view.manilhaRank}
                  onPlayCard={(card) => onPlayCard(presentation.topSeat.seatId, card)}
                  disabled={!presentation.topSeat.active || commandPending}
                />
              </div>
            )}

            <div className="mt-2 flex shrink-0 justify-between gap-2 lg:hidden">
              {!presentation.isWaiting && !presentation.isGameEnd && (
                <>
                  <SeatPanel
                    mode="hidden"
                    orientation="left"
                    tone="opponent"
                    nickname={presentation.leftSeat.nickname}
                    dealer={presentation.leftSeat.dealer}
                    active={presentation.leftSeat.active}
                    count={presentation.leftSeat.hiddenCount}
                  />
                  <SeatPanel
                    mode="hidden"
                    orientation="right"
                    tone="opponent"
                    nickname={presentation.rightSeat.nickname}
                    dealer={presentation.rightSeat.dealer}
                    active={presentation.rightSeat.active}
                    count={presentation.rightSeat.hiddenCount}
                  />
                </>
              )}
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center py-2 sm:py-3">
              {!presentation.isWaiting && !presentation.isGameEnd && (
                <>
                  <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
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

                  <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 lg:block">
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

              <CenterTable
                mode={presentation.isWaiting ? 'waiting' : 'table'}
                roomCode={view.roomCode}
                codeCopied={codeCopied}
                onCopyCode={() => onCopyCode(view.roomCode)}
                roundCards={view.roundCards}
                seatLayout={presentation.seatLayout}
                message={view.message}
                phaseLabel={presentation.phaseLabel}
                manilhaRank={view.manilhaRank}
              />
            </div>

            <div className="mt-2 flex shrink-0 flex-col items-center gap-2 sm:mt-3 sm:gap-3">
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
                onRequestTruco={onRequestTruco}
              />

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
                  onPlayCard={(card) => onPlayCard(presentation.bottomSeat.seatId, card)}
                  disabled={!presentation.bottomSeat.active || commandPending}
                />
              )}
            </div>
          </div>

          <ConnectionStatus
            connectionState={connectionState}
            shareMessage={presentation.shareMessage}
            logCount={logs.length}
            logsOpen={logsOpen}
            onToggleLogs={() => setLogsOpen((current) => !current)}
          />
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
            <div className={`rounded-full border p-4 ${presentation.gameWon ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-200' : 'border-rose-300/20 bg-rose-500/10 text-rose-200'}`}>
              {presentation.gameWon ? <Trophy className="h-8 w-8" /> : <Swords className="h-8 w-8" />}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
                {presentation.gameWon ? 'Vitoria' : 'Fim de jogo'}
              </p>
              <h3 className="mt-2 text-3xl font-black text-white">
                {presentation.scoreUs} × {presentation.scoreThem}
              </h3>
              <p className="mt-2 text-sm text-white/55">
                {presentation.gameWon ? 'Sua dupla venceu a partida.' : 'A partida terminou. Peça revanche ou saia da sala.'}
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
              {rematchRequested ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
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
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">Conexao interrompida</p>
              <h3 className="mt-2 text-2xl font-black text-white">Adversario desconectou</h3>
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
        open={Boolean(respondTrucoAction && view.trucoPending && !presentation.isPausedReconnect)}
        requesterName={view.trucoPending ? (view.players[view.trucoPending.requestedBySeatId]?.nickname ?? 'Adversario') : 'Adversario'}
        requestedValue={view.trucoPending?.requestedValue ?? 0}
        acceptedValue={view.trucoPending?.acceptedValue ?? 0}
        raiseTarget={view.trucoPending ? view.trucoPending.requestedValue + 3 : null}
        canRaise={Boolean(respondTrucoAction?.actions.includes('raise'))}
        commandPending={commandPending}
        onAccept={onAcceptTruco}
        onRaise={onRaiseTruco}
        onRun={onRunTruco}
      />
    </div>
  );
}
