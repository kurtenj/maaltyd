// Simple version of the meal plan API

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Recipe } from '../../src/types/recipe';
import { MealPlan, ShoppingListItem } from '../../src/types/mealPlan';

// Initialize Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const MEAL_PLAN_KEY = 'mealplan:current';

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
    // 1. Fetch recipes
    const recipesRes = await fetch('http://localhost:3000/api/recipes');
    if (!recipesRes.ok) {
      console.error('[api/meal-plan-simple] Failed to fetch recipes:', recipesRes.status);
      return NextResponse.json({ message: 'Failed to fetch recipes' }, { status: 500 });
    }
    
    const recipes: Recipe[] = await recipesRes.json();
    console.log(`[api/meal-plan-simple] Fetched ${recipes.length} recipes`);
    
    if (recipes.length === 0) {
      return NextResponse.json({ message: 'No recipes available' }, { status: 400 });
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