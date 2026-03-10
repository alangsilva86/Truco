import { ArraySchema, MapSchema, Schema, type, view } from '@colyseus/schema';
import { AvailableAction, Card, PlayerInfo, RANKS, RoomLifecycle, SeatId, Suit, SUITS, TEAM_SEATS, TeamId } from '@truco/contracts';
import { MatchState, getLegalActions } from '@truco/engine';
import { TEAM_VIEW_TAGS } from '../../runtime/constants.js';

export class CardSchema extends Schema {
  @type('string') id = '';
  @type('string') suit: Suit | '' = '';
  @type('string') rank: Card['rank'] | '' = '';
}

export class PlayerSchema extends Schema {
  @type('number') seatId = 0;
  @type('number') teamId = 0;
  @type('string') nickname = '';
  @type('boolean') connected = false;
}

export class PlayedCardSchema extends Schema {
  @type('number') seatId = 0;
  @type('boolean') hidden = false;
  @type('string') cardId = '';
  @type('string') suit: Suit | '' = '';
  @type('string') rank: Card['rank'] | '' = '';
}

export class TrickSchema extends Schema {
  @type('boolean') isTie = false;
  @type('number') winnerSeatId = -1;
  @type([PlayedCardSchema]) cards = new ArraySchema<PlayedCardSchema>();
}

export class TrucoRoomState extends Schema {
  @type('string') roomCode = '';
  @type('string') roomLifecycle: RoomLifecycle = 'OPEN';
  @type('string') matchId = '';
  @type('string') gamePhase = 'WAITING_PLAYERS';
  @type('number') stateVersion = 0;
  @type('number') eventCursor = 0;
  @type('number') scoreTeam0 = 0;
  @type('number') scoreTeam1 = 0;
  @type('number') currentRoundPoints = 1;
  @type('number') turnSeatId = -1;
  @type('number') dealerSeatId = -1;
  @type('number') trickStarterSeatId = -1;
  @type('string') message = 'Aguardando jogadores...';
  @type('string') manilhaRank: Card['rank'] | '' = '';
  @type('string') viraCardId = '';
  @type('string') viraSuit: Suit | '' = '';
  @type('string') viraRank: Card['rank'] | '' = '';
  @type('number') lastRoundWinnerTeam = -1;
  @type('boolean') pendingTrucoActive = false;
  @type('number') pendingTrucoRequestedBySeatId = -1;
  @type('number') pendingTrucoRequestedValue = 0;
  @type('number') pendingTrucoAcceptedValue = 0;
  @type('number') pendingTrucoResponseTeam = -1;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([PlayedCardSchema]) roundCards = new ArraySchema<PlayedCardSchema>();
  @type([TrickSchema]) trickHistory = new ArraySchema<TrickSchema>();
  @type('number') seat0OpponentCount = 0;
  @type('number') seat1OpponentCount = 0;
  @type('number') seat2OpponentCount = 0;
  @type('number') seat3OpponentCount = 0;
  @view(TEAM_VIEW_TAGS[0]) @type('string') team0Seat0HandJson = '[]';
  @view(TEAM_VIEW_TAGS[0]) @type('string') team0Seat2HandJson = '[]';
  @view(TEAM_VIEW_TAGS[1]) @type('string') team1Seat1HandJson = '[]';
  @view(TEAM_VIEW_TAGS[1]) @type('string') team1Seat3HandJson = '[]';
  @view(TEAM_VIEW_TAGS[0]) @type('string') team0AvailableActionsJson = '[]';
  @view(TEAM_VIEW_TAGS[1]) @type('string') team1AvailableActionsJson = '[]';
  @view(TEAM_VIEW_TAGS[0]) @type('string') team0OwnedSeatIdsJson = JSON.stringify(TEAM_SEATS[0]);
  @view(TEAM_VIEW_TAGS[1]) @type('string') team1OwnedSeatIdsJson = JSON.stringify(TEAM_SEATS[1]);
}

