import { z } from 'zod';
import { redis, RECIPE_PREFIX } from './redisClient';
import { RecipeSchema } from './apiSchemas';
import type { Recipe } from '../types/recipe';

/**
 * Options for fetching recipes
 */
export interface FetchRecipesOptions {
  /**
   * Schema to use for validation. Defaults to RecipeSchema.
   */
  schema?: z.ZodSchema<Recipe>;
  /**
   * Context for logging (e.g., 'api/recipes')
   */
  logContext?: string;
}

/**
 * Fetches all recipes from Redis, validates them, and optionally filters them.
 * 
 * This is a shared utility to avoid code duplication across API routes.
 * 
 * @param options - Configuration options for fetching recipes
 * @returns Array of valid recipes
 * @throws Error if Redis operation fails
 */
export async function fetchAllRecipes(
  options: FetchRecipesOptions = {}
): Promise<Recipe[]> {
  const {
    schema = RecipeSchema,
    logContext = 'recipeFetcher',
  } = options;

  console.log(`[${logContext}]: Fetching recipe keys from Redis using SCAN...`);
  
  // 1. Scan for all recipe keys
  const recipeKeys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [nextCursorStr, keys] = await redis.scan(cursor as number, { 
      match: `${RECIPE_PREFIX}*` 
    });
    recipeKeys.push(...keys);
    cursor = nextCursorStr;
  } while (cursor !== '0');

  console.log(`[${logContext}]: Found ${recipeKeys.length} recipe keys via SCAN.`);

  if (recipeKeys.length === 0) {
    return [];
  }

  // 2. Fetch all recipes in batch
  console.log(`[${logContext}]: Fetching ${recipeKeys.length} recipes using mget...`);
  const recipesData = await redis.mget<Recipe[]>(...recipeKeys);
  console.log(`[${logContext}]: Received ${recipesData ? recipesData.length : 'null'} results from mget.`);

  // 3. Filter out nulls and validate with schema
  const validRecipes = recipesData
    .map((recipe, index) => {
      const key = recipeKeys[index] || 'unknown_key';
      
      if (!recipe) {
        console.warn(`[${logContext}] Null recipe data found for key index ${index}. Skipping.`);
        return null;
      }

      const result = schema.safeParse(recipe);
      if (!result.success) {
        console.warn(
          `[${logContext}] Invalid recipe data found for key ${key}, skipping: ${JSON.stringify(recipe)}. Error:`,
          result.error.flatten()
        );
        return null;
      }

      return result.data;
    })
    .filter((recipe): recipe is Recipe => recipe !== null);

  console.log(`[${logContext}]: Returning ${validRecipes.length} valid recipes.`);
  return validRecipes;
}

