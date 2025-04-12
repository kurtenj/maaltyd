// Simple version of the meal plan reroll API

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Recipe } from '../../../src/types/recipe';
import { MealPlan } from '../../../src/types/mealPlan';

// Initialize Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const MEAL_PLAN_KEY = 'mealplan:current';

// PUT handler - re-roll a recipe in the meal plan
export async function PUT(request: Request) {
  console.log('[api/meal-plan-simple/reroll] PUT request received');

  try {
    // 1. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('[api/meal-plan-simple/reroll] Invalid JSON in request body');
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const { currentPlan, recipeIndexToReplace } = body;

    if (!currentPlan || typeof recipeIndexToReplace !== 'number' || recipeIndexToReplace < 0 || recipeIndexToReplace > 6) {
      console.error('[api/meal-plan-simple/reroll] Invalid request data');
      return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
    }

    // 2. Fetch recipes
    const recipesRes = await fetch('http://localhost:3000/api/recipes');
    if (!recipesRes.ok) {
      console.error('[api/meal-plan-simple/reroll] Failed to fetch recipes:', recipesRes.status);
      return NextResponse.json({ message: 'Failed to fetch recipes' }, { status: 500 });
    }

    const allRecipes: Recipe[] = await recipesRes.json();
    console.log(`[api/meal-plan-simple/reroll] Fetched ${allRecipes.length} recipes`);

    if (allRecipes.length === 0) {
      return NextResponse.json({ message: 'No recipes available' }, { status: 400 });
    }

    // 3. Pick a random recipe that is different from the current one
    const currentRecipeId = currentPlan.recipes[recipeIndexToReplace]?.id;
    const otherRecipes = allRecipes.filter(r => r.id !== currentRecipeId);

    if (otherRecipes.length === 0) {
      // If no other recipes, pick any recipe
      console.log('[api/meal-plan-simple/reroll] No other recipes available, picking any recipe');
      const randomIndex = Math.floor(Math.random() * allRecipes.length);
      const newRecipe = allRecipes[randomIndex];
      
      // Create updated meal plan
      const updatedPlan = {
        ...currentPlan,
        recipes: [...currentPlan.recipes]
      };
      
      updatedPlan.recipes[recipeIndexToReplace] = newRecipe;
      
      // Regenerate shopping list (simplified)
      const ingredientMap = new Map();
      
      for (const recipe of updatedPlan.recipes) {
        if (recipe.other && Array.isArray(recipe.other)) {
          for (const ing of recipe.other) {
            const name = ing.name.toLowerCase();
            
            if (!ingredientMap.has(name)) {
              ingredientMap.set(name, {
                name: name,
                quantity: 1,
                unit: ing.unit || '',
                acquired: false
              });
            } else {
              // Check if this item was already acquired
              const existingItem = updatedPlan.shoppingList.find(item => item.name === name);
              const wasAcquired = existingItem ? existingItem.acquired : false;
              
              const item = ingredientMap.get(name);
              item.quantity += 1;
              item.acquired = wasAcquired; // Preserve acquired status
            }
          }
        }
      }
      
      updatedPlan.shoppingList = Array.from(ingredientMap.values());
      
      // Save to Redis
      await redis.set(MEAL_PLAN_KEY, updatedPlan);
      console.log('[api/meal-plan-simple/reroll] Updated meal plan saved');
      
      return NextResponse.json(updatedPlan);
    }
    
    // Pick a random recipe from other recipes
    const randomIndex = Math.floor(Math.random() * otherRecipes.length);
    const newRecipe = otherRecipes[randomIndex];
    
    // Create updated meal plan
    const updatedPlan = {
      ...currentPlan,
      recipes: [...currentPlan.recipes]
    };
    
    updatedPlan.recipes[recipeIndexToReplace] = newRecipe;
    
    // Regenerate shopping list (simplified)
    const ingredientMap = new Map();
    
    for (const recipe of updatedPlan.recipes) {
      if (recipe.other && Array.isArray(recipe.other)) {
        for (const ing of recipe.other) {
          const name = ing.name.toLowerCase();
          
          if (!ingredientMap.has(name)) {
            ingredientMap.set(name, {
              name: name,
              quantity: 1,
              unit: ing.unit || '',
              acquired: false
            });
          } else {
            // Check if this item was already acquired
            const existingItem = updatedPlan.shoppingList.find(item => item.name === name);
            const wasAcquired = existingItem ? existingItem.acquired : false;
            
            const item = ingredientMap.get(name);
            item.quantity += 1;
            item.acquired = wasAcquired; // Preserve acquired status
          }
        }
      }
    }
    
    updatedPlan.shoppingList = Array.from(ingredientMap.values());
    
    // Save to Redis
    await redis.set(MEAL_PLAN_KEY, updatedPlan);
    console.log('[api/meal-plan-simple/reroll] Updated meal plan saved');
    
    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error('[api/meal-plan-simple/reroll] Error:', error);
    return NextResponse.json({ message: 'Error re-rolling recipe' }, { status: 500 });
  }
} 