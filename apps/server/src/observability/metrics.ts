import type { RoomDirectoryEntry } from '../services/matchmakingRooms.js';

interface TimingMetric {
  count: number;
  lastMs: number;
  maxMs: number;
  totalMs: number;
}

interface CounterSet {
  commandRejectedTotal: number;
  matchStartedTotal: number;
  reconnectAttemptTotal: number;
  reconnectFailureTotal: number;
  reconnectSuccessTotal: number;
  roomCreatedTotal: number;
}

function createTimingMetric(): TimingMetric {
  return {
    count: 0,
    lastMs: 0,
    maxMs: 0,
    totalMs: 0,
  };
}

function recordTiming(metric: TimingMetric, durationMs: number): void {
  metric.count += 1;
  metric.lastMs = durationMs;
  metric.maxMs = Math.max(metric.maxMs, durationMs);
  metric.totalMs += durationMs;
}

function averageMs(metric: TimingMetric): number {
  return metric.count === 0
    ? 0
    : Number((metric.totalMs / metric.count).toFixed(3));
}

class ServerMetrics {
  private readonly counters: CounterSet = {
    commandRejectedTotal: 0,
    matchStartedTotal: 0,
    reconnectAttemptTotal: 0,
    reconnectFailureTotal: 0,
    reconnectSuccessTotal: 0,
    roomCreatedTotal: 0,
  };

  private readonly timings = {
    commandApplyMs: createTimingMetric(),
    matchDurationMs: createTimingMetric(),
    stateSyncMs: createTimingMetric(),
  };

  increment(counter: keyof CounterSet): void {
    this.counters[counter] += 1;
  }

  recordCommandApply(durationMs: number): void {
    recordTiming(this.timings.commandApplyMs, durationMs);
  }

  recordMatchDuration(durationMs: number): void {
    recordTiming(this.timings.matchDurationMs, durationMs);
  }

  recordStateSync(durationMs: number): void {
    recordTiming(this.timings.stateSyncMs, durationMs);
  }

  getStateSyncSummary(): { averageMs: number; lastMs: number } {
    return {
      averageMs: averageMs(this.timings.stateSyncMs),
      lastMs: this.timings.stateSyncMs.lastMs,
    };
  }

  snapshot(roomDirectory: RoomDirectoryEntry[] = []): Record<string, unknown> {
    return {
      counters: { ...this.counters },
      timings: {
        commandApplyMs: {
          averageMs: averageMs(this.timings.commandApplyMs),
          lastMs: this.timings.commandApplyMs.lastMs,
          maxMs: this.timings.commandApplyMs.maxMs,
        },
        matchDurationMs: {
          averageMs: averageMs(this.timings.matchDurationMs),
          lastMs: this.timings.matchDurationMs.lastMs,
          maxMs: this.timings.matchDurationMs.maxMs,
        },
        stateSyncMs: {
          averageMs: averageMs(this.timings.stateSyncMs),
          lastMs: this.timings.stateSyncMs.lastMs,
          maxMs: this.timings.stateSyncMs.maxMs,
        },
      },
      roomDirectory,
    };
  }
}

export const serverMetrics = new ServerMetrics();
