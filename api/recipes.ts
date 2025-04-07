import { list } from '@vercel/blob';
// import { NextResponse } from 'next/server'; // Remove this line
import { z } from 'zod';
import type { Recipe } from '../src/types/recipe'; // Remove ', Ingredient'

// Zod schema for Ingredient
const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string(), z.number()]), // Allow string or number
  unit: z.string(), // Unit can be empty string
});

// Updated Recipe Schema
const RecipeSchema = z.object({
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1), // Use IngredientSchema
  instructions: z.array(z.string()).min(1),
});

// export const runtime = 'edge'; // Keep commented out

// Remove eslint-disable comment (already handled by rule config)
export async function GET(_request: Request) { // Unused parameter prefixed with _
  // console.log('[api/recipes]: GET request received (Simplified Test)'); // Remove test log

  // --- TEMP: Return hardcoded data --- 
  // return new Response(JSON.stringify([{id: 'test-123', title: 'Hardcoded Test Recipe', main: 'Test Main', other: ['Test Other'], instructions: ['Step 1']}]), {
  //   status: 200,
  //   headers: { 'Content-Type': 'application/json' },
  // });
  // --- END TEMP ---

  // Original Code Commented Out:
  console.log('[api/recipes]: GET request received'); 
  try {
    const { blobs } = await list({
      prefix: 'recipes/'
    });

    console.log(`[api/recipes]: Found ${blobs.length} blobs in recipes/ prefix.`);

    const recipes: Recipe[] = [];

    for (const blob of blobs) {
      try {
        console.log(`[api/recipes]: Fetching content for ${blob.pathname}`);
        const response = await fetch(blob.url); 
        if (!response.ok) {
            console.warn(`[api/recipes]: Failed to fetch blob content for ${blob.pathname}, status: ${response.status}`);
            continue; 
        }
        const recipeData = await response.json();

        const validationResult = RecipeSchema.safeParse(recipeData);
        if (!validationResult.success) {
            console.warn(`[api/recipes]: Skipping invalid recipe blob ${blob.pathname}:`, validationResult.error.errors);
            continue; 
        }

        const recipeId = blob.pathname.split('/').pop()?.replace('.json', '') || 'unknown';
        
        recipes.push({ 
          ...validationResult.data, 
          id: recipeId 
        });
      } catch (fetchError: unknown) {
          console.error(`[api/recipes]: Error fetching or parsing blob ${blob.pathname}:`, fetchError);
      }
    }

    console.log(`[api/recipes]: Returning ${recipes.length} valid recipes.`);
    return new Response(JSON.stringify(recipes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[api/recipes]: Error listing blobs:', error);
    const message = error instanceof Error ? error.message : 'Failed to load recipes.';
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 