import { kv } from '@vercel/kv';
import { z } from 'zod';
import type { Recipe } from '../../src/types/recipe'; // Assuming type path relative to lib

// Key generation helper
const getRecipeKey = (id: string) => `recipe:${id}`;

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
 * Deletes a recipe from KV storage based on its ID.
 * Throws generic Error for KV failures.
 * @param id The recipe ID
 */
export async function deleteRecipeAction(id: string): Promise<void> {
  if (!id) {
    throw new Error('Recipe ID cannot be empty.');
  }
  const key = getRecipeKey(id);
  console.log(`[Action] Attempting to delete recipe from KV with key: ${key}`);

  try {
    const result = await kv.del(key);
    console.log(`[Action] kv.del result for key ${key}: ${result}`);
    // kv.del returns number of keys deleted (0 or 1). 
    // We don't strictly need to check for 0, as the goal is for the key to be gone.
  } catch (error: unknown) {
    console.error(`[Action] Error during KV delete process for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error during KV deletion process.';
    throw new Error(`Failed to delete recipe ${id} from KV: ${message}`);
  }
}

/**
 * Updates a recipe in KV storage.
 * Validates input data against the schema.
 * Throws specific validation Error or generic Error for other failures.
 * @param id The recipe ID
 * @param data The raw recipe data received from the request body.
 * @returns The updated recipe data including the ID.
 */
export async function updateRecipeAction(id: string, data: unknown): Promise<Recipe> {
  if (!id) {
    throw new Error('Recipe ID cannot be empty for update.');
  }
  const key = getRecipeKey(id);
  console.log(`[Action] Attempting to update recipe in KV with key: ${key}`);

  // 1. Validate incoming data (excluding ID)
  let validatedRecipeData;
  try {
    const validationResult = RecipeSchemaForUpdate.safeParse(data);
    if (!validationResult.success) {
      const validationError = new Error('Validation failed');
      (validationError as unknown as Record<string, unknown>)['isValidationError'] = true;
      (validationError as unknown as Record<string, unknown>)['details'] = validationResult.error.flatten(); 
      console.error('[Action] Recipe update validation failed:', validationError);
      throw validationError; 
    }
    validatedRecipeData = validationResult.data;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'isValidationError' in err && err.isValidationError === true) {
      throw err; // Re-throw the custom validation error
    }
    console.error('[Action] Unexpected error during validation:', err);
    throw new Error('Unexpected error during data validation.');
  }

  // 2. Construct the full recipe object to save (including the ID)
  // Note: KV handles JSON serialization, so we pass the object directly
  const recipeToSave: Recipe = {
    ...validatedRecipeData,
    id: id 
  };

  try {
    // 3. Save the validated data to KV, overwriting the existing key
    console.log(`[Action] Saving validated recipe object to KV key: ${key}`);
    const result = await kv.set(key, recipeToSave); // Pass the object
    console.log(`[Action] kv.set result for key ${key}: ${result}`);
    if (result !== 'OK') {
      // Handle potential non-OK responses from kv.set if necessary
      console.warn(`[Action] kv.set for key ${key} returned non-OK status: ${result}`);
      // Optionally throw an error here if 'OK' is strictly required
    }

    // 4. Return the updated recipe data
    return recipeToSave;

  } catch (error: unknown) {
    console.error(`[Action] Error saving updated recipe to KV for key ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error saving updated recipe to KV.';
    throw new Error(`Failed to save updated recipe ${id} to KV: ${message}`);
  }
}

// Remove redundant comment
// // We will add updateRecipeAction here later 