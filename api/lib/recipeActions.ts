import { head, del, put } from '@vercel/blob';
import { z } from 'zod';
import type { Recipe } from '../../src/types/recipe'; // Assuming type path relative to lib

// Custom Error for specific cases might be useful
export class RecipeNotFoundError extends Error {
  constructor(message = "Recipe not found") {
    super(message);
    this.name = "RecipeNotFoundError";
  }
}

// --- Zod Schemas (Duplicated from route for now, consider sharing) ---
// Note: Ideally, these schemas would be defined in a shared location
// and imported here and in the route handler.
const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string(),
});

const RecipeSchemaForUpdate = z.object({
  // ID is handled separately, not expected in the input data for update
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string()).min(1),
});
// --- End Schemas ---

/**
 * Deletes a recipe blob from storage based on its ID.
 * Throws RecipeNotFoundError if the blob doesn't exist initially.
 * Throws generic Error for other failures.
 * @param id The recipe ID (filename without .json)
 */
export async function deleteRecipeAction(id: string): Promise<void> {
  if (!id) {
    throw new Error('Recipe ID cannot be empty.');
  }
  const blobPathname = `recipes/${id}.json`;
  console.log(`[Action] Attempting to delete recipe blob: ${blobPathname}`);

  try {
    // 1. Get blob metadata (including URL) - this also checks existence
    const blobInfo = await head(blobPathname);
    console.log(`[Action] Blob found for deletion: ${blobInfo.url}`);

    // 2. Delete using the full URL
    await del(blobInfo.url);
    console.log(`[Action] Successfully deleted blob: ${blobPathname}`);

  } catch (error: unknown) {
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
export async function updateRecipeAction(id: string, data: unknown): Promise<Recipe> {
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
      (validationError as unknown as Record<string, unknown>)['isValidationError'] = true;
      (validationError as unknown as Record<string, unknown>)['details'] = validationResult.error.flatten(); 
      console.error('[Action] Recipe update validation failed:', validationError);
      throw validationError; 
    }
    validatedRecipeData = validationResult.data;
  } catch (err) {
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
  const recipeToSave: Recipe = {
    ...validatedRecipeData,
    id: id // Add the id back
  };

  try {
    // 3. Upload the validated data, overwriting the existing blob
    console.log(`[Action] Saving validated recipe to blob: ${blobPathname}`);
    await put(blobPathname, JSON.stringify(recipeToSave, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false, // Ensure we overwrite the exact file
    });
    console.log(`[Action] Successfully saved recipe to blob: ${blobPathname}`);

    // 4. Return the updated recipe data
    return recipeToSave;

  } catch (error: unknown) {
    console.error(`[Action] Error saving updated blob ${blobPathname}:`, error);
    // Re-throw a generic error for blob storage issues
    const message = error instanceof Error ? error.message : 'Unknown error saving updated recipe.';
    throw new Error(`Failed to save updated recipe ${id}: ${message}`);
  }
}

// Remove redundant comment
// // We will add updateRecipeAction here later 