import { AvailableAction, Card, ClientGameView, SeatId, TeamId, getSeatLayoutForTeam } from '@truco/contracts';

type PlayAction = Extract<AvailableAction, { type: 'PLAY_CARD' }>;
type TrucoAction = Extract<AvailableAction, { type: 'REQUEST_TRUCO' }>;

export type BannerTone = 'player' | 'opponent' | 'waiting' | 'warning' | 'finished';
export type TrickDotTone = 'us' | 'them' | 'tie' | 'empty';

export interface TableSeatModel {
  seatId: SeatId;
  nickname: string;
  dealer: boolean;
  active: boolean;
}

export interface TableBannerModel {
  tone: BannerTone;
  title: string;
  detail: string;
}

export interface TablePresentationModel {
  seatLayout: ReturnType<typeof getSeatLayoutForTeam>;
  isWaiting: boolean;
  isGameEnd: boolean;
  isPausedReconnect: boolean;
  isBottomTurn: boolean;
  isTopTurn: boolean;
  isOpponentLeftTurn: boolean;
  isOpponentRightTurn: boolean;
  scoreUs: number;
  scoreThem: number;
  gameWon: boolean;
  trickDots: TrickDotTone[];
  banner: TableBannerModel | null;
  topSeat: TableSeatModel;
  bottomSeat: TableSeatModel;
  leftSeat: TableSeatModel & { hiddenCount: number };
  rightSeat: TableSeatModel & { hiddenCount: number };
  topCards: Card[];
  bottomCards: Card[];
  shareMessage: string;
  phaseLabel: string;
  coveredHint: string;
  trucoHint: string;
  trucoLabel: string;
  canToggleCovered: boolean;
  canRequestTruco: boolean;
}

function createBanner(params: {
  view: ClientGameView;
  viewerTeamId: TeamId;
  isWaiting: boolean;
  isGameEnd: boolean;
  isPausedReconnect: boolean;
  isBottomTurn: boolean;
  isTopTurn: boolean;
  isOpponentLeftTurn: boolean;
  isOpponentRightTurn: boolean;
  seatLayout: ReturnType<typeof getSeatLayoutForTeam>;
  scoreUs: number;
  scoreThem: number;
  gameWon: boolean;
}): TableBannerModel | null {
  const {
    view,
    isWaiting,
    isGameEnd,
    isPausedReconnect,
    isBottomTurn,
    isTopTurn,
    isOpponentLeftTurn,
    isOpponentRightTurn,
    seatLayout,
    scoreUs,
    scoreThem,
    gameWon,
  } = params;

  if (isPausedReconnect) {
    return {
      tone: 'warning',
      title: 'Conexao pausada',
      detail: 'Aguardando a reconexao do adversario para continuar.',
    };
  }

  if (isGameEnd) {
    return {
      tone: 'finished',
      title: gameWon ? 'Partida vencida' : 'Partida encerrada',
      detail: `${scoreUs} x ${scoreThem}`,
    };
  }

  if (view.gamePhase === 'TRUCO_DECISION' && view.trucoPending?.responseTeam === params.viewerTeamId) {
    return {
      tone: 'player',
      title: 'Responder truco',
      detail: 'Aceite, aumente ou corra antes da rodada continuar.',
    };
  }

  if (isWaiting) {
    return {
      tone: 'waiting',
      title: 'Sala pronta',
      detail: 'Compartilhe o codigo para a partida comecar.',
    };
  }

  if (isBottomTurn) {
    return {
      tone: 'player',
      title: 'Sua vez',
      detail: `${view.players[seatLayout.bottom].nickname} joga agora no assento inferior.`,
    };
  }

  if (isTopTurn) {
    return {
      tone: 'player',
      title: 'Sua vez',
      detail: `${view.players[seatLayout.top].nickname} joga agora no assento superior.`,
    };
  }

  if (isOpponentLeftTurn) {
    return {
      tone: 'opponent',
      title: 'Vez deles',
      detail: `${view.players[seatLayout.left].nickname} esta pensando na jogada.`,
    };
  }

  if (isOpponentRightTurn) {
    return {
      tone: 'opponent',
      title: 'Vez deles',
      detail: `${view.players[seatLayout.right].nickname} esta pensando na jogada.`,
    };
  }

  return {
    tone: 'waiting',
    title: 'Mesa sincronizada',
    detail: view.message,
  };
}

function getPhaseLabel(view: ClientGameView): string {
  switch (view.gamePhase) {
    case 'TRICK_END':
      return 'Vaza resolvida';
    case 'ROUND_END':
      return 'Rodada encerrada';
    case 'TRUCO_DECISION':
      return 'Truco em decisao';
    case 'GAME_END':
      return 'Fim de jogo';
    case 'WAITING_PLAYERS':
      return 'Aguardando';
    default:
      return 'Mesa';
  }
}

