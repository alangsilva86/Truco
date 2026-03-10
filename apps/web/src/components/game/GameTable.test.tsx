// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createClientGameView } from '../../test/fixtures.js';
import { GameTable } from './GameTable.js';

describe('GameTable', () => {
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
      />,
    );

    expect(
      screen.getByRole('button', { name: /aguardando adversario/i }),
    ).toBeDisabled();
  });
});