function createCardSchema(card: Card): CardSchema {
  const schema = new CardSchema();
  schema.id = card.id;
  schema.rank = card.rank;
  schema.suit = card.suit;
  return schema;
}

function createPlayedCardSchema(input: { seatId: SeatId; hidden: boolean; card: Card | null }): PlayedCardSchema {
  const schema = new PlayedCardSchema();
  schema.seatId = input.seatId;
  schema.hidden = input.hidden;
  schema.cardId = input.card?.id ?? '';
  schema.rank = input.card?.rank ?? '';
  schema.suit = input.card?.suit ?? '';
  return schema;
}

function createPlayerSchema(player: PlayerInfo): PlayerSchema {
  const schema = new PlayerSchema();
  schema.seatId = player.seatId;
  schema.teamId = player.teamId;
  schema.nickname = player.nickname;
  schema.connected = player.connected;
  return schema;
}

function createTrickSchema(trick: MatchState['trickHistory'][number]): TrickSchema {
  const schema = new TrickSchema();
  schema.isTie = trick.winnerSeatId === 'tie';
  schema.winnerSeatId = trick.winnerSeatId === 'tie' ? -1 : trick.winnerSeatId;
  schema.cards = new ArraySchema<PlayedCardSchema>(
    ...trick.cards.map((card) => createPlayedCardSchema({
      seatId: card.seatId,
      hidden: card.hidden,
      card: card.hidden ? null : card.card,
    })),
  );
  return schema;
}

function setPlayers(state: TrucoRoomState, players: Record<SeatId, PlayerInfo>): void {
  state.players = new MapSchema<PlayerSchema>();
  for (const seatId of [0, 1, 2, 3] as SeatId[]) {
    state.players.set(String(seatId), createPlayerSchema(players[seatId]));
  }
}

function setTeamHands(state: TrucoRoomState, engineState: MatchState): void {
  state.team0Seat0HandJson = JSON.stringify(engineState.hands[0]);
  state.team0Seat2HandJson = JSON.stringify(engineState.hands[2]);
  state.team1Seat1HandJson = JSON.stringify(engineState.hands[1]);
  state.team1Seat3HandJson = JSON.stringify(engineState.hands[3]);
}

function setOpponentCounts(state: TrucoRoomState, engineState: MatchState): void {
  state.seat0OpponentCount = engineState.hands[0].length;
  state.seat1OpponentCount = engineState.hands[1].length;
  state.seat2OpponentCount = engineState.hands[2].length;
  state.seat3OpponentCount = engineState.hands[3].length;
}

function serializeActions(actions: AvailableAction[]): string {
  return JSON.stringify(actions);
}

export function syncWaitingRoomState(
  state: TrucoRoomState,
  roomCode: string,
  lifecycle: RoomLifecycle,
  players: Record<SeatId, PlayerInfo>,
): void {
  state.roomCode = roomCode;
  state.roomLifecycle = lifecycle;
  state.matchId = '';
  state.gamePhase = 'WAITING_PLAYERS';
  state.stateVersion = 0;
  state.eventCursor = 0;
  state.scoreTeam0 = 0;
  state.scoreTeam1 = 0;
  state.currentRoundPoints = 1;
  state.turnSeatId = -1;
  state.dealerSeatId = -1;
  state.trickStarterSeatId = -1;
  state.message = 'Aguardando o segundo jogador...';
  state.manilhaRank = '';
  state.viraCardId = '';
  state.viraSuit = '';
  state.viraRank = '';
  state.lastRoundWinnerTeam = -1;
  state.pendingTrucoActive = false;
  state.pendingTrucoRequestedBySeatId = -1;
  state.pendingTrucoRequestedValue = 0;
  state.pendingTrucoAcceptedValue = 0;
  state.pendingTrucoResponseTeam = -1;
  setPlayers(state, players);
  state.roundCards = new ArraySchema<PlayedCardSchema>();
  state.trickHistory = new ArraySchema<TrickSchema>();
  state.team0Seat0HandJson = '[]';
  state.team0Seat2HandJson = '[]';
  state.team1Seat1HandJson = '[]';
  state.team1Seat3HandJson = '[]';
  state.team0AvailableActionsJson = '[]';
  state.team1AvailableActionsJson = '[]';
  state.team0OwnedSeatIdsJson = JSON.stringify(TEAM_SEATS[0]);
  state.team1OwnedSeatIdsJson = JSON.stringify(TEAM_SEATS[1]);
  state.seat0OpponentCount = 0;
  state.seat1OpponentCount = 0;
  state.seat2OpponentCount = 0;
  state.seat3OpponentCount = 0;
}

