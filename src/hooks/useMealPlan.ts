import { useState, useEffect, useCallback } from 'react';
import { MealPlan } from '../types/mealPlan';
import { mealPlanApi } from '../services/api';
import { logger } from '../utils/logger';
import { tryCatchAsync } from '../utils/errorHandling';

interface UseMealPlanReturn {
  mealPlan: MealPlan | null;
  isLoading: boolean;
  error: string | null;
  generateNewMealPlan: () => Promise<void>;
  rerollRecipeInPlan: (recipeIndex: number) => Promise<void>;
}

export function useMealPlan(): UseMealPlanReturn {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch meal plan on mount
  useEffect(() => {
    const fetchMealPlan = async () => {
      logger.log('useMealPlan', 'Fetching meal plan...');
      setIsLoading(true);
      setError(null);

      const [result, fetchError] = await tryCatchAsync(
        () => mealPlanApi.get(),
        'useMealPlan',
        'Failed to fetch meal plan'
      );

      if (fetchError) {
        logger.error('useMealPlan', 'Error fetching meal plan:', fetchError);
        setError(fetchError.message);
        setMealPlan(null);
      } else {
        logger.log('useMealPlan', 'Meal plan fetched successfully:', result);
        setMealPlan(result);
      }

      setIsLoading(false);
    };

    fetchMealPlan();
  }, []);

  // Generate a new meal plan
  const generateNewMealPlan = useCallback(async () => {
    logger.log('useMealPlan', 'Generating new meal plan...');
    setIsLoading(true);
    setError(null);

    const [result, generateError] = await tryCatchAsync(
      () => mealPlanApi.generate(),
      'useMealPlan',
      'Failed to generate meal plan'
    );

    if (generateError) {
      logger.error('useMealPlan', 'Error generating meal plan:', generateError);
      setError(generateError.message);
    } else {
      logger.log('useMealPlan', 'New meal plan generated successfully:', result);
      setMealPlan(result);
    }

    setIsLoading(false);
  }, []);

  // Re-roll a single recipe in the meal plan
  const rerollRecipeInPlan = useCallback(async (recipeIndex: number) => {
    if (!mealPlan) return;

    logger.log('useMealPlan', `Re-rolling recipe at index ${recipeIndex}...`);
    setIsLoading(true);
    setError(null);

    // Optimistically update UI first
    const originalPlan = mealPlan;
    setMealPlan(prevPlan => {
      if (!prevPlan) return null;
      return {
        ...prevPlan,
        recipes: prevPlan.recipes.map((recipe, index) => 
          index === recipeIndex ? { ...recipe, title: 'Loading...' } : recipe
        ),
      };
    });

    const [result, rerollError] = await tryCatchAsync(
      () => mealPlanApi.rerollRecipe(mealPlan, recipeIndex),
      'useMealPlan',
      `Failed to re-roll recipe at index ${recipeIndex}`
    );

    if (rerollError) {
      logger.error('useMealPlan', `Error re-rolling recipe at index ${recipeIndex}:`, rerollError);
      setError(rerollError.message);
      // Revert optimistic update on error
      setMealPlan(originalPlan);
    } else {
      logger.log('useMealPlan', `Recipe at index ${recipeIndex} re-rolled successfully:`, result);
      setMealPlan(result);
    }

    setIsLoading(false);
  }, [mealPlan]);

  return {
    mealPlan,
    isLoading,
    error,
    generateNewMealPlan,
    rerollRecipeInPlan,
  };
} 