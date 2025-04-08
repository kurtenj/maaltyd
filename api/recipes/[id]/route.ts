// Imports for KV
import { kv } from '@vercel/kv'; 
// Remove blob imports
// import { head } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';
// Restore Recipe type import
import type { Recipe } from '../../../src/types/recipe';
// Import the action and custom error
import { deleteRecipeAction, updateRecipeAction } from '../../lib/recipeActions';

// Key generation helper (can be shared or redefined)
const getRecipeKey = (id: string) => `recipe:${id}`;

// Zod schema for Ingredient (needed for Recipe validation)
const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string(),
});

// Zod schema for Recipe validation
const RecipeSchema = z.object({
  id: z.string().optional(), // ID is added after fetch, not in blob
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string()).min(1),
});

// Define the expected params structure
interface RouteParams {
  params: {
    id: string;
  };
}

// Remove or comment out to use default Node.js runtime
// export const runtime = 'edge';

export async function GET(request: Request, { params }: RouteParams) {
  console.log(`--- GET /api/recipes/[id] HANDLER EXECUTED for ID: ${params?.id} ---`);

  if (!params || !params.id) {
    console.error('[GET /api/recipes/[id]] Error: ID parameter is missing.');
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }
  const id = params.id;
  const key = getRecipeKey(id);
  console.log(`[GET /api/recipes/[id]] Constructed KV key: ${key}`);

  try {
    // 1. Fetch data directly from KV
    console.log(`[GET /api/recipes/[id]] Fetching recipe from KV with key: ${key}...`);
    // Specify expected type for kv.get<Recipe>
    const recipeData = await kv.get<Recipe>(key); 
    console.log(`[GET /api/recipes/[id]] Data received from KV:`, recipeData ? `Recipe title: ${recipeData.title}` : 'null');

    // 2. Check if data exists
    if (recipeData === null) {
      console.log(`[GET /api/recipes/[id]] Recipe not found in KV for key: ${key}`);
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }

    // 3. Optional: Validate data read from KV (good practice)
    // Although data *should* be valid if saved correctly, this adds robustness
    const validationResult = RecipeSchema.safeParse(recipeData);
    if (!validationResult.success) {
      console.error('[GET /api/recipes/[id]] Invalid data found in KV:', validationResult.error.flatten());
      // Decide how to handle - return error or maybe try to fix/ignore?
      return NextResponse.json({ message: 'Recipe data retrieved from storage is invalid.' }, { status: 500 });
    }
    console.log(`[GET /api/recipes/[id]] Validation of KV data successful.`);

    // 4. Return the data
    // Ensure the ID is present (kv.set in action adds it)
    return NextResponse.json(validationResult.data, { status: 200 });

  } catch (error: unknown) {
    console.error(`[GET /api/recipes/[id]] Error fetching recipe from KV for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while fetching the recipe.';
    return NextResponse.json({ message: `Server error: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const id = pathSegments[pathSegments.length - 1]; 
  
  if (!id) {
    return NextResponse.json(
      { message: 'Recipe ID is required.' },
      { status: 400 }
    );
  }

  console.log(`[Route] DELETE request for recipe id: ${id}`);

  try {
    await deleteRecipeAction(id);
    console.log(`[Route] deleteRecipeAction completed successfully for id: ${id}`);
    // kv.del doesn't error on non-existent key, so we always return 204 if action succeeds
    return new NextResponse(null, { status: 204 }); 

  } catch (error: unknown) {
    console.error(`[Route] Error calling deleteRecipeAction for id ${id}:`, error);

    // Handle other potential errors from kv.del
    const message = error instanceof Error ? error.message : 'Unknown server error during deletion.';
    return NextResponse.json(
      { message: 'Server error deleting recipe.', error: message },
      { status: 500 } 
    );
  }
}

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const id = pathSegments[pathSegments.length - 1]; 

  if (!id) {
    return NextResponse.json(
      { message: 'Recipe ID is required.' },
      { status: 400 }
    );
  }

  console.log(`[Route] PUT request for recipe id: ${id}`);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    console.error(`[Route] Error parsing JSON body for id ${id}:`, error);
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  try {
    const updatedRecipe = await updateRecipeAction(id, requestBody);
    console.log(`[Route] updateRecipeAction completed successfully for id: ${id}`);
    return NextResponse.json(updatedRecipe, { status: 200 });

  } catch (error: unknown) {
    console.error(`[Route] Error calling updateRecipeAction for id ${id}:`, String(error)); 

    // Check for the custom validation error flag using indexed access
    if (typeof error === 'object' && error !== null && 'isValidationError' in error && error.isValidationError === true) {
      console.log('[Route] Caught validation error');
      // Safely access details using indexed access check
      const details = (typeof error === 'object' && error !== null && 'details' in error) ? error.details : 'Validation failed';
      return NextResponse.json(
        { message: 'Invalid recipe data provided.', errors: details }, 
        { status: 400 }
      );
    } else {
       // Handle other potential errors
      console.log('[Route] Caught other error type');
      let message = 'Unknown server error during update.';
      if (error instanceof Error) {
          message = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
          message = error.message;
      } else if (typeof error === 'string') {
          message = error;
      }
      
      return NextResponse.json(
        { message: 'Server error updating recipe.', errorDetail: message },
        { status: 500 } 
      );
    }
  }
} 