import {
  ClientGameView,
  PlayerInfo,
  RoomMatchFormat,
  RoomLifecycle,
  SeatId,
  TEAM_SEATS,
  TeamId,
} from '@truco/contracts';
import { MatchState, projectClientView } from '@truco/engine';

interface SeriesSnapshot {
  score: Record<TeamId, number>;
  targetWins: number;
  winnerTeam: TeamId | null;
}

export function createWaitingGameView(
  roomCode: string,
  matchFormat: RoomMatchFormat,
  roomLifecycle: RoomLifecycle,
  teamId: TeamId,
  players: Record<SeatId, PlayerInfo>,
  series: SeriesSnapshot,
): ClientGameView {
  return {
    matchId: '',
    roomCode,
    matchFormat,
    stateVersion: 0,
    eventCursor: 0,
    gamePhase: 'WAITING_PLAYERS',
    roomLifecycle,
    ownedSeatIds: TEAM_SEATS[teamId],
    players,
    visibleHands: {},
    opponentHandCounts: {},
    roundCards: [],
    trickHistory: [],
    scores: { 0: 0, 1: 0 },
    currentRoundPoints: 1,
    turnSeatId: null,
    dealerSeatId: null,
    trickStarterSeatId: null,
    vira: null,
    manilhaRank: null,
    trucoPending: null,
    availableActions: [],
    connectionState: 'connected',
    message: 'Aguardando o segundo jogador...',
    lastRoundWinnerTeam: null,
    seriesScore: { ...series.score },
    seriesTargetWins: series.targetWins,
    seriesWinnerTeam: series.winnerTeam,
  };
}

export function createEngineGameView(
  roomCode: string,
  matchFormat: RoomMatchFormat,
  roomLifecycle: RoomLifecycle,
  teamId: TeamId,
  engineState: MatchState,
  series: SeriesSnapshot,
): ClientGameView {
  return {
    ...projectClientView(engineState, teamId),
    matchFormat,
    roomCode,
    roomLifecycle,
    ownedSeatIds: TEAM_SEATS[teamId],
    connectionState: 'connected',
    seriesScore: { ...series.score },
    seriesTargetWins: series.targetWins,
    seriesWinnerTeam: series.winnerTeam,
  };
}
