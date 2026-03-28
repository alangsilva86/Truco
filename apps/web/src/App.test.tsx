// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  let lastRoom: FakeRoom | null = null;

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

    emitDrop(): void {
      this.dropHandler?.();
    }

    emitLeave(): void {
      this.leaveHandler?.();
    }

    emitReconnect(): void {
      this.reconnectHandler?.();
    }

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

  function registerRoom(room: FakeRoom): FakeRoom {
    lastRoom = room;
    return room;
  }

  return {
    createRoom: () => registerRoom(new FakeRoom()),
    create: vi.fn().mockImplementation(async () => registerRoom(new FakeRoom())),
    fetchServerVersion: vi.fn().mockResolvedValue({
      version: '1.0.0',
      bootId: 'boot-1',
      startedAt: '2026-03-28T00:00:00.000Z',
    }),
    getClientReconnectBudgetMs: vi.fn().mockReturnValue(55_000),
    getLastRoom: () => lastRoom,
    joinById: vi.fn().mockImplementation(async () => registerRoom(new FakeRoom())),
    lookupRoom: vi.fn().mockResolvedValue({ roomId: 'room-join' }),
    reconnect: vi.fn().mockImplementation(async () => registerRoom(new FakeRoom())),
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
      create: mocks.create,
      joinById: mocks.joinById,
      reconnect: mocks.reconnect,
    }),
    fetchServerVersion: mocks.fetchServerVersion,
    getClientReconnectBudgetMs: mocks.getClientReconnectBudgetMs,
    getDefaultRoomTimeoutMs: () => 100,
    lookupRoom: mocks.lookupRoom,
    withTimeout: async <T,>(operation: () => Promise<T>) => operation(),
  };
});

describe('App', () => {
  const localStorageMock = createStorageMock();

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    localStorageMock.clear();
    mocks.create.mockClear();
    mocks.fetchServerVersion.mockClear();
    mocks.fetchServerVersion.mockResolvedValue({
      version: '1.0.0',
      bootId: 'boot-1',
      startedAt: '2026-03-28T00:00:00.000Z',
    });
    mocks.getClientReconnectBudgetMs.mockClear();
    mocks.getClientReconnectBudgetMs.mockReturnValue(55_000);
    mocks.joinById.mockClear();
    mocks.lookupRoom.mockClear();
    mocks.reconnect.mockClear();
  });

  it('nao reconecta automaticamente usando a sessao salva', async () => {
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

    await screen.findByRole('button', { name: /reconectar · rcn123/i });
    expect(mocks.reconnect).not.toHaveBeenCalled();
  });

  it('reconecta manualmente usando o botao da sessao salva', async () => {
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

    fireEvent.click(
      await screen.findByRole('button', { name: /reconectar · rcn123/i }),
    );

    await waitFor(() => {
      expect(mocks.reconnect).toHaveBeenCalledWith('token-123');
    });

    expect(
      await screen.findByRole('button', { name: /sair da sala/i }),
    ).toBeInTheDocument();
  });

  it('limpa a sessao salva antes de criar uma nova sala', async () => {
    localStorageMock.setItem(
      'truco-online-session',
      JSON.stringify({
        nickname: 'Ana',
        roomCode: 'OLD123',
        roomId: 'room-old',
        ownedSeatIds: [0, 2],
        reconnectionToken: 'token-old',
        viewerTeamId: 0,
        sessionId: 'session-old',
      }),
    );
    mocks.create.mockImplementationOnce(async () => {
      expect(window.localStorage.getItem('truco-online-session')).toBeNull();
      return mocks.createRoom();
    });

    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: /criar sala/i })[1]);

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalled();
    });
  });

  it('limpa a sessao salva antes de entrar por codigo', async () => {
    localStorageMock.setItem(
      'truco-online-session',
      JSON.stringify({
        nickname: 'Ana',
        roomCode: 'OLD123',
        roomId: 'room-old',
        ownedSeatIds: [0, 2],
        reconnectionToken: 'token-old',
        viewerTeamId: 0,
        sessionId: 'session-old',
      }),
    );
    mocks.joinById.mockImplementationOnce(async () => {
      expect(window.localStorage.getItem('truco-online-session')).toBeNull();
      return mocks.createRoom();
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /entrar por codigo/i }));
    fireEvent.change(screen.getByPlaceholderText(/codigo da sala/i), {
      target: { value: 'ABCD12' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: /entrar por codigo/i })[1],
    );

    await waitFor(() => {
      expect(mocks.lookupRoom).toHaveBeenCalledWith('ABCD12');
      expect(mocks.joinById).toHaveBeenCalled();
    });
  });

  it('mostra erro claro quando a reconexao manual falha', async () => {
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
    mocks.reconnect.mockRejectedValueOnce(new Error('expired'));

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: /reconectar · rcn123/i }),
    );

    expect(
      await screen.findByText(/sua sessao expirou ou foi invalidada/i),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('truco-online-session')).toBeNull();
  });

  it('preserva a sessao salva quando a reconexao manual falha de forma transitória', async () => {
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
    mocks.getClientReconnectBudgetMs.mockReturnValueOnce(1);
    mocks.reconnect.mockRejectedValueOnce(new Error('network down'));

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: /reconectar · rcn123/i }),
    );

    expect(
      await screen.findByText(/backend ainda nao respondeu|reconexao falhou temporariamente/i),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('truco-online-session')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /reconectar · rcn123/i }),
    ).toBeInTheDocument();
  });

  it('inicia o supervisor automatico depois que o reconnect nativo falha', async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/seu apelido/i), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /criar sala/i })[1]);

    await screen.findByRole('button', { name: /sair da sala/i });
    const room = mocks.getLastRoom();
    expect(room).not.toBeNull();

    mocks.reconnect.mockImplementationOnce(() => new Promise(() => undefined));

    room!.emitDrop();
    room!.emitLeave();

    await waitFor(() => {
      expect(mocks.reconnect).toHaveBeenCalledWith('token-123');
    });

    expect(
      await screen.findByText(/recuperando sessao/i),
    ).toBeInTheDocument();
  });

  it('falha cedo quando detecta mudanca de bootId e preserva a sessao salva', async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/seu apelido/i), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /criar sala/i })[1]);

    await screen.findByRole('button', { name: /sair da sala/i });
    const room = mocks.getLastRoom();
    expect(room).not.toBeNull();

    mocks.fetchServerVersion.mockResolvedValueOnce({
      version: '1.0.0',
      bootId: 'boot-2',
      startedAt: '2026-03-28T00:10:00.000Z',
    });

    room!.emitDrop();
    room!.emitLeave();

    expect(
      await screen.findByRole('heading', { name: /servidor reiniciou/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('truco-online-session')).not.toBeNull();
  });
});
