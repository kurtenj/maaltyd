'use client';

import { LazyMotion, domAnimation, m, type Variants } from 'motion/react';
import { useNavigationDirection } from '../hooks/useNavigationDirection';

const pageVariants: Variants = {
  enter: (direction: 1 | -1) => ({ x: direction === 1 ? '100%' : '-100%' }),
  center: { x: 0 },
};

/**
 * Slides each new page in from the direction of travel.
 *
 * Enter-only: the App Router swaps route content immediately on navigation,
 * so an AnimatePresence exit animation would play on the *new* page's content.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname, direction, hasNavigated } = useNavigationDirection();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        key={pathname}
        custom={direction}
        variants={pageVariants}
        initial={hasNavigated ? 'enter' : false}
        animate="center"
        transition={{ type: 'tween', ease: 'easeOut', duration: 0.22 }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
