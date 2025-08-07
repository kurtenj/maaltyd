// Simple version of the meal plan reroll API

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { MealPlan } from '../../../src/types/mealPlan';
import { Recipe } from '../../../src/types/recipe';
import { z } from 'zod';

// Initialize Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const MEAL_PLAN_KEY = 'mealplan:current';
const RECIPE_PREFIX = 'recipe:';

// --- Schemas (Copied from api/recipes.ts for validation) ---
const standardUnitsTuple_Simple: [string, ...string[]] = [
    '', 'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon', 
    'ml', 'l', 'oz', 'lb', 'g', 'kg', 
    'pinch', 'dash', 'clove', 'slice', 'servings'
];

const IngredientSchema_Simple = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(standardUnitsTuple_Simple).optional(),
});

const RecipeSchema_Simple = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema_Simple).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  excludeFromMealPlan: z.boolean().optional(),
});
// --- End Schemas ---

export async function PUT(request: Request) {
  console.log('[api/meal-plan-simple/reroll] PUT request received');

  try {
    // 1. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (_error) {
      console.error('[api/meal-plan-simple/reroll] Invalid JSON in request body');
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const { currentPlan, recipeIndexToReplace } = body;

    if (!currentPlan || typeof recipeIndexToReplace !== 'number' || recipeIndexToReplace < 0 || recipeIndexToReplace >= 7) {
      console.error('[api/meal-plan-simple/reroll] Invalid request data');
      return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
    }

    // 2. Fetch recipes using the same pattern as api/recipes.ts
    console.log('[api/meal-plan-simple/reroll] Fetching recipe keys from Redis using SCAN...');
    const recipeKeys: string[] = [];
    let cursor: string | number = 0;
    do {
      const [nextCursorStr, keys] = await redis.scan(cursor as number, { match: `${RECIPE_PREFIX}*` });
      recipeKeys.push(...keys);
      cursor = nextCursorStr;
    } while (cursor !== '0');

    console.log(`[api/meal-plan-simple/reroll] Found ${recipeKeys.length} recipe keys via SCAN.`);

    if (recipeKeys.length === 0) {
      console.error('[api/meal-plan-simple/reroll] No recipes found in database');
      return NextResponse.json({ message: 'No recipes available in database' }, { status: 400 });
    }

    console.log(`[api/meal-plan-simple/reroll] Fetching ${recipeKeys.length} recipes using mget...`);
    const recipesData = await redis.mget<Recipe[]>(...recipeKeys);
    console.log(`[api/meal-plan-simple/reroll] Received ${recipesData ? recipesData.length : 'null'} results from mget.`);

    // Filter out nulls and validate schema
    const recipes = recipesData.filter((recipe, index) => {
      const key = recipeKeys[index] || 'unknown_key';
      if (!recipe) {
        console.warn(`[api/meal-plan-simple/reroll] Null recipe data found for key index ${index}. Skipping.`);
        return false;
      }
      // Use the locally defined schema for validation
      const result = RecipeSchema_Simple.safeParse(recipe); 
      if (!result.success) {
        console.warn(`[api/meal-plan-simple/reroll] Invalid recipe data found for key ${key}, skipping: ${JSON.stringify(recipe)}. Error:`, result.error.flatten());
        return false;
      }
      return true;
    });

    // Filter out recipes that are excluded from meal planning
    const mealPlanEligibleRecipes = recipes.filter(recipe => !recipe.excludeFromMealPlan);

    console.log(`[api/meal-plan-simple/reroll] Using ${mealPlanEligibleRecipes.length} valid recipes for reroll (${recipes.length - mealPlanEligibleRecipes.length} excluded from meal planning).`);

    if (mealPlanEligibleRecipes.length === 0) {
      console.error('[api/meal-plan-simple/reroll] No valid recipes available for meal planning after filtering');
      return NextResponse.json({ message: 'No valid recipes available for meal planning' }, { status: 400 });
    }

    // 3. Select a new random recipe
    const randomIndex = Math.floor(Math.random() * mealPlanEligibleRecipes.length);
    const newRecipe = mealPlanEligibleRecipes[randomIndex];

    // 4. Create updated meal plan
    const updatedPlan: MealPlan = {
      ...currentPlan,
      recipes: currentPlan.recipes.map((recipe, index) => 
        index === recipeIndexToReplace ? newRecipe : recipe
      )
    };

    // 5. Save to Redis
    await redis.set(MEAL_PLAN_KEY, updatedPlan);
    console.log('[api/meal-plan-simple/reroll] Meal plan updated and saved');

    // 6. Return the updated meal plan
    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error('[api/meal-plan-simple/reroll] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 