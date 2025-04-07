import { del, put, head } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Recipe } from '../../../src/types/recipe'; // Fix import path

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
  _context: { params: { id: string } } // Keep context for convention, but don't rely on it
) {
  // console.log('DELETE /api/recipes/[id] invoked.'); 
  // console.log('DELETE Context:', JSON.stringify(context, null, 2)); // Context is empty
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const id = pathSegments[pathSegments.length - 1]; 
  // console.log(`DELETE ID parsed from URL: ${id}`);

  // const id = context.params?.id; // Original method (not working)
  if (!id) {
    return NextResponse.json(
      { message: 'Recipe ID is required.' },
      { status: 400 }
    );
  }

  console.log(`Attempting to delete recipe blob with id: ${id}`);
  const blobPathname = `recipes/${id}.json`;

  try {
    await del(blobPathname);
    console.log(`Successfully deleted blob: ${blobPathname}`);
    // Return 204 No Content on successful deletion
    return new NextResponse(null, { status: 204 }); 
  } catch (error: unknown) {
    console.error(`Error deleting blob ${blobPathname}:`, error);
    // Type checking for error object
    let errorMessage = 'Unknown error';
    const errorStatus = 500; // Use const
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Vercel Blob errors might have a status property
    if (typeof error === 'object' && error !== null && 'status' in error) {
        // Type assertion after check (slightly better than direct any)
        const status = (error as { status: unknown }).status; 
        if (status === 404 || errorMessage.includes('The specified blob does not exist')) {
            console.warn(`Blob not found during delete attempt (id: ${id}), returning success.`);
            return new NextResponse(null, { status: 204 }); // Treat as success if already gone
        }
    }
    return NextResponse.json(
      { message: 'Error deleting recipe.', error: errorMessage },
      { status: errorStatus } // Use generic 500 unless specific status known
    );
  }
}

export async function PUT(
  request: Request,
  _context: { params: { id: string } } // Keep context for convention, but don't rely on it
) {
  // console.log('PUT /api/recipes/[id] invoked.');
  // console.log('PUT Context:', JSON.stringify(context, null, 2)); // Context is empty
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const id = pathSegments[pathSegments.length - 1]; 
  // console.log(`PUT ID parsed from URL: ${id}`);

  // const id = context.params?.id; // Original method (not working)
  if (!id) {
    return NextResponse.json(
      { message: 'Recipe ID is required.' },
      { status: 400 }
    );
  }

  const blobPathname = `recipes/${id}.json`;

  try {
    const body = await request.json();
    // console.log(`Received PUT request for id: ${id} with body:`, JSON.stringify(body));

    const validationResult = RecipeSchema.safeParse(body); 

    // console.log('Validation Result:', JSON.stringify(validationResult, null, 2));

    if (!validationResult.success) {
      console.error('Recipe validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { message: 'Invalid recipe data.', errors: validationResult.error.errors },
        { status: 400 }
      );
    }

    // Construct the final recipe object including the ID
    const validatedRecipeData = validationResult.data; 
    
    // console.log('Validated Data before Spread:', JSON.stringify(validatedRecipeData, null, 2));

    const recipeToSave: Recipe = {
        ...validatedRecipeData,
        id: id // Add the id back 
    };

    console.log(`Attempting to save validated recipe to blob: ${blobPathname}`);

    // Upload the validated data
    await put(blobPathname, JSON.stringify(recipeToSave, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false // Ensure we overwrite the exact file
    });

    // console.log(`Successfully saved recipe to blob: ${blob.pathname}, URL: ${blob.url}`);

    // Return the updated recipe data (optional, could also return 200 OK or 204 No Content)
    return NextResponse.json(recipeToSave, { status: 200 });

  } catch (error: unknown) {
    // console.error(`Error processing PUT request for ${blobPathname}:`, error); // Keep error log?
    console.error(`Error processing PUT request for ${blobPathname}:`, error);
    let errorMessage = 'Unknown error';
    if (error instanceof SyntaxError) { // Handle JSON parsing error
         return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
    }
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error updating recipe.', error: errorMessage },
      { status: 500 }
    );
  }
} 