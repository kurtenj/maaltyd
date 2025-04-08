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

// Key generation helper (Redefined here)
const getRecipeKey = (id: string) => `recipe:${id}`;

// Helper function to generate a simple slug
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars except -
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

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

// --- POST Handler to Create New Recipes ---
export async function POST(request: Request) {
  console.log(`[api/recipes]: POST request received.`);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    console.error(`[api/recipes POST]: Error parsing JSON body:`, error);
    return new Response(JSON.stringify({ message: 'Invalid JSON in request body.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // 1. Validate incoming data (should NOT include ID)
  const validationResult = RecipeSchema.safeParse(requestBody);
  if (!validationResult.success) {
    console.error('[api/recipes POST]: Recipe validation failed:', validationResult.error.flatten());
    return new Response(JSON.stringify({ message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // 2. Generate ID (slug from title)
  const validatedData = validationResult.data;
  const newId = slugify(validatedData.title);
  const key = getRecipeKey(newId); // Use the same key generation

  console.log(`[api/recipes POST]: Generated key: ${key} for title: "${validatedData.title}"`);

  // 3. Construct the full recipe object
  const newRecipe: Recipe = {
    ...validatedData,
    id: newId, // Add the generated ID
  };

  try {
    // 4. Optional but recommended: Check if key already exists to prevent overwrite
    const existing = await kv.get(key);
    if (existing !== null) {
        console.warn(`[api/recipes POST]: Key ${key} already exists. Aborting creation.`);
        return new Response(JSON.stringify({ message: `Recipe with ID '${newId}' already exists.` }), { status: 409, headers: { 'Content-Type': 'application/json' } }); // 409 Conflict
    }

    // 5. Save to KV
    console.log(`[api/recipes POST]: Saving new recipe to KV key: ${key}`);
    const setResult = await kv.set(key, newRecipe);
    console.log(`[api/recipes POST]: kv.set result for key ${key}: ${setResult}`);

    if (setResult !== 'OK') {
      console.error(`[api/recipes POST]: kv.set failed for key ${key}, result: ${setResult}`);
      throw new Error('Failed to save recipe to KV store.');
    }

    // 6. Return 201 Created with the new recipe data
    return new Response(JSON.stringify(newRecipe), {
      status: 201, // Created
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error(`[api/recipes POST]: Error saving new recipe to KV for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error saving new recipe.';
    return new Response(JSON.stringify({ message: `Server error: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// No other functions (POST, PUT, DELETE for this file)
// No imports needed for this simple test 