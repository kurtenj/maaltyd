import { z } from 'zod';
import { redis, RECIPE_PREFIX } from './redisClient';
import { RecipeSchema } from './apiSchemas';
import { serverLogger } from './serverLogger';
import type { Recipe } from '../types/recipe';

export interface FetchRecipesOptions {
  schema?: z.ZodSchema<Recipe>;
  logContext?: string;
}

export async function fetchAllRecipes(
  options: FetchRecipesOptions = {}
): Promise<Recipe[]> {
  const {
    schema = RecipeSchema,
    logContext = 'recipeFetcher',
  } = options;

  serverLogger.log(logContext, 'fetching recipe keys from Redis using SCAN...');

  const recipeKeys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [nextCursorStr, keys] = await redis.scan(cursor as number, {
      match: `${RECIPE_PREFIX}*`
    });
    recipeKeys.push(...keys);
    cursor = nextCursorStr;
  } while (cursor !== '0');

  serverLogger.log(logContext, `found ${recipeKeys.length} recipe keys via SCAN`);

  if (recipeKeys.length === 0) {
    return [];
  }

  serverLogger.log(logContext, `fetching ${recipeKeys.length} recipes using mget...`);
  const recipesData = await redis.mget<Recipe[]>(...recipeKeys);
  serverLogger.log(logContext, `received ${recipesData ? recipesData.length : 'null'} results from mget`);

  const validRecipes = recipesData
    .map((recipe, index) => {
      const key = recipeKeys[index] || 'unknown_key';

      if (!recipe) {
        serverLogger.warn(logContext, `null recipe data for key index ${index}, skipping`);
        return null;
      }

      const result = schema.safeParse(recipe);
      if (!result.success) {
        serverLogger.warn(logContext, `invalid recipe data for key ${key}, skipping:`, result.error.flatten());
        return null;
      }

      return result.data;
    })
    .filter((recipe): recipe is Recipe => recipe !== null);

  serverLogger.log(logContext, `returning ${validRecipes.length} valid recipes`);
  return validRecipes;
}
