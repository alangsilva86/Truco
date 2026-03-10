import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ColyseusTestServer, boot } from '@colyseus/testing';
import { ClientGameView, GameCommand } from '@truco/contracts';
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
});