export function syncEngineRoomState(
  state: TrucoRoomState,
  roomCode: string,
  lifecycle: RoomLifecycle,
  engineState: MatchState,
): void {
  state.roomCode = roomCode;
  state.roomLifecycle = lifecycle;
  state.matchId = engineState.matchId;
  state.gamePhase = engineState.phase;
  state.stateVersion = engineState.stateVersion;
  state.eventCursor = engineState.eventCursor;
  state.scoreTeam0 = engineState.scores[0];
  state.scoreTeam1 = engineState.scores[1];
  state.currentRoundPoints = engineState.currentRoundPoints;
  state.turnSeatId = engineState.turnSeatId ?? -1;
  state.dealerSeatId = engineState.dealerSeatId ?? -1;
  state.trickStarterSeatId = engineState.trickStarterSeatId ?? -1;
  state.message = engineState.message;
  state.manilhaRank = engineState.manilhaRank ?? '';
  state.viraCardId = engineState.vira?.id ?? '';
  state.viraSuit = engineState.vira?.suit ?? '';
  state.viraRank = engineState.vira?.rank ?? '';
  state.lastRoundWinnerTeam = engineState.lastRoundWinnerTeam ?? -1;
  state.pendingTrucoActive = Boolean(engineState.pendingTruco);
  state.pendingTrucoRequestedBySeatId = engineState.pendingTruco?.requestedBySeatId ?? -1;
  state.pendingTrucoRequestedValue = engineState.pendingTruco?.requestedValue ?? 0;
  state.pendingTrucoAcceptedValue = engineState.pendingTruco?.acceptedValue ?? 0;
  state.pendingTrucoResponseTeam = engineState.pendingTruco?.responseTeam ?? -1;
  setPlayers(state, engineState.players);
  state.roundCards = new ArraySchema<PlayedCardSchema>(
    ...([0, 1, 2, 3] as SeatId[])
      .map((seatId) => engineState.roundCards[seatId])
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
      .map((card) => createPlayedCardSchema({
        seatId: card.seatId,
        hidden: card.hidden,
        card: card.hidden ? null : card.card,
      })),
  );
  state.trickHistory = new ArraySchema<TrickSchema>(...engineState.trickHistory.map(createTrickSchema));
  setTeamHands(state, engineState);
  setOpponentCounts(state, engineState);
  state.team0AvailableActionsJson = serializeActions(getLegalActions(engineState, 0));
  state.team1AvailableActionsJson = serializeActions(getLegalActions(engineState, 1));
}

export function createPlaceholderPlayers(): Record<SeatId, PlayerInfo> {
  return {
    0: { seatId: 0, teamId: 0, nickname: 'Aguardando...', connected: false },
    1: { seatId: 1, teamId: 1, nickname: 'Aguardando...', connected: false },
    2: { seatId: 2, teamId: 0, nickname: 'Aguardando...', connected: false },
    3: { seatId: 3, teamId: 1, nickname: 'Aguardando...', connected: false },
  };
}

export function sanitizeNickname(rawNickname: unknown): string {
  const fallback = 'Jogador';
  if (typeof rawNickname !== 'string') {
    return fallback;
  }

  const trimmed = rawNickname.trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : fallback;
}

export function isValidCardRank(value: string): value is Card['rank'] {
  return (RANKS as readonly string[]).includes(value);
}

export function isValidCardSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value);
}
