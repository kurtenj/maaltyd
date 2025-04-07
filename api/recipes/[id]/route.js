"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.DELETE = DELETE;
exports.PUT = PUT;
const blob_1 = require("@vercel/blob");
const server_1 = require("next/server");
const zod_1 = require("zod");
// Remove Recipe type import as it's not directly used here
// import type { Recipe } from '../../../src/types/recipe';
// Import the action and custom error
const recipeActions_1 = require("../../lib/recipeActions");
// Zod schema for Ingredient (needed for Recipe validation)
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    unit: zod_1.z.string(),
});
// Zod schema for Recipe validation
const RecipeSchema = zod_1.z.object({
    id: zod_1.z.string().optional(), // ID is added after fetch, not in blob
    title: zod_1.z.string().min(1),
    main: zod_1.z.string().min(1),
    other: zod_1.z.array(IngredientSchema).min(1),
    instructions: zod_1.z.array(zod_1.z.string()).min(1),
});
// Remove or comment out to use default Node.js runtime
// export const runtime = 'edge';
async function GET(request, { params }) {
    console.log(`--- GET /api/recipes/[id] HANDLER EXECUTED for ID: ${params?.id} ---`);
    if (!params || !params.id) {
        console.error('[GET /api/recipes/[id]] Error: ID parameter is missing.');
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    const id = params.id;
    const blobPathname = `recipes/${id}.json`;
    console.log(`[GET /api/recipes/[id]] Constructed blobPathname: ${blobPathname}`);
    try {
        // 1. Check if blob exists
        console.log(`[GET /api/recipes/[id]] Checking existence with head(${blobPathname})...`);
        const blobInfo = await (0, blob_1.head)(blobPathname); // Throws if not found
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
        return server_1.NextResponse.json(recipeWithId, { status: 200 });
    }
    catch (error) {
        // Log the raw error for diagnostics
        console.error('[GET /api/recipes/[id]] Caught error:', error);
        // Check specifically for BlobNotFoundError from head()
        // Need to check the error structure/message Vercel Blob throws
        if (error instanceof Error && (error.name === 'BlobNotFoundError' || error.message.includes('The requested blob does not exist'))) {
            console.log('[GET /api/recipes/[id]] Caught BlobNotFoundError, returning 404.');
            return server_1.NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
        }
        // Handle other errors
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        console.error(`[GET /api/recipes/[id]] Returning 500: ${message}`);
        return server_1.NextResponse.json({ message: `Server error: ${message}` }, { status: 500 });
    }
}
async function DELETE(request) {
    // --- TEMPORARY TEST --- 
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];
    console.log(`--- !!! DELETE /api/recipes/${id} ROUTE HANDLER REACHED (TEMP TEST) !!! ---`);
    return new server_1.NextResponse(null, { status: 204 });
    // --- END TEMP TEST ---
    /*
      // Original code commented out:
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
        return new NextResponse(null, { status: 204 });
    
      } catch (error: unknown) {
        console.error(`[Route] Error calling deleteRecipeAction for id ${id}:`, error);
    
        if (error instanceof RecipeNotFoundError) {
            return NextResponse.json({ message: error.message }, { status: 404 });
        }
        
        const message = error instanceof Error ? error.message : 'Unknown server error during deletion.';
        return NextResponse.json(
          { message: 'Server error deleting recipe.', error: message },
          { status: 500 }
        );
      }
    */
}
async function PUT(request) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    console.log(`[Route] PUT request for recipe id: ${id}`);
    let requestBody;
    try {
        requestBody = await request.json();
    }
    catch (error) {
        console.error(`[Route] Error parsing JSON body for id ${id}:`, error);
        return server_1.NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
    }
    try {
        const updatedRecipe = await (0, recipeActions_1.updateRecipeAction)(id, requestBody);
        console.log(`[Route] updateRecipeAction completed successfully for id: ${id}`);
        return server_1.NextResponse.json(updatedRecipe, { status: 200 });
    }
    catch (error) {
        console.error(`[Route] Error calling updateRecipeAction for id ${id}:`, String(error));
        // Check for the custom validation error flag using indexed access
        if (typeof error === 'object' && error !== null && 'isValidationError' in error && error.isValidationError === true) {
            console.log('[Route] Caught validation error');
            // Safely access details using indexed access check
            const details = (typeof error === 'object' && error !== null && 'details' in error) ? error.details : 'Validation failed';
            return server_1.NextResponse.json({ message: 'Invalid recipe data provided.', errors: details }, { status: 400 });
        }
        else {
            // Handle other potential errors
            console.log('[Route] Caught other error type');
            let message = 'Unknown server error during update.';
            if (error instanceof Error) {
                message = error.message;
            }
            else if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
                message = error.message;
            }
            else if (typeof error === 'string') {
                message = error;
            }
            return server_1.NextResponse.json({ message: 'Server error updating recipe.', errorDetail: message }, { status: 500 });
        }
    }
}
//# sourceMappingURL=route.js.map