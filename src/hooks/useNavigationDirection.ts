import { useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Derives slide direction from route "depth": the home route ("/") is
 * shallow, every other route is deep. Moving shallow -> deep slides
 * forward (1), deep -> shallow slides backward (-1). Depth-equal moves
 * (e.g. one detail page to another) keep the last direction.
 */
function getDepth(pathname: string): number {
  return pathname === '/' ? 0 : 1;
}

interface DirectionState {
  depth: number;
  direction: 1 | -1;
}

export function useNavigationDirection(): 1 | -1 {
  const location = useLocation();
  const currentDepth = getDepth(location.pathname);

  const [state, setState] = useState<DirectionState>({ depth: currentDepth, direction: 1 });

  if (currentDepth !== state.depth) {
    setState({ depth: currentDepth, direction: currentDepth > state.depth ? 1 : -1 });
  }

  return state.direction;
}
