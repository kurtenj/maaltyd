import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RecipeUpdateSchema } from '../../../../utils/apiSchemas';
import { redis, getRecipeKey } from '../../../../utils/redisClient';
import { fetchRecipeById, getRecipeById } from '../../../../utils/recipeFetcher';
import { verifyAuth } from '../../../../utils/auth';
import { serverLogger } from '../../../../utils/serverLogger';
import type { Recipe } from '../../../../types/recipe';

const MOD = 'api/recipe/[id]';

type RouteContext = { params: Promise<{ id: string }> };

// --- GET Handler (Get Single Recipe) ---
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;

  try {
    const recipe = await fetchRecipeById(id);
    if (!recipe) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (error: unknown) {
    serverLogger.error(MOD, `GET error fetching recipe ${id}:`, error);
    return NextResponse.json({ message: 'Error fetching recipe.' }, { status: 500 });
  }
}

// --- DELETE Handler (Delete Recipe) ---
export async function DELETE(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const userId = await verifyAuth(request);
  if (!userId) {
    return NextResponse.json(
      { message: 'Authentication required. Please sign in to delete recipes.' },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    await redis.del(getRecipeKey(id));
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    serverLogger.error(MOD, `DELETE error for recipe ${id}:`, error);
    return NextResponse.json({ message: 'Error deleting recipe.' }, { status: 500 });
  }
}

// --- PUT Handler (Update Recipe) ---
export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const userId = await verifyAuth(request);
  if (!userId) {
    return NextResponse.json(
      { message: 'Authentication required. Please sign in to update recipes.' },
      { status: 401 }
    );
  }

  const { id } = await params;

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  if (requestBody === null || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return NextResponse.json({ message: 'Request body must be an object.' }, { status: 400 });
  }

  const { id: _id, ...bodyWithoutId } = requestBody as { id?: string; [key: string]: unknown };

  const validationResult = RecipeUpdateSchema.safeParse(bodyWithoutId);
  if (!validationResult.success) {
    serverLogger.error(MOD, 'PUT validation failed:', z.flattenError(validationResult.error));
    return NextResponse.json(
      { message: 'Invalid recipe data provided.', errors: z.flattenError(validationResult.error) },
      { status: 400 }
    );
  }

  try {
    // Photos are only changed via POST /api/recipe/:id/image, so keep the stored one
    const existing = await getRecipeById(id);
    if (!existing) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }
    const { imageUrl: _ignoredImageUrl, ...recipeData } = validationResult.data;
    const recipeToSave = { ...recipeData, id, imageUrl: existing.imageUrl } as Recipe;

    // `xx`: only update an existing recipe, never create one via PUT
    const setResult = await redis.set(getRecipeKey(id), recipeToSave, { xx: true });
    if (setResult === null) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }
    return NextResponse.json(recipeToSave);
  } catch (error: unknown) {
    serverLogger.error(MOD, `PUT error updating recipe ${id}:`, error);
    return NextResponse.json({ message: 'Error updating recipe.' }, { status: 500 });
  }
}
