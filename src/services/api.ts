import { Recipe } from '../types/recipe';

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
    const response = await fetch(`/api/recipe-by-id?id=${encodeURIComponent(id)}`, NO_CACHE_OPTIONS);
    return handleApiResponse<Recipe>(response);
  },
  
  /**
   * Create new recipe
   */
  async create(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
    const response = await fetch('/api/recipes', {
      ...NO_CACHE_OPTIONS,
      method: 'POST',
      headers: {
        ...NO_CACHE_OPTIONS.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    
    return handleApiResponse<Recipe>(response);
  },
  
  /**
   * Update existing recipe
   */
  async update(id: string, recipe: Recipe): Promise<Recipe> {
    const response = await fetch(`/api/recipe-by-id?id=${encodeURIComponent(id)}`, {
      ...NO_CACHE_OPTIONS,
      method: 'PUT',
      headers: {
        ...NO_CACHE_OPTIONS.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    
    return handleApiResponse<Recipe>(response);
  },
  
  /**
   * Delete recipe
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/recipe-by-id?id=${encodeURIComponent(id)}`, {
      ...NO_CACHE_OPTIONS,
      method: 'DELETE',
    });
    
    if (response.status === 204 || response.ok) {
      return;
    }
    
    return handleApiResponse<void>(response);
  }
}; 