import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

import { NextResponse } from 'next/server';
import { RecipeCreateSchema, RecipeSchema } from '../src/utils/apiSchemas';
import { redis, RECIPE_PREFIX } from '../src/utils/redisClient';
import { fetchAllRecipes } from '../src/utils/recipeFetcher';
import { verifyAuth } from '../src/utils/auth';
import { serverLogger } from '../src/utils/serverLogger';
import type { Recipe } from '../src/types/recipe';

const MOD = 'api/recipes';

// --- GET Handler (List Recipes) ---
export async function GET(_request: Request): Promise<NextResponse> {
  serverLogger.log(MOD, 'GET request received');

  try {
    const validRecipes = await fetchAllRecipes({
      schema: RecipeSchema,
      logContext: MOD,
    });

    return NextResponse.json(validRecipes);

  } catch (error: unknown) {
    serverLogger.error(MOD, 'GET error fetching recipes:', error);
    const message = error instanceof Error ? error.message : 'Failed to load recipes.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- POST Handler (Create Recipe) ---
export async function POST(request: Request): Promise<NextResponse> {
  serverLogger.log(MOD, 'POST request received');

  // Verify Clerk authentication
  const userId = await verifyAuth(request);

  if (!userId) {
    serverLogger.log(MOD, 'POST no authenticated user found');
    return NextResponse.json({
      message: 'Authentication required. Please sign in to create recipes.'
    }, { status: 401 });
  }

  serverLogger.log(MOD, `POST authenticated user: ${userId}`);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    serverLogger.error(MOD, 'POST error parsing JSON body:', error);
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const validationResult = RecipeCreateSchema.safeParse(requestBody);
  if (!validationResult.success) {
    serverLogger.error(MOD, 'POST recipe validation failed:', validationResult.error.flatten());
    return NextResponse.json(
      { message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const validatedData = validationResult.data;
  const newId = crypto.randomUUID();
  const key = `${RECIPE_PREFIX}${newId}`;

  serverLogger.log(MOD, `POST generated ID: ${newId}, key: ${key}`);

  const newRecipe = {
    ...validatedData,
    id: newId,
  } as Recipe;

  try {
    serverLogger.log(MOD, `POST saving to Redis key: ${key}`);
    const setResult = await redis.set(key, newRecipe, { nx: true });

    if (setResult === null) {
      serverLogger.warn(MOD, `POST key ${key} already exists (NX failed)`);
      return NextResponse.json({ message: `Recipe with generated ID '${newId}' already exists.` }, { status: 409 });
    }

    return NextResponse.json(newRecipe, { status: 201 });

  } catch (error: unknown) {
    serverLogger.error(MOD, `POST error saving recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error saving recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
