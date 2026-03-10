export const SUITS = ['Ouros', 'Espadas', 'Copas', 'Paus'] as const;
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type SeatId = 0 | 1 | 2 | 3;
export type TeamId = 0 | 1;
export type CardPlayMode = 'open' | 'covered';
export type GamePhase =
  | 'WAITING_PLAYERS'
  | 'DEALING'
  | 'PLAYING'
  | 'TRUCO_DECISION'
  | 'TRICK_END'
  | 'ROUND_END'
  | 'GAME_END';
export type RoomLifecycle = 'OPEN' | 'LOCKED' | 'PAUSED_RECONNECT' | 'CLOSED';
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type TrucoResponseAction = 'accept' | 'run' | 'raise';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface PlayerInfo {
  seatId: SeatId;
  teamId: TeamId;
  nickname: string;
  connected: boolean;
}

export interface PlayedCardView {
  seatId: SeatId;
  hidden: boolean;
  card: Card | null;
}

export interface TrickView {
  winnerSeatId: SeatId | 'tie';
  cards: PlayedCardView[];
}

export interface PendingTrucoState {
  requestedBySeatId: SeatId;
  requestedValue: number;
  acceptedValue: number;
  responseTeam: TeamId;
}

export interface AvailablePlayAction {
  type: 'PLAY_CARD';
  seatId: SeatId;
  cardIds: string[];
  canPlayCovered: boolean;
}

export interface AvailableTrucoAction {
  type: 'REQUEST_TRUCO';
  seatIds: SeatId[];
  nextValue: number;
}

export interface AvailableTrucoResponseAction {
  type: 'RESPOND_TRUCO';
  actions: TrucoResponseAction[];
  requestedValue: number;
  currentAcceptedValue: number;
}

export type AvailableAction =
  | AvailablePlayAction
  | AvailableTrucoAction
  | AvailableTrucoResponseAction;

export interface ClientGameView {
  matchId: string;
  roomCode: string;
  stateVersion: number;
  eventCursor: number;
  gamePhase: GamePhase;
  roomLifecycle: RoomLifecycle;
  ownedSeatIds: SeatId[];
  players: Record<SeatId, PlayerInfo>;
  visibleHands: Partial<Record<SeatId, Card[]>>;
  opponentHandCounts: Partial<Record<SeatId, number>>;
  roundCards: PlayedCardView[];
  trickHistory: TrickView[];
  scores: Record<TeamId, number>;
  currentRoundPoints: number;
  turnSeatId: SeatId | null;
  dealerSeatId: SeatId | null;
  trickStarterSeatId: SeatId | null;
  vira: Card | null;
  manilhaRank: Rank | null;
  trucoPending: PendingTrucoState | null;
  availableActions: AvailableAction[];
  connectionState: ConnectionState;
  message: string;
  lastRoundWinnerTeam: TeamId | null;
}

export interface PlayCardPayload {
  seatId: SeatId;
  cardId: string;
  mode: CardPlayMode;
}

export interface RequestTrucoPayload {
  seatId: SeatId;
}

export interface RespondTrucoPayload {
  action: TrucoResponseAction;
}

export interface RematchPayload {
  requestedBySeatId: SeatId;
}

export interface BaseGameCommand<TType extends string, TPayload> {
  commandId: string;
  issuedAt: number;
  type: TType;
  payload: TPayload;
}

export type PlayCardCommand = BaseGameCommand<'PLAY_CARD', PlayCardPayload>;
export type RequestTrucoCommand = BaseGameCommand<'REQUEST_TRUCO', RequestTrucoPayload>;
export type RespondTrucoCommand = BaseGameCommand<'RESPOND_TRUCO', RespondTrucoPayload>;
export type RematchCommand = BaseGameCommand<'REMATCH', RematchPayload>;

export type GameCommand =
  | PlayCardCommand
  | RequestTrucoCommand
  | RespondTrucoCommand
  | RematchCommand;

export interface BaseEngineEvent<TType extends string, TPayload> {
  cursor: number;
  stateVersion: number;
  timestamp: number;
  type: TType;
  payload: TPayload;
}

export type EngineEvent =
  | BaseEngineEvent<'ROUND_STARTED', { dealerSeatId: SeatId; turnSeatId: SeatId; currentRoundPoints: number }>
  | BaseEngineEvent<'CARD_PLAYED', { seatId: SeatId; card: Card | null; hidden: boolean }>
  | BaseEngineEvent<'TRUCO_REQUESTED', { seatId: SeatId; requestedValue: number; responseTeam: TeamId }>
  | BaseEngineEvent<'TRUCO_ACCEPTED', { acceptedValue: number }>
  | BaseEngineEvent<'TRUCO_RAISED', { seatId: SeatId; requestedValue: number; responseTeam: TeamId }>
  | BaseEngineEvent<'TRUCO_RUN', { runnerTeam: TeamId; awardedTeam: TeamId; awardedPoints: number }>
  | BaseEngineEvent<'TRICK_WON', { winnerSeatId: SeatId | 'tie'; nextTurnSeatId: SeatId; cards: PlayedCardView[] }>
  | BaseEngineEvent<'ROUND_ENDED', { winnerTeam: TeamId; awardedPoints: number; scores: Record<TeamId, number> }>
  | BaseEngineEvent<'GAME_ENDED', { winnerTeam: TeamId; scores: Record<TeamId, number> }>
  | BaseEngineEvent<'PLAYER_DROPPED', { teamId: TeamId; nickname: string }>
  | BaseEngineEvent<'PLAYER_RECONNECTED', { teamId: TeamId; nickname: string }>;

export type ClientMatchEvent = EngineEvent;

export interface ClientStorageSnapshot {
  nickname: string;
  roomCode: string;
  roomId: string;
  ownedSeatIds: SeatId[];
  reconnectionToken: string;
  sessionId?: string;
}

export const TEAM_SEATS: Record<TeamId, SeatId[]> = {
  0: [0, 2],
  1: [1, 3],
};

export function getTeamForSeat(seatId: SeatId): TeamId {
  return seatId % 2 === 0 ? 0 : 1;
}

export function getPartnerSeat(seatId: SeatId): SeatId {
  return ((seatId + 2) % 4) as SeatId;
}

export function getOpponentSeats(teamId: TeamId): SeatId[] {
  return TEAM_SEATS[teamId === 0 ? 1 : 0];
}

export function getSeatLayoutForTeam(teamId: TeamId): {
  bottom: SeatId;
  top: SeatId;
  left: SeatId;
  right: SeatId;
} {
  if (teamId === 0) {
    return {
      bottom: 0,
      top: 2,
      left: 1,
      right: 3,
    };
  }

  return {
    bottom: 1,
    top: 3,
    left: 2,
    right: 0,
  };
}
