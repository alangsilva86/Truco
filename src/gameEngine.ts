import { Card, Rank, Suit, PlayerId } from './types';

export const SUITS: Suit[] = ['Ouros', 'Espadas', 'Copas', 'Paus'];
export const RANKS: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

export const RANK_VALUE: Record<Rank, number> = {
  '4': 0, '5': 1, '6': 2, '7': 3, 'Q': 4, 'J': 5, 'K': 6, 'A': 7, '2': 8, '3': 9
};

export const SUIT_VALUE: Record<Suit, number> = {
  'Ouros': 0, 'Espadas': 1, 'Copas': 2, 'Paus': 3
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function getManilhaRank(viraRank: Rank): Rank {
  const index = RANKS.indexOf(viraRank);
  return RANKS[(index + 1) % RANKS.length];
}

export function compareCards(c1: Card, c2: Card, manilhaRank: Rank): number {
  const isM1 = c1.rank === manilhaRank;
  const isM2 = c2.rank === manilhaRank;

  if (isM1 && isM2) {
    return SUIT_VALUE[c1.suit] - SUIT_VALUE[c2.suit];
  }
  if (isM1) return 1;
  if (isM2) return -1;

  return RANK_VALUE[c1.rank] - RANK_VALUE[c2.rank];
}

export function getTrickWinner(cards: (Card | null)[], manilhaRank: Rank, firstPlayer: PlayerId): PlayerId | 'tie' {
  let winner: PlayerId | 'tie' = firstPlayer;
  let bestCard = cards[firstPlayer]!;

  for (let i = 1; i < 4; i++) {
    const currentPlayer = ((firstPlayer + i) % 4) as PlayerId;
    const currentCard = cards[currentPlayer];
    if (!currentCard) continue;

    const cmp = compareCards(currentCard, bestCard, manilhaRank);
    if (cmp > 0) {
      bestCard = currentCard;
      winner = currentPlayer;
    } else if (cmp === 0) {
      winner = 'tie';
    }
  }
  return winner;
}
