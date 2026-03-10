import {
  AvailableAction,
  Card,
  ClientGameView,
  ClientMatchEvent,
  GameCommand,
  GamePhase,
  PendingTrucoState,
  PlayerInfo,
  RematchCommand,
  SeatId,
  TeamId,
  TEAM_SEATS,
  TrickView,
  getPartnerSeat,
  getTeamForSeat,
} from '@truco/contracts';
import {
  PlayedCardInternal,
  TrickInternal,
  compareCards,
  createDeck,
  getManilhaRank,
  getNextTrucoValue,
  getOrderedRoundCards,
  getRoundWinnerTeam,
  getTrickWinner,
  getTrucoLabel,
  sanitizePlayedCardView,
} from './cards.js';

interface MatchSetup {
  matchId: string;
  players: Record<SeatId, PlayerInfo>;
}

type PendingTransition =
  | { kind: 'START_ROUND'; dealerSeatId: SeatId }
  | { kind: 'ADVANCE_TRICK'; nextTurnSeatId: SeatId }
  | null;

export interface MatchState {
  matchId: string;
  seed: number;
  rngState: number;
  phase: GamePhase;
  players: Record<SeatId, PlayerInfo>;
  scores: Record<TeamId, number>;
  hands: Record<SeatId, Card[]>;
  deck: Card[];
  vira: Card | null;
  manilhaRank: Card['rank'] | null;
  dealerSeatId: SeatId | null;
  trickStarterSeatId: SeatId | null;
  turnSeatId: SeatId | null;
  currentRoundPoints: number;
  lastTrucoBySeatId: SeatId | null;
  pendingTruco: PendingTrucoState | null;
  roundCards: Partial<Record<SeatId, PlayedCardInternal>>;
  trickHistory: TrickInternal[];
  trickWinners: Array<SeatId | 'tie'>;
  pendingTransition: PendingTransition;
  eventCursor: number;
  stateVersion: number;
  message: string;
  gameWinnerTeam: TeamId | null;
  lastRoundWinnerTeam: TeamId | null;
  rematchVotes: Record<TeamId, boolean>;
}

export interface ApplyCommandResult {
  nextState: MatchState;
  events: ClientMatchEvent[];
  error?: string;
}

function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

