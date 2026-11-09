'use client';

import { SkulletProvider } from 'skullet/react';
import { smart } from 'skullet';

/**
 * App-wide skeleton settings (https://skullet.lochie.me): light mode, shimmer motion,
 * and the "smart" reveal with a "rise" entrance (each piece slides up 8px as it appears).
 *
 * Client component because the `smart` preset contains functions, which can't be
 * passed from a server component as props.
 */
const REVEAL = { ...smart, enter: { translate: '0 8px' } };
const THEME = { animation: 'shimmer' } as const;

export default function SkeletonProvider({ children }: { children: React.ReactNode }) {
  return (
    <SkulletProvider mode="light" theme={THEME} reveal={REVEAL}>
      {children}
    </SkulletProvider>
  );
}
