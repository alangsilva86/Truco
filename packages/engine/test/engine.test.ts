import { describe, expect, it } from 'vitest';
import { AvailableAction, PlayerInfo, TeamId } from '@truco/contracts';
import {
  MatchState,
  applyCommand,
  applyPendingTransition,
  beginMatch,
  createMatch,
  forfeitMatch,
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

function startMatchAtScore(
  scores: MatchState['scores'],
  seed = 1234,
): MatchState {
  const base = createMatch(seed, {
    matchId: 'match-1',
    players: createPlayers(),
  });
  base.scores = { ...scores };
  const dealing = beginMatch(base).nextState;
  return applyPendingTransition(dealing).nextState;
}

// Play a card for the current turn seat (uses first card in hand by default).
function playCard(state: MatchState, tag: string, cardIndex = 0): MatchState {
  const seat = state.turnSeatId!;
  const cardId = state.hands[seat][cardIndex].id;
  const result = applyCommand(state, {
    commandId: `play-${tag}`,
    issuedAt: Date.now(),
    type: 'PLAY_CARD',
    payload: { seatId: seat, cardId, mode: 'open' },
  });
  expect(result.error).toBeUndefined();
  return result.nextState;
}

// Play all 4 seats in a single trick and advance past TRICK_END.
// The engine may emit ROUND_END directly when the trick decides the round winner.
function playOneTrick(state: MatchState, trickTag: string): MatchState {
  let s = state;
  for (let i = 0; i < 4; i++) {
    s = playCard(s, `${trickTag}-${i}`);
  }
  expect(['TRICK_END', 'ROUND_END']).toContain(s.phase);
  if (s.phase === 'TRICK_END') {
    return applyPendingTransition(s).nextState;
  }
  return s;
}

// Play cards until ROUND_END (early win after 2 tricks or full 3 tricks).
function playUntilRoundEnd(state: MatchState): MatchState {
  let s = state;
  for (let trick = 0; trick < 3; trick++) {
    if (s.phase !== 'PLAYING') break;
    for (let play = 0; play < 4; play++) {
      if (s.phase !== 'PLAYING') break;
      s = playCard(s, `${trick}-${play}`);
    }
    if (s.phase === 'TRICK_END') {
      s = applyPendingTransition(s).nextState;
    }
  }
  return s;
}

describe('engine', () => {
  it('deals deterministically from the same seed', () => {
    const left = startReadyMatch(42);
    const right = startReadyMatch(42);

    expect(left.hands).toEqual(right.hands);
    expect(left.vira).toEqual(right.vira);
    expect(left.manilhaRank).toEqual(right.manilhaRank);
    expect(left.turnSeatId).toEqual(3);
  });

  it('avanca o turno em sentido anti-horario', () => {
    const state = startReadyMatch(42);
    const afterFirstPlay = playCard(state, 'anti-clockwise');

    expect(afterFirstPlay.turnSeatId).toBe(2);
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

  it('keeps play actions for active team and only allows running during active play', () => {
    const state = startReadyMatch(99);
    const activeTeam = (state.turnSeatId ?? 1) % 2 === 0 ? 0 : (1 as TeamId);
    const waitingTeam = activeTeam === 0 ? 1 : 0;

    expect(
      getLegalActions(state, activeTeam).some((action) => action.type === 'PLAY_CARD'),
    ).toBe(true);
    expect(
      getLegalActions(state, waitingTeam).some(
        (action) => action.type === 'PLAY_CARD',
      ),
    ).toBe(false);
    expect(
      getLegalActions(state, activeTeam).some((action) => action.type === 'RUN_ROUND'),
    ).toBe(true);
    expect(
      getLegalActions(state, waitingTeam).some(
        (action) => action.type === 'RUN_ROUND',
      ),
    ).toBe(true);
  });

  // ── New tests ─────────────────────────────────────────────────────────────────

  it('resolves a full trick after 4 plays and advances state', () => {
    const state = startReadyMatch(55);

    // Play all 4 seats
    let s = state;
    for (let i = 0; i < 4; i++) {
      expect(s.phase).toBe('PLAYING');
      s = playCard(s, `trick-${i}`);
    }

    expect(s.phase).toBe('TRICK_END');
    expect(s.trickHistory).toHaveLength(1);

    const advanced = applyPendingTransition(s).nextState;
    expect(['PLAYING', 'ROUND_END']).toContain(advanced.phase);
  });

  it('awarding team scores 1 point when the responder runs from truco', () => {
    const state = startReadyMatch(20);
    const requesterSeat = state.turnSeatId!;
    const requesterTeam = (requesterSeat % 2) as TeamId;

    const afterRequest = applyCommand(state, {
      commandId: 'truco-req',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: { seatId: requesterSeat },
    });

    expect(afterRequest.error).toBeUndefined();
    expect(afterRequest.nextState.phase).toBe('TRUCO_DECISION');
    expect(afterRequest.nextState.pendingTruco?.requestedValue).toBe(3);

    const afterRun = applyCommand(afterRequest.nextState, {
      commandId: 'truco-run',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'run' },
    });

    expect(afterRun.error).toBeUndefined();
    // Running forfeits the round — requester's team wins 1 pt (acceptedValue before raise)
    expect(afterRun.nextState.scores[requesterTeam]).toBe(1);
    expect(afterRun.events.some((e) => e.type === 'TRUCO_RUN')).toBe(true);
  });

  it('chains truco raises: 1 → 3 → 6, then accepted at 6', () => {
    const state = startReadyMatch(30);
    const requesterSeat = state.turnSeatId!;

    // Request: currentRoundPoints 1 → requestedValue 3
    const afterReq = applyCommand(state, {
      commandId: 'chain-req',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: { seatId: requesterSeat },
    });
    expect(afterReq.nextState.pendingTruco?.requestedValue).toBe(3);
    expect(afterReq.nextState.pendingTruco?.acceptedValue).toBe(1);

    // Raise: acceptedValue locked at 3, new requestedValue 6
    const afterRaise = applyCommand(afterReq.nextState, {
      commandId: 'chain-raise',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    });
    expect(afterRaise.error).toBeUndefined();
    expect(afterRaise.nextState.pendingTruco?.requestedValue).toBe(6);
    expect(afterRaise.nextState.pendingTruco?.acceptedValue).toBe(3);

    // Accept at 6
    const afterAccept = applyCommand(afterRaise.nextState, {
      commandId: 'chain-accept',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'accept' },
    });
    expect(afterAccept.error).toBeUndefined();
    expect(afterAccept.nextState.currentRoundPoints).toBe(6);
    expect(afterAccept.nextState.phase).toBe('PLAYING');
    expect(afterAccept.nextState.pendingTruco).toBeNull();
  });

  it('caps truco at 12 without offering a new request or raise above it', () => {
    const state = startReadyMatch(130);
    const requesterSeat = state.turnSeatId!;
    const requesterTeam = (requesterSeat % 2) as TeamId;
    const responderTeam: TeamId = requesterTeam === 0 ? 1 : 0;

    const afterTruco = applyCommand(state, {
      commandId: 'cap-req-3',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: { seatId: requesterSeat },
    }).nextState;

    const afterSeis = applyCommand(afterTruco, {
      commandId: 'cap-req-6',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    }).nextState;

    const afterNove = applyCommand(afterSeis, {
      commandId: 'cap-req-9',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    }).nextState;

    const afterDoze = applyCommand(afterNove, {
      commandId: 'cap-req-12',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    }).nextState;

    expect(afterDoze.pendingTruco?.requestedValue).toBe(12);
    expect(afterDoze.pendingTruco?.responseTeam).not.toBeUndefined();
    expect(
      (
        getLegalActions(
          afterDoze,
          afterDoze.pendingTruco!.responseTeam,
        ).find((action) => action.type === 'RESPOND_TRUCO') as
          | Extract<AvailableAction, { type: 'RESPOND_TRUCO' }>
          | undefined
      )?.actions,
    ).toEqual(['accept', 'run']);

    const acceptedAtDoze = applyCommand(afterDoze, {
      commandId: 'cap-accept-12',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'accept' },
    }).nextState;

    expect(acceptedAtDoze.currentRoundPoints).toBe(12);
    expect(
      getLegalActions(acceptedAtDoze, responderTeam).some(
        (action) => action.type === 'REQUEST_TRUCO',
      ),
    ).toBe(false);
  });

  it('requires a play-or-run decision when one team reaches 11', () => {
    const state = startMatchAtScore({ 0: 11, 1: 10 }, 31);

    expect(state.phase).toBe('HAND_OF_ELEVEN_DECISION');
    expect(getLegalActions(state, 0)).toContainEqual({
      type: 'RESPOND_HAND_OF_ELEVEN',
      playValue: 3,
      runPenalty: 1,
    });
    expect(
      getLegalActions(state, 1).some((action) => action.type === 'RUN_ROUND'),
    ).toBe(false);

    const afterPlay = applyCommand(state, {
      commandId: 'hand-11-play',
      issuedAt: Date.now(),
      type: 'RESPOND_HAND_OF_ELEVEN',
      payload: { action: 'play' },
    });

    expect(afterPlay.error).toBeUndefined();
    expect(afterPlay.nextState.phase).toBe('PLAYING');
    expect(afterPlay.nextState.currentRoundPoints).toBe(3);

    const blockedTruco = applyCommand(afterPlay.nextState, {
      commandId: 'hand-11-truco',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: { seatId: afterPlay.nextState.turnSeatId! },
    });

    expect(blockedTruco.error).toContain('11 points');
  });

  it('awards only 1 point to the opponent when running at 11', () => {
    const state = startMatchAtScore({ 0: 11, 1: 10 }, 32);

    const afterRun = applyCommand(state, {
      commandId: 'hand-11-run',
      issuedAt: Date.now(),
      type: 'RESPOND_HAND_OF_ELEVEN',
      payload: { action: 'run' },
    });

    expect(afterRun.error).toBeUndefined();
    expect(afterRun.nextState.scores).toEqual({ 0: 11, 1: 11 });
    expect(afterRun.nextState.phase).toBe('ROUND_END');
  });

  it('allows running the round during play and awards 1 point to the opponent', () => {
    const state = startReadyMatch(34);
    const runnerSeat = state.turnSeatId ?? 0;
    const runnerTeam = (runnerSeat % 2) as TeamId;
    const awardedTeam: TeamId = runnerTeam === 0 ? 1 : 0;

    const result = applyCommand(state, {
      commandId: 'run-round-playing',
      issuedAt: Date.now(),
      type: 'RUN_ROUND',
      payload: { requestedBySeatId: runnerSeat },
    });

    expect(result.error).toBeUndefined();
    expect(result.nextState.phase).toBe('ROUND_END');
    expect(result.nextState.scores[awardedTeam]).toBe(1);
    expect(result.events.some((event) => event.type === 'ROUND_RUN')).toBe(true);
  });

  it('does not allow running the round while a truco decision is pending', () => {
    const state = startReadyMatch(35);
    const requesterSeat = state.turnSeatId ?? 0;

    const requested = applyCommand(state, {
      commandId: 'truco-before-run-round',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: { seatId: requesterSeat },
    });
    expect(requested.error).toBeUndefined();
    expect(requested.nextState.phase).toBe('TRUCO_DECISION');
    expect(
      getLegalActions(requested.nextState, 0).some(
        (action) => action.type === 'RUN_ROUND',
      ),
    ).toBe(false);
    expect(
      getLegalActions(requested.nextState, 1).some(
        (action) => action.type === 'RUN_ROUND',
      ),
    ).toBe(false);

    const ranRound = applyCommand(requested.nextState, {
      commandId: 'run-round-after-truco',
      issuedAt: Date.now(),
      type: 'RUN_ROUND',
      payload: { requestedBySeatId: 1 },
    });

    expect(ranRound.error).toContain('only available while a round is active');
  });

  it('awards the full current round value when someone runs after doze was accepted', () => {
    const state = startReadyMatch(36);
    const requesterSeat = state.turnSeatId!;
    const requesterTeam = (requesterSeat % 2) as TeamId;
    const runnerSeat = requesterTeam === 0 ? 1 : 0;

    const afterTruco = applyCommand(state, {
      commandId: 'doze-req-3',
      issuedAt: Date.now(),
      type: 'REQUEST_TRUCO',
      payload: { seatId: requesterSeat },
    }).nextState;

    const afterSeis = applyCommand(afterTruco, {
      commandId: 'doze-req-6',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    }).nextState;

    const afterNove = applyCommand(afterSeis, {
      commandId: 'doze-req-9',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    }).nextState;

    const afterDoze = applyCommand(afterNove, {
      commandId: 'doze-req-12',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'raise' },
    }).nextState;

    const acceptedAtDoze = applyCommand(afterDoze, {
      commandId: 'doze-accept-12',
      issuedAt: Date.now(),
      type: 'RESPOND_TRUCO',
      payload: { action: 'accept' },
    }).nextState;

    const result = applyCommand(acceptedAtDoze, {
      commandId: 'doze-run-round',
      issuedAt: Date.now(),
      type: 'RUN_ROUND',
      payload: { requestedBySeatId: runnerSeat },
    });

    expect(result.error).toBeUndefined();
    expect(result.nextState.scores[requesterTeam]).toBe(12);
    expect(result.nextState.phase).toBe('GAME_END');
    expect(
      result.events.some(
        (event) =>
          event.type === 'ROUND_RUN' && event.payload.awardedPoints === 12,
      ),
    ).toBe(true);
  });

  it('starts 11 x 11 as mao de ferro worth 3 without truco', () => {
    const state = startMatchAtScore({ 0: 11, 1: 11 }, 33);
    const activeTeam = ((state.turnSeatId ?? 1) % 2) as TeamId;

    expect(state.phase).toBe('PLAYING');
    expect(state.currentRoundPoints).toBe(3);
    expect(
      getLegalActions(state, activeTeam).some(
        (action) => action.type === 'REQUEST_TRUCO',
      ),
    ).toBe(false);
  });

  it('completes a full round and awards 1 point to the winner', () => {
    const state = startReadyMatch(50);
    const after = playUntilRoundEnd(state);

    expect(after.phase).toBe('ROUND_END');
    const totalPoints = after.scores[0] + after.scores[1];
    expect(totalPoints).toBe(1); // default currentRoundPoints = 1
  });

  it('plays 3 tricks without error when no truco is requested', () => {
    const state = startReadyMatch(77);

    // Trick 1
    const afterT1 = playOneTrick(state, 't1');
    expect(['PLAYING', 'ROUND_END']).toContain(afterT1.phase);

    if (afterT1.phase !== 'PLAYING') return;

    // Trick 2
    const afterT2 = playOneTrick(afterT1, 't2');
    expect(['PLAYING', 'ROUND_END']).toContain(afterT2.phase);
  });

  it('forfeit ends the game immediately and awards win to the surviving team', () => {
    const state = startReadyMatch(40);

    const result = forfeitMatch(state, 0);

    expect(result.nextState.phase).toBe('GAME_END');
    expect(result.nextState.gameWinnerTeam).toBe(1);
    expect(result.nextState.scores[1]).toBeGreaterThanOrEqual(12);
    expect(result.events.some((e) => e.type === 'GAME_ENDED')).toBe(true);
  });

  it('rejects a PLAY_CARD command targeting the wrong seat', () => {
    const state = startReadyMatch(88);
    const wrongSeat = ((state.turnSeatId! + 1) % 4) as 0 | 1 | 2 | 3;
    const cardId = state.hands[wrongSeat][0].id;

    const result = applyCommand(state, {
      commandId: 'wrong-seat',
      issuedAt: Date.now(),
      type: 'PLAY_CARD',
      payload: { seatId: wrongSeat, cardId, mode: 'open' },
    });

    expect(result.error).toBeDefined();
  });

  it('rematch resets the game after both teams vote', () => {
    const state = startReadyMatch(60);

    // Fast-forward to GAME_END via forfeit
    const forfeited = forfeitMatch(state, 0).nextState;
    expect(forfeited.phase).toBe('GAME_END');

    // Team 0 votes rematch
    const vote0 = applyCommand(forfeited, {
      commandId: 'rematch-0',
      issuedAt: Date.now(),
      type: 'REMATCH',
      payload: { requestedBySeatId: 0 },
    });
    expect(vote0.error).toBeUndefined();
    // Only one team voted — still GAME_END
    expect(vote0.nextState.phase).toBe('GAME_END');

    // Team 1 votes rematch — both teams in, new match starts
    const vote1 = applyCommand(vote0.nextState, {
      commandId: 'rematch-1',
      issuedAt: Date.now(),
      type: 'REMATCH',
      payload: { requestedBySeatId: 1 },
    });
    expect(vote1.error).toBeUndefined();
    // After both votes, engine begins a new match (DEALING or PLAYING)
    expect(['DEALING', 'PLAYING', 'ROUND_END']).toContain(
      vote1.nextState.phase,
    );
    // Scores reset to 0
    expect(vote1.nextState.scores[0]).toBe(0);
    expect(vote1.nextState.scores[1]).toBe(0);
  });
});
