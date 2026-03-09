import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, RotateCcw, Zap, Brain, Swords } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameState, PlayerId, Rank } from './types';
import { createDeck, shuffle, getManilhaRank, compareCards, getTrickWinner } from './gameEngine';
import { CardComponent } from './components/Card';

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_STATE: GameState = {
  deck: [],
  players: [
    { id: 0, name: 'Você',        hand: [], team: 0 },
    { id: 1, name: 'AI Esquerda', hand: [], team: 1 },
    { id: 2, name: 'Parceiro',    hand: [], team: 0 },
    { id: 3, name: 'AI Direita',  hand: [], team: 1 },
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
  message: 'Bem-vindo ao Truco Royale!',
  logs: ['Jogo iniciado.'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextTrucoValue(current: number): number {
  if (current === 1) return 3;
  if (current === 3) return 6;
  if (current === 6) return 9;
  if (current === 9) return 12;
  return 12;
}

function getTrucoLabel(value: number): string {
  if (value === 3)  return 'TRUCO';
  if (value === 6)  return 'SEIS';
  if (value === 9)  return 'NOVE';
  return 'DOZE';
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [trickStarter, setTrickStarter] = useState<PlayerId>(1);
  const [firstTrickWinner, setFirstTrickWinner] = useState<PlayerId | 'tie' | null>(null);

  // Stable random rotations for played cards — prevent jitter on re-render
  const cardRotationRef = useRef<Map<string, number>>(new Map());
  const getCardRotation = useCallback((cardId: string, playerIndex: number): number => {
    const key = `${cardId}-p${playerIndex}`;
    if (!cardRotationRef.current.has(key)) {
      cardRotationRef.current.set(key, (playerIndex * 15) - 22 + (Math.random() * 10 - 5));
    }
    return cardRotationRef.current.get(key)!;
  }, []);

  // ── startNewRound ───────────────────────────────────────────────────────────
  const startNewRound = useCallback((dealerId: PlayerId) => {
    cardRotationRef.current.clear();
    const deck = shuffle(createDeck());
    const players = INITIAL_STATE.players.map((p) => ({ ...p, hand: deck.splice(0, 3) }));
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
      logs: [`Nova rodada — ${players[nextStarter].name} começa.`, ...prev.logs].slice(0, 10),
    }));
    setTrickStarter(nextStarter);
    setFirstTrickWinner(null);
  }, []);

  // ── playCard ────────────────────────────────────────────────────────────────
  const playCard = useCallback((playerId: PlayerId, cardIndex: number) => {
    setState(prev => {
      const player = prev.players[playerId];
      const card   = player.hand[cardIndex];
      const newHand = player.hand.filter((_, i) => i !== cardIndex);
      const newPlayers = prev.players.map(p => p.id === playerId ? { ...p, hand: newHand } : p);
      const newRoundCards = [...prev.roundCards];
      newRoundCards[playerId] = card;
      return {
        ...prev,
        players: newPlayers,
        roundCards: newRoundCards,
        turn: ((prev.turn + 1) % 4) as PlayerId,
        logs: [`${player.name}: ${card.rank} de ${card.suit}`, ...prev.logs].slice(0, 10),
      };
    });
  }, []);

  // ── Trick resolution ────────────────────────────────────────────────────────
  useEffect(() => {
    const playedCount = state.roundCards.filter(c => c !== null).length;
    if (playedCount !== 4 || state.phase !== 'playing') return;

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

      const { team0, team1 } = newTricksWon;
      const totalTricks = team0 + team1 + (winner === 'tie' ? 1 : 0);
      let roundEnded = false;
      let roundWinnerTeam: 0 | 1 | null = null;

      if (team0 === 2) { roundEnded = true; roundWinnerTeam = 0; }
      else if (team1 === 2) { roundEnded = true; roundWinnerTeam = 1; }
      else if (winner === 'tie' && currentFirstTrickWinner !== null && currentFirstTrickWinner !== 'tie') {
        roundEnded = true;
        roundWinnerTeam = state.players[currentFirstTrickWinner as PlayerId].team;
      } else if (currentFirstTrickWinner === 'tie' && winner !== 'tie') {
        roundEnded = true;
        roundWinnerTeam = state.players[winner as PlayerId].team;
      } else if (totalTricks === 3) {
        roundEnded = true;
        if (team0 > team1) roundWinnerTeam = 0;
        else if (team1 > team0) roundWinnerTeam = 1;
        else {
          const dealerTeam = state.players[state.dealer].team;
          roundWinnerTeam = dealerTeam === 0 ? 1 : 0;
        }
      }

      if (roundEnded) {
        const points = state.currentRoundPoints;
        const newScores = { ...state.scores };
        if (roundWinnerTeam === 0) newScores.team0 += points;
        else newScores.team1 += points;

        const roundMsg = roundWinnerTeam === 0
          ? `Nosso time venceu! (+${points})`
          : `Adversários venceram! (+${points})`;

        if (newScores.team0 >= 12 || newScores.team1 >= 12) {
          setState(prev => ({
            ...prev,
            scores: newScores,
            trickHistory: [...prev.trickHistory, { cards: state.roundCards, winner }],
            phase: 'gameEnd',
            message: roundWinnerTeam === 0 ? 'VOCÊS VENCERAM O JOGO!' : 'ELES VENCERAM O JOGO!',
            logs: [roundMsg, ...prev.logs].slice(0, 10),
          }));
          // Confetti apenas na vitória do jogador
          if (roundWinnerTeam === 0) {
            confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } });
          }
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
  }, [state.roundCards, state.phase, state.manilhaRank, trickStarter, state.players,
      state.tricksWon, state.currentRoundPoints, state.scores, state.dealer, startNewRound]);

  // ── Initial deal ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'dealing') startNewRound(0);
  }, [state.phase, startNewRound]);

  // ── AI turn — play card ─────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'playing' || (state.turn !== 1 && state.turn !== 3) || state.trucoPending) {
      setIsAiThinking(false);
      return;
    }

    setIsAiThinking(true);

    const aiTimer = setTimeout(() => {
      const aiPlayer = state.players[state.turn];
      if (aiPlayer.hand.length > 0) {
        let bestIndex = 0;
        const playedCards = state.roundCards.filter(c => c !== null);

        if (playedCards.length > 0) {
          let bestPlayed = playedCards[0]!;
          for (const c of playedCards) {
            if (c && compareCards(c, bestPlayed, state.manilhaRank!) > 0) bestPlayed = c;
          }
          let winIndex = -1;
          for (let i = 0; i < aiPlayer.hand.length; i++) {
            if (compareCards(aiPlayer.hand[i], bestPlayed, state.manilhaRank!) > 0) {
              if (winIndex === -1 || compareCards(aiPlayer.hand[winIndex], aiPlayer.hand[i], state.manilhaRank!) > 0) {
                winIndex = i;
              }
            }
          }
          if (winIndex !== -1) {
            bestIndex = winIndex;
          } else {
            let lowest = 0;
            for (let i = 1; i < aiPlayer.hand.length; i++) {
              if (compareCards(aiPlayer.hand[lowest], aiPlayer.hand[i], state.manilhaRank!) > 0) lowest = i;
            }
            bestIndex = lowest;
          }
        }

        playCard(state.turn, bestIndex);
      }
      setIsAiThinking(false);
    }, 1200);

    return () => {
      clearTimeout(aiTimer);
      setIsAiThinking(false);
    };
  }, [state.turn, state.phase, state.trucoPending, state.players, playCard, state.roundCards, state.manilhaRank]);

  // ── AI Truco call ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (
      state.phase !== 'playing' ||
      (state.turn !== 1 && state.turn !== 3) ||
      state.trucoPending ||
      state.lastTrucoBy === 1 ||
      state.lastTrucoBy === 3 ||
      getNextTrucoValue(state.currentRoundPoints) > 12
    ) return;

    const aiPlayer = state.players[state.turn];
    const hasManilha = aiPlayer.hand.some(c => c.rank === state.manilhaRank);
    const nextValue = getNextTrucoValue(state.currentRoundPoints);

    if ((hasManilha && Math.random() > 0.8) || Math.random() > 0.98) {
      setState(prev => ({
        ...prev,
        trucoPending: true,
        lastTrucoBy: state.turn,
        message: `${getTrucoLabel(nextValue)}! — ${aiPlayer.name}`,
        logs: [`${aiPlayer.name} pediu ${getTrucoLabel(nextValue)}!`, ...prev.logs].slice(0, 10),
      }));
    }
  }, [state.turn, state.phase, state.trucoPending, state.lastTrucoBy,
      state.players, state.manilhaRank, state.currentRoundPoints]);

  // ── Handlers ────────────────────────────────────────────────────────────────
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
    if (state.phase !== 'playing' || state.trucoPending) return;
    if (state.lastTrucoBy !== null && state.players[state.lastTrucoBy].team === 0) return;
    const nextValue = getNextTrucoValue(state.currentRoundPoints);
    if (nextValue > 12) return;

    setState(prev => ({
      ...prev,
      trucoPending: true,
      lastTrucoBy: 0,
      message: `${getTrucoLabel(nextValue)}! Aguardando...`,
      logs: [`Você pediu ${getTrucoLabel(nextValue)}!`, ...prev.logs].slice(0, 10),
    }));

    setTimeout(() => {
      const hasManilha =
        state.players[1].hand.some(c => c.rank === state.manilhaRank) ||
        state.players[3].hand.some(c => c.rank === state.manilhaRank);
      const threshold = nextValue === 3 ? 0.4 : nextValue === 6 ? 0.6 : 0.8;
      const accept = Math.random() > threshold || hasManilha;

      if (accept) {
        setState(prev => ({
          ...prev,
          trucoPending: false,
          currentRoundPoints: nextValue,
          message: 'Aceito!',
          logs: [`Adversários aceitaram ${getTrucoLabel(nextValue)}.`, ...prev.logs].slice(0, 10),
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
  };

  // User responds: Aceitar
  const handleTrucoAccept = () => {
    const nextValue = getNextTrucoValue(state.currentRoundPoints);
    setState(prev => ({
      ...prev,
      trucoPending: false,
      currentRoundPoints: nextValue,
      message: 'Você aceitou!',
      logs: [`Você aceitou ${getTrucoLabel(nextValue)}.`, ...prev.logs].slice(0, 10),
    }));
  };

  // User responds: Correr
  const handleTrucoRun = () => {
    setState(prev => ({
      ...prev,
      trucoPending: false,
      scores: { ...prev.scores, team1: prev.scores.team1 + prev.currentRoundPoints },
      phase: 'roundEnd',
      message: 'Você correu!',
      logs: ['Você correu!', ...prev.logs].slice(0, 10),
    }));
    setTimeout(() => startNewRound(((state.dealer + 1) % 4) as PlayerId), 2000);
  };

  // User responds: Aumentar (aceita o truco da IA implicitamente e pede mais)
  const handleTrucoRaise = () => {
    const aiTrucoValue = getNextTrucoValue(state.currentRoundPoints); // Ex: 3
    const raiseValue   = getNextTrucoValue(aiTrucoValue);             // Ex: 6

    setState(prev => ({
      ...prev,
      trucoPending: true,
      lastTrucoBy: 0,
      currentRoundPoints: aiTrucoValue, // Aceita o truco da IA
      message: `${getTrucoLabel(raiseValue)}! Aguardando...`,
      logs: [`Você pediu ${getTrucoLabel(raiseValue)}!`, ...prev.logs].slice(0, 10),
    }));

    setTimeout(() => {
      const hasManilha =
        state.players[1].hand.some(c => c.rank === state.manilhaRank) ||
        state.players[3].hand.some(c => c.rank === state.manilhaRank);
      const threshold = raiseValue === 6 ? 0.5 : raiseValue === 9 ? 0.65 : 0.85;
      const accept = Math.random() > threshold || hasManilha;

      if (accept) {
        setState(prev => ({
          ...prev,
          trucoPending: false,
          currentRoundPoints: raiseValue,
          message: `Aceitaram ${getTrucoLabel(raiseValue)}!`,
          logs: [`Adversários aceitaram ${getTrucoLabel(raiseValue)}.`, ...prev.logs].slice(0, 10),
        }));
      } else {
        setState(prev => ({
          ...prev,
          trucoPending: false,
          scores: { ...prev.scores, team0: prev.scores.team0 + aiTrucoValue },
          phase: 'roundEnd',
          message: 'Eles correram!',
          logs: ['Adversários correram!', ...prev.logs].slice(0, 10),
        }));
        setTimeout(() => startNewRound(((state.dealer + 1) % 4) as PlayerId), 2000);
      }
    }, 1500);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const canCallTruco =
    state.phase === 'playing' &&
    !state.trucoPending &&
    (state.lastTrucoBy === null || state.players[state.lastTrucoBy].team !== 0) &&
    getNextTrucoValue(state.currentRoundPoints) <= 12;

  // Pode aumentar se o próximo valor após o que a IA pediu ainda está dentro do limite
  const aiTrucoValue = getNextTrucoValue(state.currentRoundPoints);
  const canRaise = aiTrucoValue < 12;

  const isPlayerWin = state.phase === 'gameEnd' && state.scores.team0 >= 12;

  const resetGame = () => {
    cardRotationRef.current.clear();
    setState(INITIAL_STATE);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col">

      {/* Truco amber flash */}
      <AnimatePresence>
        {state.trucoPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.12, 0] }}
            transition={{ duration: 0.7, repeat: Infinity }}
            className="fixed inset-0 z-30 bg-amber-500 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md border-b border-white/5 z-10">

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shadow-[0_0_16px_rgba(16,185,129,0.2)]">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-black tracking-tighter uppercase leading-none">Truco Royale</h1>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-[0.3em] font-bold">Premium</p>
          </div>
        </div>

        {/* Placar central */}
        <div className="flex gap-4 sm:gap-8 items-center bg-black/40 px-4 sm:px-6 py-2 rounded-2xl border border-white/5 backdrop-blur-xl shadow-inner">
          <div className="text-center">
            <p className="text-[9px] text-white/40 uppercase font-black tracking-widest mb-0.5">Nós</p>
            <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 leading-none drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
              {state.scores.team0}
            </p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-[9px] text-white/40 uppercase font-black tracking-widest mb-0.5">Eles</p>
            <p className="text-2xl sm:text-3xl font-mono font-black text-rose-400 leading-none drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]">
              {state.scores.team1}
            </p>
          </div>
        </div>

        {/* Badges de info do jogo + Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {state.manilhaRank && (
            <div className="flex flex-col items-center bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg">
              <p className="text-[8px] uppercase font-black text-amber-400/60 tracking-widest leading-none">Manilha</p>
              <p className="text-sm font-black text-amber-400 leading-none">{state.manilhaRank}</p>
            </div>
          )}
          {state.currentRoundPoints > 1 && (
            <div className="flex flex-col items-center bg-orange-500/10 border border-orange-500/30 px-2 py-1 rounded-lg">
              <p className="text-[8px] uppercase font-black text-orange-400/60 tracking-widest leading-none">Vale</p>
              <p className="text-sm font-black text-orange-400 leading-none">{state.currentRoundPoints}</p>
            </div>
          )}
          <button
            onClick={resetGame}
            aria-label="Reiniciar jogo"
            className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-90 border border-transparent hover:border-white/10"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-white/50" />
          </button>
        </div>
      </header>

      {/* ── Log Ticker ─────────────────────────────────────────────────────── */}
      <div className="bg-black/80 backdrop-blur-xl border-b border-white/10 py-1.5 overflow-hidden z-20">
        <div className="flex gap-8 items-center animate-marquee whitespace-nowrap px-4">
          {[...state.logs, ...state.logs].map((log, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/60 flex items-center gap-2 shrink-0">
              <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400/20" />
              {log}
            </span>
          ))}
        </div>
      </div>

      {/* ── Mesa Principal ─────────────────────────────────────────────────── */}
      <main className="flex-1 relative flex flex-col items-center p-2 sm:p-4 overflow-hidden">

        {/* Fundo de feltro */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-felt opacity-40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.07)_0%,transparent_70%)]" />
        </div>

        {/* ── Barra de status da rodada ───────────────────────────────────── */}
        <div className="relative z-10 w-full flex items-start justify-between px-1 pt-1 pb-3 gap-2">

          {/* Tracker de vazas */}
          <div className="flex items-center gap-2.5">
            {[0, 1, 2].map((i) => {
              const trick = state.trickHistory[i];
              const winnerTeam = trick
                ? trick.winner === 'tie'
                  ? (state.players[state.dealer].team === 0 ? 1 : 0) // empate: perde o dealer
                  : state.players[trick.winner as PlayerId].team
                : null;
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    trick
                      ? winnerTeam === 0
                        ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                        : 'bg-rose-500 border-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                      : 'bg-white/5 border-white/20'
                  }`}>
                    {trick && (
                      <span className="text-[7px] font-black text-white">
                        {trick.winner === 'tie' ? '=' : winnerTeam === 0 ? 'N' : 'E'}
                      </span>
                    )}
                  </div>
                  <p className="text-[8px] uppercase font-bold text-white/25 leading-none">V{i + 1}</p>
                </div>
              );
            })}
          </div>

          {/* AI thinking indicator */}
          <AnimatePresence>
            {isAiThinking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full"
              >
                <Brain className="w-3 h-3 text-amber-400 animate-pulse" />
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider whitespace-nowrap">
                  {state.players[state.turn]?.name} pensando...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vira + Manilha */}
          <div className="flex items-center gap-1.5 shrink-0">
            {state.vira && (
              <>
                <div className="flex flex-col items-center">
                  <p className="text-[8px] uppercase font-black text-white/30 tracking-wider mb-0.5 leading-none">Vira</p>
                  <div className="scale-[0.5] origin-top-left w-8">
                    <CardComponent card={state.vira} manilhaRank={null} />
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg flex flex-col items-center self-start mt-4">
                  <p className="text-[8px] uppercase font-black text-amber-400/70 tracking-widest leading-none">Manilha</p>
                  <p className="text-base font-black text-amber-400 leading-tight">{state.manilhaRank}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Mesa ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 w-full relative flex items-center justify-center z-10">

          {/* AI Esquerda — Player 1 */}
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-all duration-300 ${
            state.turn === 1 ? 'opacity-100' : 'opacity-50'
          }`}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full border backdrop-blur-md transition-all duration-300 ${
              state.turn === 1
                ? 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-white/5 border-white/10'
            }`}>
              {isAiThinking && state.turn === 1
                ? <Brain className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                : <Zap className="w-2.5 h-2.5 text-rose-400" />
              }
              <span className="text-[10px] font-bold uppercase tracking-wide">{state.players[1].name}</span>
            </div>
            <div className="flex -space-x-4">
              {state.players[1].hand.map((_, i) => (
                <div key={i} className="w-7 h-10 bg-indigo-900/30 border border-indigo-400/20 rounded-md shadow-md" />
              ))}
            </div>
          </div>

          {/* AI Direita — Player 3 */}
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-all duration-300 ${
            state.turn === 3 ? 'opacity-100' : 'opacity-50'
          }`}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full border backdrop-blur-md transition-all duration-300 ${
              state.turn === 3
                ? 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-white/5 border-white/10'
            }`}>
              {isAiThinking && state.turn === 3
                ? <Brain className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                : <Zap className="w-2.5 h-2.5 text-rose-400" />
              }
              <span className="text-[10px] font-bold uppercase tracking-wide">{state.players[3].name}</span>
            </div>
            <div className="flex -space-x-4">
              {state.players[3].hand.map((_, i) => (
                <div key={i} className="w-7 h-10 bg-indigo-900/30 border border-indigo-400/20 rounded-md shadow-md" />
              ))}
            </div>
          </div>

          {/* Parceiro (topo) — Player 2 — sempre face-down */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 transition-all duration-300 ${
            state.turn === 2 ? 'opacity-25 scale-90' : 'opacity-70'
          }`}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full border backdrop-blur-md transition-all ${
              state.turn === 2
                ? 'bg-emerald-500/20 border-emerald-500/40'
                : 'bg-white/5 border-white/10'
            }`}>
              <Users className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wide">{state.players[2].name}</span>
            </div>
            <div className="flex -space-x-5">
              {state.players[2].hand.map((_, i) => (
                <div key={i} className="w-8 h-12 bg-gradient-to-br from-slate-700 via-slate-800 to-black border border-white/10 rounded-lg shadow-lg" />
              ))}
            </div>
          </div>

          {/* ── Área de Cartas Jogadas ───────────────────────────────────── */}
          <div className="relative w-44 h-44 sm:w-60 sm:h-60 flex items-center justify-center">
            <AnimatePresence>
              {state.roundCards.map((card, i) => card && (
                <motion.div
                  key={`${card.id}-${i}`}
                  initial={{
                    scale: 0, opacity: 0,
                    y: i === 0 ? 70 : i === 2 ? -70 : 0,
                    x: i === 1 ? -70 : i === 3 ? 70 : 0,
                  }}
                  animate={{
                    scale: 0.55,
                    opacity: 1,
                    y: i === 0 ? 18 : i === 2 ? -18 : 0,
                    x: i === 1 ? -18 : i === 3 ? 18 : 0,
                    rotate: getCardRotation(card.id, i),
                    zIndex: 10 + i,
                  }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className="absolute flex flex-col items-center"
                >
                  <CardComponent card={card} manilhaRank={state.manilhaRank} className="shadow-2xl" />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className={`mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${
                      state.players[i].team === 0
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    }`}
                  >
                    {state.players[i].name}
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Mensagem de status (centro) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.message}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-2xl"
                >
                  <p className="text-[10px] sm:text-xs font-bold text-white text-center whitespace-nowrap">
                    {state.message}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Área de Ação — Barra inferior ──────────────────────────────── */}
        <div className="h-40 sm:h-52 w-full flex items-center justify-center relative z-20 pb-2">
          <AnimatePresence mode="wait">

            {/* Vez do jogador */}
            {state.turn === 0 ? (
              <motion.div
                key="user"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="flex flex-col items-center gap-3 w-full"
              >
                <div className="flex justify-center gap-2 sm:gap-3">
                  {state.players[0].hand.map((card, i) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      manilhaRank={state.manilhaRank}
                      onClick={() => handleUserPlay(i)}
                      className="ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 backdrop-blur-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Sua vez</span>
                  </div>
                  <button
                    onClick={callTruco}
                    disabled={!canCallTruco}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black rounded-xl uppercase text-[10px] tracking-tighter shadow-lg shadow-orange-500/20 border-b-2 border-orange-700 active:translate-y-0.5 active:border-b-0 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {getTrucoLabel(getNextTrucoValue(state.currentRoundPoints))}!
                  </button>
                </div>
              </motion.div>

            /* Vez do parceiro */
            ) : state.turn === 2 ? (
              <motion.div
                key="partner"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="flex flex-col items-center gap-3 w-full"
              >
                <div className="flex justify-center gap-2 sm:gap-3">
                  {state.players[2].hand.map((card, i) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      manilhaRank={state.manilhaRank}
                      onClick={() => handlePartnerPlay(i)}
                      className="ring-2 ring-indigo-500/50"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30 backdrop-blur-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Vez do Parceiro</span>
                  </div>
                  <button
                    onClick={callTruco}
                    disabled={!canCallTruco}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black rounded-xl uppercase text-[10px] tracking-tighter shadow-lg shadow-orange-500/20 border-b-2 border-orange-700 active:translate-y-0.5 active:border-b-0 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {getTrucoLabel(getNextTrucoValue(state.currentRoundPoints))}!
                  </button>
                </div>
              </motion.div>

            /* Aguardando IA */
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 w-full"
              >
                <div className="flex justify-center gap-2 opacity-25 grayscale">
                  {state.players[0].hand.map((card, i) => (
                    <CardComponent key={card.id} card={card} manilhaRank={state.manilhaRank} />
                  ))}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  {isAiThinking && <Brain className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                    {isAiThinking ? 'Aguardando jogada da IA...' : 'Aguardando...'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Game Over Overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {state.phase === 'gameEnd' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`border p-6 sm:p-10 rounded-[32px] text-center w-full max-w-sm shadow-2xl ${
                isPlayerWin
                  ? 'bg-slate-900 border-emerald-500/20 shadow-emerald-500/10'
                  : 'bg-slate-900 border-rose-500/20 shadow-rose-500/10'
              }`}
            >
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-5 border ${
                isPlayerWin
                  ? 'bg-emerald-500/20 border-emerald-500/30'
                  : 'bg-rose-500/20 border-rose-500/30'
              }`}>
                {isPlayerWin
                  ? <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                  : <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400" />
                }
              </div>

              <h2 className={`text-2xl sm:text-3xl font-black mb-2 tracking-tighter uppercase ${
                isPlayerWin ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isPlayerWin ? 'Vitória!' : 'Derrota!'}
              </h2>
              <p className="text-white/50 mb-6 text-sm font-medium">{state.message}</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                  <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Nós</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">{state.scores.team0}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                  <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Eles</p>
                  <p className="text-2xl font-mono font-bold text-rose-400">{state.scores.team1}</p>
                </div>
              </div>

              <button
                onClick={resetGame}
                className={`w-full py-3 font-black rounded-2xl hover:scale-105 transition-transform active:scale-95 uppercase tracking-widest text-xs sm:text-sm shadow-lg ${
                  isPlayerWin
                    ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                    : 'bg-rose-500 text-white shadow-rose-500/20'
                }`}
              >
                Jogar Novamente
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal de Resposta ao Truco da IA ─────────────────────────────── */}
      <AnimatePresence>
        {state.trucoPending && state.lastTrucoBy !== null && state.lastTrucoBy !== 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-amber-500/50 p-6 sm:p-8 rounded-[28px] text-center w-full max-w-xs shadow-[0_0_50px_rgba(245,158,11,0.25)]"
            >
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>

              <h2 className="text-2xl font-black mb-1 tracking-tighter uppercase text-amber-400">
                {getTrucoLabel(aiTrucoValue)}!
              </h2>
              <p className="text-white/50 text-xs mb-0.5">
                {state.players[state.lastTrucoBy].name} está pedindo
              </p>
              <p className="text-white/30 text-[10px] mb-6">
                Rodada passaria a valer {aiTrucoValue} ponto{aiTrucoValue !== 1 ? 's' : ''}
              </p>

              <div className="flex flex-col gap-2">
                {/* Aceitar */}
                <button
                  onClick={handleTrucoAccept}
                  className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:scale-[1.02] transition-transform active:scale-95 uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20"
                >
                  Aceitar — {aiTrucoValue} pts
                </button>

                {/* Aumentar (só se houver próximo nível) */}
                {canRaise && (
                  <button
                    onClick={handleTrucoRaise}
                    className="w-full py-3 bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold rounded-xl hover:bg-amber-500/25 transition-all active:scale-95 uppercase text-xs tracking-widest"
                  >
                    {getTrucoLabel(getNextTrucoValue(aiTrucoValue))}! — {getNextTrucoValue(aiTrucoValue)} pts
                  </button>
                )}

                {/* Correr */}
                <button
                  onClick={handleTrucoRun}
                  className="w-full py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold rounded-xl hover:bg-rose-500/20 transition-all active:scale-95 uppercase text-[10px] tracking-widest"
                >
                  Correr — {state.currentRoundPoints} pt{state.currentRoundPoints !== 1 ? 's' : ''} p/ eles
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
