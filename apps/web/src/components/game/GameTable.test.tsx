// @vitest-environment jsdom

import {
  AvailableHandOfElevenAction,
  AvailablePlayAction,
  AvailableTrucoResponseAction,
} from '@truco/contracts';
import { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientGameView } from '../../test/fixtures.js';
import { createIdleReconnectStatus } from '../../lib/reconnect.js';
import { GameTable } from './GameTable.js';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
    writable: true,
  });
  window.dispatchEvent(new Event('resize'));
}

function createBaseProps() {
  return {
    viewerTeamId: 0 as const,
    connectionState: 'connected' as const,
    logs: [],
    error: null,
    chatBubbles: [],
    reconnectStatus: createIdleReconnectStatus(),
    coveredMode: false,
    commandPending: false,
    codeCopied: false,
    rematchRequested: false,
    requestTrucoAction: null,
    respondHandOfElevenAction: null,
    respondTrucoAction: null,
    onDismissError: () => undefined,
    onCopyCode: () => undefined,
    onLeave: () => undefined,
    onReturnToLobby: () => undefined,
    onRetryReconnect: () => undefined,
    onToggleCovered: () => undefined,
    onPlayHandOfEleven: () => undefined,
    onPlayCard: () => undefined,
    onRequestTruco: () => undefined,
    onRequestRematch: () => undefined,
    onAcceptTruco: () => undefined,
    onRunHandOfEleven: () => undefined,
    onRaiseTruco: () => undefined,
    onRunTruco: () => undefined,
    patoTauntCount: 0,
    onSendReaction: () => undefined,
    onSendPatoTaunt: () => undefined,
  };
}

