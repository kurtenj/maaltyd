import { useState, useEffect, useCallback } from 'react';
import { mealPlanApi } from '../services/api';
import type { MealPlan, ShoppingListItem } from '../types/mealPlan';
import { logger } from '../utils/logger';
import { tryCatchAsync } from '../utils/errorHandling';

interface UseMealPlanReturn {
  mealPlan: MealPlan | null;
  isLoading: boolean;
  error: string | null;
  fetchMealPlan: () => Promise<void>;
  generateNewMealPlan: () => Promise<void>;
  rerollRecipeInPlan: (recipeIndex: number) => Promise<void>;
  toggleShoppingListItem: (itemName: string, currentStatus: boolean) => Promise<void>;
}

export function useMealPlan(): UseMealPlanReturn {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the current meal plan on initial load
  const fetchMealPlan = useCallback(async () => {
    logger.log('useMealPlan', 'Fetching current meal plan...');
    setIsLoading(true);
    setError(null);
    const [data, fetchError] = await tryCatchAsync(
      mealPlanApi.get,
      'useMealPlan', 
      'Failed to fetch meal plan'
    );

    if (fetchError) {
      if (fetchError.message.includes('Not found') || fetchError.message.includes('404')) {
        logger.log('useMealPlan', 'No existing meal plan found.');
        setMealPlan(null); // Explicitly set to null if not found
      } else {
        logger.error('useMealPlan', 'Error fetching meal plan:', fetchError);
        setError(fetchError.message);
        setMealPlan(null);
      }
    } else if (data) {
      logger.log('useMealPlan', 'Meal plan fetched successfully.');
      setMealPlan(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMealPlan();
  }, [fetchMealPlan]);

  // Generate a new meal plan
  const generateNewMealPlan = useCallback(async () => {
    logger.log('useMealPlan', 'Generating new meal plan...');
    setIsLoading(true);
    setError(null);
    const [newPlan, genError] = await tryCatchAsync(
      mealPlanApi.generate,
      'useMealPlan', 
      'Failed to generate new meal plan'
    );

    if (genError) {
      logger.error('useMealPlan', 'Error generating meal plan:', genError);
      setError(genError.message);
      setMealPlan(null);
    } else if (newPlan) {
      logger.log('useMealPlan', 'New meal plan generated successfully.');
      setMealPlan(newPlan);
    }
    setIsLoading(false);
  }, []);

  // Re-roll a recipe in the current plan
  const rerollRecipeInPlan = useCallback(async (recipeIndex: number) => {
    if (!mealPlan) {
      setError('Cannot re-roll: No current meal plan exists.');
      return;
    }
    logger.log('useMealPlan', `Re-rolling recipe at index ${recipeIndex}...`);
    setIsLoading(true);
    setError(null);
    
    const [updatedPlan, rerollError] = await tryCatchAsync(
      () => mealPlanApi.rerollRecipe(mealPlan, recipeIndex),
      'useMealPlan', 
      'Failed to re-roll recipe'
    );

    if (rerollError) {
      logger.error('useMealPlan', 'Error re-rolling recipe:', rerollError);
      setError(rerollError.message);
      // Keep the old plan state on error? Or clear it?
    } else if (updatedPlan) {
      logger.log('useMealPlan', 'Recipe re-rolled successfully.');
      setMealPlan(updatedPlan);
    }
    setIsLoading(false);
  }, [mealPlan]); // Dependency on mealPlan is important here

  // Toggle the acquired status of a shopping list item
  const toggleShoppingListItem = useCallback(async (itemName: string, currentStatus: boolean) => {
    if (!mealPlan) return; // Should not happen if UI is correct

    const newStatus = !currentStatus;
    // Optimistically update UI first
    const originalPlan = mealPlan;
    setMealPlan(prevPlan => {
      if (!prevPlan) return null;
      return {
        ...prevPlan,
        shoppingList: prevPlan.shoppingList.map(item => 
          item.name === itemName ? { ...item, acquired: newStatus } : item
        ),
      };
    });

    logger.log('useMealPlan', `Toggling status for item "${itemName}" to ${newStatus}...`);
    const [_result, updateError] = await tryCatchAsync(
      () => mealPlanApi.updateShoppingItemStatus(itemName, newStatus),
      'useMealPlan', 
      `Failed to update status for item "${itemName}"`
    );

    if (updateError) {
      logger.error('useMealPlan', `Error updating item "${itemName}":`, updateError);
      setError(updateError.message);
      // Revert optimistic update on error
      setMealPlan(originalPlan);
    } else {
      logger.log('useMealPlan', `Item "${itemName}" status updated successfully on backend.`);
      // State is already updated optimistically
    }
    // Potentially remove error message after a short delay?
  }, [mealPlan]); // Dependency on mealPlan

  return {
    mealPlan,
    isLoading,
    error,
    fetchMealPlan, // Expose fetch if manual refresh is needed
    generateNewMealPlan,
    rerollRecipeInPlan,
    toggleShoppingListItem,
  };
} 