import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

import { NextResponse } from 'next/server';
import { RecipeSchema, RecipeUpdateSchema } from '../../src/utils/apiSchemas';
import { redis, getRecipeKey } from '../../src/utils/redisClient';
import { verifyAuth } from '../../src/utils/auth';
import type { Recipe } from '../../src/types/recipe';

console.log('--- !!! api/recipe/[id].ts TOP LEVEL EXECUTION (Shared Redis Init) !!! ---');

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
    console.log(`[api/recipe/{id}] Fallback: extracted ID from URL: "${id}"`);
  }
  
  return id || null;
}

// --- GET Handler (Get Single Recipe) ---
export async function GET(request: Request, context: { params: { id: string } }): Promise<NextResponse> {
  const id = extractRecipeId(request, context);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }
  
  console.log(`[GET /api/recipe/{id}] Request received. ID: "${id}"`);
  const key = getRecipeKey(id);

  try {
    console.log(`[GET /api/recipe/{id}] Fetching key: ${key}`);
    const recipeData = await redis.get<Recipe>(key);
    console.log(`[GET /api/recipe/{id}] Result for key ${key}:`, recipeData);

    if (recipeData === null) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }
    
    // Optional: Validate data read from DB, though often trusted if written by same app
    const validation = RecipeSchema.safeParse(recipeData);
    if (!validation.success) {
      console.warn(`[GET /api/recipe/{id}] Invalid data found in Redis for key ${key}:`, validation.error.flatten());
      // Return 500 as data integrity issue
      return NextResponse.json({ message: 'Invalid recipe data stored.' }, { status: 500 }); 
    }

    return NextResponse.json(validation.data);

  } catch (error: unknown) {
    console.error(`[GET /api/recipe/{id}] Error fetching recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error fetching recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- DELETE Handler (Delete Recipe) ---
export async function DELETE(request: Request, context: { params: { id: string } }): Promise<NextResponse> {
  // Verify Clerk authentication
  const userId = await verifyAuth(request);
  
  if (!userId) {
    console.log('[DELETE /api/recipe/{id}]: No authenticated user found');
    return NextResponse.json({ 
      message: 'Authentication required. Please sign in to delete recipes.' 
    }, { status: 401 });
  }

  const id = extractRecipeId(request, context);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }
  
  console.log(`[DELETE /api/recipe/{id}] Request received. ID: "${id}"`);
  const key = getRecipeKey(id);

  try {
    const result = await redis.del(key);
    // redis.del returns number of keys deleted (0 or 1)
    // We return 204 whether it existed or not, as the goal is deletion
    console.log(`[DELETE /api/recipe/{id}] Delete result for key ${key}: ${result}`);
    return new NextResponse(null, { status: 204 }); // Use NextResponse for consistency

  } catch (error: unknown) {
    console.error(`[DELETE /api/recipe/{id}] Error deleting recipe for key ${key}:`, error);
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
  
  console.log(`[PUT /api/recipe/{id}] Request received. ID: "${id}"`);
  const key = getRecipeKey(id);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (_error: unknown) {
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  // Validate that requestBody is an object (not null, not array, not primitive)
  if (requestBody === null || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return NextResponse.json({ message: 'Request body must be an object.' }, { status: 400 });
  }

  // Strip out the 'id' field from request body since it comes from the URL
  const { id: _id, ...bodyWithoutId } = requestBody as { id?: string; [key: string]: unknown };
  
  const validationResult = RecipeUpdateSchema.safeParse(bodyWithoutId);
  if (!validationResult.success) {
    console.error('[PUT /api/recipe/{id}] Validation failed:', validationResult.error.flatten());
    return NextResponse.json(
      { 
        message: 'Invalid recipe data provided.', 
        errors: validationResult.error.flatten()
      },
      { status: 400 }
    );
  }

  // Construct the full recipe object, including the ID from the route
  const recipeToSave = {
    ...validationResult.data,
    id: id,
  } as Recipe; // Use type assertion to ensure it matches Recipe type

  try {
    // Overwrite the key with the new validated data
    const setResult = await redis.set(key, recipeToSave);

    if (setResult !== 'OK') {
      console.error(`[PUT /api/recipe/{id}] Failed to update recipe in Redis for key ${key}. Result: ${setResult}`);
      throw new Error(`Failed to update recipe. Result: ${setResult}`); // Let catch block handle response
    }

    return NextResponse.json(recipeToSave); // Return the updated recipe

  } catch (error: unknown) {
    console.error(`[PUT /api/recipe/{id}] Error updating recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error updating recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
} 