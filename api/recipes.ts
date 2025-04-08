import { kv } from '@vercel/kv';
import { z } from 'zod';
import type { Recipe } from '../src/types/recipe';

console.log('--- !!! api/recipes.ts TOP LEVEL EXECUTION !!! ---');

const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string(),
});

const RecipeSchema = z.object({
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string()).min(1),
});

export async function GET(_request: Request) {
  const tokenPresent = !!process.env.KV_REST_API_TOKEN;
  console.log(`[api/recipes]: GET request received. KV_REST_API_TOKEN present: ${tokenPresent}`);

  if (!tokenPresent) {
    console.error('[api/recipes]: KV environment variables seem missing!');
    return new Response(JSON.stringify({ message: 'Server configuration error: Missing KV store credentials.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[api/recipes]: Attempting to get recipe keys from KV...');
  try {
    const recipeKeys: string[] = [];
    for await (const key of kv.scanIterator({ match: 'recipe:*' })) {
      recipeKeys.push(key);
    }
    console.log(`[api/recipes]: Found ${recipeKeys.length} recipe keys.`);

    if (recipeKeys.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[api/recipes]: Fetching ${recipeKeys.length} recipes using mget...`);
    const recipesData = await kv.mget<Recipe[]>(...recipeKeys);
    console.log(`[api/recipes]: Received ${recipesData.length} results from mget.`);

    const recipes: Recipe[] = recipesData.filter((recipe, index) => {
      if (recipe === null) {
        console.warn(`[api/recipes]: Got null for key ${recipeKeys[index]} during mget.`);
        return false;
      }
      const validationResult = RecipeSchema.safeParse(recipe);
      if (!validationResult.success) {
          console.warn(`[api/recipes]: Skipping invalid recipe from KV key ${recipeKeys[index]}:`, validationResult.error.errors);
          return false;
      }
      return true;
    }) as Recipe[];

    console.log(`[api/recipes]: Returning ${recipes.length} valid recipes.`);
    return new Response(JSON.stringify(recipes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[api/recipes]: Error getting recipes from KV:', error);
    const message = error instanceof Error ? error.message : 'Failed to load recipes from KV.';
    return new Response(JSON.stringify({ message, details: error instanceof Error ? error.stack : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// No other functions (POST, PUT, DELETE for this file)
// No imports needed for this simple test 