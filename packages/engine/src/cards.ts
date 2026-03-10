import {
  Card,
  PlayedCardView,
  Rank,
  RANKS,
  SeatId,
  Suit,
  SUITS,
  getTeamForSeat,
} from '@truco/contracts';

export const RANK_VALUE: Record<Rank, number> = {
  '4': 0,
  '5': 1,
  '6': 2,
  '7': 3,
  Q: 4,
  J: 5,
  K: 6,
  A: 7,
  '2': 8,
  '3': 9,
};

export const SUIT_VALUE: Record<Suit, number> = {
  Ouros: 0,
  Espadas: 1,
  Copas: 2,
  Paus: 3,
};

export interface PlayedCardInternal {
  seatId: SeatId;
  hidden: boolean;
  card: Card;
}

export interface TrickInternal {
  winnerSeatId: SeatId | 'tie';
  cards: PlayedCardInternal[];
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function getManilhaRank(viraRank: Rank): Rank {
  const index = RANKS.indexOf(viraRank);
  return RANKS[(index + 1) % RANKS.length];
}

export function compareCards(
  left: Card,
  right: Card,
  manilhaRank: Rank,
): number {
  const leftIsManilha = left.rank === manilhaRank;
  const rightIsManilha = right.rank === manilhaRank;

  if (leftIsManilha && rightIsManilha) {
    return SUIT_VALUE[left.suit] - SUIT_VALUE[right.suit];
  }

  if (leftIsManilha) {
    return 1;
  }

  if (rightIsManilha) {
    return -1;
  }

  return RANK_VALUE[left.rank] - RANK_VALUE[right.rank];
}

export function comparePlayedCards(
  left: PlayedCardInternal,
  right: PlayedCardInternal,
  manilhaRank: Rank,
): number {
  if (left.hidden && right.hidden) {
    return 0;
  }

  if (left.hidden) {
    return -1;
  }

  if (right.hidden) {
    return 1;
  }

  return compareCards(left.card, right.card, manilhaRank);
}

export function getTrickWinner(
  roundCards: Partial<Record<SeatId, PlayedCardInternal>>,
  manilhaRank: Rank,
  firstPlayer: SeatId,
): SeatId | 'tie' {
  const orderedCards = getOrderedRoundCards(roundCards);
  let winner: SeatId | 'tie' = firstPlayer;
  let bestCard = roundCards[firstPlayer];

  if (!bestCard) {
    throw new Error(
      'Cannot resolve trick winner without the first player card.',
    );
  }

  for (let offset = 1; offset < orderedCards.length; offset += 1) {
    const currentSeatId = ((firstPlayer + offset) % 4) as SeatId;
    const currentCard = roundCards[currentSeatId];

    if (!currentCard) {
      continue;
    }

    const comparison = comparePlayedCards(currentCard, bestCard, manilhaRank);

    if (comparison > 0) {
      bestCard = currentCard;
      winner = currentSeatId;
    } else if (comparison === 0) {
      winner = 'tie';
    }
  }

  return winner;
}

export function getRoundWinnerTeam(
  trickWinners: Array<SeatId | 'tie'>,
  handStarterSeatId: SeatId,
): 0 | 1 | null {
  const teamResults = trickWinners.map((winnerSeatId) =>
    winnerSeatId === 'tie' ? 'tie' : getTeamForSeat(winnerSeatId),
  );

  const team0Wins = teamResults.filter((teamId) => teamId === 0).length;
  const team1Wins = teamResults.filter((teamId) => teamId === 1).length;

  if (team0Wins >= 2) {
    return 0;
  }

  if (team1Wins >= 2) {
    return 1;
  }

  if (teamResults.length === 1) {
    return null;
  }

  const [first, second, third] = teamResults;
  const handStarterTeam = getTeamForSeat(handStarterSeatId);

  if (teamResults.length === 2) {
    if (first === 'tie' && second !== 'tie') {
      return second;
    }

    if (first !== 'tie' && second === 'tie') {
      return first;
    }

    return null;
  }

  if (first === 'tie' && second === 'tie') {
    return third === 'tie' || third === undefined ? handStarterTeam : third;
  }

  if (third === 'tie') {
    if (first !== 'tie') {
      return first;
    }

    if (second !== 'tie') {
      return second;
    }

    return handStarterTeam;
  }

  return third ?? handStarterTeam;
}

export function getNextTrucoValue(current: number): number {
  if (current === 1) {
    return 3;
  }

  if (current === 3) {
    return 6;
  }

  if (current === 6) {
    return 9;
  }

  return 12;
}

export function getTrucoLabel(value: number): string {
  if (value === 3) {
    return 'TRUCO';
  }

  if (value === 6) {
    return 'SEIS';
  }

  if (value === 9) {
    return 'NOVE';
  }

  return 'DOZE';
}

export function sanitizePlayedCardView(
  card: PlayedCardInternal,
): PlayedCardView {
  return {
    seatId: card.seatId,
    hidden: card.hidden,
    card: card.hidden ? null : card.card,
  };
}

export function getOrderedRoundCards(
  roundCards: Partial<Record<SeatId, PlayedCardInternal>>,
): PlayedCardInternal[] {
  return ([0, 1, 2, 3] as SeatId[])
    .map((seatId) => roundCards[seatId])
    .filter((card): card is PlayedCardInternal => Boolean(card));
}
