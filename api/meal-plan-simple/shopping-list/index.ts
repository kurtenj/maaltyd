// Simple version of the shopping list API

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { MealPlan } from '../../../src/types/mealPlan';

// Initialize Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const MEAL_PLAN_KEY = 'mealplan:current';

// PATCH handler - update shopping list item status
export async function PATCH(request: Request) {
  console.log('[api/meal-plan-simple/shopping-list] PATCH request received');

  try {
    // 1. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (_error) {
      console.error('[api/meal-plan-simple/shopping-list] Invalid JSON in request body');
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const { itemName, acquired } = body;

    if (!itemName || typeof acquired !== 'boolean') {
      console.error('[api/meal-plan-simple/shopping-list] Invalid request data');
      return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
    }

    // 2. Fetch current meal plan
    const mealPlan = await redis.get<MealPlan>(MEAL_PLAN_KEY);

    if (!mealPlan) {
      console.error('[api/meal-plan-simple/shopping-list] No meal plan found');
      return NextResponse.json({ message: 'No meal plan found' }, { status: 404 });
    }

    // 3. Update item status
    const itemIndex = mealPlan.shoppingList.findIndex(item => item.name === itemName);

    if (itemIndex === -1) {
      console.error(`[api/meal-plan-simple/shopping-list] Item '${itemName}' not found`);
      return NextResponse.json({ message: `Item '${itemName}' not found` }, { status: 404 });
    }

    // Update the status
    mealPlan.shoppingList[itemIndex].acquired = acquired;

    // 4. Save back to Redis
    await redis.set(MEAL_PLAN_KEY, mealPlan);
    console.log(`[api/meal-plan-simple/shopping-list] Updated status for '${itemName}' to ${acquired}`);

    return NextResponse.json({
      message: 'Item status updated successfully',
      item: mealPlan.shoppingList[itemIndex]
    });
  } catch (error) {
    console.error('[api/meal-plan-simple/shopping-list] Error:', error);
    return NextResponse.json({ message: 'Error updating shopping list item' }, { status: 500 });
  }
} 