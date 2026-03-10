import { ClientMatchEvent, GameCommand, TEAM_SEATS, TeamId, getTeamForSeat } from '@truco/contracts';
import {
  ApplyCommandResult,
  MatchState,
  applyCommand,
  applyPendingTransition,
  beginMatch,
  forfeitMatch,
  updateTeamConnection,
} from '@truco/engine';
import { CommandQueue } from './CommandQueue.js';

interface MatchRuntimeOptions {
  initialState: MatchState;
  onStateChange: (state: MatchState) => void;
  onEvent: (event: ClientMatchEvent) => void;
  onReject: (teamId: TeamId, message: string, commandId?: string) => void;
}

function ownsSeat(teamId: TeamId, seatId: number): boolean {
  return TEAM_SEATS[teamId].includes(seatId as 0 | 1 | 2 | 3);
}

export class MatchRuntime {
  private state: MatchState;
  private readonly queue = new CommandQueue();
  private readonly processedCommandIds = new Set<string>();
  private readonly eventLog: ClientMatchEvent[] = [];
  private transitionTimer: NodeJS.Timeout | null = null;
  private transitionsPaused = false;

  constructor(private readonly options: MatchRuntimeOptions) {
    this.state = options.initialState;
  }

  getState(): MatchState {
    return this.state;
  }

  start(dealerSeatId = 0): void {
    this.commit(beginMatch(this.state, dealerSeatId as 0 | 1 | 2 | 3));
  }

  enqueuePlayerCommand(teamId: TeamId, command: GameCommand): void {
    if (this.processedCommandIds.has(command.commandId)) {
      return;
    }

    this.queue.enqueue(() => {
      const validationError = this.validateCommandOwnership(teamId, command);
      if (validationError) {
        this.options.onReject(teamId, validationError, command.commandId);
        return;
      }

      const result = applyCommand(this.state, command);
      if (result.error) {
        this.options.onReject(teamId, result.error, command.commandId);
        return;
      }

      this.processedCommandIds.add(command.commandId);
      this.commit(result);
    });
  }

  markTeamConnection(teamId: TeamId, connected: boolean): void {
    this.queue.enqueue(() => {
      const result = updateTeamConnection(this.state, teamId, connected);
      this.commit(result);
    });
  }

  pauseTransitions(): void {
    this.transitionsPaused = true;
    this.clearTransitionTimer();
  }

  resumeTransitions(): void {
    this.transitionsPaused = false;
    this.schedulePendingTransition();
  }

  forceForfeit(loserTeamId: TeamId): void {
    this.queue.enqueue(() => {
      const result = forfeitMatch(this.state, loserTeamId);
      this.commit(result);
    });
  }

  dispose(): void {
    this.clearTransitionTimer();
  }

  private commit(result: ApplyCommandResult): void {
    this.state = result.nextState;
    this.options.onStateChange(this.state);

    for (const event of result.events) {
      this.eventLog.push(event);
      this.options.onEvent(event);
    }

    this.schedulePendingTransition();
  }

  private schedulePendingTransition(): void {
    this.clearTransitionTimer();

    if (this.transitionsPaused || !this.state.pendingTransition) {
      return;
    }

    const delay = this.state.phase === 'DEALING'
      ? 500
      : this.state.phase === 'TRICK_END'
        ? 1200
        : this.state.phase === 'ROUND_END'
          ? 1600
          : 0;

    if (delay === 0) {
      return;
    }

    this.transitionTimer = setTimeout(() => {
      this.queue.enqueue(() => {
        const result = applyPendingTransition(this.state);
        this.commit(result);
      });
    }, delay);
  }

  private clearTransitionTimer(): void {
    if (!this.transitionTimer) {
      return;
    }

    clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }

  private validateCommandOwnership(teamId: TeamId, command: GameCommand): string | null {
    switch (command.type) {
      case 'PLAY_CARD':
        return ownsSeat(teamId, command.payload.seatId)
          ? null
          : 'This command targets a seat outside of your team.';
      case 'REQUEST_TRUCO':
        return ownsSeat(teamId, command.payload.seatId)
          ? null
          : 'This command targets a seat outside of your team.';
      case 'REMATCH':
        return ownsSeat(teamId, command.payload.requestedBySeatId)
          ? null
          : 'This command targets a seat outside of your team.';
      case 'RESPOND_TRUCO':
        if (!this.state.pendingTruco) {
          return 'There is no pending truco decision.';
        }
        return this.state.pendingTruco.responseTeam === teamId
          ? null
          : 'Your team cannot answer this truco request.';
      default:
        return null;
    }
  }
}
