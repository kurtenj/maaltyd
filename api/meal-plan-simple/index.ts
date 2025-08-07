// Simple version of the meal plan API

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { MealPlan } from '../../src/types/mealPlan';
import { Recipe } from '../../src/types/recipe';
import { z } from 'zod';

// Initialize Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const MEAL_PLAN_KEY = 'mealplan:current';
const RECIPE_PREFIX = 'recipe:'; // Define the recipe prefix

// --- Schemas (Copied from api/recipes.ts for validation) ---
const standardUnitsTuple_Simple: [string, ...string[]] = [
    '', 'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon', 
    'ml', 'l', 'oz', 'lb', 'g', 'kg', 
    'pinch', 'dash', 'clove', 'slice', 'servings' // Ensure this matches!
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

// GET handler - fetch meal plan
export async function GET() {
  console.log('[api/meal-plan-simple] GET request received');

  try {
    const mealPlan = await redis.get<MealPlan>(MEAL_PLAN_KEY);
    
    if (!mealPlan) {
      console.log('[api/meal-plan-simple] No meal plan found');
      return NextResponse.json({ message: 'No meal plan found' }, { status: 404 });
    }
    
    console.log('[api/meal-plan-simple] Meal plan found and returned');
    return NextResponse.json(mealPlan);
  } catch (error) {
    console.error('[api/meal-plan-simple] Error:', error);
    return NextResponse.json({ message: 'Error fetching meal plan' }, { status: 500 });
  }
}

// POST handler - generate new meal plan
export async function POST() {
  console.log('[api/meal-plan-simple] POST request received');

  try {
    // 1. Fetch recipes using the same pattern as api/recipes.ts
    console.log('[api/meal-plan-simple] Fetching recipe keys from Redis using SCAN...');
    const recipeKeys: string[] = [];
    let cursor: string | number = 0;
    do {
      const [nextCursorStr, keys] = await redis.scan(cursor as number, { match: `${RECIPE_PREFIX}*` });
      recipeKeys.push(...keys);
      cursor = nextCursorStr;
    } while (cursor !== '0');

    console.log(`[api/meal-plan-simple] Found ${recipeKeys.length} recipe keys via SCAN.`);

    if (recipeKeys.length === 0) {
      console.error('[api/meal-plan-simple] No recipes found in database');
      return NextResponse.json({ message: 'No recipes available in database' }, { status: 400 });
    }

    console.log(`[api/meal-plan-simple] Fetching ${recipeKeys.length} recipes using mget...`);
    const recipesData = await redis.mget<Recipe[]>(...recipeKeys);
    console.log(`[api/meal-plan-simple] Received ${recipesData ? recipesData.length : 'null'} results from mget.`);

    // Filter out nulls and validate schema
    const recipes = recipesData.filter((recipe, index) => {
      const key = recipeKeys[index] || 'unknown_key';
      if (!recipe) {
        console.warn(`[api/meal-plan-simple] Null recipe data found for key index ${index}. Skipping.`);
        return false;
      }
      // Use the locally defined schema for validation
      const result = RecipeSchema_Simple.safeParse(recipe); 
      if (!result.success) {
        console.warn(`[api/meal-plan-simple] Invalid recipe data found for key ${key}, skipping: ${JSON.stringify(recipe)}. Error:`, result.error.flatten());
        return false;
      }
      return true;
    });

    // Filter out recipes that are excluded from meal planning
    const mealPlanEligibleRecipes = recipes.filter(recipe => !recipe.excludeFromMealPlan);

    console.log(`[api/meal-plan-simple] Using ${mealPlanEligibleRecipes.length} valid recipes for plan generation (${recipes.length - mealPlanEligibleRecipes.length} excluded from meal planning).`);

    if (mealPlanEligibleRecipes.length === 0) {
      console.error('[api/meal-plan-simple] No valid recipes available for meal planning after filtering');
      return NextResponse.json({ message: 'No valid recipes available for meal planning' }, { status: 400 });
    }
    
    // 2. Generate meal plan
    const selectedRecipes: Recipe[] = [];
    for (let i = 0; i < 7; i++) {
      // Pick a random recipe (allowing duplicates if necessary)
      const randomIndex = Math.floor(Math.random() * mealPlanEligibleRecipes.length);
      selectedRecipes.push(mealPlanEligibleRecipes[randomIndex]);
    }
    
    // 3. Create the meal plan object
    const mealPlan: MealPlan = {
      recipes: selectedRecipes
    };
    
    // 4. Save to Redis
    await redis.set(MEAL_PLAN_KEY, mealPlan);
    console.log('[api/meal-plan-simple] Meal plan generated and saved');
    
    // 5. Return the meal plan
    return NextResponse.json(mealPlan, { status: 201 });
  } catch (error) {
    console.error('[api/meal-plan-simple] Error generating meal plan:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 