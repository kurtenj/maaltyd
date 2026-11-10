import type { Recipe } from '../types/recipe';

const titleCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * Alphabetical by title, ignoring case, accents, and stray whitespace ("Focaccia " sorts as
 * "Focaccia"); numbers sort naturally ("2-Minute" before "20-Minute"). Redis SCAN returns keys
 * in hash order, which looks random, so every recipe list goes through this.
 */
export function sortRecipesByTitle(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => titleCollator.compare(a.title.trim(), b.title.trim()));
}
