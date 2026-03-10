import { describe, expect, it } from 'vitest';
import { PlayerInfo, TeamId } from '@truco/contracts';
import {
  MatchState,
  applyCommand,
  applyPendingTransition,
  beginMatch,
  createMatch,
  getLegalActions,
  projectClientView,
} from '../src/index.js';

function createPlayers(): Record<0 | 1 | 2 | 3, PlayerInfo> {
  return {
    0: { seatId: 0, teamId: 0, nickname: 'Ana', connected: true },
    1: { seatId: 1, teamId: 1, nickname: 'Bia', connected: true },
    2: { seatId: 2, teamId: 0, nickname: 'Ana • Parceiro', connected: true },
    3: { seatId: 3, teamId: 1, nickname: 'Bia • Parceiro', connected: true },
  };
}

function startReadyMatch(seed = 1234): MatchState {
  const base = createMatch(seed, {
    matchId: 'match-1',
    players: createPlayers(),
  });
  const dealing = beginMatch(base).nextState;
  return applyPendingTransition(dealing).nextState;
}

describe('engine', () => {
  it('deals deterministically from the same seed', () => {
    const left = startReadyMatch(42);
    const right = startReadyMatch(42);

    expect(left.hands).toEqual(right.hands);
    expect(left.vira).toEqual(right.vira);
    expect(left.manilhaRank).toEqual(right.manilhaRank);
    expect(left.turnSeatId).toEqual(1);
  });

  it('projects only the own team cards to the client view', () => {
    const state = startReadyMatch(7);
    const team0View = projectClientView(state, 0);
    const team1View = projectClientView(state, 1);

    expect(team0View.visibleHands[0]).toHaveLength(3);
    expect(team0View.visibleHands[2]).toHaveLength(3);
    expect(team0View.visibleHands[1]).toBeUndefined();
    expect(team0View.visibleHands[3]).toBeUndefined();
    expect(team1View.visibleHands[1]).toHaveLength(3);
    expect(team1View.visibleHands[3]).toHaveLength(3);
  });

  it('rejects covered play on the first trick', () => {
    const state = startReadyMatch(11);
    const firstSeat = state.turnSeatId ?? 1;
    const firstCardId = state.hands[firstSeat][0].id;

    const result = applyCommand(state, {
      commandId: 'cmd-1',
      issuedAt: Date.now(),
      type: 'PLAY_CARD',
      payload: {
        seatId: firstSeat,
        cardId: firstCardId,
        mode: 'covered',
      },
    });

    expect(result.error).toContain('Covered');
  });

  it('raises round value after truco is accepted', () => {
    const state = startReadyMatch(12);
    const request = applyCommand(state, {
      commandId: 'cmd-2',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: {
        seatId: state.turnSeatId ?? 1,
      },
    });

    expect(request.error).toBeUndefined();
    expect(request.nextState.phase).toBe('TRUCO_DECISION');

    const accepted = applyCommand(request.nextState, {
      commandId: 'cmd-3',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: {
        action: 'accept',
      },
    });

    expect(accepted.nextState.currentRoundPoints).toBe(3);
    expect(accepted.nextState.phase).toBe('PLAYING');
  });

  it('exposes legal actions only to the active team', () => {
    const state = startReadyMatch(99);
    const activeTeam = (state.turnSeatId ?? 1) % 2 === 0 ? 0 : 1 as TeamId;
    const waitingTeam = activeTeam === 0 ? 1 : 0;

    expect(getLegalActions(state, activeTeam)).not.toHaveLength(0);
    expect(getLegalActions(state, waitingTeam)).toHaveLength(0);
  });
});
