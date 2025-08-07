import type { Recipe } from './recipe';

/**
 * Represents a 7-day meal plan.
 */
export interface MealPlan {
  recipes: Recipe[];                 // Array of 7 Recipe objects
} 