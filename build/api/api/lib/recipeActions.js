"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeNotFoundError = void 0;
exports.deleteRecipeAction = deleteRecipeAction;
exports.updateRecipeAction = updateRecipeAction;
const blob_1 = require("@vercel/blob");
const zod_1 = require("zod");
// Custom Error for specific cases might be useful
class RecipeNotFoundError extends Error {
    constructor(message = "Recipe not found") {
        super(message);
        this.name = "RecipeNotFoundError";
    }
}
exports.RecipeNotFoundError = RecipeNotFoundError;
// --- Zod Schemas (Duplicated from route for now, consider sharing) ---
// Note: Ideally, these schemas would be defined in a shared location
// and imported here and in the route handler.
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    unit: zod_1.z.string(),
});
const RecipeSchemaForUpdate = zod_1.z.object({
    // ID is handled separately, not expected in the input data for update
    title: zod_1.z.string().min(1),
    main: zod_1.z.string().min(1),
    other: zod_1.z.array(IngredientSchema).min(1),
    instructions: zod_1.z.array(zod_1.z.string()).min(1),
});
// --- End Schemas ---
/**
 * Deletes a recipe blob from storage based on its ID.
 * Throws RecipeNotFoundError if the blob doesn't exist initially.
 * Throws generic Error for other failures.
 * @param id The recipe ID (filename without .json)
 */
async function deleteRecipeAction(id) {
    if (!id) {
        throw new Error('Recipe ID cannot be empty.');
    }
    const blobPathname = `recipes/${id}.json`;
    console.log(`[Action] Attempting to delete recipe blob: ${blobPathname}`);
    try {
        // 1. Get blob metadata (including URL) - this also checks existence
        const blobInfo = await (0, blob_1.head)(blobPathname);
        console.log(`[Action] Blob found for deletion: ${blobInfo.url}`);
        // 2. Delete using the full URL
        await (0, blob_1.del)(blobInfo.url);
        console.log(`[Action] Successfully deleted blob: ${blobPathname}`);
    }
    catch (error) {
        // Check if the error is specifically a "not found" error from head()
        if (error instanceof Error && (error.name === 'BlobNotFoundError' || error.message.includes('The requested blob does not exist'))) {
            console.warn(`[Action] Blob not found during delete attempt (id: ${id}).`);
            // Let the caller decide how to handle "not found" - here we throw a specific error
            throw new RecipeNotFoundError(`Recipe with ID ${id} not found for deletion.`);
        }
        // Log the original error for diagnostics
        console.error(`[Action] Error during delete process for ${blobPathname}:`, error);
        // Re-throw a generic error for other issues
        const message = error instanceof Error ? error.message : 'Unknown error during deletion process.';
        throw new Error(`Failed to delete recipe ${id}: ${message}`);
    }
}
/**
 * Updates a recipe blob in storage.
 * Validates input data against the schema.
 * Throws ZodError if validation fails.
 * Throws generic Error for other failures.
 * @param id The recipe ID (filename without .json)
 * @param data The raw recipe data received from the request body.
 * @returns The updated recipe data including the ID.
 */
async function updateRecipeAction(id, data) {
    if (!id) {
        throw new Error('Recipe ID cannot be empty for update.');
    }
    const blobPathname = `recipes/${id}.json`;
    console.log(`[Action] Attempting to update recipe blob: ${blobPathname}`);
    // 1. Validate incoming data (excluding ID)
    let validatedRecipeData;
    try {
        const validationResult = RecipeSchemaForUpdate.safeParse(data);
        if (!validationResult.success) {
            // Throw a specific custom error for validation failure
            const validationError = new Error('Validation failed');
            // Attach properties using double cast (Error -> unknown -> Record)
            validationError['isValidationError'] = true;
            validationError['details'] = validationResult.error.flatten();
            console.error('[Action] Recipe update validation failed:', validationError);
            throw validationError;
        }
        validatedRecipeData = validationResult.data;
    }
    catch (err) {
        // Re-throw if it wasn't the custom validation error
        // Use type guard with indexed access check
        if (typeof err === 'object' && err !== null && 'isValidationError' in err && err.isValidationError === true) {
            throw err; // Re-throw the custom validation error
        }
        // Handle unexpected errors during parsing/validation if any
        console.error('[Action] Unexpected error during validation:', err);
        throw new Error('Unexpected error during data validation.');
    }
    // 2. Construct the full recipe object to save (including the ID)
    const recipeToSave = {
        ...validatedRecipeData,
        id: id // Add the id back
    };
    try {
        // 3. Upload the validated data, overwriting the existing blob
        console.log(`[Action] Saving validated recipe to blob: ${blobPathname}`);
        await (0, blob_1.put)(blobPathname, JSON.stringify(recipeToSave, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false, // Ensure we overwrite the exact file
        });
        console.log(`[Action] Successfully saved recipe to blob: ${blobPathname}`);
        // 4. Return the updated recipe data
        return recipeToSave;
    }
    catch (error) {
        console.error(`[Action] Error saving updated blob ${blobPathname}:`, error);
        // Re-throw a generic error for blob storage issues
        const message = error instanceof Error ? error.message : 'Unknown error saving updated recipe.';
        throw new Error(`Failed to save updated recipe ${id}: ${message}`);
    }
}
// Remove redundant comment
// // We will add updateRecipeAction here later 
//# sourceMappingURL=recipeActions.js.map