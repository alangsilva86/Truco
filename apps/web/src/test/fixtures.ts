import { ClientGameView, PlayerInfo, SeatId, TeamId } from '@truco/contracts';

function createPlayers(): Record<SeatId, PlayerInfo> {
  return {
    0: { seatId: 0, teamId: 0, nickname: 'Ana', connected: true },
    1: { seatId: 1, teamId: 1, nickname: 'Bia', connected: true },
    2: { seatId: 2, teamId: 0, nickname: 'Ana • Parceiro', connected: true },
    3: { seatId: 3, teamId: 1, nickname: 'Bia • Parceiro', connected: true },
  };
}

export function createClientGameView(
  overrides: Partial<ClientGameView> = {},
): ClientGameView {
  const ownedSeatIds = (overrides.ownedSeatIds ?? [0, 2]) as SeatId[];
  const viewerTeamId = (ownedSeatIds[0] % 2) as TeamId;

  return {
    matchId: 'match-1',
    roomCode: 'ABC123',
    stateVersion: 1,
    eventCursor: 1,
    gamePhase: 'PLAYING',
    roomLifecycle: 'LOCKED',
    ownedSeatIds,
    players: createPlayers(),
    visibleHands:
      viewerTeamId === 0
        ? {
            0: [{ id: 'A-Ouros', rank: 'A', suit: 'Ouros' }],
            2: [{ id: '3-Paus', rank: '3', suit: 'Paus' }],
          }
        : {
            1: [{ id: 'A-Ouros', rank: 'A', suit: 'Ouros' }],
            3: [{ id: '3-Paus', rank: '3', suit: 'Paus' }],
          },
    opponentHandCounts: viewerTeamId === 0 ? { 1: 3, 3: 3 } : { 0: 3, 2: 3 },
    roundCards: [],
    trickHistory: [],
    scores: { 0: 6, 1: 3 },
    currentRoundPoints: 1,
    turnSeatId: ownedSeatIds[0],
    dealerSeatId: 1,
    trickStarterSeatId: ownedSeatIds[0],
    vira: null,
    manilhaRank: null,
    trucoPending: null,
    availableActions: [
      {
        type: 'PLAY_CARD',
        seatId: ownedSeatIds[0],
        cardIds: ['A-Ouros'],
        canPlayCovered: false,
      },
    ],
    connectionState: 'connected',
    message: 'Sua vez.',
    lastRoundWinnerTeam: null,
    ...overrides,
  };
}
