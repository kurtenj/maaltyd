import type { Recipe } from './recipe';

/**
 * Represents a single item in the aggregated shopping list.
 */
export interface ShoppingListItem {
  name: string;       // Name of the ingredient
  quantity: number;   // Aggregated numerical quantity
  unit: string;       // Unit of measurement (e.g., 'cup', 'tbsp', 'g', '' if unitless)
  acquired: boolean;  // Whether the item has been acquired by the user
}

/**
 * Represents a 7-day meal plan.
 */
export interface MealPlan {
  recipes: Recipe[];                 // Array of 7 Recipe objects
  shoppingList: ShoppingListItem[];  // Aggregated shopping list for the plan
} 