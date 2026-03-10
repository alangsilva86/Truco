import { ClientMatchEvent, PlayerInfo, SeatId } from '@truco/contracts';

export function describeEvent(
  event: ClientMatchEvent,
  players?: Record<SeatId, PlayerInfo>,
): string {
  const name = (seatId: SeatId) =>
    players?.[seatId]?.nickname ?? `Assento ${seatId}`;

  switch (event.type) {
    case 'ROUND_STARTED':
      return `Nova rodada · vale ${event.payload.currentRoundPoints}`;
    case 'CARD_PLAYED':
      return event.payload.hidden
        ? `${name(event.payload.seatId)} jogou coberta`
        : `${name(event.payload.seatId)} jogou carta`;
    case 'TRUCO_REQUESTED':
      return `${name(event.payload.seatId)} pediu ${event.payload.requestedValue}`;
    case 'TRUCO_ACCEPTED':
      return `Truco aceito · vale ${event.payload.acceptedValue}`;
    case 'TRUCO_RAISED':
      return `${name(event.payload.seatId)} aumentou para ${event.payload.requestedValue}`;
    case 'TRUCO_RUN':
      return `Correram · ${event.payload.awardedPoints} pts para eles`;
    case 'TRICK_WON':
      return event.payload.winnerSeatId === 'tie'
        ? 'Vaza empatada'
        : `${name(event.payload.winnerSeatId)} ganhou a vaza`;
    case 'ROUND_ENDED':
      return `Rodada encerrada · +${event.payload.awardedPoints} pts`;
    case 'GAME_ENDED':
      return 'Partida encerrada';
    case 'PLAYER_DROPPED':
      return `${event.payload.nickname} desconectou`;
    case 'PLAYER_RECONNECTED':
      return `${event.payload.nickname} voltou`;
    default:
      return 'Evento';
  }
}
