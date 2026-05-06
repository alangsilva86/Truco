import { performance } from 'node:perf_hooks';
import { Client, CloseCode, Room } from 'colyseus';
import { GameCommand, RoomLifecycle, SeatId, TeamId } from '@truco/contracts';
import { MatchState, createMatch } from '@truco/engine';
import { getReconnectWindowSeconds } from '../config/runtime.js';
import { roomService } from '../modules/rooms/room.service.js';
import { generateRoomCode } from '../modules/rooms/roomCode.js';
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
  userId?: string | null;
}

interface ClientReconnectTelemetryPayload {
  durationMs: number;
  strategy: 'native' | 'supervisor';
}

const DISCONNECT_GRACE_MS = 2_000;

interface PersistentRoomAuth {
  nickname: string;
  roomCode: string;
  teamId: TeamId;
  userId: string;
}

interface EphemeralRoomAuth {
  nickname: string;
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
  private readonly sessionUserMap = new Map<string, string>();
  private readonly sessionTeamMap = new Map<string, TeamId>();
  private readonly teamUserMap = new Map<TeamId, string>();
  private readonly clientsByTeam = new Map<TeamId, Client>();
  private readonly reactionRateLimit = new Map<string, number>();
  private readonly reconnectStartedAtBySession = new Map<string, number>();
  private readonly reconnectSequenceBySession = new Map<string, number>();
  private persistentRoomId: string | null = null;
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

      if (this.lifecycle === 'PAUSED_RECONNECT') {
        client.send('command_rejected', {
          message: 'Partida pausada aguardando reconexao do adversario.',
          commandId: message.commandId,
        });
        return;
      }

