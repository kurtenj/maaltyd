import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { RecipeCreateSchema, RecipeSchema } from '../src/utils/apiSchemas';
import { redis, RECIPE_PREFIX } from '../src/utils/redisClient';
import { fetchAllRecipes } from '../src/utils/recipeFetcher';
import { verifyAuth } from '../src/utils/auth';
import type { Recipe } from '../src/types/recipe';

console.log('--- !!! api/recipes.ts TOP LEVEL EXECUTION (Shared Redis Init) !!! ---');

// --- GET Handler (List Recipes) ---
export async function GET(_request: Request): Promise<NextResponse> {
  console.log(`[api/recipes]: GET request received (using @upstash/redis).`);

  try {
    const validRecipes = await fetchAllRecipes({
      schema: RecipeSchema,
      logContext: 'api/recipes',
    });

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

  // Verify Clerk authentication
  const userId = await verifyAuth(request);
  
  if (!userId) {
    console.log('[POST /api/recipes]: No authenticated user found');
    return NextResponse.json({ 
      message: 'Authentication required. Please sign in to create recipes.' 
    }, { status: 401 });
  }
  
  console.log(`[POST /api/recipes]: Authenticated user: ${userId}`);

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
  const newId = uuidv4(); // Generate UUID for unique ID
  const key = `${RECIPE_PREFIX}${newId}`;

  console.log(`[api/recipes POST]: Generated unique ID: ${newId} and key: ${key}`);

  const newRecipe = {
    ...validatedData,
    id: newId,
  } as Recipe; // Use type assertion to ensure it matches Recipe type

  try {
    // Use redis.set with 'nx' option to only set if the key doesn't exist
    console.log(`[api/recipes POST]: Saving new recipe to Redis key: ${key} (if not exists)`);
    const setResult = await redis.set(key, newRecipe, { nx: true });

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

// Ensure file ends correctly
