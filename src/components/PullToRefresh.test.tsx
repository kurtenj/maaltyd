import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PullToRefresh from './PullToRefresh';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

function touch(type: 'touchstart' | 'touchmove' | 'touchend', y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: { clientY: number }[] };
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ clientY: y }] });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

/** Drag a finger from y=0 down to `to` (screen px), then release. */
function pull(to: number) {
  touch('touchstart', 0);
  const move = touch('touchmove', to);
  touch('touchend', to);
  return move;
}

beforeEach(() => {
  refresh.mockClear();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  render(
    <PullToRefresh>
      <p>Recipes</p>
    </PullToRefresh>
  );
});

describe('PullToRefresh', () => {
  it('refreshes the page data after a long enough pull from the top', () => {
    const move = pull(200); // 200px of finger travel = 100px of pull after resistance
    expect(move.defaultPrevented).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the refresh indicator up for at least 1.1s, even when data returns instantly', () => {
    vi.useFakeTimers();
    try {
      pull(200);
      expect(screen.getByRole('status')).toHaveTextContent('Refreshing recipes');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Refreshing recipes');

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('Refreshing recipes')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing for a short pull', () => {
    pull(80); // 40px of pull, below the 70px trigger
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores pulls when the page is scrolled down', () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    const move = pull(200);
    expect(move.defaultPrevented).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores upward swipes (normal scrolling)', () => {
    touch('touchstart', 200);
    const move = touch('touchmove', 50);
    touch('touchend', 50);
    expect(move.defaultPrevented).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders its content', () => {
    expect(screen.getByText('Recipes')).toBeInTheDocument();
  });
});
