import { list } from '@vercel/blob';
import { z } from 'zod';
import type { Recipe } from '../src/types/recipe';

console.log('--- !!! api/recipes.ts TOP LEVEL EXECUTION !!! ---');

const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string(),
});

const RecipeSchema = z.object({
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string()).min(1),
});

export async function GET(_request: Request) {
  const tokenPresent = !!process.env.BLOB_READ_WRITE_TOKEN;
  const tokenLength = process.env.BLOB_READ_WRITE_TOKEN?.length || 0;
  console.log(`[api/recipes]: GET request received. BLOB_READ_WRITE_TOKEN present: ${tokenPresent}, Length: ${tokenLength}`);

  if (!tokenPresent) {
    console.error('[api/recipes]: BLOB_READ_WRITE_TOKEN is missing!');
    return new Response(JSON.stringify({ message: 'Server configuration error: Missing blob storage token.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[api/recipes]: Attempting to list blobs...');
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
        } as Recipe);
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
    return new Response(JSON.stringify({ message, details: error instanceof Error ? error.stack : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// No other functions (POST, PUT, DELETE for this file)
// No imports needed for this simple test 