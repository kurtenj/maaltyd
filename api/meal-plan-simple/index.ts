// Simple version of the meal plan API

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Recipe } from '../../src/types/recipe';
import { MealPlan, ShoppingListItem } from '../../src/types/mealPlan';
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
    // 1. Fetch recipes directly from Redis
    console.log('[api/meal-plan-simple] Fetching recipe keys from Redis...');
    const recipeKeys: string[] = [];
    let cursor: string | number = 0;
    do {
      // Use the RECIPE_PREFIX constant defined earlier
      const [nextCursorStr, keys] = await redis.scan(cursor as number, { match: `${RECIPE_PREFIX}*` });
      recipeKeys.push(...keys);
      cursor = nextCursorStr;
    } while (cursor !== '0');

    console.log(`[api/meal-plan-simple] Found ${recipeKeys.length} recipe keys.`);

    if (recipeKeys.length === 0) {
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
    // --- End fetching recipes from Redis ---
    
    console.log(`[api/meal-plan-simple] Using ${recipes.length} valid recipes for plan generation.`);

    if (recipes.length === 0) {
      // This condition might be hit if all recipes failed validation
      return NextResponse.json({ message: 'No valid recipes available after filtering' }, { status: 400 });
    }
    
    // 2. Generate meal plan
    const selectedRecipes: Recipe[] = [];
    for (let i = 0; i < 7; i++) {
      // Pick a random recipe (allowing duplicates if necessary)
      const randomIndex = Math.floor(Math.random() * recipes.length);
      selectedRecipes.push(recipes[randomIndex]);
    }
    
    // 3. Generate shopping list
    const ingredientMap = new Map<string, ShoppingListItem>();
    
    for (const recipe of selectedRecipes) {
      // Process ingredients from each recipe
      if (recipe.other && Array.isArray(recipe.other)) {
        for (const ing of recipe.other) {
          const name = ing.name.toLowerCase();
          
          if (!ingredientMap.has(name)) {
            ingredientMap.set(name, {
              name: name,
              quantity: 1, // Simple counter
              unit: ing.unit || '',
              acquired: false
            });
          } else {
            // Just increment the counter for duplicates
            const item = ingredientMap.get(name)!;
            item.quantity += 1;
          }
        }
      }
    }
    
    // Convert the map to an array for the shopping list
    const shoppingList = Array.from(ingredientMap.values());
    
    // 4. Create the meal plan object
    const mealPlan: MealPlan = {
      recipes: selectedRecipes,
      shoppingList: shoppingList
    };
    
    // 5. Save to Redis
    await redis.set(MEAL_PLAN_KEY, mealPlan);
    console.log('[api/meal-plan-simple] Meal plan generated and saved');
    
    // 6. Return the meal plan
    return NextResponse.json(mealPlan, { status: 201 });
  } catch (error) {
    console.error('[api/meal-plan-simple] Error:', error);
    return NextResponse.json({ message: 'Error generating meal plan' }, { status: 500 });
  }
} 