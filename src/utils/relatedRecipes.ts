import type { Recipe } from '../types/recipe';

/** Recipes sharing the same main ingredient, excluding the recipe itself. */
export function getRelatedRecipes(allRecipes: Recipe[], recipe: Recipe, limit = 2): Recipe[] {
  return allRecipes.filter((r) => r.main === recipe.main && r.id !== recipe.id).slice(0, limit);
}
