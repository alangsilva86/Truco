import {
  AvailableAction,
  Card,
  ClientGameView,
  ClientMatchEvent,
  ConnectionState,
  PendingTrucoState,
  PlayedCardView,
  PlayerInfo,
  SeatId,
  TEAM_SEATS,
  TeamId,
} from '@truco/contracts';

type RawSchemaState = Record<string, unknown>;

function toCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || typeof candidate.rank !== 'string' || typeof candidate.suit !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    rank: candidate.rank as Card['rank'],
    suit: candidate.suit as Card['suit'],
  };
}

function toPlayedCard(raw: unknown): PlayedCardView | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.seatId !== 'number' || typeof candidate.hidden !== 'boolean') {
    return null;
  }

  return {
    seatId: candidate.seatId as SeatId,
    hidden: candidate.hidden,
    card: candidate.cardId ? {
      id: String(candidate.cardId),
      rank: String(candidate.rank) as Card['rank'],
      suit: String(candidate.suit) as Card['suit'],
    } : null,
  };
}

function toPlayerMap(raw: unknown): Record<SeatId, PlayerInfo> {
  const base: Record<SeatId, PlayerInfo> = {
    0: { seatId: 0, teamId: 0, nickname: 'Aguardando...', connected: false },
    1: { seatId: 1, teamId: 1, nickname: 'Aguardando...', connected: false },
    2: { seatId: 2, teamId: 0, nickname: 'Aguardando...', connected: false },
    3: { seatId: 3, teamId: 1, nickname: 'Aguardando...', connected: false },
  };

  if (!raw || typeof raw !== 'object') {
    return base;
  }

  for (const entry of Object.values(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const player = entry as Record<string, unknown>;
    if (typeof player.seatId !== 'number' || typeof player.teamId !== 'number' || typeof player.nickname !== 'string') {
      continue;
    }

    const seatId = player.seatId as SeatId;
    base[seatId] = {
      seatId,
      teamId: player.teamId as TeamId,
      nickname: player.nickname,
      connected: Boolean(player.connected),
    };
  }

  return base;
}

function parseJsonArray<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toCardList(raw: unknown): Card[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  return Object.values(raw as Record<string, unknown>)
    .map(toCard)
    .filter((card): card is Card => Boolean(card));
}

function toRoundCards(raw: unknown): PlayedCardView[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  return Object.values(raw as Record<string, unknown>)
    .map(toPlayedCard)
    .filter((card): card is PlayedCardView => Boolean(card));
}

export function buildClientView(rawState: unknown, connectionState: ConnectionState): ClientGameView | null {
  if (!rawState || typeof rawState !== 'object') {
    return null;
  }

  const state = rawState as RawSchemaState;
  const team0OwnedSeats = parseJsonArray<SeatId[]>(state.team0OwnedSeatIdsJson, []);
  const team1OwnedSeats = parseJsonArray<SeatId[]>(state.team1OwnedSeatIdsJson, []);
  const ownedSeatIds = team0OwnedSeats.length > 0 ? team0OwnedSeats : team1OwnedSeats;

  if (ownedSeatIds.length === 0) {
    return null;
  }

  const teamId = TEAM_SEATS[0].includes(ownedSeatIds[0]) ? 0 : 1;
  const visibleHands: Partial<Record<SeatId, Card[]>> = {};

  if (teamId === 0) {
    visibleHands[0] = parseJsonArray<Card[]>(state.team0Seat0HandJson, []);
    visibleHands[2] = parseJsonArray<Card[]>(state.team0Seat2HandJson, []);
  } else {
    visibleHands[1] = parseJsonArray<Card[]>(state.team1Seat1HandJson, []);
    visibleHands[3] = parseJsonArray<Card[]>(state.team1Seat3HandJson, []);
  }

  const opponentHandCounts: Partial<Record<SeatId, number>> = {
    0: Number(state.seat0OpponentCount ?? 0),
    1: Number(state.seat1OpponentCount ?? 0),
    2: Number(state.seat2OpponentCount ?? 0),
    3: Number(state.seat3OpponentCount ?? 0),
  };

  const availableActions = parseJsonArray<AvailableAction[]>(
    teamId === 0 ? state.team0AvailableActionsJson : state.team1AvailableActionsJson,
    [],
  );

  const pendingTruco: PendingTrucoState | null = state.pendingTrucoActive
    ? {
        requestedBySeatId: Number(state.pendingTrucoRequestedBySeatId) as SeatId,
        requestedValue: Number(state.pendingTrucoRequestedValue ?? 0),
        acceptedValue: Number(state.pendingTrucoAcceptedValue ?? 0),
        responseTeam: Number(state.pendingTrucoResponseTeam) as TeamId,
      }
    : null;

  return {
    matchId: String(state.matchId ?? ''),
    roomCode: String(state.roomCode ?? ''),
    stateVersion: Number(state.stateVersion ?? 0),
    eventCursor: Number(state.eventCursor ?? 0),
    gamePhase: String(state.gamePhase ?? 'WAITING_PLAYERS') as ClientGameView['gamePhase'],
    roomLifecycle: String(state.roomLifecycle ?? 'OPEN') as ClientGameView['roomLifecycle'],
    ownedSeatIds,
    players: toPlayerMap(state.players),
    visibleHands,
    opponentHandCounts,
    roundCards: toRoundCards(state.roundCards),
    trickHistory: Object.values((state.trickHistory ?? {}) as Record<string, unknown>).map((rawTrick) => {
      const trick = rawTrick as Record<string, unknown>;
      return {
        winnerSeatId: trick.isTie ? 'tie' : Number(trick.winnerSeatId) as SeatId,
        cards: toRoundCards(trick.cards),
      };
    }),
    scores: {
      0: Number(state.scoreTeam0 ?? 0),
      1: Number(state.scoreTeam1 ?? 0),
    },
    currentRoundPoints: Number(state.currentRoundPoints ?? 1),
    turnSeatId: Number(state.turnSeatId ?? -1) >= 0 ? Number(state.turnSeatId) as SeatId : null,
    dealerSeatId: Number(state.dealerSeatId ?? -1) >= 0 ? Number(state.dealerSeatId) as SeatId : null,
    trickStarterSeatId: Number(state.trickStarterSeatId ?? -1) >= 0 ? Number(state.trickStarterSeatId) as SeatId : null,
    vira: state.viraCardId ? {
      id: String(state.viraCardId),
      rank: String(state.viraRank) as Card['rank'],
      suit: String(state.viraSuit) as Card['suit'],
    } : null,
    manilhaRank: state.manilhaRank ? String(state.manilhaRank) as Card['rank'] : null,
    trucoPending: pendingTruco,
    availableActions,
    connectionState,
    message: String(state.message ?? ''),
    lastRoundWinnerTeam: Number(state.lastRoundWinnerTeam ?? -1) >= 0
      ? Number(state.lastRoundWinnerTeam) as TeamId
      : null,
  };
}

export function describeEvent(event: ClientMatchEvent): string {
  switch (event.type) {
    case 'ROUND_STARTED':
      return `Nova rodada valendo ${event.payload.currentRoundPoints}`;
    case 'CARD_PLAYED':
      return event.payload.hidden ? 'Carta coberta jogada' : `Carta aberta na mesa`;
    case 'TRUCO_REQUESTED':
      return `Pedido de ${event.payload.requestedValue}`;
    case 'TRUCO_ACCEPTED':
      return `Truco aceito: ${event.payload.acceptedValue}`;
    case 'TRUCO_RAISED':
      return `Aumento para ${event.payload.requestedValue}`;
    case 'TRUCO_RUN':
      return `Correram da rodada`;
    case 'TRICK_WON':
      return event.payload.winnerSeatId === 'tie' ? 'Vaza empatada' : `Vaza resolvida`;
    case 'ROUND_ENDED':
      return `Rodada encerrada`;
    case 'GAME_ENDED':
      return `Partida encerrada`;
    case 'PLAYER_DROPPED':
      return `${event.payload.nickname} desconectou`;
    case 'PLAYER_RECONNECTED':
      return `${event.payload.nickname} voltou`;
    default:
      return 'Evento';
  }
}
