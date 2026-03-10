import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ColyseusTestServer, boot } from '@colyseus/testing';
import { matchMaker } from 'colyseus';
import { ClientGameView, ClientMatchEvent, GameCommand } from '@truco/contracts';
import app from '../src/app.config.js';

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 4_000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function onceMessage<T>(
  room: { onMessage: (type: string, cb: (message: T) => void) => void },
  type: string,
): Promise<T> {
  return new Promise((resolve) => {
    room.onMessage(type, (message: T) => resolve(message));
  });
}

async function bootstrapView(room: {
  onMessage: (type: string, cb: (message: ClientGameView) => void) => void;
  send: (type: string, payload?: unknown) => void;
}): Promise<ClientGameView> {
  const response = onceMessage<ClientGameView>(room, 'game_view');
  room.send('bootstrap');
  return response;
}

function dropConnection(room: {
  connection: { close: () => void };
  reconnection: { maxRetries: number };
}): void {
  room.reconnection.maxRetries = 0;
  room.connection.close();
}

async function expectHttpError(
  operation: Promise<unknown>,
): Promise<{ data: { error?: string; message?: string }; statusCode: number }> {
  try {
    await operation;
    throw new Error('Expected HTTP request to fail.');
  } catch (error) {
    return error as {
      data: { error?: string; message?: string };
      statusCode: number;
    };
  }
}

