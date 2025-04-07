"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.DELETE = DELETE;
exports.PUT = PUT;
const blob_1 = require("@vercel/blob");
const server_1 = require("next/server");
const zod_1 = require("zod");
// Zod schema for Ingredient (needed for Recipe validation)
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string(),
    quantity: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    unit: zod_1.z.string(),
});
// Zod schema for Recipe validation
const RecipeSchema = zod_1.z.object({
    // id: z.string(), // ID comes from URL param, not body
    title: zod_1.z.string(),
    main: zod_1.z.string(),
    other: zod_1.z.array(IngredientSchema),
    instructions: zod_1.z.array(zod_1.z.string()),
});
exports.runtime = 'edge';
async function DELETE(request, { params }) {
    const id = params.id;
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
async function PUT(request, { params }) {
    const id = params.id;
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    const blobPathname = `recipes/${id}.json`;
    try {
        const body = await request.json();
        console.log(`Received PUT request for id: ${id} with body:`, JSON.stringify(body));
        // Validate the incoming data (excluding the id, which comes from the param)
        // We need to manually add the id back *after* validation for the final object
        const validationResult = RecipeSchema.safeParse(body);
        if (!validationResult.success) {
            console.error('Recipe validation failed:', validationResult.error.errors);
            return server_1.NextResponse.json({ message: 'Invalid recipe data.', errors: validationResult.error.errors }, { status: 400 });
        }
        // Construct the final recipe object including the ID
        const validatedRecipeData = validationResult.data;
        const recipeToSave = {
            ...validatedRecipeData,
            id: id // Add the id back 
        };
        console.log(`Attempting to save validated recipe to blob: ${blobPathname}`);
        // Upload the validated data
        const blob = await (0, blob_1.put)(blobPathname, JSON.stringify(recipeToSave, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false, // Ensure we overwrite the exact file
        });
        console.log(`Successfully saved recipe to blob: ${blob.pathname}, URL: ${blob.url}`);
        // Return the updated recipe data (optional, could also return 200 OK or 204 No Content)
        return server_1.NextResponse.json(recipeToSave, { status: 200 });
    }
    catch (error) {
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
//# sourceMappingURL=%5Bid%5D.js.map