describe('GameTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('dispara revanche no fim do jogo', () => {
    const onRequestRematch = vi.fn();
    const view = createClientGameView({
      gamePhase: 'GAME_END',
      scores: { 0: 12, 1: 9 },
      message: 'Fim da partida.',
    });

    render(
      <GameTable
        view={view}
        viewerTeamId={0}
        connectionState="connected"
        logs={[]}
        error={null}
        chatBubbles={[]}
        reconnectStatus={createIdleReconnectStatus()}
        coveredMode={false}
        commandPending={false}
        codeCopied={false}
        rematchRequested={false}
        playAction={null}
        respondHandOfElevenAction={null}
        requestTrucoAction={null}
        respondTrucoAction={null}
        onDismissError={() => undefined}
        onCopyCode={() => undefined}
        onLeave={() => undefined}
        onReturnToLobby={() => undefined}
        onRetryReconnect={() => undefined}
        onToggleCovered={() => undefined}
        onPlayHandOfEleven={() => undefined}
        onPlayCard={() => undefined}
        onRequestTruco={() => undefined}
        onRequestRematch={onRequestRematch}
        onAcceptTruco={() => undefined}
        onRunHandOfEleven={() => undefined}
        onRaiseTruco={() => undefined}
        onRunTruco={() => undefined}
        patoTauntCount={0}
        onSendReaction={() => undefined}
        onSendPatoTaunt={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /pedir revanche/i }));

    expect(onRequestRematch).toHaveBeenCalledTimes(1);
  });

  it('mostra estado de revanche pendente', () => {
    const view = createClientGameView({
      gamePhase: 'GAME_END',
      scores: { 0: 9, 1: 12 },
      message: 'Fim da partida.',
    });

    render(
      <GameTable
        view={view}
        viewerTeamId={0}
        connectionState="connected"
        logs={[]}
        error={null}
        chatBubbles={[]}
        reconnectStatus={createIdleReconnectStatus()}
        coveredMode={false}
        commandPending={false}
        codeCopied={false}
        rematchRequested
        playAction={null}
        respondHandOfElevenAction={null}
        requestTrucoAction={null}
        respondTrucoAction={null}
        onDismissError={() => undefined}
        onCopyCode={() => undefined}
        onLeave={() => undefined}
        onReturnToLobby={() => undefined}
        onRetryReconnect={() => undefined}
        onToggleCovered={() => undefined}
        onPlayHandOfEleven={() => undefined}
        onPlayCard={() => undefined}
        onRequestTruco={() => undefined}
        onRequestRematch={() => undefined}
        onAcceptTruco={() => undefined}
        onRunHandOfEleven={() => undefined}
        onRaiseTruco={() => undefined}
        onRunTruco={() => undefined}
        patoTauntCount={0}
        onSendReaction={() => undefined}
        onSendPatoTaunt={() => undefined}
      />,
    );

    expect(
      screen.getByRole('button', { name: /aguardando adversario/i }),
    ).toBeDisabled();
  });

  it('exige confirmacao explicita antes de jogar carta no mobile', () => {
    setViewport(375, 812);
    const onPlayCard = vi.fn();
    const view = createClientGameView({
      availableActions: [
        {
          type: 'PLAY_CARD',
          seatId: 0,
          cardIds: ['A-Ouros'],
          canPlayCovered: true,
        },
      ],
    });
    const playAction = view.availableActions[0] as AvailablePlayAction;

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={playAction}
        onPlayCard={onPlayCard}
      />,
    );

    const bottomCard = screen
      .getAllByRole('button', { name: /a de ouros/i })
      .find((button) => !button.hasAttribute('disabled'));

    expect(bottomCard).toBeDefined();
    fireEvent.click(bottomCard!);

    expect(onPlayCard).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /jogar aberta/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /coberta/i })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /coberta/i }));

    expect(onPlayCard).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: 'A-Ouros' }),
      'covered',
    );
  });

  it('mantem o assento superior em foco espacial quando ele joga no mobile', () => {
    setViewport(390, 844);
    const onPlayCard = vi.fn();
    const view = createClientGameView({
      turnSeatId: 2,
      availableActions: [
        {
          type: 'PLAY_CARD',
          seatId: 2,
          cardIds: ['3-Paus'],
          canPlayCovered: false,
        },
      ],
      message: 'Ana • Parceiro joga agora.',
    });
    const playAction = view.availableActions[0] as AvailablePlayAction;

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={playAction}
        onPlayCard={onPlayCard}
      />,
    );

    expect(
      screen.getByText(/jogando pelo parceiro · ana • parceiro/i),
    ).toBeInTheDocument();

    const topCard = screen
      .getAllByRole('button', { name: /3 de paus/i })
      .find((button) => !button.hasAttribute('disabled'));

    expect(topCard).toBeDefined();
    fireEvent.click(topCard!);
    const confirmButtons = screen.getAllByRole('button', {
      name: /jogar aberta/i,
    });

    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(onPlayCard).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ id: '3-Paus' }),
      'open',
    );
  });

  it('mantem a carta visivel enquanto a jogada aguarda confirmacao do servidor', () => {
    setViewport(375, 812);
    const view = createClientGameView({
      availableActions: [
        {
          type: 'PLAY_CARD',
          seatId: 0,
          cardIds: ['A-Ouros'],
          canPlayCovered: false,
        },
      ],
    });
    const playAction = view.availableActions[0] as AvailablePlayAction;

    function PendingHarness() {
      const [pending, setPending] = useState(false);

      return (
        <GameTable
          {...createBaseProps()}
          view={view}
          playAction={playAction}
          commandPending={pending}
          onPlayCard={() => setPending(true)}
        />
      );
    }

    render(<PendingHarness />);

    const bottomCard = screen
      .getAllByRole('button', { name: /a de ouros/i })
      .find((button) => !button.hasAttribute('disabled'));

    expect(bottomCard).toBeDefined();
    fireEvent.click(bottomCard!);

    const confirmButtons = screen.getAllByRole('button', {
      name: /jogar aberta/i,
    });

    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(
      screen.getAllByRole('button', { name: /a de ouros/i }).length,
    ).toBeGreaterThan(0);
  });

  it('mostra as opcoes de mao de 11 para a dupla com 11 pontos', () => {
    const onPlayHandOfEleven = vi.fn();
    const onRunHandOfEleven = vi.fn();
    const view = createClientGameView({
      gamePhase: 'HAND_OF_ELEVEN_DECISION',
      scores: { 0: 11, 1: 10 },
      turnSeatId: 1,
      availableActions: [
        {
          type: 'RESPOND_HAND_OF_ELEVEN',
          playValue: 3,
          runPenalty: 1,
        },
      ],
      message: 'Mao de 11 para Ana.',
    });

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={null}
        respondHandOfElevenAction={
          view.availableActions[0] as AvailableHandOfElevenAction
        }
        onPlayHandOfEleven={onPlayHandOfEleven}
        onRunHandOfEleven={onRunHandOfEleven}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /jogar · vale 3/i }));
    fireEvent.click(screen.getByRole('button', { name: /correr · perder 1/i }));

    expect(onPlayHandOfEleven).toHaveBeenCalledTimes(1);
    expect(onRunHandOfEleven).toHaveBeenCalledTimes(1);
  });

  it('mostra toast emerald quando o truco pedido por nos e aceito', () => {
    const initialView = createClientGameView({
      gamePhase: 'TRUCO_DECISION',
      trucoPending: {
        requestedBySeatId: 0,
        requestedValue: 3,
        acceptedValue: 1,
        responseTeam: 1,
      },
    });

    const { rerender } = render(
      <GameTable
        {...createBaseProps()}
        view={initialView}
        playAction={null}
      />,
    );

    rerender(
      <GameTable
        {...createBaseProps()}
        view={createClientGameView({
          gamePhase: 'PLAYING',
          trucoPending: null,
        })}
        playAction={null}
      />,
    );

    expect(screen.getByText(/aceito! vale 3pts/i)).toBeInTheDocument();
  });

  it('mostra banner com resultado da rodada durante round_end', () => {
    const view = createClientGameView({
      gamePhase: 'ROUND_END',
      currentRoundPoints: 2,
      scores: { 0: 8, 1: 3 },
      trickHistory: [
        {
          winnerSeatId: 0,
          cards: [],
        },
        {
          winnerSeatId: 3,
          cards: [],
        },
        {
          winnerSeatId: 2,
          cards: [],
        },
      ],
    });

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={null}
      />,
    );

    expect(screen.getByText(/rodada ganha/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 pontos/i)).toBeInTheDocument();
    expect(screen.getByText(/8 x 3/i)).toBeInTheDocument();
  });

  it('mostra a camada de distribuicao durante dealing', () => {
    const view = createClientGameView({
      gamePhase: 'DEALING',
      visibleHands: {},
      trickHistory: [],
      roundCards: [],
      turnSeatId: null,
      dealerSeatId: null,
      trickStarterSeatId: null,
      availableActions: [],
      message: 'Distribuindo as cartas...',
    });

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={null}
      />,
    );

    expect(screen.getAllByText(/distribuindo/i).length).toBeGreaterThan(0);
  });

  it('mostra o spotlight de fim de vaza durante trick_end', () => {
    const view = createClientGameView({
      gamePhase: 'TRICK_END',
      roundCards: [
        {
          seatId: 0,
          hidden: false,
          card: { id: 'A-Ouros', rank: 'A', suit: 'Ouros' },
        },
        {
          seatId: 1,
          hidden: false,
          card: { id: '7-Copas', rank: '7', suit: 'Copas' },
        },
      ],
      trickHistory: [
        {
          winnerSeatId: 0,
          cards: [
            {
              seatId: 0,
              hidden: false,
              card: { id: 'A-Ouros', rank: 'A', suit: 'Ouros' },
            },
            {
              seatId: 1,
              hidden: false,
              card: { id: '7-Copas', rank: '7', suit: 'Copas' },
            },
          ],
        },
      ],
    });

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={null}
      />,
    );

    expect(screen.getByText(/fim da vaza/i)).toBeInTheDocument();
    expect(screen.getByText(/ana levou a vaza/i)).toBeInTheDocument();
  });

  it('mostra cartas da dupla no sheet de truco', () => {
    const view = createClientGameView({
      gamePhase: 'TRUCO_DECISION',
      trucoPending: {
        requestedBySeatId: 1,
        requestedValue: 3,
        acceptedValue: 1,
        responseTeam: 0,
      },
      availableActions: [
        {
          type: 'RESPOND_TRUCO',
          actions: ['accept', 'run', 'raise'],
          requestedValue: 3,
          currentAcceptedValue: 1,
        },
      ],
    });

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={null}
        respondTrucoAction={
          view.availableActions[0] as AvailableTrucoResponseAction
        }
      />,
    );

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(/suas cartas/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/a de ouros/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/3 de paus/i)).toBeInTheDocument();
  });

  it('mostra cartas da dupla no sheet de mao de 11', () => {
    const view = createClientGameView({
      gamePhase: 'HAND_OF_ELEVEN_DECISION',
      scores: { 0: 11, 1: 10 },
      availableActions: [
        {
          type: 'RESPOND_HAND_OF_ELEVEN',
          playValue: 3,
          runPenalty: 1,
        },
      ],
    });

    render(
      <GameTable
        {...createBaseProps()}
        view={view}
        playAction={null}
        respondHandOfElevenAction={
          view.availableActions[0] as AvailableHandOfElevenAction
        }
      />,
    );

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(/sua mao de 11/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/a de ouros/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/3 de paus/i)).toBeInTheDocument();
  });
});
