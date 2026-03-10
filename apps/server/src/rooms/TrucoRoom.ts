import { StateView } from '@colyseus/schema';
import { Client, CloseCode, Room } from 'colyseus';
import { GameCommand, RoomLifecycle, TEAM_SEATS, TeamId } from '@truco/contracts';
import { MatchRuntime } from '../runtime/MatchRuntime.js';
import { ReconnectManager } from '../runtime/ReconnectManager.js';
import { TEAM_VIEW_TAGS } from '../runtime/constants.js';
import { roomDirectory } from '../services/roomDirectory.js';
import {
  TrucoRoomState,
  createPlaceholderPlayers,
  sanitizeNickname,
  syncEngineRoomState,
  syncWaitingRoomState,
} from './schema/TrucoRoomState.js';
import { MatchState, createMatch } from '@truco/engine';

interface Participant {
  nickname: string;
  connected: boolean;
}

function createRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function buildPlayers(participants: Record<TeamId, Participant | null>) {
  const players = createPlaceholderPlayers();

  const team0Name = participants[0]?.nickname ?? 'Aguardando...';
  players[0] = { seatId: 0, teamId: 0, nickname: team0Name, connected: Boolean(participants[0]?.connected) };
  players[2] = { seatId: 2, teamId: 0, nickname: `${team0Name} • Parceiro`, connected: Boolean(participants[0]?.connected) };

  const team1Name = participants[1]?.nickname ?? 'Aguardando...';
  players[1] = { seatId: 1, teamId: 1, nickname: team1Name, connected: Boolean(participants[1]?.connected) };
  players[3] = { seatId: 3, teamId: 1, nickname: `${team1Name} • Parceiro`, connected: Boolean(participants[1]?.connected) };

  return players;
}

export class TrucoRoom extends Room<{ state: TrucoRoomState }> {
  maxClients = 2;
  state = new TrucoRoomState();

  private readonly reconnectManager = new ReconnectManager();
  private readonly participants: Record<TeamId, Participant | null> = { 0: null, 1: null };
  private readonly sessionTeamMap = new Map<string, TeamId>();
  private readonly clientsByTeam = new Map<TeamId, Client>();
  private runtime: MatchRuntime | null = null;
  private roomCode = '';
  private lifecycle: RoomLifecycle = 'OPEN';

  messages = {
    command: (client: Client, message: GameCommand) => {
      const teamId = this.sessionTeamMap.get(client.sessionId);
      if (teamId === undefined || !this.runtime) {
        client.send('command_rejected', { message: 'Room is not ready yet.' });
        return;
      }

      this.runtime.enqueuePlayerCommand(teamId, message);
    },
  };

  onCreate(): void {
    this.roomCode = createRoomCode();
    roomDirectory.register(this.roomId, this.roomCode);
    void this.setPrivate(true);
    this.syncState();
  }

  onJoin(client: Client, options: { nickname?: string }): void {
    const teamId = this.assignTeam(client);
    if (teamId === null) {
      throw new Error('Room is already full.');
    }

    const nickname = sanitizeNickname(options.nickname);
    this.participants[teamId] = { nickname, connected: true };
    this.clientsByTeam.set(teamId, client);
    const view = client.view ?? (client.view = new StateView());
    view.add(this.state, TEAM_VIEW_TAGS[teamId]);

    if (!this.runtime && this.participants[0] && this.participants[1]) {
      this.lifecycle = 'LOCKED';
      const initialState = createMatch(Date.now(), {
        matchId: `${this.roomId}-${Date.now()}`,
        players: buildPlayers(this.participants),
      });
      this.runtime = new MatchRuntime({
        initialState,
        onStateChange: (state) => {
          this.syncState(state);
        },
        onEvent: (event) => {
          for (const roomClient of this.clientsByTeam.values()) {
            roomClient.send('match_event', event);
          }
        },
        onReject: (ownerTeamId, message, commandId) => {
          this.clientsByTeam.get(ownerTeamId)?.send('command_rejected', { message, commandId });
        },
      });
      this.syncState(initialState);
      this.clock.setTimeout(() => {
        this.runtime?.start();
      }, 25);
    } else if (this.runtime) {
      this.lifecycle = 'LOCKED';
      this.runtime.markTeamConnection(teamId, true);
      this.runtime.resumeTransitions();
      this.syncState(this.runtime.getState());
    } else {
      this.syncState();
    }

    this.refreshDirectory();
  }

  async onLeave(client: Client, _code: CloseCode): Promise<void> {
    const teamId = this.sessionTeamMap.get(client.sessionId);
    if (teamId === undefined) {
      return;
    }

    this.clientsByTeam.delete(teamId);

    if (!this.runtime) {
      this.participants[teamId] = null;
      this.sessionTeamMap.delete(client.sessionId);
      this.lifecycle = 'OPEN';
      this.syncState();
      this.refreshDirectory();
      return;
    }

    this.lifecycle = 'PAUSED_RECONNECT';
    this.runtime.pauseTransitions();
    this.runtime.markTeamConnection(teamId, false);
    this.syncState(this.runtime.getState());
    this.refreshDirectory();
    this.reconnectManager.schedule(teamId, 60_000, () => {
      this.runtime?.forceForfeit(teamId);
      this.lifecycle = 'CLOSED';
      this.refreshDirectory();
    });

    try {
      const reconnectedClient = await this.allowReconnection(client, 60);
      this.clientsByTeam.set(teamId, reconnectedClient);
      this.reconnectManager.clear(teamId);
      this.lifecycle = 'LOCKED';
      this.runtime.markTeamConnection(teamId, true);
      this.runtime.resumeTransitions();
      this.refreshDirectory();
    } catch {
      this.reconnectManager.clear(teamId);
      this.runtime.forceForfeit(teamId);
      this.lifecycle = 'CLOSED';
      this.refreshDirectory();
    }
  }

  onDispose(): void {
    roomDirectory.unregister(this.roomCode);
    this.reconnectManager.clearAll();
    this.runtime?.dispose();
  }

  private assignTeam(client: Client): TeamId | null {
    const existing = this.sessionTeamMap.get(client.sessionId);
    if (existing !== undefined) {
      return existing;
    }

    const teamId = this.participants[0] === null ? 0 : this.participants[1] === null ? 1 : null;
    if (teamId === null) {
      return null;
    }

    this.sessionTeamMap.set(client.sessionId, teamId);
    return teamId;
  }

  private syncState(engineState?: MatchState): void {
    if (engineState) {
      syncEngineRoomState(this.state, this.roomCode, this.lifecycle, engineState);
      return;
    }

    if (this.runtime) {
      syncEngineRoomState(this.state, this.roomCode, this.lifecycle, this.runtime.getState());
      return;
    }

    syncWaitingRoomState(this.state, this.roomCode, this.lifecycle, buildPlayers(this.participants));
  }

  private refreshDirectory(): void {
    roomDirectory.update(this.roomCode, {
      currentClients: this.clientsByTeam.size,
      joinable: this.lifecycle === 'OPEN' && this.participants[1] === null,
      lifecycle: this.lifecycle,
    });
  }
}
