'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CookingPotIcon from './CookingPotIcon';

/** How far (px, after resistance) the content must be pulled before release triggers a refresh. */
const TRIGGER_DISTANCE = 70;
/** Content can't be pulled further than this. */
const MAX_PULL = 110;
/** Where the content rests while the refresh runs. */
const REFRESHING_OFFSET = 56;
/** Finger travel is damped so the pull feels elastic. */
const RESISTANCE = 0.5;
/**
 * The pot stays up at least this long, even when the data comes back sooner, so you get to
 * see it: one full lid rattle in CookingPotIcon (0.9s animation + 0.2s pause).
 */
const MIN_REFRESH_MS = 1100;

/**
 * Pull down from the top of the page to re-fetch its server data (router.refresh()).
 *
 * Custom because iOS home-screen web apps have no native pull-to-refresh, and globals.css
 * sets `overscroll-behavior: none` (no rubber-band bounce) everywhere. Touch-only: mouse and
 * trackpad users never see it.
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isRefreshPending, startRefresh] = useTransition();
  // Shown state outlives the transition until MIN_REFRESH_MS has passed
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshStartedAt = useRef(0);
  const [pull, setPull] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const passedTrigger = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Only start at the very top, with one finger, and not while a refresh is running
      if (window.scrollY > 0 || e.touches.length !== 1 || isRefreshing) return;
      startY.current = e.touches[0].clientY;
      passedTrigger.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      if (distance <= 0 || window.scrollY > 0) {
        // Scrolling up / normal scroll: not a pull
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      e.preventDefault(); // keep the page still while we pull it ourselves
      const next = Math.min(distance * RESISTANCE, MAX_PULL);
      pullRef.current = next;
      setPull(next);
      setIsDragging(true);
      if (!passedTrigger.current && next >= TRIGGER_DISTANCE) {
        passedTrigger.current = true;
        navigator.vibrate?.(10); // light tick on Android; iOS ignores it
      }
    };

    const onTouchEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      setIsDragging(false);
      if (pullRef.current >= TRIGGER_DISTANCE) {
        refreshStartedAt.current = Date.now();
        setIsRefreshing(true);
        startRefresh(() => router.refresh());
      }
      pullRef.current = 0;
      setPull(0);
    };

    // Non-passive so the touchmove handler can call preventDefault()
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [router, isRefreshing]);

  // Once the data is back, hide the pot — but not before MIN_REFRESH_MS
  useEffect(() => {
    if (!isRefreshing || isRefreshPending) return;
    const remaining = MIN_REFRESH_MS - (Date.now() - refreshStartedAt.current);
    const timer = setTimeout(() => setIsRefreshing(false), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [isRefreshing, isRefreshPending]);

  const offset = isRefreshing ? REFRESHING_OFFSET : pull;
  const progress = Math.min(offset / TRIGGER_DISTANCE, 1);
  const transition = isDragging ? 'none' : 'transform 250ms ease-out, opacity 250ms ease-out';

  return (
    <div className="relative">
      <div
        aria-hidden={!isRefreshing}
        className="absolute inset-x-0 top-0 flex justify-center text-stone-400 pointer-events-none"
        style={{
          transform: `translateY(${offset / 2 - 20}px) rotate(${isRefreshing ? 0 : progress * 180 - 180}deg)`,
          opacity: progress,
          transition,
        }}
      >
        <CookingPotIcon size={28} isAnimating={isRefreshing} />
        <span className="sr-only" role="status">
          {isRefreshing ? 'Refreshing recipes' : ''}
        </span>
      </div>
      <div style={{ transform: `translateY(${offset}px)`, transition }}>{children}</div>
    </div>
  );
}
