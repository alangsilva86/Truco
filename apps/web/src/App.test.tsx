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
      if (type === 'bootstrap') {
        queueMicrotask(() => {
          const handlers = this.messageHandlers.get('game_view') ?? [];
          for (const handler of handlers) {
            handler(gameView);
          }
        });
        return;
      }

      if (type === 'client_reconnect_telemetry') {
        return;
      }
    }
  }

  function registerRoom(room: FakeRoom): FakeRoom {
    return room;
  }

  return {
    createOrUpdateGuestUser: vi.fn().mockResolvedValue({
      ok: true,
      user: {
        id: 'usr-1',
        nickname: 'Ana',
        avatarUrl: null,
        isGuest: true,
      },
    }),
    createRoomRequest: vi.fn().mockResolvedValue({
      ok: true,
      room: {
        id: 'room-db-1',
        roomCode: 'RCN123',
        status: 'waiting',
        players: 1,
        maxPlayers: 2,
        canJoin: true,
        ownerUserId: 'usr-1',
        createdAt: '2026-05-06T00:00:00.000Z',
      },
      joinUrl: 'https://truco.example/sala/RCN123',
      colyseus: {
        roomCode: 'RCN123',
        roomId: 'room-1',
        roomName: 'truco_room',
        assignedTeamId: 0,
      },
    }),
    fetchPublicRooms: vi.fn().mockResolvedValue({ ok: true, rooms: [] }),
    fetchServerVersion: vi.fn().mockResolvedValue({
      version: '1.0.0',
      bootId: 'boot-1',
      startedAt: '2026-03-28T00:00:00.000Z',
    }),
    fetchUserRooms: vi.fn().mockResolvedValue({ ok: true, rooms: [] }),
    getClientReconnectBudgetMs: vi.fn().mockReturnValue(55_000),
    joinById: vi.fn().mockImplementation(async () => registerRoom(new FakeRoom())),
    joinRoomRequest: vi.fn().mockResolvedValue({
      ok: true,
      room: {
        id: 'room-db-2',
        roomCode: 'ABCD12',
        status: 'waiting',
        players: 2,
        maxPlayers: 2,
        canJoin: true,
        ownerUserId: 'usr-2',
        createdAt: '2026-05-06T00:00:00.000Z',
      },
      colyseus: {
        roomCode: 'ABCD12',
        roomId: 'room-join',
        roomName: 'truco_room',
        assignedTeamId: 1,
      },
    }),
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
      joinById: mocks.joinById,
      reconnect: mocks.reconnect,
    }),
    createOrUpdateGuestUser: mocks.createOrUpdateGuestUser,
    createRoomRequest: mocks.createRoomRequest,
    fetchPublicRooms: mocks.fetchPublicRooms,
    fetchServerVersion: mocks.fetchServerVersion,
    fetchUserRooms: mocks.fetchUserRooms,
    getClientReconnectBudgetMs: mocks.getClientReconnectBudgetMs,
    getDefaultRoomTimeoutMs: () => 100,
    joinRoomRequest: mocks.joinRoomRequest,
    withTimeout: async <T,>(operation: () => Promise<T>) => operation(),
  };
});

describe('App', () => {
  const localStorageMock = createStorageMock();

  afterEach(() => {
    cleanup();
    window.history.pushState({}, '', '/');
  });

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    localStorageMock.clear();
    mocks.createOrUpdateGuestUser.mockClear();
    mocks.createRoomRequest.mockClear();
    mocks.fetchPublicRooms.mockClear();
    mocks.fetchUserRooms.mockClear();
    mocks.joinById.mockClear();
    mocks.joinRoomRequest.mockClear();
    mocks.reconnect.mockClear();
    mocks.fetchServerVersion.mockClear();
    mocks.fetchServerVersion.mockResolvedValue({
      version: '1.0.0',
      bootId: 'boot-1',
      startedAt: '2026-03-28T00:00:00.000Z',
    });
  });

  it('nao reconecta automaticamente usando a sessao salva fora da rota da sala', async () => {
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
        userId: 'usr-1',
      }),
    );

    render(<App />);

    await screen.findByRole('button', { name: /reconectar · rcn123/i });
    expect(mocks.reconnect).not.toHaveBeenCalled();
  });

  it('reconecta automaticamente quando a rota aponta para a mesma sala salva', async () => {
    window.history.pushState({}, '', '/sala/RCN123');
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
        userId: 'usr-1',
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(mocks.reconnect).toHaveBeenCalledWith('token-123');
    });

    expect(
      await screen.findByRole('button', { name: /sair da sala/i }),
    ).toBeInTheDocument();
  });

  it('cria usuario convidado, cria sala via API e persiste a nova sessao', async () => {
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
        userId: 'usr-old',
      }),
    );

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/seu apelido/i), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^criar sala$/i })[1]);

    await waitFor(() => {
      expect(mocks.createOrUpdateGuestUser).toHaveBeenCalledWith({
        nickname: 'Ana',
        userId: undefined,
      });
    });
    expect(mocks.createRoomRequest).toHaveBeenCalledWith({
      maxPlayers: 2,
      nickname: 'Ana',
      ownerUserId: 'usr-1',
    });
    expect(mocks.joinById).toHaveBeenCalledWith('room-1', {
      assignedTeamId: 0,
      nickname: 'Ana',
      roomCode: 'RCN123',
      userId: 'usr-1',
    });

    await screen.findByRole('button', { name: /sair da sala/i });
    expect(
      JSON.parse(localStorageMock.getItem('truco-online-session') ?? '{}'),
    ).toMatchObject({
      roomCode: 'RCN123',
      roomId: 'room-1',
      userId: 'usr-1',
    });
    expect(
      JSON.parse(localStorageMock.getItem('truco-online-user') ?? '{}'),
    ).toMatchObject({
      id: 'usr-1',
      nickname: 'Ana',
    });
  });

  it('entra por codigo usando a API de join e atualiza a rota da sala', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^entrar por codigo$/i }));
    fireEvent.change(screen.getByPlaceholderText(/seu apelido/i), {
      target: { value: 'Ana' },
    });
    fireEvent.change(screen.getByPlaceholderText(/codigo da sala/i), {
      target: { value: 'ABCD12' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: /^entrar por codigo$/i })[1],
    );

    await waitFor(() => {
      expect(mocks.joinRoomRequest).toHaveBeenCalledWith({
        nickname: 'Ana',
        roomCode: 'ABCD12',
        userId: 'usr-1',
      });
    });
    expect(mocks.joinById).toHaveBeenCalledWith('room-join', {
      assignedTeamId: 1,
      nickname: 'Ana',
      roomCode: 'ABCD12',
      userId: 'usr-1',
    });
    expect(window.location.pathname).toBe('/sala/ABCD12');
  });

  it('permite reconexao manual pelo botao do lobby', async () => {
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
        userId: 'usr-1',
      }),
    );

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: /reconectar · rcn123/i }),
    );

    await waitFor(() => {
      expect(mocks.reconnect).toHaveBeenCalledWith('token-123');
    });
    expect(window.location.pathname).toBe('/sala/RCN123');
  });
});
