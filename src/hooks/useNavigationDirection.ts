import { useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Derives slide direction from route "depth": the home route ("/") is
 * shallow, every other route is deep. Moving shallow -> deep slides
 * forward (1), deep -> shallow slides backward (-1). Depth-equal moves
 * (e.g. one detail page to another) keep the last direction.
 */
function getDepth(pathname: string): number {
  return pathname === '/' ? 0 : 1;
}

interface NavigationState {
  pathname: string;
  direction: 1 | -1;
  /** False until the first client-side navigation, so the initial page load doesn't animate. */
  hasNavigated: boolean;
}

export function useNavigationDirection(): NavigationState {
  const pathname = usePathname();

  const [state, setState] = useState<NavigationState>({ pathname, direction: 1, hasNavigated: false });

  if (pathname !== state.pathname) {
    const prevDepth = getDepth(state.pathname);
    const nextDepth = getDepth(pathname);
    const next: NavigationState = {
      pathname,
      direction: nextDepth === prevDepth ? state.direction : nextDepth > prevDepth ? 1 : -1,
      hasNavigated: true,
    };
    setState(next);
    return next;
  }

  return state;
}
