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
  trickHistory: [],
  roundWinner: null,
  scores: { team0: 0, team1: 0 },
  currentRoundPoints: 1,
  tricksWon: { team0: 0, team1: 0 },
  phase: 'dealing',
  lastTrucoBy: null,
  trucoPending: false,
  message: 'Bem-vindo ao Truco Premium!',
  logs: ['Jogo iniciado.'],
};

export default function App() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [trickStarter, setTrickStarter] = useState<PlayerId>(1); // Dealer is 0, so first starter is 1

  const [firstTrickWinner, setFirstTrickWinner] = useState<PlayerId | 'tie' | null>(null);

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
      trickHistory: [],
      roundWinner: null,
      currentRoundPoints: 1,
      tricksWon: { team0: 0, team1: 0 },
      phase: 'playing',
      lastTrucoBy: null,
      trucoPending: false,
      message: 'Nova rodada! Valendo 1 ponto.',
      logs: [`Nova rodada iniciada por ${players[nextStarter].name}.`, ...prev.logs].slice(0, 10),
    }));
    setTrickStarter(nextStarter);
    setFirstTrickWinner(null);
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
        logs: [`${player.name} jogou ${card.rank} de ${card.suit}`, ...prev.logs].slice(0, 10),
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
        let currentFirstTrickWinner = firstTrickWinner;

        if (winner === 'tie') {
          message = 'Empatou! (Embuchou)';
          nextTurn = trickStarter; 
          if (currentFirstTrickWinner === null) setFirstTrickWinner('tie');
        } else {
          const winningPlayer = state.players[winner];
          if (winningPlayer.team === 0) newTricksWon.team0++;
          else newTricksWon.team1++;
          nextTurn = winner;
          message = `${winningPlayer.name} venceu a vaza!`;
          if (currentFirstTrickWinner === null) {
            setFirstTrickWinner(winner);
            currentFirstTrickWinner = winner;
          }
        }

        // Check if round ended
        const { team0, team1 } = newTricksWon;
        const totalTricks = team0 + team1 + (winner === 'tie' ? 1 : 0);
        let roundEnded = false;
        let roundWinnerTeam: 0 | 1 | null = null;

        // Standard Truco Tie Rules:
        // 1. If someone wins 2 tricks, they win.
        // 2. If 1st trick ties, winner of 2nd wins.
        // 3. If 2nd trick ties, winner of 1st wins.
        // 4. If 3rd trick ties, winner of 1st wins.
        // 5. If all tie, dealer's team loses.

        if (team0 === 2) { roundEnded = true; roundWinnerTeam = 0; }
        else if (team1 === 2) { roundEnded = true; roundWinnerTeam = 1; }
        else if (winner === 'tie' && currentFirstTrickWinner !== null && currentFirstTrickWinner !== 'tie') {
          // Tie in 2nd or 3rd trick
          roundEnded = true;
          roundWinnerTeam = state.players[currentFirstTrickWinner as PlayerId].team;
        } else if (currentFirstTrickWinner === 'tie' && winner !== 'tie') {
          // 1st tied, but 2nd has a winner
          roundEnded = true;
          roundWinnerTeam = state.players[winner as PlayerId].team;
        } else if (totalTricks === 3) {
          roundEnded = true;
          if (team0 > team1) roundWinnerTeam = 0;
          else if (team1 > team0) roundWinnerTeam = 1;
          else {
            // All tied or complex case
            const dealerTeam = state.players[state.dealer].team;
            roundWinnerTeam = dealerTeam === 0 ? 1 : 0; // Dealer loses on triple tie
          }
        }

        if (roundEnded) {
          const points = state.currentRoundPoints;
          const newScores = { ...state.scores };
          if (roundWinnerTeam === 0) newScores.team0 += points;
          else newScores.team1 += points;

          const roundMsg = roundWinnerTeam === 0 ? `Seu time venceu a rodada! (+${points})` : `Eles venceram a rodada! (+${points})`;

          if (newScores.team0 >= 12 || newScores.team1 >= 12) {
            setState(prev => ({
              ...prev,
              scores: newScores,
              trickHistory: [...prev.trickHistory, { cards: state.roundCards, winner }],
              phase: 'gameEnd',
              message: roundWinnerTeam === 0 ? 'VOCÊS VENCERAM O JOGO!' : 'ELES VENCERAM O JOGO!',
              logs: [roundMsg, ...prev.logs].slice(0, 10),
            }));
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          } else {
            setState(prev => ({
              ...prev,
              scores: newScores,
              tricksWon: newTricksWon,
              trickHistory: [...prev.trickHistory, { cards: state.roundCards, winner }],
              roundCards: [null, null, null, null],
              message: roundMsg,
              logs: [roundMsg, ...prev.logs].slice(0, 10),
            }));
            setTimeout(() => startNewRound(((state.dealer + 1) % 4) as PlayerId), 2000);
          }
        } else {
          setState(prev => ({
            ...prev,
            tricksWon: newTricksWon,
            trickHistory: [...prev.trickHistory, { cards: state.roundCards, winner }],
            roundCards: [null, null, null, null],
            turn: nextTurn,
            message,
            logs: [message, ...prev.logs].slice(0, 10),
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
    if (state.phase === 'playing' && (state.turn === 1 || state.turn === 3) && !state.trucoPending && state.lastTrucoBy !== 1 && state.lastTrucoBy !== 3) {
      const aiPlayer = state.players[state.turn];
      const hasManilha = aiPlayer.hand.some(c => c.rank === state.manilhaRank);
      const nextValue = getNextTrucoValue(state.currentRoundPoints);
      
      // AI calls Truco if it has a manilha or just for bluffing
      if ((hasManilha && Math.random() > 0.8) || (Math.random() > 0.98)) {
        setState(prev => ({
          ...prev,
          trucoPending: true,
          lastTrucoBy: state.turn,
          message: `${nextValue === 3 ? 'TRUCO!' : nextValue === 6 ? 'SEIS!' : nextValue === 9 ? 'NOVE!' : 'DOZE!'} de ${aiPlayer.name}`,
          logs: [`${aiPlayer.name} pediu ${nextValue === 3 ? 'TRUCO' : nextValue}.`, ...prev.logs].slice(0, 10),
        }));
      }
    }
  }, [state.turn, state.phase, state.trucoPending, state.lastTrucoBy, state.players, state.manilhaRank, state.currentRoundPoints]);

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

  const getNextTrucoValue = (current: number) => {
    if (current === 1) return 3;
    if (current === 3) return 6;
    if (current === 6) return 9;
    if (current === 9) return 12;
    return 12;
  };

  const callTruco = () => {
    if (state.phase === 'playing' && !state.trucoPending && state.lastTrucoBy !== 0) {
      const nextValue = getNextTrucoValue(state.currentRoundPoints);
      setState(prev => ({
        ...prev,
        trucoPending: true,
        lastTrucoBy: 0,
        message: `${nextValue === 3 ? 'TRUCO!' : nextValue === 6 ? 'SEIS!' : nextValue === 9 ? 'NOVE!' : 'DOZE!'} Aguardando...`,
        logs: [`Você pediu ${nextValue === 3 ? 'TRUCO' : nextValue}.`, ...prev.logs].slice(0, 10),
      }));

      // AI Response to Truco
      setTimeout(() => {
        const aiPlayer = state.players[1]; // Representative AI
        const hasManilha = state.players[1].hand.some(c => c.rank === state.manilhaRank) || 
                          state.players[3].hand.some(c => c.rank === state.manilhaRank);
        
        const acceptThreshold = nextValue === 3 ? 0.4 : nextValue === 6 ? 0.6 : 0.8;
        const accept = Math.random() > acceptThreshold || hasManilha;

        if (accept) {
          setState(prev => ({
            ...prev,
            trucoPending: false,
            currentRoundPoints: nextValue,
            message: 'Aceito!',
            logs: [`Adversários aceitaram o ${nextValue === 3 ? 'TRUCO' : nextValue}.`, ...prev.logs].slice(0, 10),
          }));
        } else {
          setState(prev => ({
            ...prev,
            trucoPending: false,
            scores: { ...prev.scores, team0: prev.scores.team0 + prev.currentRoundPoints },
            phase: 'roundEnd',
            message: 'Eles correram!',
            logs: ['Adversários correram!', ...prev.logs].slice(0, 10),
          }));
          setTimeout(() => startNewRound(((state.dealer + 1) % 4) as PlayerId), 2000);
        }
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col selection:bg-emerald-500/30">
      {/* Truco Flash Effect */}
      <AnimatePresence>
        {state.trucoPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="absolute inset-0 z-30 bg-amber-500 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Header / Scoreboard */}
      <header className="px-4 py-4 sm:p-6 flex justify-between items-center bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md border-b border-white/5 z-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-base sm:text-xl font-black tracking-tighter uppercase leading-none">Truco Royale</h1>
            <p className="text-[8px] sm:text-[10px] text-emerald-400/60 uppercase tracking-[0.3em] font-bold">Premium Edition</p>
          </div>
        </div>

        <div className="flex gap-6 sm:gap-10 items-center bg-black/40 px-6 py-2 rounded-2xl border border-white/5 backdrop-blur-xl shadow-inner">
          <div className="text-center">
            <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-black tracking-widest mb-0.5">Nós</p>
            <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 leading-none drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{state.scores.team0}</p>
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="text-center">
            <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-black tracking-widest mb-0.5">Eles</p>
            <p className="text-2xl sm:text-3xl font-mono font-black text-rose-400 leading-none drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]">{state.scores.team1}</p>
          </div>
        </div>

        <button 
          onClick={() => setState(INITIAL_STATE)}
          className="p-3 hover:bg-white/10 rounded-xl transition-all active:scale-90 border border-transparent hover:border-white/10"
        >
          <RotateCcw className="w-5 h-5 text-white/60" />
        </button>
      </header>

      {/* Game Log Ticker */}
      <div className="bg-black/80 backdrop-blur-xl border-b border-white/10 py-2 px-4 overflow-hidden z-20 shadow-2xl">
        <div className="flex gap-8 items-center animate-marquee whitespace-nowrap">
          {state.logs.map((log, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/60 flex items-center gap-3">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />
              {log}
            </span>
          ))}
          {/* Duplicate for seamless loop */}
          {state.logs.map((log, i) => (
            <span key={`dup-${i}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/60 flex items-center gap-3">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />
              {log}
            </span>
          ))}
        </div>
      </div>

      {/* Main Table Area */}
      <main className="flex-1 relative flex flex-col items-center p-2 sm:p-4 overflow-hidden">
        {/* The Table Surface */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-felt" />
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-transparent to-black/80" />
          <div className="w-[140%] sm:w-[90%] aspect-square max-w-[900px] rounded-full bg-emerald-900/10 border border-emerald-500/5 blur-2xl" />
          <div className="absolute w-[85%] sm:w-[65%] aspect-square max-w-[650px] rounded-full border border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Top Section (History & Spacing) */}
        <div className="h-20 sm:h-32 w-full relative z-10">
          {/* Trick Tracker (Vazas) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20">
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => {
                const trick = state.trickHistory[i];
                const isCompleted = !!trick;
                const winnerTeam = trick ? (state.players[trick.winner === 'tie' ? state.dealer : trick.winner].team) : null;
                
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div 
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
                        isCompleted 
                          ? winnerTeam === 0 
                            ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.6)]' 
                            : 'bg-rose-500 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                          : 'bg-white/5 border-white/10'
                      }`} 
                    >
                      {isCompleted && (
                        <span className="text-[6px] font-black text-white">
                          {winnerTeam === 0 ? 'N' : 'E'}
                        </span>
                      )}
                    </div>
                    <p className="text-[6px] uppercase font-black text-white/20 tracking-tighter">Vaza {i + 1}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Trick History (Mobile Friendly) */}
          <div className="absolute left-2 top-4 flex flex-col gap-2 z-20 max-w-[60px] sm:max-w-none">
            <p className="text-[7px] font-black uppercase tracking-widest text-white/20 ml-1">Histórico</p>
            {state.trickHistory.map((trick, i) => (
              <div key={i} className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/5 flex flex-col gap-1 shadow-xl relative overflow-hidden">
                 <div className={`absolute inset-0 opacity-10 ${state.players[trick.winner === 'tie' ? state.dealer : trick.winner].team === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                 <div className="flex -space-x-4 relative z-10">
                  {trick.cards.map((card, j) => card && (
                    <div key={j} className="scale-[0.35] sm:scale-[0.45] origin-left">
                      <CardComponent card={card} manilhaRank={state.manilhaRank} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle Section (Table & AI Players) */}
        <div className="flex-1 w-full relative flex items-center justify-center z-10">
          {/* AI Left */}
          <div className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 -rotate-90 sm:rotate-0 origin-center">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
              <Zap className="w-2.5 h-2.5 text-rose-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{state.players[1].name}</span>
            </div>
            <div className="flex -space-x-10">
              {state.players[1].hand.map((_, i) => (
                <div key={i} className="w-8 h-12 bg-indigo-900/20 border border-indigo-400/20 rounded-md" />
              ))}
            </div>
          </div>

          {/* AI Right */}
          <div className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 rotate-90 sm:rotate-0 origin-center">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
              <Zap className="w-2.5 h-2.5 text-rose-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{state.players[3].name}</span>
            </div>
            <div className="flex -space-x-10">
              {state.players[3].hand.map((_, i) => (
                <div key={i} className="w-8 h-12 bg-indigo-900/20 border border-indigo-400/20 rounded-md" />
              ))}
            </div>
          </div>

          {/* Partner (Top) */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-500 ${state.turn === 2 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
              <Users className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{state.players[2].name}</span>
            </div>
            <div className="flex -space-x-6">
              {state.players[2].hand.map((card, i) => (
                <CardComponent 
                  key={card.id} 
                  card={card} 
                  manilhaRank={state.manilhaRank}
                  onClick={() => handlePartnerPlay(i)}
                  className="scale-50 sm:scale-75"
                />
              ))}
            </div>
          </div>

          {/* Center Area (Played Cards & Vira) */}
          <div className="relative w-40 h-40 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Vira & Manilha Info */}
            <div className="absolute -left-12 xs:-left-16 sm:-left-32 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 sm:gap-3 z-0">
              <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                <p className="text-[6px] sm:text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">Vira</p>
                <CardComponent card={state.vira} manilhaRank={state.manilhaRank} className="scale-[0.4] sm:scale-75 border-emerald-500/30" />
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl backdrop-blur-md flex flex-col items-center shadow-lg">
                <p className="text-[5px] sm:text-[7px] uppercase font-black text-emerald-400/60 tracking-widest">Manilha</p>
                <p className="text-xs sm:text-lg font-black text-emerald-400 leading-none">{state.manilhaRank}</p>
              </div>
            </div>

            {/* Played Cards */}
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />
              <AnimatePresence>
                {state.roundCards.map((card, i) => card && (
                  <motion.div
                    key={`${card.id}-${i}`}
                    initial={{ scale: 0, opacity: 0, y: i === 0 ? 80 : i === 2 ? -80 : 0, x: i === 1 ? -80 : i === 3 ? 80 : 0, rotate: 0 }}
                    animate={{ 
                      scale: 0.6, 
                      opacity: 1, 
                      y: i === 0 ? 15 : i === 2 ? -15 : 0, 
                      x: i === 1 ? -15 : i === 3 ? 15 : 0, 
                      rotate: (i * 15) - 22 + (Math.random() * 10 - 5),
                      zIndex: 10 + i
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="absolute flex flex-col items-center"
                  >
                    <CardComponent card={card} manilhaRank={state.manilhaRank} className="shadow-2xl" />
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-0.5 px-1 py-0.5 rounded-full text-[5px] sm:text-[8px] font-black uppercase tracking-tighter border ${
                        state.players[i].team === 0 ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      }`}
                    >
                      {state.players[i].name}
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Status Message */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.message}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl"
                >
                  <p className="text-[10px] sm:text-sm font-bold text-emerald-400 text-center whitespace-nowrap">
                    {state.message}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom Section (User & Partner Controls) */}
        <div className="h-32 sm:h-48 w-full flex items-center justify-center relative z-20 pb-2">
          <AnimatePresence mode="wait">
            {state.turn === 0 ? (
              <motion.div 
                key="user-hand"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="flex flex-col items-center gap-2 sm:gap-4 w-full"
              >
                <div className="flex -space-x-6 sm:space-x-4">
                  {state.players[0].hand.map((card, i) => (
                    <CardComponent 
                      key={card.id} 
                      card={card} 
                      manilhaRank={state.manilhaRank}
                      onClick={() => handleUserPlay(i)}
                      className="ring-4 ring-emerald-500/50 shadow-emerald-500/40 scale-80 sm:scale-110 -translate-y-1 sm:-translate-y-2"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between w-full max-w-sm gap-2 sm:gap-3">
                  <div className="flex-1 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-emerald-500/20 rounded-xl sm:rounded-2xl border border-emerald-500/30 backdrop-blur-xl">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-400">Sua Vez</span>
                  </div>
                  <button
                    onClick={callTruco}
                    disabled={state.trucoPending || state.lastTrucoBy !== null && state.players[state.lastTrucoBy].team === 0}
                    className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black rounded-xl sm:rounded-2xl uppercase text-[10px] sm:text-xs tracking-tighter shadow-xl shadow-orange-500/20 border-b-2 sm:border-b-4 border-orange-700 active:translate-y-0.5 sm:active:translate-y-1 active:border-b-0 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                    {state.currentRoundPoints === 1 ? 'Truco!' : state.currentRoundPoints === 3 ? 'Seis!' : state.currentRoundPoints === 6 ? 'Nove!' : 'Doze!'}
                  </button>
                </div>
              </motion.div>
            ) : state.turn === 2 ? (
              <motion.div 
                key="partner-hand"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="flex flex-col items-center gap-2 sm:gap-4 w-full"
              >
                <div className="flex -space-x-6 sm:space-x-4">
                  {state.players[2].hand.map((card, i) => (
                    <CardComponent 
                      key={card.id} 
                      card={card} 
                      manilhaRank={state.manilhaRank}
                      onClick={() => handlePartnerPlay(i)}
                      className="ring-4 ring-indigo-500/50 shadow-indigo-500/40 scale-80 sm:scale-110 -translate-y-1 sm:-translate-y-2"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between w-full max-w-sm gap-2 sm:gap-3">
                  <div className="flex-1 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-indigo-500/20 rounded-xl sm:rounded-2xl border border-indigo-500/30 backdrop-blur-xl">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-400">Vez do Parceiro</span>
                  </div>
                  <button
                    onClick={callTruco}
                    disabled={state.trucoPending || state.lastTrucoBy !== null && state.players[state.lastTrucoBy].team === 0}
                    className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black rounded-xl sm:rounded-2xl uppercase text-[10px] sm:text-xs tracking-tighter shadow-xl shadow-orange-500/20 border-b-2 sm:border-b-4 border-orange-700 active:translate-y-0.5 sm:active:translate-y-1 active:border-b-0 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                    {state.currentRoundPoints === 1 ? 'Truco!' : state.currentRoundPoints === 3 ? 'Seis!' : state.currentRoundPoints === 6 ? 'Nove!' : 'Doze!'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-2 sm:gap-4 w-full"
              >
                 <div className="flex -space-x-8 opacity-40 grayscale">
                  {state.players[0].hand.map((card, i) => (
                    <CardComponent key={card.id} card={card} manilhaRank={state.manilhaRank} className="scale-75 sm:scale-90" />
                  ))}
                </div>
                <div className="px-4 sm:px-6 py-2 sm:py-3 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 backdrop-blur-md">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/40 italic">Aguardando Jogada...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>


      {/* Game Over Overlay */}
      <AnimatePresence>
        {state.phase === 'gameEnd' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-6 sm:p-12 rounded-[32px] sm:rounded-[40px] text-center w-full max-w-md shadow-2xl"
            >
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-emerald-500/30">
                <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-emerald-400" />
              </div>
              <h2 className="text-2xl sm:text-4xl font-black mb-2 sm:mb-4 tracking-tighter uppercase">Fim de Jogo</h2>
              <p className="text-white/60 mb-6 sm:mb-8 font-medium text-sm sm:text-base">{state.message}</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="bg-white/5 p-3 sm:p-4 rounded-2xl border border-white/10">
                  <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-bold mb-1">Nós</p>
                  <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">{state.scores.team0}</p>
                </div>
                <div className="bg-white/5 p-3 sm:p-4 rounded-2xl border border-white/10">
                  <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-bold mb-1">Eles</p>
                  <p className="text-xl sm:text-2xl font-mono font-bold text-rose-400">{state.scores.team1}</p>
                </div>
              </div>
              <button
                onClick={() => setState(INITIAL_STATE)}
                className="w-full py-3 sm:py-4 bg-emerald-500 text-black font-black rounded-2xl hover:scale-105 transition-transform active:scale-95 uppercase tracking-widest text-xs sm:text-sm shadow-lg shadow-emerald-500/20"
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
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-amber-500/50 p-6 sm:p-8 rounded-[32px] text-center w-full max-w-xs shadow-[0_0_50px_rgba(245,158,11,0.3)]"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-amber-500/30">
                <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black mb-2 tracking-tighter uppercase text-amber-400">TRUCO!</h2>
              <p className="text-white/60 mb-6 sm:mb-8 text-xs sm:text-sm">Os adversários estão pedindo Truco. O que você faz?</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    const nextValue = getNextTrucoValue(state.currentRoundPoints);
                    setState(prev => ({
                      ...prev,
                      trucoPending: false,
                      currentRoundPoints: nextValue,
                      message: 'Você aceitou!',
                    }));
                  }}
                  className="w-full py-3 sm:py-4 bg-emerald-500 text-black font-bold rounded-xl hover:scale-105 transition-transform active:scale-95 uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20"
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
                  className="w-full py-3 sm:py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold rounded-xl hover:bg-rose-500/20 transition-all active:scale-95 uppercase text-xs tracking-widest"
                >
                  Correr
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Footer Info */}
      <footer className="px-4 py-3 flex justify-center gap-4 sm:gap-12 bg-black/40 border-t border-white/5 text-[8px] sm:text-[10px] uppercase tracking-widest font-bold text-white/30 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          <span className="whitespace-nowrap">Manilha: {state.manilhaRank}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-orange-500" />
          <span className="whitespace-nowrap">Valor: {state.currentRoundPoints}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-indigo-500" />
          <span className="whitespace-nowrap">Rodada: {state.tricksWon.team0 + state.tricksWon.team1 + 1}/3</span>
        </div>
      </footer>
    </div>
  );
}
