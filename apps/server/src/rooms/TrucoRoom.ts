import { performance } from 'node:perf_hooks';
import { Client, CloseCode, Room } from 'colyseus';
import { GameCommand, RoomLifecycle, TeamId } from '@truco/contracts';
import { MatchState, createMatch } from '@truco/engine';
import { logger } from '../observability/logger.js';
import { serverMetrics } from '../observability/metrics.js';
import { MatchRuntime } from '../runtime/MatchRuntime.js';
import { ReconnectManager } from '../runtime/ReconnectManager.js';
import {
  findTrucoRoomByCode,
  type TrucoRoomMetadata,
} from '../services/matchmakingRooms.js';
import { createEngineGameView, createWaitingGameView } from './gameView.js';
import {
  StateSyncSnapshot,
  TrucoRoomState,
  createPlaceholderPlayers,
  sanitizeNickname,
  syncEngineRoomState,
  syncWaitingRoomState,
} from './schema/TrucoRoomState.js';

interface Participant {
  connected: boolean;
  nickname: string;
}

// Unambiguous charset: excludes 0/O, 1/I, 2/Z, 5/S, 8/B
const ROOM_CODE_CHARS = 'ACDEFGHJKMNPQRTUVWXY34679';
const DISCONNECT_GRACE_MS = 2_000;
const RECONNECT_WINDOW_SECONDS = 60;

async function createRoomCode(
  existingCodeCheck: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code +=
        ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!(await existingCodeCheck(code))) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique room code after 20 attempts.');
}

function buildPlayers(participants: Record<TeamId, Participant | null>) {
  const players = createPlaceholderPlayers();

  const team0Name = participants[0]?.nickname ?? 'Aguardando...';
  players[0] = {
    seatId: 0,
    teamId: 0,
    nickname: team0Name,
    connected: Boolean(participants[0]?.connected),
  };
  players[2] = {
    seatId: 2,
    teamId: 0,
    nickname: `${team0Name} • Parceiro`,
    connected: Boolean(participants[0]?.connected),
  };

  const team1Name = participants[1]?.nickname ?? 'Aguardando...';
  players[1] = {
    seatId: 1,
    teamId: 1,
    nickname: team1Name,
    connected: Boolean(participants[1]?.connected),
  };
  players[3] = {
    seatId: 3,
    teamId: 1,
    nickname: `${team1Name} • Parceiro`,
    connected: Boolean(participants[1]?.connected),
  };

  return players;
}

