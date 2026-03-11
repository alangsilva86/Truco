// @vitest-environment jsdom

import { AvailablePlayAction } from '@truco/contracts';
import { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientGameView } from '../../test/fixtures.js';
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
    coveredMode: false,
    commandPending: false,
    codeCopied: false,
    rematchRequested: false,
    requestTrucoAction: null,
    respondTrucoAction: null,
    onDismissError: () => undefined,
    onCopyCode: () => undefined,
    onLeave: () => undefined,
    onToggleCovered: () => undefined,
    onRequestTruco: () => undefined,
    onRequestRematch: () => undefined,
    onAcceptTruco: () => undefined,
    onRaiseTruco: () => undefined,
    onRunTruco: () => undefined,
    patoTauntCount: 0,
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
        coveredMode={false}
        commandPending={false}
        codeCopied={false}
        rematchRequested={false}
        playAction={null}
        requestTrucoAction={null}
        respondTrucoAction={null}
        onDismissError={() => undefined}
        onCopyCode={() => undefined}
        onLeave={() => undefined}
        onToggleCovered={() => undefined}
        onPlayCard={() => undefined}
        onRequestTruco={() => undefined}
        onRequestRematch={onRequestRematch}
        onAcceptTruco={() => undefined}
        onRaiseTruco={() => undefined}
        onRunTruco={() => undefined}
        patoTauntCount={0}
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
        coveredMode={false}
        commandPending={false}
        codeCopied={false}
        rematchRequested
        playAction={null}
        requestTrucoAction={null}
        respondTrucoAction={null}
        onDismissError={() => undefined}
        onCopyCode={() => undefined}
        onLeave={() => undefined}
        onToggleCovered={() => undefined}
        onPlayCard={() => undefined}
        onRequestTruco={() => undefined}
        onRequestRematch={() => undefined}
        onAcceptTruco={() => undefined}
        onRaiseTruco={() => undefined}
        onRunTruco={() => undefined}
        patoTauntCount={0}
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
    expect(
      screen.getByRole('button', { name: /jogar coberta/i }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /jogar coberta/i }));

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

    expect(screen.getByText(/assento do topo em foco/i)).toBeInTheDocument();
    expect(
      screen.getByText(/jogando agora: ana • parceiro · assento cima/i),
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

    expect(screen.getByText(/enviando jogada/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /a de ouros/i }).length,
    ).toBeGreaterThan(0);
  });
});
