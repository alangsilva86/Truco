export type Suit = 'Ouros' | 'Espadas' | 'Copas' | 'Paus';
export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export type PlayerId = 0 | 1 | 2 | 3; // 0 is User, 1 is Left, 2 is Partner (Top), 3 is Right

export interface Player {
  id: PlayerId;
  name: string;
  hand: Card[];
  team: 0 | 1; // 0: User + Partner, 1: AI Left + AI Right
}

export interface Trick {
  cards: (Card | null)[];
  winner: PlayerId | 'tie';
}

export interface GameState {
  deck: Card[];
  players: Player[];
  vira: Card | null;
  manilhaRank: Rank | null;
  turn: PlayerId;
  dealer: PlayerId;
  roundCards: (Card | null)[]; // Cards played in the current "queda" (trick)
  trickHistory: Trick[];
  roundWinner: PlayerId | null;
  scores: { team0: number; team1: number };
  currentRoundPoints: number; // 1, 3, 6, 9, 12
  tricksWon: { team0: number; team1: number };
  phase: 'dealing' | 'playing' | 'roundEnd' | 'gameEnd';
  lastTrucoBy: PlayerId | null;
  trucoPending: boolean;
  message: string;
  logs: string[];
}