export class TrucoRoom extends Room<{
  metadata: TrucoRoomMetadata;
  state: TrucoRoomState;
}> {
  maxClients = 2;
  state = new TrucoRoomState();

  private readonly disconnectGraceManager = new ReconnectManager();
  private readonly participants: Record<TeamId, Participant | null> = {
    0: null,
    1: null,
  };
  private readonly sessionTeamMap = new Map<string, TeamId>();
  private readonly clientsByTeam = new Map<TeamId, Client>();
  private runtime: MatchRuntime | null = null;
  private roomCode = '';
  private lifecycle: RoomLifecycle = 'OPEN';
  private matchStartedAt: number | null = null;
  private lastMatchDurationMs = 0;

  messages = {
    bootstrap: (client: Client) => {
      const teamId = this.sessionTeamMap.get(client.sessionId);
      if (teamId === undefined) {
        client.send('command_rejected', {
          message: 'Unable to bootstrap this session.',
        });
        return;
      }

      client.send('game_view', this.createGameView(teamId));
    },
    command: (client: Client, message: GameCommand) => {
      const teamId = this.sessionTeamMap.get(client.sessionId);
      if (teamId === undefined || !this.runtime) {
        client.send('command_rejected', { message: 'Room is not ready yet.' });
        return;
      }

      this.runtime.enqueuePlayerCommand(teamId, message);
    },
    pato_taunt: (client: Client) => {
      const senderTeamId = this.sessionTeamMap.get(client.sessionId);
      if (senderTeamId === undefined) return;
      const targetTeamId: TeamId = senderTeamId === 0 ? 1 : 0;
      this.clientsByTeam.get(targetTeamId)?.send('pato_taunt', {});
    },
  };

  async onCreate(): Promise<void> {
    this.roomCode = await createRoomCode(async (code) =>
      Boolean(await findTrucoRoomByCode(code)),
    );
    serverMetrics.increment('roomCreatedTotal');
    logger.info('room.created', {
      roomCode: this.roomCode,
      roomId: this.roomId,
    });
    this.metadata = this.createMatchmakingMetadata();
    void this.setPrivate(true);
    this.syncState();
  }

  onJoin(client: Client, options: { nickname?: string }): void {
    const teamId = this.assignTeam(client);
    if (teamId === null) {
      throw new Error('Room is already full.');
    }

    this.disconnectGraceManager.clear(teamId);

    const nickname = sanitizeNickname(options.nickname);
    this.participants[teamId] = { nickname, connected: true };
    this.clientsByTeam.set(teamId, client);

    if (!this.runtime && this.canStartMatch()) {
      this.startMatch();
    } else if (this.runtime) {
      this.lifecycle = 'LOCKED';
      this.runtime.markTeamConnection(teamId, true);
      this.runtime.resumeTransitions();
      this.syncState(this.runtime.getState());
    } else {
      this.syncState();
    }

    this.refreshDirectory();
    logger.info('room.joined', {
      roomCode: this.roomCode,
      roomId: this.roomId,
      teamId,
      nickname,
      currentClients: this.clientsByTeam.size,
    });
  }

  async onLeave(client: Client, code: CloseCode): Promise<void> {
    const teamId = this.sessionTeamMap.get(client.sessionId);
    if (teamId === undefined) {
      return;
    }

    if (this.clientsByTeam.get(teamId) === client) {
      this.clientsByTeam.delete(teamId);
    }

    if (code === CloseCode.CONSENTED) {
      this.handleConsentedLeave(teamId, client.sessionId);
      return;
    }

    this.syncState(this.runtime?.getState());
    this.refreshDirectory();
    this.scheduleDisconnectGrace(teamId);

    try {
      const reconnectedClient = await this.allowReconnection(
        client,
        RECONNECT_WINDOW_SECONDS,
      );

      this.disconnectGraceManager.clear(teamId);
      this.clientsByTeam.set(teamId, reconnectedClient);

      const participant = this.participants[teamId];
      const wasMarkedDisconnected = participant?.connected === false;
      if (participant) {
        participant.connected = true;
      }

      if (this.runtime) {
        if (wasMarkedDisconnected) {
          this.runtime.markTeamConnection(teamId, true);
        }

        this.lifecycle = this.hasDisconnectedParticipants()
          ? 'PAUSED_RECONNECT'
          : 'LOCKED';
        if (this.lifecycle === 'LOCKED') {
          this.runtime.resumeTransitions();
        }

        this.syncState(this.runtime.getState());
      } else if (this.canStartMatch()) {
        this.startMatch();
      } else {
        this.lifecycle = 'OPEN';
        this.syncState();
      }

      this.refreshDirectory();
      serverMetrics.increment('reconnectSuccessTotal');
      logger.info('room.reconnect.success', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        teamId,
      });
    } catch {
      this.disconnectGraceManager.clear(teamId);
      const wasMarkedDisconnected = this.participants[teamId]?.connected === false;

      if (this.runtime) {
        if (!wasMarkedDisconnected) {
          this.participants[teamId]!.connected = false;
          this.runtime.pauseTransitions();
          this.runtime.markTeamConnection(teamId, false);
        }

        this.runtime.forceForfeit(teamId);
        this.sessionTeamMap.delete(client.sessionId);
        this.lifecycle = 'CLOSED';
        this.syncState(this.runtime.getState());
      } else {
        this.participants[teamId] = null;
        this.sessionTeamMap.delete(client.sessionId);
        this.lifecycle = 'OPEN';
        this.syncState();
      }

      this.refreshDirectory();
      serverMetrics.increment('reconnectFailureTotal');
      logger.error('room.reconnect.failed', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        teamId,
      });
    }
  }

  onDispose(): void {
    this.disconnectGraceManager.clearAll();
    this.runtime?.dispose();
    logger.info('room.disposed', {
      roomCode: this.roomCode,
      roomId: this.roomId,
    });
  }

  private assignTeam(client: Client): TeamId | null {
    const existing = this.sessionTeamMap.get(client.sessionId);
    if (existing !== undefined) {
      return existing;
    }

    const teamId =
      this.participants[0] === null
        ? 0
        : this.participants[1] === null
          ? 1
          : null;
    if (teamId === null) {
      return null;
    }

    this.sessionTeamMap.set(client.sessionId, teamId);
    return teamId;
  }

  private canStartMatch(): boolean {
    return (
      !this.runtime &&
      this.participants[0] !== null &&
      this.participants[1] !== null &&
      this.clientsByTeam.has(0) &&
      this.clientsByTeam.has(1)
    );
  }

  private startMatch(): void {
    this.lifecycle = 'LOCKED';
    this.matchStartedAt = Date.now();
    serverMetrics.increment('matchStartedTotal');

    const initialState = createMatch(Date.now(), {
      matchId: `${this.roomId}-${Date.now()}`,
      players: buildPlayers(this.participants),
    });

    this.runtime = new MatchRuntime({
      initialState,
      onStateChange: (state) => {
        this.syncState(state);
        this.broadcastGameViews();
      },
      onEvent: (event) => {
        for (const roomClient of this.clientsByTeam.values()) {
          roomClient.send('match_event', event);
        }

        if (event.type === 'GAME_ENDED' && this.matchStartedAt !== null) {
          this.lastMatchDurationMs = Date.now() - this.matchStartedAt;
          serverMetrics.recordMatchDuration(this.lastMatchDurationMs);
          logger.info('match.finished', {
            roomCode: this.roomCode,
            roomId: this.roomId,
            durationMs: this.lastMatchDurationMs,
            winnerTeam: event.payload.winnerTeam,
          });
        }
      },
      onReject: (ownerTeamId, message, commandId) => {
        serverMetrics.increment('commandRejectedTotal');
        logger.warn('command.rejected', {
          roomCode: this.roomCode,
          roomId: this.roomId,
          ownerTeamId,
          commandId,
          message,
        });
        this.clientsByTeam
          .get(ownerTeamId)
          ?.send('command_rejected', { message, commandId });
      },
    });

    logger.info('match.started', {
      roomCode: this.roomCode,
      roomId: this.roomId,
    });
    this.syncState(initialState);
    this.clock.setTimeout(() => {
      this.runtime?.start();
    }, 25);
  }

  private handleConsentedLeave(teamId: TeamId, sessionId: string): void {
    this.disconnectGraceManager.clear(teamId);

    if (!this.participants[teamId]) {
      this.sessionTeamMap.delete(sessionId);
      return;
    }

    if (!this.runtime) {
      this.participants[teamId] = null;
      this.sessionTeamMap.delete(sessionId);
      this.lifecycle = 'OPEN';
      this.syncState();
      this.refreshDirectory();
      logger.info('room.left.waiting', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        teamId,
      });
      return;
    }

    this.participants[teamId].connected = false;
    this.runtime.pauseTransitions();
    this.runtime.markTeamConnection(teamId, false);
    this.runtime.forceForfeit(teamId);
    this.sessionTeamMap.delete(sessionId);
    this.lifecycle = 'CLOSED';
    this.syncState(this.runtime.getState());
    this.refreshDirectory();
    logger.info('room.left.match', {
      roomCode: this.roomCode,
      roomId: this.roomId,
      teamId,
    });
  }

  private scheduleDisconnectGrace(teamId: TeamId): void {
    this.disconnectGraceManager.schedule(teamId, DISCONNECT_GRACE_MS, () => {
      const participant = this.participants[teamId];
      if (!participant || this.clientsByTeam.has(teamId)) {
        return;
      }

      participant.connected = false;
      serverMetrics.increment('reconnectAttemptTotal');

      if (this.runtime) {
        this.lifecycle = 'PAUSED_RECONNECT';
        this.runtime.pauseTransitions();
        this.runtime.markTeamConnection(teamId, false);
        this.syncState(this.runtime.getState());
      } else {
        this.lifecycle = 'OPEN';
        this.syncState();
      }

      this.refreshDirectory();
      logger.warn('room.reconnect.waiting', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        teamId,
      });
    });
  }

  private hasDisconnectedParticipants(): boolean {
    return Object.values(this.participants).some(
      (participant) => participant !== null && !participant.connected,
    );
  }

  private createMatchmakingMetadata(): TrucoRoomMetadata {
    return {
      currentClients: this.clientsByTeam.size,
      joinable:
        this.lifecycle === 'OPEN' &&
        (this.participants[0] === null || this.participants[1] === null),
      lifecycle: this.lifecycle,
      roomCode: this.roomCode,
    };
  }

  private broadcastGameViews(): void {
    for (const [teamId, client] of this.clientsByTeam.entries()) {
      client.send('game_view', this.createGameView(teamId));
    }
  }

  private createGameView(teamId: TeamId) {
    if (this.runtime) {
      return createEngineGameView(
        this.roomCode,
        this.lifecycle,
        teamId,
        this.runtime.getState(),
      );
    }

    return createWaitingGameView(
      this.roomCode,
      this.lifecycle,
      teamId,
      buildPlayers(this.participants),
    );
  }

  private createStateSnapshot(): StateSyncSnapshot {
    const stateSyncSummary = serverMetrics.getStateSyncSummary();
    return {
      currentClients: this.clientsByTeam.size,
      activeConnections: Object.values(this.participants).filter(
        (participant) => participant?.connected,
      ).length,
      averageStateSyncDurationMs: stateSyncSummary.averageMs,
      lastStateSyncDurationMs: stateSyncSummary.lastMs,
      lastMatchDurationMs: this.lastMatchDurationMs,
    };
  }

  private syncState(engineState?: MatchState): void {
    const startedAt = performance.now();
    const snapshot = this.createStateSnapshot();

    if (engineState) {
      syncEngineRoomState(
        this.state,
        this.roomCode,
        this.lifecycle,
        engineState,
        snapshot,
      );
    } else if (this.runtime) {
      syncEngineRoomState(
        this.state,
        this.roomCode,
        this.lifecycle,
        this.runtime.getState(),
        snapshot,
      );
    } else {
      syncWaitingRoomState(
        this.state,
        this.roomCode,
        this.lifecycle,
        buildPlayers(this.participants),
        snapshot,
      );
    }

    const durationMs = Number((performance.now() - startedAt).toFixed(3));
    serverMetrics.recordStateSync(durationMs);
    const updatedSnapshot = this.createStateSnapshot();
    this.state.currentClients = updatedSnapshot.currentClients;
    this.state.activeConnections = updatedSnapshot.activeConnections;
    this.state.lastStateSyncDurationMs = durationMs;
    this.state.averageStateSyncDurationMs =
      updatedSnapshot.averageStateSyncDurationMs;
    this.state.lastMatchDurationMs = updatedSnapshot.lastMatchDurationMs;
  }

  private refreshDirectory(): void {
    if (!this.roomCode) {
      return;
    }

    void this.setMetadata(this.createMatchmakingMetadata());
  }
}
