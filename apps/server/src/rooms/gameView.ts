import {
  ClientGameView,
  PlayerInfo,
  RoomLifecycle,
  SeatId,
  TEAM_SEATS,
  TeamId,
} from '@truco/contracts';
import { MatchState, projectClientView } from '@truco/engine';

export function createWaitingGameView(
  roomCode: string,
  roomLifecycle: RoomLifecycle,
  teamId: TeamId,
  players: Record<SeatId, PlayerInfo>,
): ClientGameView {
  return {
    matchId: '',
    roomCode,
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
  };
}

export function createEngineGameView(
  roomCode: string,
  roomLifecycle: RoomLifecycle,
  teamId: TeamId,
  engineState: MatchState,
): ClientGameView {
  return {
    ...projectClientView(engineState, teamId),
    roomCode,
    roomLifecycle,
    ownedSeatIds: TEAM_SEATS[teamId],
    connectionState: 'connected',
  };
}
