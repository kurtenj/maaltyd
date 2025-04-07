"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.GET = GET;
exports.DELETE = DELETE;
exports.PUT = PUT;
const blob_1 = require("@vercel/blob");
const server_1 = require("next/server");
const zod_1 = require("zod");
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
exports.runtime = 'edge';
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
async function DELETE(request, _context // Keep context for convention, but don't rely on it
) {
    // console.log('DELETE /api/recipes/[id] invoked.'); 
    // console.log('DELETE Context:', JSON.stringify(context, null, 2)); // Context is empty
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];
    // console.log(`DELETE ID parsed from URL: ${id}`);
    // const id = context.params?.id; // Original method (not working)
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    console.log(`Attempting to delete recipe blob with id: ${id}`);
    const blobPathname = `recipes/${id}.json`;
    try {
        await (0, blob_1.del)(blobPathname);
        console.log(`Successfully deleted blob: ${blobPathname}`);
        // Return 204 No Content on successful deletion
        return new server_1.NextResponse(null, { status: 204 });
    }
    catch (error) {
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
            const status = error.status;
            if (status === 404 || errorMessage.includes('The specified blob does not exist')) {
                console.warn(`Blob not found during delete attempt (id: ${id}), returning success.`);
                return new server_1.NextResponse(null, { status: 204 }); // Treat as success if already gone
            }
        }
        return server_1.NextResponse.json({ message: 'Error deleting recipe.', error: errorMessage }, { status: errorStatus } // Use generic 500 unless specific status known
        );
    }
}
async function PUT(request, _context // Keep context for convention, but don't rely on it
) {
    // console.log('PUT /api/recipes/[id] invoked.');
    // console.log('PUT Context:', JSON.stringify(context, null, 2)); // Context is empty
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];
    // console.log(`PUT ID parsed from URL: ${id}`);
    // const id = context.params?.id; // Original method (not working)
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    const blobPathname = `recipes/${id}.json`;
    try {
        const body = await request.json();
        // console.log(`Received PUT request for id: ${id} with body:`, JSON.stringify(body));
        const validationResult = RecipeSchema.safeParse(body);
        // console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
        if (!validationResult.success) {
            console.error('Recipe validation failed:', validationResult.error.errors);
            return server_1.NextResponse.json({ message: 'Invalid recipe data.', errors: validationResult.error.errors }, { status: 400 });
        }
        // Construct the final recipe object including the ID
        const validatedRecipeData = validationResult.data;
        // console.log('Validated Data before Spread:', JSON.stringify(validatedRecipeData, null, 2));
        const recipeToSave = {
            ...validatedRecipeData,
            id: id // Add the id back 
        };
        console.log(`Attempting to save validated recipe to blob: ${blobPathname}`);
        // Upload the validated data
        await (0, blob_1.put)(blobPathname, JSON.stringify(recipeToSave, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false, // Ensure we overwrite the exact file
            cacheControlMaxAge: 0 // Prevent edge and browser caching for this blob
        });
        // console.log(`Successfully saved recipe to blob: ${blob.pathname}, URL: ${blob.url}`);
        // Return the updated recipe data (optional, could also return 200 OK or 204 No Content)
        return server_1.NextResponse.json(recipeToSave, { status: 200 });
    }
    catch (error) {
        // console.error(`Error processing PUT request for ${blobPathname}:`, error); // Keep error log?
        console.error(`Error processing PUT request for ${blobPathname}:`, error);
        let errorMessage = 'Unknown error';
        if (error instanceof SyntaxError) { // Handle JSON parsing error
            return server_1.NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
        }
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return server_1.NextResponse.json({ message: 'Error updating recipe.', error: errorMessage }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map