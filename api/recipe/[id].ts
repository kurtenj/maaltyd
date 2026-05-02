import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

import { NextResponse } from 'next/server';
import { RecipeSchema, RecipeUpdateSchema } from '../../src/utils/apiSchemas';
import { redis, getRecipeKey } from '../../src/utils/redisClient';
import { verifyAuth } from '../../src/utils/auth';
import { serverLogger } from '../../src/utils/serverLogger';
import type { Recipe } from '../../src/types/recipe';

const MOD = 'api/recipe/[id]';

/**
 * Extract recipe ID from request context or URL pathname
 * Handles both Vercel's context.params and fallback URL parsing
 */
function extractRecipeId(request: Request, context: { params: { id: string } }): string | null {
  // Try to get ID from context params first (Vercel's standard way)
  let id = context?.params?.id;

  // Fallback: extract ID from URL pathname if context.params is not working
  if (!id) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    id = pathSegments[pathSegments.length - 1]; // Get the last segment
    serverLogger.log(MOD, `fallback: extracted ID from URL: "${id}"`);
  }

  return id || null;
}

// --- GET Handler (Get Single Recipe) ---
export async function GET(request: Request, context: { params: { id: string } }): Promise<NextResponse> {
  const id = extractRecipeId(request, context);

  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }

  serverLogger.log(MOD, `GET request. ID: "${id}"`);
  const key = getRecipeKey(id);

  try {
    serverLogger.log(MOD, `GET fetching key: ${key}`);
    const recipeData = await redis.get<Recipe>(key);
    serverLogger.log(MOD, `GET result for key ${key}:`, recipeData);

    if (recipeData === null) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }

    const validation = RecipeSchema.safeParse(recipeData);
    if (!validation.success) {
      serverLogger.warn(MOD, `GET invalid data in Redis for key ${key}:`, validation.error.flatten());
      return NextResponse.json({ message: 'Invalid recipe data stored.' }, { status: 500 });
    }

    return NextResponse.json(validation.data);

  } catch (error: unknown) {
    serverLogger.error(MOD, `GET error fetching recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error fetching recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- DELETE Handler (Delete Recipe) ---
export async function DELETE(request: Request, context: { params: { id: string } }): Promise<NextResponse> {
  // Verify Clerk authentication
  const userId = await verifyAuth(request);

  if (!userId) {
    serverLogger.log(MOD, 'DELETE no authenticated user found');
    return NextResponse.json({
      message: 'Authentication required. Please sign in to delete recipes.'
    }, { status: 401 });
  }

  const id = extractRecipeId(request, context);

  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }

  serverLogger.log(MOD, `DELETE request. ID: "${id}"`);
  const key = getRecipeKey(id);

  try {
    const result = await redis.del(key);
    serverLogger.log(MOD, `DELETE result for key ${key}: ${result}`);
    return new NextResponse(null, { status: 204 });

  } catch (error: unknown) {
    serverLogger.error(MOD, `DELETE error for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error deleting recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- PUT Handler (Update Recipe) ---
export async function PUT(request: Request, context: { params: { id: string } }): Promise<NextResponse> {
  // Verify Clerk authentication
  const userId = await verifyAuth(request);

  if (!userId) {
    return NextResponse.json({
      message: 'Authentication required. Please sign in to update recipes.'
    }, { status: 401 });
  }

  const id = extractRecipeId(request, context);

  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }

  serverLogger.log(MOD, `PUT request. ID: "${id}"`);
  const key = getRecipeKey(id);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (_error: unknown) {
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  if (requestBody === null || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return NextResponse.json({ message: 'Request body must be an object.' }, { status: 400 });
  }

  const { id: _id, ...bodyWithoutId } = requestBody as { id?: string; [key: string]: unknown };

  const validationResult = RecipeUpdateSchema.safeParse(bodyWithoutId);
  if (!validationResult.success) {
    serverLogger.error(MOD, 'PUT validation failed:', validationResult.error.flatten());
    return NextResponse.json(
      {
        message: 'Invalid recipe data provided.',
        errors: validationResult.error.flatten()
      },
      { status: 400 }
    );
  }

  const recipeToSave = {
    ...validationResult.data,
    id: id,
  } as Recipe;

  try {
    const setResult = await redis.set(key, recipeToSave);

    if (setResult !== 'OK') {
      serverLogger.error(MOD, `PUT failed to update recipe for key ${key}. Result: ${setResult}`);
      throw new Error(`Failed to update recipe. Result: ${setResult}`);
    }

    return NextResponse.json(recipeToSave);

  } catch (error: unknown) {
    serverLogger.error(MOD, `PUT error updating recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error updating recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
