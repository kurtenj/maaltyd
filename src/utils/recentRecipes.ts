/**
 * Recently viewed recipe IDs, kept in a cookie (not localStorage) so the server can render
 * the home page's "Last Viewed" row correctly on first paint — no client-side pop-in or
 * layout jump. Safe to import from both server and client code.
 */

export const RECENT_RECIPES_COOKIE = 'recent-recipes';
const MAX = 5;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/** Where history lived before it moved to a cookie; migrated on the next recipe view. */
const LEGACY_LOCAL_STORAGE_KEY = 'recentRecipeIds';

/** Parse a cookie value into a clean, de-duplicated list of recipe IDs. Never throws. */
export function parseRecentRecipeIds(value: string | undefined | null): string[] {
  if (!value) return [];
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return [];
  }
  const ids = decoded.split(',').filter((id) => ID_PATTERN.test(id));
  return [...new Set(ids)].slice(0, MAX);
}

/** Client only: read the IDs from document.cookie. */
export function readRecentRecipeIds(): string[] {
  if (typeof document === 'undefined') return [];
  const entry = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${RECENT_RECIPES_COOKIE}=`));
  return parseRecentRecipeIds(entry?.slice(RECENT_RECIPES_COOKIE.length + 1));
}

function readLegacyIds(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && ID_PATTERN.test(id)) : [];
  } catch {
    return [];
  }
}

/** Client only: move `id` to the front of the recently viewed list. */
export function recordRecentRecipe(id: string): void {
  // Skeletons render the detail view with sample data (ids "sample-*"); never record those
  if (id.startsWith('sample-') || !ID_PATTERN.test(id) || typeof document === 'undefined') return;

  let existing = readRecentRecipeIds();
  if (existing.length === 0) {
    existing = readLegacyIds();
    try {
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }

  const ids = [id, ...existing.filter((rid) => rid !== id)].slice(0, MAX);
  document.cookie = `${RECENT_RECIPES_COOKIE}=${encodeURIComponent(ids.join(','))}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}
