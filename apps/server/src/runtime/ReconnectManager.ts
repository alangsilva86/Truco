import { TeamId } from '@truco/contracts';

export class ReconnectManager {
  private readonly timers = new Map<TeamId, NodeJS.Timeout>();

  schedule(teamId: TeamId, timeoutMs: number, onExpire: () => void): void {
    this.clear(teamId);
    this.timers.set(teamId, setTimeout(onExpire, timeoutMs));
  }

  clear(teamId: TeamId): void {
    const timer = this.timers.get(teamId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(teamId);
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }
}
