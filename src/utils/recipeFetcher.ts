import { cache } from 'react';
import { redis, RECIPE_PREFIX, getRecipeKey } from './redisClient';
import { RecipeSchema } from './apiSchemas';
import { serverLogger } from './serverLogger';
import type { Recipe } from '../types/recipe';

/**
 * Fetch and validate every recipe in Redis (SCAN for `recipe:*`, then MGET).
 * Wrapped in React `cache()` so multiple calls within one server render share a result.
 */
export const fetchAllRecipes = cache(async (logContext = 'recipeFetcher'): Promise<Recipe[]> => {
  const recipeKeys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, keys]: [string, string[]] = await redis.scan(cursor, {
      match: `${RECIPE_PREFIX}*`,
    });
    recipeKeys.push(...keys);
    cursor = nextCursor;
  } while (cursor !== '0');

  if (recipeKeys.length === 0) {
    return [];
  }

  const recipesData = await redis.mget<(Recipe | null)[]>(...recipeKeys);

  const validRecipes = recipesData.flatMap((recipe, index) => {
    if (!recipe) return [];
    const result = RecipeSchema.safeParse(recipe);
    if (!result.success) {
      serverLogger.warn(logContext, `invalid recipe data for key ${recipeKeys[index]}, skipping:`, result.error.flatten());
      return [];
    }
    return [result.data];
  });

  serverLogger.log(logContext, `returning ${validRecipes.length} valid recipes`);
  return validRecipes;
});

/**
 * Fetch and validate a single recipe. Returns null if missing.
 * Throws if the stored data fails validation.
 */
export const fetchRecipeById = cache(async (id: string): Promise<Recipe | null> => {
  const data = await redis.get<Recipe>(getRecipeKey(id));
  if (data === null) return null;

  const result = RecipeSchema.safeParse(data);
  if (!result.success) {
    serverLogger.warn('recipeFetcher', `invalid data in Redis for recipe ${id}:`, result.error.flatten());
    throw new Error('Invalid recipe data stored.');
  }
  return result.data;
});
