import {
  AvailableAction,
  Card,
  CardPlayMode,
  ClientGameView,
  GameCommand,
  SeatId,
} from '@truco/contracts';
import { useEffect, useState } from 'react';
import { createCommand, findAction } from '../lib/commands.js';

type PlayAction = Extract<AvailableAction, { type: 'PLAY_CARD' }>;
type TrucoAction = Extract<AvailableAction, { type: 'REQUEST_TRUCO' }>;
type TrucoResponseAction = Extract<AvailableAction, { type: 'RESPOND_TRUCO' }>;

interface UseGameCommandsOptions {
  sendCommand: (command: GameCommand) => void;
  view: ClientGameView | null;
}

export function useGameCommands({ sendCommand, view }: UseGameCommandsOptions) {
  const [coveredMode, setCoveredMode] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  const playAction: PlayAction | null = view
    ? findAction(view.availableActions, 'PLAY_CARD')
    : null;
  const requestTrucoAction: TrucoAction | null = view
    ? findAction(view.availableActions, 'REQUEST_TRUCO')
    : null;
  const respondTrucoAction: TrucoResponseAction | null = view
    ? findAction(view.availableActions, 'RESPOND_TRUCO')
    : null;

  useEffect(() => {
    if (!playAction?.canPlayCovered && coveredMode) {
      setCoveredMode(false);
    }
  }, [coveredMode, playAction?.canPlayCovered]);

  useEffect(() => {
    if (view?.gamePhase !== 'GAME_END') {
      setRematchRequested(false);
    }
  }, [view?.gamePhase]);

  function handleCardPlay(
    seatId: SeatId,
    card: Card,
    mode: CardPlayMode = coveredMode ? 'covered' : 'open',
  ): void {
    if (!playAction || playAction.seatId !== seatId) {
      return;
    }

    sendCommand(
      createCommand('PLAY_CARD', {
        seatId,
        cardId: card.id,
        mode,
      }),
    );
  }

  function handleRequestTruco(): void {
    if (!requestTrucoAction || !view) {
      return;
    }

    sendCommand(
      createCommand('REQUEST_TRUCO', {
        seatId: playAction?.seatId ?? view.ownedSeatIds[0],
      }),
    );
  }

  function handleRequestRematch(): void {
    if (!view || rematchRequested) {
      return;
    }

    setRematchRequested(true);
    sendCommand(
      createCommand('REMATCH', {
        requestedBySeatId: view.ownedSeatIds[0],
      }),
    );
  }

  return {
    coveredMode,
    onAcceptTruco: () =>
      sendCommand(createCommand('RESPOND_TRUCO', { action: 'accept' })),
    onPlayCard: handleCardPlay,
    onRaiseTruco: () =>
      sendCommand(createCommand('RESPOND_TRUCO', { action: 'raise' })),
    onRequestRematch: handleRequestRematch,
    onRequestTruco: handleRequestTruco,
    onRunTruco: () =>
      sendCommand(createCommand('RESPOND_TRUCO', { action: 'run' })),
    onToggleCovered: () => setCoveredMode((current) => !current),
    playAction,
    rematchRequested,
    requestTrucoAction,
    respondTrucoAction,
  };
}
