import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ColyseusTestServer, boot } from '@colyseus/testing';
import app from '../src/app.config.js';
import { GameCommand } from '@truco/contracts';

function parseCards(raw: string | undefined): Array<{ id: string }> {
  return raw ? JSON.parse(raw) as Array<{ id: string }> : [];
}

async function waitFor(predicate: () => boolean, timeoutMs = 4_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function onceMessage<T>(room: { onMessage: (type: string, cb: (message: T) => void) => void }, type: string): Promise<T> {
  return new Promise((resolve) => {
    room.onMessage(type, (message: T) => resolve(message));
  });
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
    host.onMessage('match_event', () => undefined);
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => host.state.gamePhase === 'PLAYING' && guest.state.gamePhase === 'PLAYING');

    expect(parseCards(host.state.team0Seat0HandJson).length).toBe(3);
    expect(parseCards(host.state.team0Seat2HandJson).length).toBe(3);
    expect(parseCards(host.state.team1Seat1HandJson).length).toBe(0);

    expect(parseCards(guest.state.team1Seat1HandJson).length).toBe(3);
    expect(parseCards(guest.state.team1Seat3HandJson).length).toBe(3);
    expect(parseCards(guest.state.team0Seat0HandJson).length).toBe(0);
  });

  it('rejects commands that target seats outside the player team', async () => {
    const room = await colyseus.createRoom('truco_room', {});
    const host = await colyseus.connectTo(room, { nickname: 'Ana' });
    host.onMessage('match_event', () => undefined);
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => host.state.gamePhase === 'PLAYING');

    const rejection = onceMessage<{ message: string }>(host, 'command_rejected');
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
    host.onMessage('match_event', () => undefined);
    const guest = await colyseus.connectTo(room, { nickname: 'Bia' });
    guest.onMessage('match_event', () => undefined);

    await waitFor(() => guest.state.gamePhase === 'PLAYING');
    await waitFor(() => guest.state.turnSeatId === 1);

    const firstCardId = parseCards(guest.state.team1Seat1HandJson)[0].id;
    const duplicateCommand: GameCommand = {
      commandId: 'duplicate-1',
      issuedAt: Date.now(),
      type: 'PLAY_CARD',
      payload: {
        seatId: 1,
        cardId: firstCardId,
        mode: 'open',
      },
    };

    guest.send('command', duplicateCommand);
    guest.send('command', duplicateCommand);

    await waitFor(() => parseCards(guest.state.team1Seat1HandJson).length === 2);

    expect(parseCards(guest.state.team1Seat1HandJson).length).toBe(2);
  });
});
