import { MealPlan } from '../types/mealPlan';
import { Recipe } from '../types/recipe';
import { logger } from '../utils/logger';

/**
 * API request options with standardized cache prevention
 */
const NO_CACHE_OPTIONS = {
  cache: 'no-store' as RequestCache,
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
};

/**
 * Get authenticated headers with user ID
 */
function getAuthHeaders(userId?: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...NO_CACHE_OPTIONS.headers };
  if (userId) {
    headers['x-clerk-user-id'] = userId;
  }
  return headers;
}

/**
 * Helper function to handle API errors
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  const rawResponseText = await response.text();
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Not found.');
    }
    
    try {
      const errorJson = JSON.parse(rawResponseText);
      throw new Error(errorJson.message || `HTTP error! Status: ${response.status}`);
    } catch (_parseError) {
      throw new Error(`HTTP error! Status: ${response.status}. Response not JSON.`);
    }
  }
  
  // If response was ok, now parse the text as JSON
  return JSON.parse(rawResponseText);
}

/**
 * Recipe API functions
 */
export const recipeApi = {
  /**
   * Get all recipes
   */
  async getAll(): Promise<Recipe[]> {
    const response = await fetch('/api/recipes', NO_CACHE_OPTIONS);
    return handleApiResponse<Recipe[]>(response);
  },
  
  /**
   * Get single recipe by ID
   */
  async getById(id: string): Promise<Recipe> {
    const response = await fetch(`/api/recipe/${encodeURIComponent(id)}`, NO_CACHE_OPTIONS);
    return handleApiResponse<Recipe>(response);
  },
  
  /**
   * Create new recipe
   */
  async create(recipe: Omit<Recipe, 'id'>, userId?: string | null): Promise<Recipe> {
    const response = await fetch('/api/recipes', {
      ...NO_CACHE_OPTIONS,
      method: 'POST',
      headers: {
        ...getAuthHeaders(userId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    
    return handleApiResponse<Recipe>(response);
  },
  
    /**
   * Update existing recipe
   */
  async update(id: string, recipe: Recipe, userId?: string | null): Promise<Recipe> {
    const response = await fetch(`/api/recipe/${encodeURIComponent(id)}`, {
      ...NO_CACHE_OPTIONS,
      method: 'PUT',
      headers: {
        ...getAuthHeaders(userId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    
    return handleApiResponse<Recipe>(response);
  },

  /**
   * Delete recipe
   */
  async delete(id: string, userId?: string | null): Promise<void> {
    const response = await fetch(`/api/recipe/${encodeURIComponent(id)}`, {
      ...NO_CACHE_OPTIONS,
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(userId),
      },
    });
    
    if (response.status === 204 || response.ok) {
      return;
    }
    
    return handleApiResponse<void>(response);
  }
};

/**
 * Meal Plan API functions
 */
export const mealPlanApi = {
  /**
   * Get the current meal plan
   */
  async get(): Promise<MealPlan> {
    const response = await fetch('/api/meal-plan-simple', NO_CACHE_OPTIONS);
    return handleApiResponse<MealPlan>(response);
  },

  /**
   * Generate a new meal plan (overwrites existing)
   */
  async generate(): Promise<MealPlan> {
    const response = await fetch('/api/meal-plan-simple', {
      ...NO_CACHE_OPTIONS,
      method: 'POST',
    });
    return handleApiResponse<MealPlan>(response);
  },

  /**
   * Re-roll a single recipe in the current meal plan
   */
  async rerollRecipe(currentPlan: MealPlan, recipeIndex: number): Promise<MealPlan> {
    const response = await fetch('/api/meal-plan-simple/reroll', {
      ...NO_CACHE_OPTIONS,
      method: 'PUT',
      headers: {
        ...NO_CACHE_OPTIONS.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        currentPlan: currentPlan, 
        recipeIndexToReplace: recipeIndex 
      }),
    });
    return handleApiResponse<MealPlan>(response);
  }
}; 