describe('TrucoRoom', () => {
  let colyseus: ColyseusTestServer<typeof app>;

  beforeAll(async () => {
    colyseus = await boot(app);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it('starts a 2-player match and keeps private hands filtered by team', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    host.onMessage('game_view', () => undefined);
    guest.onMessage('game_view', () => undefined);
    host.onMessage('match_event', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(
      () =>
        host.state.gamePhase === 'PLAYING' &&
        guest.state.gamePhase === 'PLAYING',
    );

    const hostView = await bootstrapView(host);
    const guestView = await bootstrapView(guest);

    expect(hostView.visibleHands[0]).toHaveLength(3);
    expect(hostView.visibleHands[2]).toHaveLength(3);
    expect(hostView.visibleHands[1]).toBeUndefined();

    expect(guestView.visibleHands[1]).toHaveLength(3);
    expect(guestView.visibleHands[3]).toHaveLength(3);
    expect(guestView.visibleHands[0]).toBeUndefined();
  });

  it('publishes room metadata for lookup and metrics while waiting for a guest', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    host.onMessage('game_view', () => undefined);

    await waitFor(
      () =>
        typeof host.state.roomCode === 'string' && host.state.roomCode.length === 6,
    );
    const roomCode = host.state.roomCode;

    const listedRooms = await matchMaker.query({ name: 'truco_room' });
    const listedRoom = listedRooms.find(
      (entry) =>
        (entry.metadata as { roomCode?: string } | undefined)?.roomCode ===
        roomCode,
    );

    expect(listedRoom).toBeDefined();
    expect(listedRoom?.roomId).toBe(room.roomId);

    const lookupResponse = await colyseus.http.get(`/api/rooms/${roomCode}`);
    expect(lookupResponse.statusCode).toBe(200);
    expect(lookupResponse.data).toMatchObject({
      roomCode,
      roomId: room.roomId,
    });

    const metricsResponse = await colyseus.http.get('/metrics');
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.data).toMatchObject({
      roomDirectory: expect.arrayContaining([
        expect.objectContaining({
          currentClients: 1,
          joinable: true,
          lifecycle: 'OPEN',
          roomCode,
          roomId: room.roomId,
        }),
      ]),
    });
  });

  it('rejects commands that target seats outside the player team', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    host.onMessage('game_view', () => undefined);
    host.onMessage('match_event', () => undefined);
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    guest.onMessage('game_view', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => host.state.gamePhase === 'PLAYING');

    const rejection = onceMessage<{ message: string }>(
      host,
      'command_rejected',
    );
    const illegalCommand: GameCommand = {
      commandId: 'illegal-1',
      issuedAt: Date.now(),
      type: 'PLAY_CARD',
      payload: {
        seatId: 1,
        cardId: 'fake-card',
        mode: 'open',
      },
    };

    host.send('command', illegalCommand);

    await expect(rejection).resolves.toMatchObject({
      message: expect.stringContaining('outside of your team'),
    });
  });

  it('deduplicates the same command id', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    host.onMessage('game_view', () => undefined);
    host.onMessage('match_event', () => undefined);
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    guest.onMessage('game_view', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => guest.state.gamePhase === 'PLAYING');
    await waitFor(() => guest.state.turnSeatId === 1);

    const initialView = await bootstrapView(guest);
    const firstCardId = initialView.visibleHands[1]?.[0]?.id;
    expect(firstCardId).toBeDefined();

    const duplicateCommand: GameCommand = {
      commandId: 'duplicate-1',
      issuedAt: Date.now(),
      type: 'PLAY_CARD',
      payload: {
        seatId: 1,
        cardId: firstCardId!,
        mode: 'open',
      },
    };

    const previousStateVersion = guest.state.stateVersion;
    guest.send('command', duplicateCommand);
    guest.send('command', duplicateCommand);

    await waitFor(() => guest.state.stateVersion > previousStateVersion);
    const nextView = await bootstrapView(guest);

    expect(nextView.visibleHands[1]).toHaveLength(2);
  });

  it('keeps the host seat reserved while reconnecting before the match starts', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    host.onMessage('game_view', () => undefined);

    const reconnectionToken = host.reconnectionToken;
    dropConnection(host);

    await waitFor(() => room.clients.length === 0);

    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    guest.onMessage('game_view', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => guest.state.gamePhase === 'WAITING_PLAYERS');

    const reconnectedHost = await colyseus.sdk.reconnect(reconnectionToken);
    reconnectedHost.onMessage('game_view', () => undefined);
    reconnectedHost.onMessage('match_event', () => undefined);

    await waitFor(
      () =>
        reconnectedHost.state.gamePhase === 'PLAYING' &&
        guest.state.gamePhase === 'PLAYING',
    );

    const hostView = await bootstrapView(reconnectedHost);
    expect(hostView.players[0].nickname).toBe('Ana');
    expect(hostView.players[1].nickname).toBe('Bia');
  });

  it('does not emit drop events when a player reconnects quickly', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    const hostEvents: ClientMatchEvent[] = [];

    host.onMessage('game_view', () => undefined);
    guest.onMessage('game_view', () => undefined);
    host.onMessage('match_event', (event: ClientMatchEvent) => {
      hostEvents.push(event);
    });
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => host.state.gamePhase === 'PLAYING');

    const reconnectionToken = guest.reconnectionToken;
    dropConnection(guest);

    await waitFor(() => room.clients.length === 1);

    const reconnectedGuest = await colyseus.sdk.reconnect(reconnectionToken);
    reconnectedGuest.onMessage('game_view', () => undefined);
    reconnectedGuest.onMessage('match_event', () => undefined);

    await waitFor(() => room.clients.length === 2);
    await new Promise((resolve) => setTimeout(resolve, 2_400));

    expect(hostEvents.some((event) => event.type === 'PLAYER_DROPPED')).toBe(
      false,
    );
    expect(
      hostEvents.some((event) => event.type === 'PLAYER_RECONNECTED'),
    ).toBe(false);

    const guestView = await bootstrapView(reconnectedGuest);
    expect(guestView.players[1].connected).toBe(true);
  });

  it('ends the match and blocks reconnect after a consented leave', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    host.onMessage('game_view', () => undefined);
    guest.onMessage('game_view', () => undefined);
    host.onMessage('match_event', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(
      () =>
        host.state.gamePhase === 'PLAYING' &&
        guest.state.gamePhase === 'PLAYING',
    );

    const reconnectionToken = host.reconnectionToken;
    await host.leave();

    await waitFor(
      () =>
        room.state.roomLifecycle === 'CLOSED' &&
        guest.state.gamePhase === 'GAME_END',
    );

    await expect(colyseus.sdk.reconnect(reconnectionToken)).rejects.toBeTruthy();
  });

  it('returns 404, 409 and 410 from room lookup for missing, locked and closed rooms', async () => {
    const missingRoomError = await expectHttpError(
      colyseus.http.get('/api/rooms/XXXXXX'),
    );
    expect(missingRoomError.statusCode).toBe(404);
    expect(missingRoomError.data).toMatchObject({
      error: 'NOT_FOUND',
    });

    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    host.onMessage('game_view', () => undefined);
    guest.onMessage('game_view', () => undefined);
    host.onMessage('match_event', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(
      () =>
        host.state.gamePhase === 'PLAYING' &&
        guest.state.gamePhase === 'PLAYING',
    );

    const lockedRoomError = await expectHttpError(
      colyseus.http.get(`/api/rooms/${host.state.roomCode}`),
    );
    expect(lockedRoomError.statusCode).toBe(409);
    expect(lockedRoomError.data).toMatchObject({
      error: 'LOCKED',
    });

    await host.leave();

    await waitFor(() => room.state.roomLifecycle === 'CLOSED');

    const closedRoomError = await expectHttpError(
      colyseus.http.get(`/api/rooms/${guest.state.roomCode}`),
    );
    expect(closedRoomError.statusCode).toBe(410);
    expect(closedRoomError.data).toMatchObject({
      error: 'CLOSED',
    });
  });
});
