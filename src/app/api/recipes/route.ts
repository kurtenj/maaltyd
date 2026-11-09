import { NextResponse, after } from 'next/server';
import { RecipeCreateSchema } from '../../../utils/apiSchemas';
import { redis, getRecipeKey } from '../../../utils/redisClient';
import { fetchAllRecipes } from '../../../utils/recipeFetcher';
import { verifyAuth } from '../../../utils/auth';
import { serverLogger } from '../../../utils/serverLogger';
import { attachGeneratedImage } from '../../../utils/recipeImage';
import type { Recipe } from '../../../types/recipe';

const MOD = 'api/recipes';

// Leaves time for the background image generation scheduled with after()
export const maxDuration = 60;

// --- GET Handler (List Recipes) ---
export async function GET(): Promise<NextResponse> {
  try {
    const recipes = await fetchAllRecipes(MOD);
    return NextResponse.json(recipes);
  } catch (error: unknown) {
    serverLogger.error(MOD, 'GET error fetching recipes:', error);
    return NextResponse.json({ message: 'Failed to load recipes.' }, { status: 500 });
  }
}

// --- POST Handler (Create Recipe) ---
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await verifyAuth(request);
  if (!userId) {
    return NextResponse.json(
      { message: 'Authentication required. Please sign in to create recipes.' },
      { status: 401 }
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const validationResult = RecipeCreateSchema.safeParse(requestBody);
  if (!validationResult.success) {
    serverLogger.error(MOD, 'POST recipe validation failed:', validationResult.error.flatten());
    return NextResponse.json(
      { message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const newId = crypto.randomUUID();
  const key = getRecipeKey(newId);
  // Photos are always AI-generated, so any client-supplied imageUrl is ignored
  const { imageUrl: _ignoredImageUrl, ...recipeData } = validationResult.data;
  const newRecipe = { ...recipeData, id: newId } as Recipe;

  try {
    const setResult = await redis.set(key, newRecipe, { nx: true });
    if (setResult === null) {
      serverLogger.warn(MOD, `POST key ${key} already exists (NX failed)`);
      return NextResponse.json({ message: 'Recipe ID collision, please try again.' }, { status: 409 });
    }
    // Generate the photo after responding, so saving isn't slowed down
    after(async () => {
      try {
        await attachGeneratedImage(newId, { onlyIfMissing: true });
      } catch (error) {
        serverLogger.error(MOD, `background image generation failed for ${newId}:`, error);
      }
    });

    return NextResponse.json(newRecipe, { status: 201 });
  } catch (error: unknown) {
    serverLogger.error(MOD, `POST error saving recipe for key ${key}:`, error);
    return NextResponse.json({ message: 'Failed to save recipe.' }, { status: 500 });
  }
}
