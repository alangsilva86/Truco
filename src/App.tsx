import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, MessageCircle, RotateCcw, Play, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card, Player, GameState, PlayerId, Rank } from './types';
import { createDeck, shuffle, getManilhaRank, compareCards, getTrickWinner } from './gameEngine';
import { CardComponent } from './components/Card';

const INITIAL_STATE: GameState = {
  deck: [],
  players: [
    { id: 0, name: 'Você', hand: [], team: 0 },
    { id: 1, name: 'AI Esquerda', hand: [], team: 1 },
    { id: 2, name: 'Parceiro', hand: [], team: 0 },
    { id: 3, name: 'AI Direita', hand: [], team: 1 },
  ],
  vira: null,
  manilhaRank: null,
  turn: 0,
  dealer: 0,
  roundCards: [null, null, null, null],
  roundWinner: null,
  scores: { team0: 0, team1: 0 },
  currentRoundPoints: 1,
  tricksWon: { team0: 0, team1: 0 },
  phase: 'dealing',
  lastTrucoBy: null,
  trucoPending: false,
  message: 'Bem-vindo ao Truco Premium!',
};

export default function App() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [trickStarter, setTrickStarter] = useState<PlayerId>(1); // Dealer is 0, so first starter is 1

  const startNewRound = useCallback((dealerId: PlayerId) => {
    const deck = shuffle(createDeck());
    const players = INITIAL_STATE.players.map((p, i) => {
      const hand = deck.splice(0, 3);
      return { ...p, hand };
    });
    const vira = deck.splice(0, 1)[0];
    const manilhaRank = getManilhaRank(vira.rank);
    const nextStarter = ((dealerId + 1) % 4) as PlayerId;

    setState(prev => ({
      ...prev,
      deck,
      players,
      vira,
      manilhaRank,
      turn: nextStarter,
      dealer: dealerId,
      roundCards: [null, null, null, null],
      roundWinner: null,
      currentRoundPoints: 1,
      tricksWon: { team0: 0, team1: 0 },
      phase: 'playing',
      lastTrucoBy: null,
      trucoPending: false,
      message: 'Nova rodada! Valendo 1 ponto.',
    }));
    setTrickStarter(nextStarter);
  }, []);

  const playCard = useCallback((playerId: PlayerId, cardIndex: number) => {
    setState(prev => {
      const player = prev.players[playerId];
      const card = player.hand[cardIndex];
      const newHand = player.hand.filter((_, i) => i !== cardIndex);
      const newPlayers = prev.players.map(p => p.id === playerId ? { ...p, hand: newHand } : p);
      const newRoundCards = [...prev.roundCards];
      newRoundCards[playerId] = card;

      return {
        ...prev,
        players: newPlayers,
        roundCards: newRoundCards,
        turn: ((prev.turn + 1) % 4) as PlayerId,
      };
    });
  }, []);

  // Check trick winner
  useEffect(() => {
    const playedCount = state.roundCards.filter(c => c !== null).length;
    if (playedCount === 4 && state.phase === 'playing') {
      const timer = setTimeout(() => {
        const winner = getTrickWinner(state.roundCards, state.manilhaRank!, trickStarter);
        
        let newTricksWon = { ...state.tricksWon };
        let nextTurn: PlayerId;
        let message = '';

        if (winner === 'tie') {
          message = 'Empatou! (Embuchou)';
          nextTurn = trickStarter; // Usually the one who started or next? Standard: next turn is the one who tied?
          // In Truco, if it ties, the winner of the PREVIOUS trick wins the round.
        } else {
          const winningPlayer = state.players[winner];
          if (winningPlayer.team === 0) newTricksWon.team0++;
          else newTricksWon.team1++;
          nextTurn = winner;
          message = `${winningPlayer.name} venceu a vaza!`;
        }

        // Check if round ended
        const { team0, team1 } = newTricksWon;
        let roundEnded = false;
        let roundWinnerTeam: 0 | 1 | null = null;

        if (team0 === 2) { roundEnded = true; roundWinnerTeam = 0; }
        else if (team1 === 2) { roundEnded = true; roundWinnerTeam = 1; }
        else if (team0 + team1 === 3) { // Third trick tie or completed
           roundEnded = true;
           roundWinnerTeam = team0 > team1 ? 0 : 1;
        }

        if (roundEnded) {
          const points = state.currentRoundPoints;
          const newScores = { ...state.scores };
          if (roundWinnerTeam === 0) newScores.team0 += points;
          else newScores.team1 += points;

          if (newScores.team0 >= 12 || newScores.team1 >= 12) {
            setState(prev => ({
              ...prev,
              scores: newScores,
              phase: 'gameEnd',
              message: roundWinnerTeam === 0 ? 'VOCÊS VENCERAM O JOGO!' : 'ELES VENCERAM O JOGO!',
            }));
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          } else {
            setState(prev => ({
              ...prev,
              scores: newScores,
              tricksWon: newTricksWon,
              roundCards: [null, null, null, null],
              message: roundWinnerTeam === 0 ? `Seu time venceu a rodada! (+${points})` : `Eles venceram a rodada! (+${points})`,
            }));
            setTimeout(() => startNewRound(((state.dealer + 1) % 4) as PlayerId), 2000);
          }
        } else {
          setState(prev => ({
            ...prev,
            tricksWon: newTricksWon,
            roundCards: [null, null, null, null],
            turn: nextTurn,
            message,
          }));
          setTrickStarter(nextTurn);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.roundCards, state.phase, state.manilhaRank, trickStarter, state.players, state.tricksWon, state.currentRoundPoints, state.scores, state.dealer, startNewRound]);

  // AI Turn Logic
  useEffect(() => {
    if (state.phase === 'dealing') {
      startNewRound(0);
    }
  }, [state.phase, startNewRound]);

  useEffect(() => {
    if (state.phase === 'playing' && (state.turn === 1 || state.turn === 3) && !state.trucoPending) {
      const aiTimer = setTimeout(() => {
        const aiPlayer = state.players[state.turn];
        if (aiPlayer.hand.length > 0) {
          // Slightly smarter AI: 
          // If first to play, play lowest.
          // If can win, play lowest winning card.
          // Otherwise play lowest.
          let bestIndex = 0;
          const currentTrickCards = state.roundCards.filter(c => c !== null);
          
          if (currentTrickCards.length > 0) {
            // Find best card played so far
            let bestPlayed = currentTrickCards[0]!;
            for (const c of currentTrickCards) {
              if (c && compareCards(c, bestPlayed, state.manilhaRank!) > 0) bestPlayed = c;
            }

            // Find lowest card that beats bestPlayed
            let winIndex = -1;
            for (let i = 0; i < aiPlayer.hand.length; i++) {
              if (compareCards(aiPlayer.hand[i], bestPlayed, state.manilhaRank!) > 0) {
                if (winIndex === -1 || compareCards(aiPlayer.hand[winIndex], aiPlayer.hand[i], state.manilhaRank!) > 0) {
                  winIndex = i;
                }
              }
            }
            if (winIndex !== -1) bestIndex = winIndex;
            else {
              // Can't win, play lowest
              let lowest = 0;
              for (let i = 1; i < aiPlayer.hand.length; i++) {
                if (compareCards(aiPlayer.hand[lowest], aiPlayer.hand[i], state.manilhaRank!) > 0) lowest = i;
              }
              bestIndex = lowest;
            }
          }

          playCard(state.turn, bestIndex);
        }
      }, 1200);
      return () => clearTimeout(aiTimer);
    }
  }, [state.turn, state.phase, state.trucoPending, state.players, playCard, state.roundCards, state.manilhaRank]);

  // AI Truco Logic
  useEffect(() => {
    if (state.phase === 'playing' && (state.turn === 1 || state.turn === 3) && !state.trucoPending && state.lastTrucoBy === null) {
      const aiPlayer = state.players[state.turn];
      const hasManilha = aiPlayer.hand.some(c => c.rank === state.manilhaRank);
      
      if (hasManilha && Math.random() > 0.9) {
        setState(prev => ({
          ...prev,
          trucoPending: true,
          lastTrucoBy: state.turn,
          message: `${aiPlayer.name} pediu TRUCO!`,
        }));
      }
    }
  }, [state.turn, state.phase, state.trucoPending, state.lastTrucoBy, state.players, state.manilhaRank]);

  const handleUserPlay = (cardIndex: number) => {
    if (state.turn === 0 && state.phase === 'playing' && !state.trucoPending) {
      playCard(0, cardIndex);
    }
  };

  const handlePartnerPlay = (cardIndex: number) => {
    if (state.turn === 2 && state.phase === 'playing' && !state.trucoPending) {
      playCard(2, cardIndex);
    }
  };

  const callTruco = () => {
    if (state.phase === 'playing' && !state.trucoPending && state.lastTrucoBy !== 0) {
      setState(prev => ({
        ...prev,
        trucoPending: true,
        lastTrucoBy: 0,
        message: 'TRUCO! Aguardando adversários...',
      }));

      // AI Response to Truco
      setTimeout(() => {
        const accept = Math.random() > 0.3;
        if (accept) {
          setState(prev => ({
            ...prev,
            trucoPending: false,
            currentRoundPoints: prev.currentRoundPoints === 1 ? 3 : prev.currentRoundPoints + 3,
            message: 'Truco aceito!',
          }));
        } else {
          setState(prev => ({
            ...prev,
            trucoPending: false,
            scores: { ...prev.scores, team0: prev.scores.team0 + prev.currentRoundPoints },
            phase: 'roundEnd',
            message: 'Adversários correram!',
          }));
        }
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col">
      {/* Header / Scoreboard */}
      <header className="p-6 flex justify-between items-center bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
            <Trophy className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Truco Royale</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest">Premium Experience</p>
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <div className="text-center">
            <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Seu Time</p>
            <p className="text-3xl font-mono font-bold text-emerald-400">{state.scores.team0}</p>
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="text-center">
            <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Eles</p>
            <p className="text-3xl font-mono font-bold text-rose-400">{state.scores.team1}</p>
          </div>
        </div>

        <button 
          onClick={() => setState(INITIAL_STATE)}
          className="p-3 hover:bg-white/10 rounded-full transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </header>

      {/* Main Table Area */}
      <main className="flex-1 relative flex items-center justify-center p-4">
        {/* The Table Surface */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[80%] aspect-square max-w-[800px] rounded-full bg-gradient-to-b from-emerald-900/20 to-transparent border border-emerald-500/10 blur-3xl" />
          <div className="absolute w-[60%] aspect-square max-w-[600px] rounded-full border border-white/5" />
        </div>

        {/* Players Layout */}
        <div className="relative w-full max-w-5xl aspect-video flex items-center justify-center">
          
          {/* Partner (Top) */}
          <div className="absolute top-0 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <Users className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-medium">{state.players[2].name}</span>
            </div>
            <div className="flex gap-[-20px]">
              {state.players[2].hand.map((card, i) => (
                <CardComponent 
                  key={card.id} 
                  card={card} 
                  onClick={() => handlePartnerPlay(i)}
                  className={`-ml-8 first:ml-0 transition-all ${state.turn === 2 ? 'ring-2 ring-emerald-400 scale-100 opacity-100' : 'opacity-60 scale-90'}`} 
                />
              ))}
            </div>
          </div>

          {/* AI Left */}
          <div className="absolute left-0 flex flex-col items-center gap-4 -rotate-90 origin-center translate-x-[-20%]">
             <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <Zap className="w-3 h-3 text-rose-400" />
              <span className="text-xs font-medium">{state.players[1].name}</span>
            </div>
            <div className="flex gap-[-40px]">
              {state.players[1].hand.map((card, i) => (
                <CardComponent key={i} card={null} hidden className="-ml-12 first:ml-0" />
              ))}
            </div>
          </div>

          {/* AI Right */}
          <div className="absolute right-0 flex flex-col items-center gap-4 rotate-90 origin-center translate-x-[20%]">
             <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <Zap className="w-3 h-3 text-rose-400" />
              <span className="text-xs font-medium">{state.players[3].name}</span>
            </div>
            <div className="flex gap-[-40px]">
              {state.players[3].hand.map((card, i) => (
                <CardComponent key={i} card={null} hidden className="-ml-12 first:ml-0" />
              ))}
            </div>
          </div>

          {/* Center Area (Played Cards & Vira) */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Vira */}
            <div className="absolute -left-32 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Vira</p>
              <CardComponent card={state.vira} className="scale-75" />
            </div>

            {/* Played Cards */}
            <AnimatePresence>
              {state.roundCards.map((card, i) => card && (
                <motion.div
                  key={`${card.id}-${i}`}
                  initial={{ scale: 0, opacity: 0, y: i === 0 ? 100 : i === 2 ? -100 : 0, x: i === 1 ? -100 : i === 3 ? 100 : 0 }}
                  animate={{ scale: 1, opacity: 1, y: i === 0 ? 40 : i === 2 ? -40 : 0, x: i === 1 ? -40 : i === 3 ? 40 : 0, rotate: (i * 15) - 22 }}
                  className="absolute"
                >
                  <CardComponent card={card} className="scale-90" />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Status Message */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.p
                  key={state.message}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm font-medium text-emerald-400 text-center max-w-[120px]"
                >
                  {state.message}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* User (Bottom) */}
          <div className="absolute bottom-0 flex flex-col items-center gap-6">
            <div className="flex gap-4">
              {state.players[0].hand.map((card, i) => (
                <CardComponent 
                  key={card.id} 
                  card={card} 
                  onClick={() => handleUserPlay(i)}
                  className={state.turn === 0 ? 'ring-2 ring-emerald-500/50 shadow-emerald-500/20' : ''}
                />
              ))}
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <div className={`w-2 h-2 rounded-full ${(state.turn === 0 || state.turn === 2) ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                <span className="text-sm font-bold uppercase tracking-wider">
                  {state.turn === 0 ? 'Sua Vez' : state.turn === 2 ? 'Vez do Parceiro' : 'Aguardando...'}
                </span>
              </div>
              
              <button
                onClick={callTruco}
                disabled={state.trucoPending || state.turn !== 0 || state.lastTrucoBy === 0}
                className={`
                  px-6 py-2 rounded-full font-black text-sm uppercase tracking-tighter transition-all
                  ${state.trucoPending || state.turn !== 0 || state.lastTrucoBy === 0
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20'}
                `}
              >
                Truco!
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {state.phase === 'gameEnd' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white/5 border border-white/10 p-12 rounded-[40px] text-center max-w-md shadow-2xl"
            >
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
                <Trophy className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">Fim de Jogo</h2>
              <p className="text-white/60 mb-8 font-medium">{state.message}</p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Seu Time</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">{state.scores.team0}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Eles</p>
                  <p className="text-2xl font-mono font-bold text-rose-400">{state.scores.team1}</p>
                </div>
              </div>
              <button
                onClick={() => setState(INITIAL_STATE)}
                className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl hover:scale-105 transition-transform active:scale-95 uppercase tracking-widest text-sm"
              >
                Jogar Novamente
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Truco Pending Overlay (User Response) */}
      <AnimatePresence>
        {state.trucoPending && state.lastTrucoBy !== 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-amber-500/50 p-8 rounded-3xl text-center max-w-xs shadow-[0_0_50px_rgba(245,158,11,0.2)]"
            >
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
                <Zap className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tighter uppercase text-amber-400">TRUCO!</h2>
              <p className="text-white/60 mb-8 text-sm">Os adversários estão pedindo Truco. O que você faz?</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      trucoPending: false,
                      currentRoundPoints: prev.currentRoundPoints === 1 ? 3 : prev.currentRoundPoints + 3,
                      message: 'Você aceitou o Truco!',
                    }));
                  }}
                  className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:scale-105 transition-transform active:scale-95 uppercase text-xs tracking-widest"
                >
                  Aceitar
                </button>
                <button
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      trucoPending: false,
                      scores: { ...prev.scores, team1: prev.scores.team1 + prev.currentRoundPoints },
                      phase: 'roundEnd',
                      message: 'Você correu!',
                    }));
                    setTimeout(() => startNewRound(((state.dealer + 1) % 4) as PlayerId), 2000);
                  }}
                  className="w-full py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold rounded-xl hover:bg-rose-500/20 transition-all active:scale-95 uppercase text-xs tracking-widest"
                >
                  Correr
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="p-4 flex justify-center gap-12 bg-black/40 border-t border-white/5 text-[10px] uppercase tracking-[0.2em] font-bold text-white/30">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          <span>Manilha: {state.manilhaRank}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-orange-500" />
          <span>Valor: {state.currentRoundPoints} Pontos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-indigo-500" />
          <span>Rodada: {state.tricksWon.team0 + state.tricksWon.team1 + 1}/3</span>
        </div>
      </footer>
    </div>
  );
}
