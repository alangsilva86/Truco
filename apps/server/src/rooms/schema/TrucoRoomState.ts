import { MapSchema, Schema, type } from '@colyseus/schema';
import { PlayerInfo, RoomLifecycle, SeatId } from '@truco/contracts';
import { MatchState } from '@truco/engine';

export class PlayerSchema extends Schema {
  @type('number') seatId = 0;
  @type('number') teamId = 0;
  @type('string') nickname = '';
  @type('boolean') connected = false;
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
  @type('string') message = 'Aguardando jogadores...';
  @type('number') currentClients = 0;
  @type('number') activeConnections = 0;
  @type('number') lastStateSyncDurationMs = 0;
  @type('number') averageStateSyncDurationMs = 0;
  @type('number') lastMatchDurationMs = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}

export interface StateSyncSnapshot {
  currentClients: number;
  activeConnections: number;
  averageStateSyncDurationMs: number;
  lastStateSyncDurationMs: number;
  lastMatchDurationMs: number;
}

function createPlayerSchema(player: PlayerInfo): PlayerSchema {
  const schema = new PlayerSchema();
  schema.seatId = player.seatId;
  schema.teamId = player.teamId;
  schema.nickname = player.nickname;
  schema.connected = player.connected;
  return schema;
}

function setPlayers(
  state: TrucoRoomState,
  players: Record<SeatId, PlayerInfo>,
): void {
  state.players = new MapSchema<PlayerSchema>();
  for (const seatId of [0, 1, 2, 3] as SeatId[]) {
    state.players.set(String(seatId), createPlayerSchema(players[seatId]));
  }
}

function applySnapshot(
  state: TrucoRoomState,
  snapshot: StateSyncSnapshot,
): void {
  state.currentClients = snapshot.currentClients;
  state.activeConnections = snapshot.activeConnections;
  state.lastStateSyncDurationMs = snapshot.lastStateSyncDurationMs;
  state.averageStateSyncDurationMs = snapshot.averageStateSyncDurationMs;
  state.lastMatchDurationMs = snapshot.lastMatchDurationMs;
}

export function syncWaitingRoomState(
  state: TrucoRoomState,
  roomCode: string,
  lifecycle: RoomLifecycle,
  players: Record<SeatId, PlayerInfo>,
  snapshot: StateSyncSnapshot,
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
  state.message = 'Aguardando o segundo jogador...';
  setPlayers(state, players);
  applySnapshot(state, snapshot);
}

export function syncEngineRoomState(
  state: TrucoRoomState,
  roomCode: string,
  lifecycle: RoomLifecycle,
  engineState: MatchState,
  snapshot: StateSyncSnapshot,
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
  state.message = engineState.message;
  setPlayers(state, engineState.players);
  applySnapshot(state, snapshot);
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
