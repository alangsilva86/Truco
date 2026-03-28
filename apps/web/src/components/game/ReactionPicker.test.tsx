// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReactionPicker } from './ReactionPicker.js';

describe('ReactionPicker', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('mostra quick reactions ao ganhar uma vaza e envia a frase escolhida', () => {
    const onSend = vi.fn();

    render(
      <ReactionPicker
        onSend={onSend}
        gamePhase="TRICK_END"
        justWonTrick
        justLostTrick={false}
        trucoPending={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /toma!/i }));

    expect(onSend).toHaveBeenCalledWith(1);
  });

  it('abre a bandeja completa e aplica cooldown local apos enviar', () => {
    vi.useFakeTimers();
    const onSend = vi.fn();

    render(
      <ReactionPicker
        onSend={onSend}
        gamePhase="PLAYING"
        justWonTrick={false}
        justLostTrick={false}
        trucoPending
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir reações/i }));
    fireEvent.click(screen.getByRole('button', { name: /blefe total!/i }));

    expect(onSend).toHaveBeenCalledWith(10);
    expect(
      screen.getByRole('button', { name: /abrir reações/i }),
    ).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(2_500);
    });

    expect(
      screen.getByRole('button', { name: /abrir reações/i }),
    ).not.toBeDisabled();
  });
});
