// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SeatPanel } from './SeatPanel.js';

describe('SeatPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('abre as cartas ocultas em leque sutil', () => {
    const { container } = render(
      <SeatPanel
        mode="hidden"
        orientation="left"
        tone="opponent"
        nickname="Bia"
        dealer={false}
        active={false}
        roundRole={null}
        count={3}
      />,
    );

    const hiddenCards = container.querySelectorAll('div[style*="rotate("]');

    expect(hiddenCards).toHaveLength(3);
    expect(hiddenCards[0]).toHaveStyle({
      transform: 'rotate(-5deg) translateY(-0.2rem)',
      left: '0rem',
    });
    expect(hiddenCards[1]).toHaveStyle({
      transform: 'rotate(0deg) translateY(-0rem)',
      left: '1.4rem',
    });
    expect(hiddenCards[2]).toHaveStyle({
      transform: 'rotate(5deg) translateY(-0.2rem)',
      left: '2.8rem',
    });
  });

  it('mostra o marcador visual de mao', () => {
    const { getByText } = render(
      <SeatPanel
        mode="visible"
        orientation="bottom"
        tone="player"
        nickname="Ana"
        dealer={false}
        active
        roundRole="mao"
        cards={[{ id: 'A-Ouros', rank: 'A', suit: 'Ouros' }]}
        manilhaRank={null}
      />,
    );

    expect(getByText(/^mao$/i)).toBeInTheDocument();
  });
});