function randomFromState(state: MatchState): number {
  let t = (state.rngState += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffleDeck(seedState: MatchState): Card[] {
  const deck = createDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFromState(seedState) * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function withStateVersion(state: MatchState, events: ClientMatchEvent[]): ApplyCommandResult {
  state.stateVersion += 1;
  return { nextState: state, events };
}

function createEvent<TType extends ClientMatchEvent['type']>(
  state: MatchState,
  type: TType,
  payload: Extract<ClientMatchEvent, { type: TType }>['payload'],
): Extract<ClientMatchEvent, { type: TType }> {
  state.eventCursor += 1;
  return {
    cursor: state.eventCursor,
    stateVersion: state.stateVersion + 1,
    timestamp: Date.now(),
    type,
    payload,
  } as Extract<ClientMatchEvent, { type: TType }>;
}

function queueNextRound(state: MatchState, nextDealerSeatId: SeatId): void {
  state.phase = 'ROUND_END';
  state.pendingTransition = { kind: 'START_ROUND', dealerSeatId: nextDealerSeatId };
}

function startRound(state: MatchState, dealerSeatId: SeatId): ClientMatchEvent[] {
  const events: ClientMatchEvent[] = [];
  const deck = shuffleDeck(state);
  const hands: Record<SeatId, Card[]> = {
    0: deck.splice(0, 3),
    1: deck.splice(0, 3),
    2: deck.splice(0, 3),
    3: deck.splice(0, 3),
  };
  const vira = deck.shift() ?? null;

  if (!vira) {
    throw new Error('Failed to draw the vira card.');
  }

  const nextTurnSeatId = ((dealerSeatId + 1) % 4) as SeatId;

  state.deck = deck;
  state.hands = hands;
  state.vira = vira;
  state.manilhaRank = getManilhaRank(vira.rank);
  state.dealerSeatId = dealerSeatId;
  state.trickStarterSeatId = nextTurnSeatId;
  state.turnSeatId = nextTurnSeatId;
  state.currentRoundPoints = 1;
  state.lastTrucoBySeatId = null;
  state.pendingTruco = null;
  state.roundCards = {};
  state.trickHistory = [];
  state.trickWinners = [];
  state.pendingTransition = null;
  state.phase = 'PLAYING';
  state.lastRoundWinnerTeam = null;
  state.rematchVotes = { 0: false, 1: false };
  state.message = `Nova rodada. ${state.players[nextTurnSeatId].nickname} começa.`;

  events.push(createEvent(state, 'ROUND_STARTED', {
    dealerSeatId,
    turnSeatId: nextTurnSeatId,
    currentRoundPoints: state.currentRoundPoints,
  }));

  return events;
}

function beginDealing(state: MatchState, dealerSeatId: SeatId): void {
  state.phase = 'DEALING';
  state.pendingTransition = { kind: 'START_ROUND', dealerSeatId };
  state.message = 'Distribuindo as cartas...';
}

function getRoundCardsView(state: MatchState): TrickView['cards'] {
  return getOrderedRoundCards(state.roundCards).map(sanitizePlayedCardView);
}

function resolveTrickAndMaybeRound(state: MatchState): ClientMatchEvent[] {
  const events: ClientMatchEvent[] = [];

  if (!state.manilhaRank || state.trickStarterSeatId === null) {
    return events;
  }

  const trickCards = getOrderedRoundCards(state.roundCards);
  const winnerSeatId = getTrickWinner(state.roundCards, state.manilhaRank, state.trickStarterSeatId);
  const nextTurnSeatId = winnerSeatId === 'tie' ? state.trickStarterSeatId : winnerSeatId;

  state.trickHistory.push({
    winnerSeatId,
    cards: trickCards,
  });
  state.trickWinners.push(winnerSeatId);

  events.push(createEvent(state, 'TRICK_WON', {
    winnerSeatId,
    nextTurnSeatId,
    cards: trickCards.map(sanitizePlayedCardView),
  }));

  const handStarterSeatId = ((state.dealerSeatId! + 1) % 4) as SeatId;
  const roundWinnerTeam = getRoundWinnerTeam(state.trickWinners, handStarterSeatId);

  if (roundWinnerTeam === null) {
    state.phase = 'TRICK_END';
    state.pendingTransition = { kind: 'ADVANCE_TRICK', nextTurnSeatId };
    state.message = winnerSeatId === 'tie'
      ? 'Vaza empatada.'
      : `${state.players[winnerSeatId].nickname} venceu a vaza.`;
    return events;
  }

  state.lastRoundWinnerTeam = roundWinnerTeam;
  state.scores[roundWinnerTeam] += state.currentRoundPoints;

  const awardedPoints = state.currentRoundPoints;

  events.push(createEvent(state, 'ROUND_ENDED', {
    winnerTeam: roundWinnerTeam,
    awardedPoints,
    scores: { ...state.scores },
  }));

  if (state.scores[roundWinnerTeam] >= 12) {
    state.phase = 'GAME_END';
    state.pendingTransition = null;
    state.gameWinnerTeam = roundWinnerTeam;
    state.message = `${state.players[TEAM_SEATS[roundWinnerTeam][0]].nickname} venceu o jogo.`;
    events.push(createEvent(state, 'GAME_ENDED', {
      winnerTeam: roundWinnerTeam,
      scores: { ...state.scores },
    }));
    return events;
  }

  queueNextRound(state, ((state.dealerSeatId! + 1) % 4) as SeatId);
  state.message = roundWinnerTeam === 0 ? 'Time 0 venceu a rodada.' : 'Time 1 venceu a rodada.';
  return events;
}

function resolveTrucoRun(state: MatchState): ClientMatchEvent[] {
  const events: ClientMatchEvent[] = [];

  if (!state.pendingTruco || state.dealerSeatId === null) {
    return events;
  }

  const runnerTeam = state.pendingTruco.responseTeam;
  const awardedTeam = getTeamForSeat(state.pendingTruco.requestedBySeatId);
  const awardedPoints = state.pendingTruco.acceptedValue;

  state.pendingTruco = null;
  state.scores[awardedTeam] += awardedPoints;
  state.lastRoundWinnerTeam = awardedTeam;

  events.push(createEvent(state, 'TRUCO_RUN', {
    runnerTeam,
    awardedTeam,
    awardedPoints,
  }));

  events.push(createEvent(state, 'ROUND_ENDED', {
    winnerTeam: awardedTeam,
    awardedPoints,
    scores: { ...state.scores },
  }));

  if (state.scores[awardedTeam] >= 12) {
    state.phase = 'GAME_END';
    state.pendingTransition = null;
    state.gameWinnerTeam = awardedTeam;
    state.message = `${state.players[TEAM_SEATS[awardedTeam][0]].nickname} venceu o jogo.`;
    events.push(createEvent(state, 'GAME_ENDED', {
      winnerTeam: awardedTeam,
      scores: { ...state.scores },
    }));
    return events;
  }

  queueNextRound(state, ((state.dealerSeatId + 1) % 4) as SeatId);
  state.message = `Time ${awardedTeam} ganhou ${awardedPoints} ponto(s).`;
  return events;
}

function resolveRaiseSeat(teamId: TeamId): SeatId {
  return TEAM_SEATS[teamId][0];
}

function canSeatPlayCovered(state: MatchState): boolean {
  return state.trickHistory.length > 0;
}

function createInvalidResult(state: MatchState, error: string): ApplyCommandResult {
  return { nextState: state, events: [], error };
}

function playCard(state: MatchState, command: Extract<GameCommand, { type: 'PLAY_CARD' }>): ApplyCommandResult {
  const nextState = cloneState(state);
  const { seatId, cardId, mode } = command.payload;

  if (nextState.phase !== 'PLAYING') {
    return createInvalidResult(state, 'Round is not accepting card plays.');
  }

  if (nextState.turnSeatId !== seatId) {
    return createInvalidResult(state, 'It is not this seat turn.');
  }

  const hand = nextState.hands[seatId];
  const cardIndex = hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    return createInvalidResult(state, 'Card not found in hand.');
  }

  if (mode === 'covered' && !canSeatPlayCovered(nextState)) {
    return createInvalidResult(state, 'Covered card is not available on the first trick.');
  }

  const [card] = hand.splice(cardIndex, 1);
  nextState.roundCards[seatId] = {
    seatId,
    card,
    hidden: mode === 'covered',
  };
  nextState.message = `${nextState.players[seatId].nickname} jogou.`;

  const events: ClientMatchEvent[] = [
    createEvent(nextState, 'CARD_PLAYED', {
      seatId,
      card: mode === 'covered' ? null : card,
      hidden: mode === 'covered',
    }),
  ];

  const playedCardsCount = getOrderedRoundCards(nextState.roundCards).length;

  if (playedCardsCount === 4) {
    events.push(...resolveTrickAndMaybeRound(nextState));
  } else {
    nextState.turnSeatId = ((seatId + 1) % 4) as SeatId;
  }

  return withStateVersion(nextState, events);
}

function requestTruco(state: MatchState, command: Extract<GameCommand, { type: 'REQUEST_TRUCO' }>): ApplyCommandResult {
  const nextState = cloneState(state);
  const { seatId } = command.payload;

  if (nextState.phase !== 'PLAYING') {
    return createInvalidResult(state, 'Truco can only be requested during play.');
  }

  if (nextState.turnSeatId !== seatId) {
    return createInvalidResult(state, 'Only the active seat can request truco.');
  }

  const requestingTeam = getTeamForSeat(seatId);

  if (
    nextState.lastTrucoBySeatId !== null &&
    getTeamForSeat(nextState.lastTrucoBySeatId) === requestingTeam
  ) {
    return createInvalidResult(state, 'The same team cannot raise consecutively.');
  }

  const requestedValue = getNextTrucoValue(nextState.currentRoundPoints);

  if (requestedValue > 12) {
    return createInvalidResult(state, 'Round is already worth the maximum value.');
  }

  nextState.pendingTruco = {
    requestedBySeatId: seatId,
    requestedValue,
    acceptedValue: nextState.currentRoundPoints,
    responseTeam: requestingTeam === 0 ? 1 : 0,
  };
  nextState.lastTrucoBySeatId = seatId;
  nextState.phase = 'TRUCO_DECISION';
  nextState.message = `${getTrucoLabel(requestedValue)}!`;

  return withStateVersion(nextState, [
    createEvent(nextState, 'TRUCO_REQUESTED', {
      seatId,
      requestedValue,
      responseTeam: nextState.pendingTruco.responseTeam,
    }),
  ]);
}

function respondTruco(state: MatchState, command: Extract<GameCommand, { type: 'RESPOND_TRUCO' }>): ApplyCommandResult {
  if (!state.pendingTruco) {
    return createInvalidResult(state, 'There is no pending truco decision.');
  }

  const nextState = cloneState(state);
  const { action } = command.payload;

  if (!nextState.pendingTruco) {
    return createInvalidResult(state, 'There is no pending truco decision.');
  }

  if (action === 'accept') {
    nextState.currentRoundPoints = nextState.pendingTruco.requestedValue;
    nextState.pendingTruco = null;
    nextState.phase = 'PLAYING';
    nextState.message = 'Truco aceito.';

    return withStateVersion(nextState, [
      createEvent(nextState, 'TRUCO_ACCEPTED', {
        acceptedValue: nextState.currentRoundPoints,
      }),
    ]);
  }

  if (action === 'run') {
    return withStateVersion(nextState, resolveTrucoRun(nextState));
  }

  const raisedValue = getNextTrucoValue(nextState.pendingTruco.requestedValue);

  if (raisedValue > 12) {
    return createInvalidResult(state, 'No higher truco value is available.');
  }

  const raisingTeam = nextState.pendingTruco.responseTeam;
  const seatId = resolveRaiseSeat(raisingTeam);
  nextState.currentRoundPoints = nextState.pendingTruco.requestedValue;
  nextState.pendingTruco = {
    requestedBySeatId: seatId,
    requestedValue: raisedValue,
    acceptedValue: nextState.currentRoundPoints,
    responseTeam: raisingTeam === 0 ? 1 : 0,
  };
  nextState.lastTrucoBySeatId = seatId;
  nextState.phase = 'TRUCO_DECISION';
  nextState.message = `${getTrucoLabel(raisedValue)}!`;

  return withStateVersion(nextState, [
    createEvent(nextState, 'TRUCO_RAISED', {
      seatId,
      requestedValue: raisedValue,
      responseTeam: nextState.pendingTruco.responseTeam,
    }),
  ]);
}

function rematch(state: MatchState, command: RematchCommand): ApplyCommandResult {
  if (state.phase !== 'GAME_END') {
    return createInvalidResult(state, 'Rematch is only available after the game ends.');
  }

  const nextState = cloneState(state);
  const teamId = getTeamForSeat(command.payload.requestedBySeatId);
  nextState.rematchVotes[teamId] = true;

  if (nextState.rematchVotes[0] && nextState.rematchVotes[1]) {
    nextState.scores = { 0: 0, 1: 0 };
    nextState.gameWinnerTeam = null;
    nextState.lastRoundWinnerTeam = null;
    beginDealing(nextState, ((nextState.dealerSeatId ?? 3) + 1) % 4 as SeatId);
    return withStateVersion(nextState, []);
  }

  return withStateVersion(nextState, []);
}

export function createMatch(seed: number, setup: MatchSetup): MatchState {
  return {
    matchId: setup.matchId,
    seed,
    rngState: seed,
    phase: 'WAITING_PLAYERS',
    players: structuredClone(setup.players),
    scores: { 0: 0, 1: 0 },
    hands: { 0: [], 1: [], 2: [], 3: [] },
    deck: [],
    vira: null,
    manilhaRank: null,
    dealerSeatId: null,
    trickStarterSeatId: null,
    turnSeatId: null,
    currentRoundPoints: 1,
    lastTrucoBySeatId: null,
    pendingTruco: null,
    roundCards: {},
    trickHistory: [],
    trickWinners: [],
    pendingTransition: null,
    eventCursor: 0,
    stateVersion: 0,
    message: 'Aguardando jogadores...',
    gameWinnerTeam: null,
    lastRoundWinnerTeam: null,
    rematchVotes: { 0: false, 1: false },
  };
}

export function beginMatch(state: MatchState, dealerSeatId: SeatId = 0): ApplyCommandResult {
  const nextState = cloneState(state);
  beginDealing(nextState, dealerSeatId);
  nextState.stateVersion += 1;
  return { nextState, events: [] };
}

export function applyPendingTransition(state: MatchState): ApplyCommandResult {
  if (!state.pendingTransition) {
    return { nextState: state, events: [] };
  }

  const nextState = cloneState(state);

  if (!nextState.pendingTransition) {
    return { nextState: state, events: [] };
  }

  if (nextState.pendingTransition.kind === 'START_ROUND') {
    const events = startRound(nextState, nextState.pendingTransition.dealerSeatId);
    return withStateVersion(nextState, events);
  }

  nextState.roundCards = {};
  nextState.phase = 'PLAYING';
  nextState.trickStarterSeatId = nextState.pendingTransition.nextTurnSeatId;
  nextState.turnSeatId = nextState.pendingTransition.nextTurnSeatId;
  nextState.pendingTransition = null;
  nextState.message = `${nextState.players[nextState.turnSeatId].nickname} joga.`;
  nextState.stateVersion += 1;
  return { nextState, events: [] };
}

export function updateTeamConnection(state: MatchState, teamId: TeamId, connected: boolean): ApplyCommandResult {
  const nextState = cloneState(state);
  const affectedSeats = TEAM_SEATS[teamId];
  const events: ClientMatchEvent[] = [];

  for (const seatId of affectedSeats) {
    nextState.players[seatId].connected = connected;
  }

  const nickname = nextState.players[affectedSeats[0]].nickname;
  events.push(createEvent(nextState, connected ? 'PLAYER_RECONNECTED' : 'PLAYER_DROPPED', {
    teamId,
    nickname,
  }));

  return withStateVersion(nextState, events);
}

export function forfeitMatch(state: MatchState, loserTeamId: TeamId): ApplyCommandResult {
  const nextState = cloneState(state);
  const winnerTeam = loserTeamId === 0 ? 1 : 0;

  nextState.phase = 'GAME_END';
  nextState.pendingTransition = null;
  nextState.pendingTruco = null;
  nextState.gameWinnerTeam = winnerTeam;
  nextState.lastRoundWinnerTeam = winnerTeam;
  nextState.message = `${nextState.players[TEAM_SEATS[loserTeamId][0]].nickname} abandonou a partida.`;
  nextState.scores[winnerTeam] = Math.max(nextState.scores[winnerTeam], 12);

  return withStateVersion(nextState, [
    createEvent(nextState, 'GAME_ENDED', {
      winnerTeam,
      scores: { ...nextState.scores },
    }),
  ]);
}

export function applyCommand(state: MatchState, command: GameCommand): ApplyCommandResult {
  switch (command.type) {
    case 'PLAY_CARD':
      return playCard(state, command);
    case 'REQUEST_TRUCO':
      return requestTruco(state, command);
    case 'RESPOND_TRUCO':
      return respondTruco(state, command);
    case 'REMATCH':
      return rematch(state, command);
    default:
      return createInvalidResult(state, 'Unsupported command.');
  }
}

export function getLegalActions(state: MatchState, viewerTeamId: TeamId): AvailableAction[] {
  const actions: AvailableAction[] = [];

  if (state.phase === 'PLAYING' && state.turnSeatId !== null && getTeamForSeat(state.turnSeatId) === viewerTeamId) {
    actions.push({
      type: 'PLAY_CARD',
      seatId: state.turnSeatId,
      cardIds: state.hands[state.turnSeatId].map((card) => card.id),
      canPlayCovered: canSeatPlayCovered(state),
    });

    if (
      state.pendingTruco === null &&
      (
        state.lastTrucoBySeatId === null ||
        getTeamForSeat(state.lastTrucoBySeatId) !== viewerTeamId
      )
    ) {
      const nextValue = getNextTrucoValue(state.currentRoundPoints);
      if (nextValue <= 12) {
        actions.push({
          type: 'REQUEST_TRUCO',
          seatIds: TEAM_SEATS[viewerTeamId],
          nextValue,
        });
      }
    }
  }

  if (state.phase === 'TRUCO_DECISION' && state.pendingTruco?.responseTeam === viewerTeamId) {
    const raiseValue = getNextTrucoValue(state.pendingTruco.requestedValue);
    actions.push({
      type: 'RESPOND_TRUCO',
      actions: raiseValue <= 12 ? ['accept', 'raise', 'run'] : ['accept', 'run'],
      requestedValue: state.pendingTruco.requestedValue,
      currentAcceptedValue: state.pendingTruco.acceptedValue,
    });
  }

  return actions;
}

export function projectClientView(state: MatchState, viewerTeamId: TeamId): Omit<
  ClientGameView,
  'roomCode' | 'roomLifecycle' | 'ownedSeatIds' | 'connectionState'
> {
  const visibleHands: Partial<Record<SeatId, Card[]>> = {};
  const opponentHandCounts: Partial<Record<SeatId, number>> = {};

  for (const seatId of TEAM_SEATS[viewerTeamId]) {
    visibleHands[seatId] = structuredClone(state.hands[seatId]);
  }

  for (const seatId of TEAM_SEATS[viewerTeamId === 0 ? 1 : 0]) {
    opponentHandCounts[seatId] = state.hands[seatId].length;
  }

  return {
    matchId: state.matchId,
    stateVersion: state.stateVersion,
    eventCursor: state.eventCursor,
    gamePhase: state.phase,
    players: structuredClone(state.players),
    visibleHands,
    opponentHandCounts,
    roundCards: getRoundCardsView(state),
    trickHistory: state.trickHistory.map((trick) => ({
      winnerSeatId: trick.winnerSeatId,
      cards: trick.cards.map(sanitizePlayedCardView),
    })),
    scores: { ...state.scores },
    currentRoundPoints: state.currentRoundPoints,
    turnSeatId: state.turnSeatId,
    dealerSeatId: state.dealerSeatId,
    trickStarterSeatId: state.trickStarterSeatId,
    vira: state.vira,
    manilhaRank: state.manilhaRank,
    trucoPending: state.pendingTruco ? structuredClone(state.pendingTruco) : null,
    availableActions: getLegalActions(state, viewerTeamId),
    message: state.message,
    lastRoundWinnerTeam: state.lastRoundWinnerTeam,
  };
}

export function getViewerTeamForSeat(seatId: SeatId): TeamId {
  return getTeamForSeat(seatId);
}

export function getSeatLayoutForTeam(teamId: TeamId): {
  bottom: SeatId;
  top: SeatId;
  left: SeatId;
  right: SeatId;
} {
  if (teamId === 0) {
    return {
      bottom: 0,
      top: getPartnerSeat(0),
      left: 1,
      right: 3,
    };
  }

  return {
    bottom: 1,
    top: getPartnerSeat(1),
    left: 2,
    right: 0,
  };
}
