// @vitest-environment jsdom

import { getSeatLayoutForTeam } from '@truco/contracts';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CenterTable } from './CenterTable.js';

describe('CenterTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('posiciona e anima as cartas pela direcao do assento', () => {
    const { container } = render(
      <CenterTable
        mode="table"
        roomCode="ABC123"
        codeCopied={false}
        onCopyCode={vi.fn()}
        roundCards={[
          {
            seatId: 0,
            hidden: false,
            card: { id: 'A-Ouros', rank: 'A', suit: 'Ouros' },
          },
          {
            seatId: 2,
            hidden: false,
            card: { id: '3-Paus', rank: '3', suit: 'Paus' },
          },
          {
            seatId: 1,
            hidden: false,
            card: { id: '7-Copas', rank: '7', suit: 'Copas' },
          },
          {
            seatId: 3,
            hidden: false,
            card: { id: 'K-Espadas', rank: 'K', suit: 'Espadas' },
          },
        ]}
        manilhaRank={null}
        viewerTeamId={0}
        seatLayout={getSeatLayoutForTeam(0)}
        resolutionPhase={null}
      />,
    );

    const bottomCard = screen.getByRole('button', { name: /a de ouros/i });
    const topCard = screen.getByRole('button', { name: /3 de paus/i });
    const leftCard = screen.getByRole('button', { name: /7 de copas/i });
    const rightCard = screen.getByRole('button', { name: /k de espadas/i });

    expect(bottomCard.closest('div[style*="z-index"]')).toHaveStyle({
      zIndex: '4',
    });
    expect(topCard.closest('div[style*="z-index"]')).toHaveStyle({
      zIndex: '3',
    });

    expect(
      bottomCard.closest('div[style*="z-index"]')?.getAttribute('style'),
    ).toContain('3.1rem');
    expect(
      topCard.closest('div[style*="z-index"]')?.getAttribute('style'),
    ).toContain('-3.1rem');
    expect(
      leftCard.closest('div[style*="z-index"]')?.getAttribute('style'),
    ).toContain('-2.9rem');
    expect(
      rightCard.closest('div[style*="z-index"]')?.getAttribute('style'),
    ).toContain('2.9rem');

    expect(
      bottomCard.closest('div[style*="animation:"]')?.getAttribute('style'),
    ).toContain('card-enter-bottom');
    expect(
      topCard.closest('div[style*="animation:"]')?.getAttribute('style'),
    ).toContain('card-enter-top');
    expect(
      leftCard.closest('div[style*="animation:"]')?.getAttribute('style'),
    ).toContain('card-enter-left');
    expect(
      rightCard.closest('div[style*="animation:"]')?.getAttribute('style'),
    ).toContain('card-enter-right');

    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('aplica zoom nas cartas durante o fim da vaza', () => {
    const { container } = render(
      <CenterTable
        mode="table"
        roomCode="ABC123"
        codeCopied={false}
        onCopyCode={vi.fn()}
        roundCards={[
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
        ]}
        manilhaRank={null}
        viewerTeamId={0}
        seatLayout={getSeatLayoutForTeam(0)}
        resolutionPhase="TRICK_END"
      />,
    );

    const zoomLayer = container.querySelector(
      '[data-resolution-phase="TRICK_END"]:not([data-winning-card="true"])',
    );

    expect(zoomLayer).toHaveStyle({
      animation: 'resolved-table-zoom 2s cubic-bezier(0.22, 1, 0.36, 1) both',
    });

    const winningCard = container.querySelector('[data-winning-card="true"]');

    expect(winningCard).toHaveStyle({
      animation: 'resolved-winning-card 2s cubic-bezier(0.22, 1, 0.36, 1) both',
    });
  });

  it('destaca as quatro cartas com spotlight no fim da rodada', () => {
    const { container } = render(
      <CenterTable
        mode="table"
        roomCode="ABC123"
        codeCopied={false}
        onCopyCode={vi.fn()}
        roundCards={[
          {
            seatId: 0,
            hidden: false,
            card: { id: 'A-Ouros', rank: 'A', suit: 'Ouros' },
          },
          {
            seatId: 2,
            hidden: false,
            card: { id: '3-Paus', rank: '3', suit: 'Paus' },
          },
          {
            seatId: 1,
            hidden: false,
            card: { id: '7-Copas', rank: '7', suit: 'Copas' },
          },
          {
            seatId: 3,
            hidden: false,
            card: { id: 'K-Espadas', rank: 'K', suit: 'Espadas' },
          },
        ]}
        manilhaRank={null}
        viewerTeamId={0}
        seatLayout={getSeatLayoutForTeam(0)}
        resolutionPhase="ROUND_END"
      />,
    );

    expect(
      container.querySelector('[data-round-end-overlay="true"]'),
    ).toBeInTheDocument();

    const spotlightLayer = container.querySelector(
      '[data-resolution-phase="ROUND_END"]:not([data-winning-card="true"])',
    );

    expect(spotlightLayer).toHaveStyle({
      animation:
        'resolved-round-spotlight 2s cubic-bezier(0.22, 1, 0.36, 1) both',
    });

    const winningCard = container.querySelector('[data-winning-card="true"]');

    expect(winningCard).toHaveStyle({
      animation:
        'resolved-round-winning-card 2s cubic-bezier(0.22, 1, 0.36, 1) both',
    });
  });
});