function getCoveredHint(playAction: PlayAction | null): string {
  if (!playAction) {
    return 'Aguarde a vez da sua dupla para jogar.';
  }

  if (!playAction.canPlayCovered) {
    return 'Carta coberta libera a partir da segunda vaza.';
  }

  return 'Jogue escondendo o valor da carta na mesa.';
}

function getTrucoHint(view: ClientGameView, requestTrucoAction: TrucoAction | null): string {
  if (requestTrucoAction) {
    return `Pedir ${requestTrucoAction.nextValue} ponto${requestTrucoAction.nextValue > 1 ? 's' : ''} agora.`;
  }

  if (view.gamePhase === 'TRUCO_DECISION') {
    return 'Resolva o truco pendente para retomar a rodada.';
  }

  if (view.gamePhase === 'GAME_END') {
    return 'A rodada terminou. Aguarde a revanche ou saia da sala.';
  }

  return 'Aguarde a vez da sua dupla para trucar.';
}

export function createTablePresentation(params: {
  view: ClientGameView;
  viewerTeamId: TeamId;
  playAction: PlayAction | null;
  requestTrucoAction: TrucoAction | null;
}): TablePresentationModel {
  const { view, viewerTeamId, playAction, requestTrucoAction } = params;
  const seatLayout = getSeatLayoutForTeam(viewerTeamId);
  const isWaiting = view.gamePhase === 'WAITING_PLAYERS';
  const isGameEnd = view.gamePhase === 'GAME_END';
  const isPausedReconnect = view.roomLifecycle === 'PAUSED_RECONNECT';
  const isBottomTurn = playAction?.seatId === seatLayout.bottom;
  const isTopTurn = playAction?.seatId === seatLayout.top;
  const isOpponentLeftTurn = view.gamePhase === 'PLAYING' && view.turnSeatId === seatLayout.left;
  const isOpponentRightTurn = view.gamePhase === 'PLAYING' && view.turnSeatId === seatLayout.right;
  const scoreUs = viewerTeamId === 0 ? view.scores[0] : view.scores[1];
  const scoreThem = viewerTeamId === 0 ? view.scores[1] : view.scores[0];
  const gameWon = isGameEnd && scoreUs >= 12;
  const trickDots = Array.from({ length: 3 }).map((_, index) => {
    const trick = view.trickHistory[index];
    if (!trick) {
      return 'empty';
    }

    if (trick.winnerSeatId === 'tie') {
      return 'tie';
    }

    return (trick.winnerSeatId as number) % 2 === viewerTeamId ? 'us' : 'them';
  });

  return {
    seatLayout,
    isWaiting,
    isGameEnd,
    isPausedReconnect,
    isBottomTurn,
    isTopTurn,
    isOpponentLeftTurn,
    isOpponentRightTurn,
    scoreUs,
    scoreThem,
    gameWon,
    trickDots,
    banner: createBanner({
      view,
      viewerTeamId,
      isWaiting,
      isGameEnd,
      isPausedReconnect,
      isBottomTurn,
      isTopTurn,
      isOpponentLeftTurn,
      isOpponentRightTurn,
      seatLayout,
      scoreUs,
      scoreThem,
      gameWon,
    }),
    topSeat: {
      seatId: seatLayout.top,
      nickname: view.players[seatLayout.top].nickname,
      dealer: view.dealerSeatId === seatLayout.top,
      active: Boolean(isTopTurn),
    },
    bottomSeat: {
      seatId: seatLayout.bottom,
      nickname: view.players[seatLayout.bottom].nickname,
      dealer: view.dealerSeatId === seatLayout.bottom,
      active: Boolean(isBottomTurn),
    },
    leftSeat: {
      seatId: seatLayout.left,
      nickname: view.players[seatLayout.left].nickname,
      dealer: view.dealerSeatId === seatLayout.left,
      active: Boolean(isOpponentLeftTurn),
      hiddenCount: view.opponentHandCounts[seatLayout.left] ?? 0,
    },
    rightSeat: {
      seatId: seatLayout.right,
      nickname: view.players[seatLayout.right].nickname,
      dealer: view.dealerSeatId === seatLayout.right,
      active: Boolean(isOpponentRightTurn),
      hiddenCount: view.opponentHandCounts[seatLayout.right] ?? 0,
    },
    topCards: view.visibleHands[seatLayout.top] ?? [],
    bottomCards: view.visibleHands[seatLayout.bottom] ?? [],
    shareMessage: isWaiting
      ? 'Compartilhe o codigo da sala para iniciar a partida.'
      : `${view.players[seatLayout.bottom].nickname} e ${view.players[seatLayout.top].nickname} compartilham as cartas visiveis da dupla.`,
    phaseLabel: getPhaseLabel(view),
    coveredHint: getCoveredHint(playAction),
    trucoHint: getTrucoHint(view, requestTrucoAction),
    trucoLabel: requestTrucoAction ? `Trucar ${requestTrucoAction.nextValue}` : 'Trucar',
    canToggleCovered: Boolean(playAction?.canPlayCovered),
    canRequestTruco: Boolean(requestTrucoAction),
  };
}
