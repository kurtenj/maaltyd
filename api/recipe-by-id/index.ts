import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

// Use Upstash SDK
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { z } from 'zod';
// Corrected import path again for route.ts location
import type { Recipe } from '../../src/types/recipe';

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

console.log(`[api/recipe-by-id/index.ts] Initializing Redis with URL: ${redisUrl ? redisUrl : 'MISSING!'}`);

const RECIPE_PREFIX = 'recipe:';

// --- Schemas ---
// Define these once, outside handlers
const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string().min(1), z.number()]),
  unit: z.string().optional(),
});
const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});
const RecipeUpdateSchema = RecipeSchema.omit({ id: true });
// --- End Schemas ---

console.log('--- !!! api/recipe-by-id/index.ts TOP LEVEL EXECUTION (Explicit Redis Init) !!! ---');

// --- GET Handler (Get Single Recipe) ---
export async function GET(request: Request): Promise<NextResponse> {
  // Get the ID from the URL query parameters
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  console.log(`[GET /api/recipe-by-id] Request received. ID from query: "${id}" (type: ${typeof id})`);
  console.log(`[GET /api/recipe-by-id] Request URL: ${url.pathname}${url.search}`);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required. Please provide ?id=recipeId' }, { status: 400 });
  }
  
  const key = `${RECIPE_PREFIX}${id}`;

  try {
    console.log(`[GET /api/recipe-by-id] Fetching key: ${key}`);
    const recipeData = await redis.get<Recipe>(key);
    console.log(`[GET /api/recipe-by-id] Result for key ${key}:`, recipeData);

    if (recipeData === null) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }
    
    // Optional: Validate data read from DB, though often trusted if written by same app
    const validation = RecipeSchema.safeParse(recipeData);
    if (!validation.success) {
      console.warn(`[GET /api/recipe-by-id] Invalid data found in Redis for key ${key}:`, validation.error.flatten());
      // Return 500 as data integrity issue
      return NextResponse.json({ message: 'Invalid recipe data stored.' }, { status: 500 }); 
    }

    return NextResponse.json(validation.data);

  } catch (error: unknown) {
    console.error(`[GET /api/recipe-by-id] Error fetching recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error fetching recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- DELETE Handler (Delete Recipe) ---
export async function DELETE(request: Request): Promise<NextResponse> {
  // Get the ID from the URL query parameters
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  console.log(`[DELETE /api/recipe-by-id] Request received. ID from query: "${id}" (type: ${typeof id})`);
  console.log(`[DELETE /api/recipe-by-id] Request URL: ${url.pathname}${url.search}`);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required. Please provide ?id=recipeId' }, { status: 400 });
  }
  
  const key = `${RECIPE_PREFIX}${id}`;

  try {
    const result = await redis.del(key);
    // redis.del returns number of keys deleted (0 or 1)
    // We return 204 whether it existed or not, as the goal is deletion
    console.log(`[DELETE /api/recipe-by-id] Delete result for key ${key}: ${result}`);
    return new NextResponse(null, { status: 204 });

  } catch (error: unknown) {
    console.error(`[DELETE /api/recipe-by-id] Error deleting recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error deleting recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- PUT Handler (Update Recipe) ---
export async function PUT(request: Request): Promise<NextResponse> {
  // Get the ID from the URL query parameters
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  console.log(`[PUT /api/recipe-by-id] Request received. ID from query: "${id}" (type: ${typeof id})`);
  console.log(`[PUT /api/recipe-by-id] Request URL: ${url.pathname}${url.search}`);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required. Please provide ?id=recipeId' }, { status: 400 });
  }
  
  const key = `${RECIPE_PREFIX}${id}`;

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (_error: unknown) {
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const validationResult = RecipeUpdateSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return NextResponse.json(
      { message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() },
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
      console.error(`[PUT /api/recipe-by-id] Failed to update recipe in Redis for key ${key}. Result: ${setResult}`);
      throw new Error(`Failed to update recipe. Result: ${setResult}`); // Let catch block handle response
    }

    return NextResponse.json(recipeToSave); // Return the updated recipe

  } catch (error: unknown) {
    console.error(`[PUT /api/recipe-by-id] Error updating recipe for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Error updating recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
} 