      if (this.lifecycle === 'CLOSED') {
        client.send('command_rejected', {
          message: 'Esta sala foi encerrada.',
          commandId: message.commandId,
        });
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
    player_reaction: (client: Client, payload: { phraseId: number }) => {
      const senderTeamId = this.sessionTeamMap.get(client.sessionId);
      if (senderTeamId === undefined) return;

      const now = Date.now();
      const last = this.reactionRateLimit.get(client.sessionId) ?? 0;
      if (now - last < 2_500) return;
      this.reactionRateLimit.set(client.sessionId, now);

      if (
        typeof payload.phraseId !== 'number' ||
        !Number.isInteger(payload.phraseId) ||
        payload.phraseId < 0 ||
        payload.phraseId > 20
      ) {
        return;
      }

      const seatId: SeatId = senderTeamId === 0 ? 0 : 1;

      for (const roomClient of this.clientsByTeam.values()) {
        roomClient.send('player_reaction', {
          seatId,
          phraseId: payload.phraseId,
        });
      }
    },
    client_reconnect_telemetry: (
      client: Client,
      payload: ClientReconnectTelemetryPayload,
    ) => {
      const teamId = this.sessionTeamMap.get(client.sessionId);
      if (teamId === undefined) {
        return;
      }

      if (
        payload.strategy !== 'native' &&
        payload.strategy !== 'supervisor'
      ) {
        return;
      }

      if (
        typeof payload.durationMs !== 'number' ||
        !Number.isFinite(payload.durationMs) ||
        payload.durationMs < 0
      ) {
        return;
      }

      const durationMs = Number(payload.durationMs.toFixed(3));
      serverMetrics.recordReconnectRecovered(payload.strategy, durationMs);
      logger.info('room.reconnect.client_reported', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        sessionId: client.sessionId,
        teamId,
        strategy: payload.strategy,
        durationMs,
      });
    },
  };

  async onCreate(options?: {
    maxPlayers?: number;
    persistentRoomId?: string;
    roomCode?: string;
  }): Promise<void> {
    this.maxClients = 2;
    this.persistentRoomId = options?.persistentRoomId ?? null;
    this.roomCode =
      options?.roomCode ??
      (await generateRoomCode(async (code) =>
        Boolean(await findTrucoRoomByCode(code)),
      ));
    serverMetrics.increment('roomCreatedTotal');
    logger.info('room.created', {
      persistentRoomId: this.persistentRoomId,
      roomCode: this.roomCode,
      roomId: this.roomId,
    });
    this.metadata = this.createMatchmakingMetadata();
    void this.setPrivate(true);
    this.syncState();
  }

  async onAuth(
    client: Client,
    options: {
      assignedTeamId?: number;
      nickname?: string;
      roomCode?: string;
      userId?: string;
    },
  ): Promise<PersistentRoomAuth | EphemeralRoomAuth> {
    if (!this.persistentRoomId) {
      return {
        nickname: sanitizeNickname(options.nickname),
      };
    }

    return roomService.authorizeRealtimeJoin({
      assignedTeamId: Number(options.assignedTeamId),
      nickname: String(options.nickname ?? ''),
      persistentRoomId: this.persistentRoomId,
      roomCode: String(options.roomCode ?? this.roomCode),
      sessionId: client.sessionId,
      userId: String(options.userId ?? ''),
    });
  }

  onJoin(
    client: Client,
    options: { nickname?: string },
    auth?: PersistentRoomAuth | EphemeralRoomAuth | null,
  ): void {
    const persistentAuth =
      auth && 'teamId' in auth && 'userId' in auth ? auth : undefined;
    const teamId = this.assignTeam(client, persistentAuth);
    if (teamId === null) {
      throw new Error('Room is already full.');
    }

    this.disconnectGraceManager.clear(teamId);

    const nickname = auth?.nickname ?? sanitizeNickname(options.nickname);
    const userId = persistentAuth?.userId ?? null;
    this.participants[teamId] = { nickname, connected: true, userId };
    this.clientsByTeam.set(teamId, client);
    if (userId) {
      this.sessionUserMap.set(client.sessionId, userId);
      this.teamUserMap.set(teamId, userId);
    }

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
      userId,
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

    const userId = this.getUserIdForSession(client.sessionId, teamId);

    if (code === CloseCode.CONSENTED) {
      this.handleConsentedLeave(teamId, client.sessionId, userId);
      return;
    }

    this.syncState(this.runtime?.getState());
    this.refreshDirectory();
    this.scheduleDisconnectGrace(teamId, userId);
    this.beginReconnectTracking(teamId, client.sessionId);

    try {
      const reconnectedClient = await this.allowReconnection(
        client,
        getReconnectWindowSeconds(),
      );

      this.disconnectGraceManager.clear(teamId);
      this.ensureSessionOwnership(
        client.sessionId,
        reconnectedClient.sessionId,
        teamId,
      );
      this.clientsByTeam.set(teamId, reconnectedClient);

      const participant = this.participants[teamId];
      const wasMarkedDisconnected = participant?.connected === false;
      if (participant) {
        participant.connected = true;
      }
      if (userId) {
        void roomService.markParticipantJoined(
          this.persistentRoomId ?? this.roomId,
          userId,
          reconnectedClient.sessionId,
        );
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
      const timeSinceDropMs = this.getReconnectDurationMs(client.sessionId);
      const attempt = this.getReconnectAttempt(client.sessionId);
      logger.info('room.reconnect.success', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        sessionId: reconnectedClient.sessionId,
        teamId,
        attempt,
        timeSinceDropMs,
      });
      this.clearReconnectTracking(client.sessionId, reconnectedClient.sessionId);
    } catch {
      this.disconnectGraceManager.clear(teamId);
      const wasMarkedDisconnected =
        this.participants[teamId]?.connected === false;
      const timeSinceDropMs = this.getReconnectDurationMs(client.sessionId);
      const attempt = this.getReconnectAttempt(client.sessionId);

      if (this.runtime) {
        if (!wasMarkedDisconnected) {
          this.participants[teamId]!.connected = false;
          this.runtime.pauseTransitions();
          this.runtime.markTeamConnection(teamId, false);
        }

        this.runtime.forceForfeit(teamId);
        this.sessionTeamMap.delete(client.sessionId);
        this.reactionRateLimit.delete(client.sessionId);
        this.lifecycle = 'CLOSED';
        this.syncState(this.runtime.getState());
      } else {
        this.participants[teamId] = null;
        this.sessionTeamMap.delete(client.sessionId);
        this.sessionUserMap.delete(client.sessionId);
        this.teamUserMap.delete(teamId);
        this.reactionRateLimit.delete(client.sessionId);
        if (userId && this.persistentRoomId) {
          void roomService.markRoomFinished(this.persistentRoomId, 'abandoned');
          this.lifecycle = 'CLOSED';
        } else {
          this.lifecycle = 'OPEN';
        }
        this.syncState();
      }

      if (userId) {
        void roomService.markParticipantLeft(
          this.persistentRoomId ?? this.roomId,
          userId,
        );
      }

      this.refreshDirectory();
      serverMetrics.increment('reconnectFailureTotal');
      serverMetrics.recordReconnectTerminalFailure(
        'window_expired',
        timeSinceDropMs ?? undefined,
      );
      logger.error('room.reconnect.failed', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        sessionId: client.sessionId,
        teamId,
        attempt,
        timeSinceDropMs,
        failureReason: 'window_expired',
      });
      this.clearReconnectTracking(client.sessionId);
    }
  }

  onDispose(): void {
    this.disconnectGraceManager.clearAll();
    this.reactionRateLimit.clear();
    this.reconnectStartedAtBySession.clear();
    this.reconnectSequenceBySession.clear();
    this.sessionUserMap.clear();
    this.teamUserMap.clear();
    this.runtime?.dispose();
    logger.info('room.disposed', {
      persistentRoomId: this.persistentRoomId,
      roomCode: this.roomCode,
      roomId: this.roomId,
    });
  }

  private assignTeam(
    client: Client,
    auth?: PersistentRoomAuth,
  ): TeamId | null {
    const existing = this.sessionTeamMap.get(client.sessionId);
    if (existing !== undefined) {
      return existing;
    }

    if (auth) {
      if (this.clientsByTeam.has(auth.teamId)) {
        return null;
      }

      this.sessionTeamMap.set(client.sessionId, auth.teamId);
      this.sessionUserMap.set(client.sessionId, auth.userId);
      this.teamUserMap.set(auth.teamId, auth.userId);
      return auth.teamId;
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
    if (this.persistentRoomId) {
      void roomService.markRoomPlaying(this.persistentRoomId);
    }

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
          if (this.persistentRoomId) {
            void roomService.markRoomFinished(this.persistentRoomId, 'finished');
          }
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

  private handleConsentedLeave(
    teamId: TeamId,
    sessionId: string,
    userId: string | null,
  ): void {
    this.disconnectGraceManager.clear(teamId);
    this.clearReconnectTracking(sessionId);
    this.reactionRateLimit.delete(sessionId);

    if (!this.participants[teamId]) {
      this.sessionTeamMap.delete(sessionId);
      this.sessionUserMap.delete(sessionId);
      this.teamUserMap.delete(teamId);
      return;
    }

    if (!this.runtime) {
      this.participants[teamId] = null;
      this.sessionTeamMap.delete(sessionId);
      this.sessionUserMap.delete(sessionId);
      this.teamUserMap.delete(teamId);
      if (userId && this.persistentRoomId) {
        void roomService.markParticipantLeft(this.persistentRoomId, userId);
        void roomService.markRoomFinished(this.persistentRoomId, 'abandoned');
        this.lifecycle = 'CLOSED';
      } else {
        this.lifecycle = 'OPEN';
      }
      this.syncState();
      this.refreshDirectory();
      logger.info('room.left.waiting', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        teamId,
      });
      if (this.lifecycle === 'CLOSED') {
        void this.disconnect();
      }
      return;
    }

    this.participants[teamId].connected = false;
    this.runtime.pauseTransitions();
    this.runtime.markTeamConnection(teamId, false);
    this.runtime.forceForfeit(teamId);
    this.sessionTeamMap.delete(sessionId);
    this.sessionUserMap.delete(sessionId);
    this.teamUserMap.delete(teamId);
    this.lifecycle = 'CLOSED';
    if (userId && this.persistentRoomId) {
      void roomService.markParticipantLeft(this.persistentRoomId, userId);
    }
    this.syncState(this.runtime.getState());
    this.refreshDirectory();
    logger.info('room.left.match', {
      roomCode: this.roomCode,
      roomId: this.roomId,
      teamId,
    });
  }

  private scheduleDisconnectGrace(teamId: TeamId, userId: string | null): void {
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

      if (userId && this.persistentRoomId) {
        void roomService.markParticipantDisconnected(this.persistentRoomId, userId);
      }

      this.refreshDirectory();
      const sessionId = this.getSessionIdForTeam(teamId);
      logger.warn('room.reconnect.waiting', {
        roomCode: this.roomCode,
        roomId: this.roomId,
        teamId,
        sessionId,
        attempt: sessionId ? this.getReconnectAttempt(sessionId) : 0,
        timeSinceDropMs: sessionId
          ? this.getReconnectDurationMs(sessionId)
          : DISCONNECT_GRACE_MS,
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

  private beginReconnectTracking(teamId: TeamId, sessionId: string): void {
    const attempt = (this.reconnectSequenceBySession.get(sessionId) ?? 0) + 1;
    this.reconnectSequenceBySession.set(sessionId, attempt);
    this.reconnectStartedAtBySession.set(sessionId, Date.now());
    serverMetrics.recordReconnectStarted();
    logger.warn('room.reconnect.started', {
      roomCode: this.roomCode,
      roomId: this.roomId,
      sessionId,
      teamId,
      attempt,
    });
  }

  private clearReconnectTracking(
    sessionId: string,
    nextSessionId?: string,
  ): void {
    this.reconnectStartedAtBySession.delete(sessionId);
    this.reconnectSequenceBySession.delete(sessionId);

    if (nextSessionId && nextSessionId !== sessionId) {
      this.reconnectStartedAtBySession.delete(nextSessionId);
      this.reconnectSequenceBySession.delete(nextSessionId);
      this.reactionRateLimit.delete(sessionId);
    }
  }

  private ensureSessionOwnership(
    previousSessionId: string,
    nextSessionId: string,
    teamId: TeamId,
  ): void {
    if (previousSessionId === nextSessionId) {
      return;
    }

    this.sessionTeamMap.delete(previousSessionId);
    this.sessionTeamMap.set(nextSessionId, teamId);
    const userId = this.sessionUserMap.get(previousSessionId);
    if (userId) {
      this.sessionUserMap.delete(previousSessionId);
      this.sessionUserMap.set(nextSessionId, userId);
      this.teamUserMap.set(teamId, userId);
    }
    this.reactionRateLimit.delete(nextSessionId);
  }

  private getReconnectAttempt(sessionId: string): number {
    return this.reconnectSequenceBySession.get(sessionId) ?? 0;
  }

  private getReconnectDurationMs(sessionId: string): number | null {
    const startedAt = this.reconnectStartedAtBySession.get(sessionId);
    if (startedAt === undefined) {
      return null;
    }

    return Date.now() - startedAt;
  }

  private getSessionIdForTeam(teamId: TeamId): string | null {
    for (const [sessionId, mappedTeamId] of this.sessionTeamMap.entries()) {
      if (mappedTeamId === teamId) {
        return sessionId;
      }
    }

    return null;
  }

  private getUserIdForSession(
    sessionId: string,
    teamId: TeamId,
  ): string | null {
    return (
      this.sessionUserMap.get(sessionId) ?? this.teamUserMap.get(teamId) ?? null
    );
  }
}
