import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Load env vars for local dev

// Use Upstash SDK
import { Redis } from '@upstash/redis';
// Remove @vercel/kv import
// import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { z } from 'zod';
// Corrected import path again for route.ts location
import type { Recipe } from '../../src/types/recipe';
// Remove import for recipe actions
// import { deleteRecipeAction, updateRecipeAction } from '../../../lib/recipeActions';

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

console.log(`[api/recipe/[id].ts] Initializing Redis with URL: ${redisUrl ? redisUrl : 'MISSING!'}`);

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
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  excludeFromMealPlan: z.boolean().optional(),
});
const RecipeUpdateSchema = RecipeSchema.omit({ id: true });
// --- End Schemas ---

// Define the structure of the second argument (context)
interface HandlerContext {
  params: { id: string };
}

// Remove or comment out to use default Node.js runtime
// export const runtime = 'edge';

console.log('--- !!! api/recipe/[id].ts TOP LEVEL EXECUTION (Explicit Redis Init) !!! ---');

// --- GET Handler (Get Single Recipe) ---
export async function GET(request: Request, context: HandlerContext): Promise<NextResponse> {
  // Log full context to debug
  console.log(`[GET /api/recipe/{id}] Context:`, JSON.stringify(context));
  
  // Extract the ID from the URL path parameter
  const id = context?.params?.id;
  console.log(`[GET /api/recipe/{id}] Request received. ID from context.params: "${id}" (type: ${typeof id})`);
  
  // Also log the URL to check if ID is in the path
  const url = new URL(request.url);
  console.log(`[GET /api/recipe/{id}] Request URL: ${url.pathname}`);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }
  const key = `${RECIPE_PREFIX}${id}`;

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
export async function DELETE(request: Request, context: HandlerContext): Promise<NextResponse> {
  // Extract the ID from the URL path parameter
  const id = context?.params?.id;
  console.log(`[DELETE /api/recipe/{id}] Request received. ID from context.params: "${id}" (type: ${typeof id})`);
  
  // Also log the URL to check if ID is in the path
  const url = new URL(request.url);
  console.log(`[DELETE /api/recipe/{id}] Request URL: ${url.pathname}`);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }
  const key = `${RECIPE_PREFIX}${id}`;

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
export async function PUT(request: Request, context: HandlerContext): Promise<NextResponse> {
  // Extract the ID from the URL path parameter
  const id = context?.params?.id;
  console.log(`[PUT /api/recipe/{id}] Request received. ID from context.params: "${id}" (type: ${typeof id})`);
  
  // Also log the URL to check if ID is in the path
  const url = new URL(request.url);
  console.log(`[PUT /api/recipe/{id}] Request URL: ${url.pathname}`);
  
  if (!id) {
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
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