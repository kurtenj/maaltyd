import { describe, it, expect, beforeEach } from 'vitest';
import { parseRecentRecipeIds, readRecentRecipeIds, recordRecentRecipe, RECENT_RECIPES_COOKIE } from './recentRecipes';

function clearCookie() {
  document.cookie = `${RECENT_RECIPES_COOKIE}=; Path=/; Max-Age=0`;
}

beforeEach(() => {
  clearCookie();
  localStorage.clear();
});

describe('parseRecentRecipeIds', () => {
  it('parses an encoded comma-separated list', () => {
    expect(parseRecentRecipeIds(encodeURIComponent('a-1,b-2,c-3'))).toEqual(['a-1', 'b-2', 'c-3']);
  });

  it('drops invalid or tampered entries, de-duplicates, and caps at 5', () => {
    const value = encodeURIComponent('a,<script>,a,b,c,d,e,f,g');
    expect(parseRecentRecipeIds(value)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns [] for missing or malformed values', () => {
    expect(parseRecentRecipeIds(undefined)).toEqual([]);
    expect(parseRecentRecipeIds('')).toEqual([]);
    expect(parseRecentRecipeIds('%E0%A4%A')).toEqual([]); // bad percent-encoding
  });
});

describe('recordRecentRecipe', () => {
  it('stores the most recent first, without duplicates, capped at 5', () => {
    for (const id of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) recordRecentRecipe(id);
    recordRecentRecipe('r3');
    expect(readRecentRecipeIds()).toEqual(['r3', 'r6', 'r5', 'r4', 'r2']);
  });

  it('ignores the sample recipes rendered inside skeletons', () => {
    recordRecentRecipe('sample-1');
    expect(readRecentRecipeIds()).toEqual([]);
  });

  it('migrates history from the old localStorage key on first use', () => {
    localStorage.setItem('recentRecipeIds', JSON.stringify(['old-1', 'old-2']));
    recordRecentRecipe('new-1');
    expect(readRecentRecipeIds()).toEqual(['new-1', 'old-1', 'old-2']);
    expect(localStorage.getItem('recentRecipeIds')).toBeNull();
  });

  it('writes a cookie the server can read back with parseRecentRecipeIds', () => {
    recordRecentRecipe('abc-123');
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${RECENT_RECIPES_COOKIE}=`));
    expect(parseRecentRecipeIds(raw?.split('=')[1])).toEqual(['abc-123']);
  });
});
