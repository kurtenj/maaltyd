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
      // Create an error with more details
      const error = new Error(errorJson.message || `HTTP error! Status: ${response.status}`);
      // Attach the full error response for better debugging
      (error as Error & { response?: unknown }).response = errorJson;
      throw error;
    } catch (parseError) {
      // If parsing fails, include the raw response text
      const error = new Error(`HTTP error! Status: ${response.status}. Response: ${rawResponseText}`);
      (error as Error & { response?: unknown }).response = { raw: rawResponseText };
      throw error;
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