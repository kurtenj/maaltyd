import { head } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import type { Recipe } from '../../../src/types/recipe'; // Fix import path
// Import the action and custom error
import { deleteRecipeAction, updateRecipeAction, RecipeNotFoundError } from '../../lib/recipeActions';

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

export const runtime = 'edge';

export async function GET(request: Request, { params }: RouteParams) {
  console.log(`--- GET /api/recipes/[id] HANDLER EXECUTED for ID: ${params?.id} ---`);

  if (!params || !params.id) {
    console.error('[GET /api/recipes/[id]] Error: ID parameter is missing.');
    return NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
  }

  const id = params.id;
  const blobPathname = `recipes/${id}.json`;
  console.log(`[GET /api/recipes/[id]] Constructed blobPathname: ${blobPathname}`);

  try {
    // 1. Check if blob exists
    console.log(`[GET /api/recipes/[id]] Checking existence with head(${blobPathname})...`);
    const blobInfo = await head(blobPathname); // Throws if not found
    console.log(`[GET /api/recipes/[id]] Blob found. URL: ${blobInfo.url}`);

    // 2. Fetch blob content
    console.log(`[GET /api/recipes/[id]] Fetching content from ${blobInfo.url}...`);
    const response = await fetch(blobInfo.url);

    if (!response.ok) {
      console.error(`[GET /api/recipes/[id]] Error fetching blob content. Status: ${response.status}`);
      throw new Error(`Failed to fetch recipe data. Status: ${response.status}`);
    }

    // 3. Parse JSON
    console.log(`[GET /api/recipes/[id]] Parsing JSON response...`);
    const recipeData = await response.json();

    // 4. Validate schema
    console.log(`[GET /api/recipes/[id]] Validating recipe data against schema...`);
    const validationResult = RecipeSchema.safeParse(recipeData);

    if (!validationResult.success) {
      console.error('[GET /api/recipes/[id]] Schema validation failed:', validationResult.error.errors);
      throw new Error('Recipe data from storage is invalid.');
    }
    console.log(`[GET /api/recipes/[id]] Validation successful.`);

    // 5. Return validated data (adding the id back)
    const recipeWithId = { ...validationResult.data, id: id };
    return NextResponse.json(recipeWithId, { status: 200 });

  } catch (error: unknown) {
    // Log the raw error for diagnostics
    console.error('[GET /api/recipes/[id]] Caught error:', error);

    // Check specifically for BlobNotFoundError from head()
    // Need to check the error structure/message Vercel Blob throws
    if (error instanceof Error && (error.name === 'BlobNotFoundError' || error.message.includes('The requested blob does not exist'))) {
        console.log('[GET /api/recipes/[id]] Caught BlobNotFoundError, returning 404.');
        return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error(`[GET /api/recipes/[id]] Returning 500: ${message}`);
    return NextResponse.json({ message: `Server error: ${message}` }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  _context: { params: { id: string } } 
) {
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
    // Return 204 No Content on successful deletion
    return new NextResponse(null, { status: 204 }); 

  } catch (error: unknown) {
    console.error(`[Route] Error calling deleteRecipeAction for id ${id}:`, error);

    if (error instanceof RecipeNotFoundError) {
        // If the action specifically threw RecipeNotFoundError, return 404
        return NextResponse.json({ message: error.message }, { status: 404 });
    }
    
    // Handle other potential errors
    const message = error instanceof Error ? error.message : 'Unknown server error during deletion.';
    return NextResponse.json(
      { message: 'Server error deleting recipe.', error: message },
      { status: 500 } 
    );
  }
}

export async function PUT(
  request: Request,
  _context: { params: { id: string } } 
) {
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
    // Call the action function
    const updatedRecipe = await updateRecipeAction(id, requestBody);
    console.log(`[Route] updateRecipeAction completed successfully for id: ${id}`);
    // Return the result from the action
    return NextResponse.json(updatedRecipe, { status: 200 });

  } catch (error: unknown) {
    console.error(`[Route] Error calling updateRecipeAction for id ${id}:`, error);

    if (error instanceof ZodError) {
      // Handle validation errors thrown by the action
      return NextResponse.json(
        { message: 'Invalid recipe data provided.', errors: error.flatten() }, 
        { status: 400 }
      );
    }
    
    // Handle other potential errors (e.g., blob storage failure)
    const message = error instanceof Error ? error.message : 'Unknown server error during update.';
    return NextResponse.json(
      { message: 'Server error updating recipe.', error: message },
      { status: 500 } 
    );
  }
} 