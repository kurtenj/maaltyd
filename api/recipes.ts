import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

// Use Upstash SDK
import { Redis } from '@upstash/redis';
// Remove @vercel/kv import
// import { kv } from '@vercel/kv';
import { z } from 'zod';
import type { Recipe } from '../src/types/recipe';
import { NextResponse } from 'next/server'; // Use NextResponse for consistency

// Initialize Redis client with proper URL prefixing
const redisUrl = process.env.KV_REST_API_URL || '';
const redisToken = process.env.KV_REST_API_TOKEN || '';

// Add a check immediately after initialization
if (!redisUrl || !redisToken) {
  console.error('CRITICAL: Redis URL or Token is missing from environment variables!');
}

// Initialize the Redis client properly
const redis = new Redis({
  url: redisUrl,  // Must be a complete URL
  token: redisToken,
});

console.log(`[api/recipes.ts] Initializing Redis with URL: ${redisUrl ? redisUrl : 'MISSING!'}`);
console.log('--- !!! api/recipes.ts TOP LEVEL EXECUTION (Explicit Redis Init) !!! ---');

// --- Schemas ---
const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string().min(1), z.number()]), // Ensure string quantity isn't empty
  unit: z.string().optional(), // Make unit optional
});

// Base Recipe Schema (used for validation on read and as base for create)
const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1), // Ensure instructions aren't empty
});

// Schema for validating data during creation (ID is generated, not provided)
const RecipeCreateSchema = RecipeSchema.omit({ id: true });
// --- End Schemas ---

const RECIPE_PREFIX = 'recipe:';

// --- GET Handler (List Recipes) ---
export async function GET(_request: Request): Promise<NextResponse> {
  console.log(`[api/recipes]: GET request received (using @upstash/redis).`);

  console.log('[api/recipes]: Attempting to get recipe keys from Redis using SCAN...');
  try {
    const recipeKeys: string[] = [];
    let cursor: string | number = 0;
    do {
      const [nextCursorStr, keys] = await redis.scan(cursor as number, { match: `${RECIPE_PREFIX}*` });
      recipeKeys.push(...keys);
      cursor = nextCursorStr;
    } while (cursor !== '0');

    console.log(`[api/recipes]: Found ${recipeKeys.length} recipe keys via SCAN.`);

    if (recipeKeys.length === 0) {
      return NextResponse.json([]);
    }

    console.log(`[api/recipes]: Fetching ${recipeKeys.length} recipes using mget...`);
    // Use redis.mget - returns array of results (data or null)
    const recipesData = await redis.mget<Recipe[]>(...recipeKeys);
    console.log(`[api/recipes]: Received ${recipesData ? recipesData.length : 'null'} results from mget.`);

    // Filter out nulls (recipes not found) and invalid data
    const validRecipes = recipesData.filter(recipe => {
      if (!recipe) return false;
      const result = RecipeSchema.safeParse(recipe);
      if (!result.success) {
        console.warn(`[GET /api/recipes] Invalid recipe data found in Redis, skipping: ${JSON.stringify(recipe)}`, result.error.flatten());
        return false;
      }
      return true;
    });

    console.log(`[api/recipes]: Returning ${validRecipes.length} valid recipes.`);
    return NextResponse.json(validRecipes);

  } catch (error: unknown) {
    console.error('[GET /api/recipes] Error fetching recipes:', error);
    const message = error instanceof Error ? error.message : 'Failed to load recipes.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- POST Handler (Create Recipe) ---
export async function POST(request: Request): Promise<NextResponse> {
  console.log(`[api/recipes]: POST request received (using @upstash/redis).`);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    console.error(`[api/recipes POST]: Error parsing JSON body:`, error);
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const validationResult = RecipeCreateSchema.safeParse(requestBody);
  if (!validationResult.success) {
    console.error('[api/recipes POST]: Recipe validation failed:', validationResult.error.flatten());
    return NextResponse.json(
      { message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const validatedData = validationResult.data;
  const newId = Date.now().toString(); // Simple unique ID
  const key = `${RECIPE_PREFIX}${newId}`;

  console.log(`[api/recipes POST]: Generated unique ID: ${newId} and key: ${key}`);

  const newRecipe = {
    ...validatedData,
    id: newId,
  } as Recipe; // Use type assertion to ensure it matches Recipe type

  try {
    // Use redis.set with 'nx' option to only set if the key doesn't exist
    console.log(`[api/recipes POST]: Saving new recipe to Redis key: ${key} (if not exists)`);
    // redis.set returns the object if NX fails, null if NX succeeds
    const setResult = await redis.set(key, newRecipe, { nx: true }); 
    console.log(`[api/recipes POST]: redis.set nx result for key ${key}:`, setResult);

    // If setResult is NOT null, it means the key already existed (NX failed)
    if (setResult !== 'OK') { 
      console.warn(`[POST /api/recipes] Key ${key} already exists (NX failed).`);
      return NextResponse.json({ message: `Recipe with generated ID '${newId}' already exists.` }, { status: 409 });
    }

    // If setResult is 'OK', the key was set successfully
    return NextResponse.json(newRecipe, { status: 201 });

  } catch (error: unknown) {
    console.error(`[POST /api/recipes] Error saving recipe to Redis for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error saving recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// No other functions (POST, PUT, DELETE for this file)
// No imports needed for this simple test 