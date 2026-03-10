// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

const mocks = vi.hoisted(() => {
  const gameView = {
    matchId: 'match-1',
    roomCode: 'RCN123',
    stateVersion: 1,
    eventCursor: 1,
    gamePhase: 'WAITING_PLAYERS',
    roomLifecycle: 'OPEN',
    ownedSeatIds: [0, 2],
    players: {
      0: { seatId: 0, teamId: 0, nickname: 'Ana', connected: true },
      1: { seatId: 1, teamId: 1, nickname: 'Aguardando...', connected: false },
      2: { seatId: 2, teamId: 0, nickname: 'Ana • Parceiro', connected: true },
      3: { seatId: 3, teamId: 1, nickname: 'Aguardando...', connected: false },
    },
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

  class FakeRoom {
    roomId = 'room-1';
    reconnectionToken = 'token-123';
    sessionId = 'session-123';
    reconnection = {
      maxDelay: 5_000,
      maxRetries: 15,
      minDelay: 100,
      minUptime: 5_000,
    };
    private readonly messageHandlers = new Map<
      string,
      Array<(payload: unknown) => void>
    >();
    private dropHandler: (() => void) | null = null;
    private leaveHandler: (() => void) | null = null;
    private reconnectHandler: (() => void) | null = null;

    leave(): void {
      this.leaveHandler?.();
    }

    onDrop(handler: () => void): void {
      this.dropHandler = handler;
    }

    onLeave(handler: () => void): void {
      this.leaveHandler = handler;
    }

    onMessage(type: string, handler: (payload: unknown) => void): void {
      const handlers = this.messageHandlers.get(type) ?? [];
      handlers.push(handler);
      this.messageHandlers.set(type, handlers);
    }

    onReconnect(handler: () => void): void {
      this.reconnectHandler = handler;
    }

    send(type: string): void {
      if (type !== 'bootstrap') {
        return;
      }

      queueMicrotask(() => {
        const handlers = this.messageHandlers.get('game_view') ?? [];
        for (const handler of handlers) {
          handler(gameView);
        }
      });
    }
  }

  return {
    reconnect: vi.fn().mockResolvedValue(new FakeRoom()),
  };
});

vi.mock('./lib/network.js', async () => {
  const actual =
    await vi.importActual<typeof import('./lib/network.js')>(
      './lib/network.js',
    );

  return {
    ...actual,
    createColyseusClient: () => ({
      create: vi.fn(),
      joinById: vi.fn(),
      reconnect: mocks.reconnect,
    }),
    getDefaultRoomTimeoutMs: () => 100,
    retryWithBackoff: async <T,>(operation: (attempt: number) => Promise<T>) =>
      operation(1),
    withTimeout: async <T,>(operation: () => Promise<T>) => operation(),
  };
});

describe('App', () => {
  const localStorageMock = createStorageMock();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    localStorageMock.clear();
    mocks.reconnect.mockClear();
  });

  it('reconecta automaticamente usando a sessao salva', async () => {
    localStorageMock.setItem(
      'truco-online-session',
      JSON.stringify({
        nickname: 'Ana',
        roomCode: 'RCN123',
        roomId: 'room-1',
        ownedSeatIds: [0, 2],
        reconnectionToken: 'token-123',
        viewerTeamId: 0,
        sessionId: 'session-123',
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(mocks.reconnect).toHaveBeenCalledWith('token-123');
    });

    expect(await screen.findByText(/sala rcn123/i)).toBeInTheDocument();
  });
});
