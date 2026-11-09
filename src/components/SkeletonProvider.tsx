'use client';

import { SkulletProvider } from 'skullet/react';
import { smart } from 'skullet';

/**
 * App-wide skeleton settings (https://skullet.lochie.me): light mode, no skeleton motion,
 * and the "smart" reveal with a "rise" entrance (each piece slides up 8px as it appears).
 *
 * `hold`: how long a skeleton waits before it appears at all. Our pages' data lands
 * ~80–140ms after the shell (measured on production), which sat right on smart's default
 * 150ms and caused a brief flash. At 400ms, normal loads skip the skeleton entirely and
 * only genuinely slow ones show it. Skullet caps this at 1s.
 *
 * Client component because the `smart` preset contains functions, which can't be
 * passed from a server component as props.
 */
const REVEAL = { ...smart, hold: 400, enter: { translate: '0 8px' } };
// Static blocks: with the longer hold, skeletons are rare and brief, so motion just adds noise
const THEME = { animation: 'none' } as const;

export default function SkeletonProvider({ children }: { children: React.ReactNode }) {
  return (
    <SkulletProvider mode="light" theme={THEME} reveal={REVEAL}>
      {children}
    </SkulletProvider>
  );
}
