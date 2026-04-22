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
 * Get authenticated headers with Bearer token
 */
function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...NO_CACHE_OPTIONS.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
      const errorMessage = errorJson.message || `HTTP error! Status: ${response.status}`;
      const error = new Error(errorMessage);
      
      // Attach the full error response for better debugging
      (error as Error & { response?: unknown }).response = errorJson;
      
      throw error;
    } catch (_parseError) {
      // If parsing fails, include the raw response text
      const errorMessage = `HTTP error! Status: ${response.status}. Response: ${rawResponseText.substring(0, 200)}`;
      const error = new Error(errorMessage);
      (error as Error & { response?: unknown }).response = { raw: rawResponseText };
      throw error;
    }
  }
  
  // If response was ok, now parse the text as JSON
  try {
    return JSON.parse(rawResponseText);
  } catch (parseError) {
    throw new Error('Failed to parse API response', { cause: parseError });
  }
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
  async create(recipe: Omit<Recipe, 'id'>, getToken: (() => Promise<string | null>) | null): Promise<Recipe> {
    const token = getToken ? await getToken() : null;
    const response = await fetch('/api/recipes', {
      ...NO_CACHE_OPTIONS,
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });

    return handleApiResponse<Recipe>(response);
  },

  /**
   * Update existing recipe
   */
  async update(id: string, recipe: Recipe, getToken: (() => Promise<string | null>) | null): Promise<Recipe> {
    const token = getToken ? await getToken() : null;
    const response = await fetch(`/api/recipe/${encodeURIComponent(id)}`, {
      ...NO_CACHE_OPTIONS,
      method: 'PUT',
      headers: {
        ...getAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });

    return handleApiResponse<Recipe>(response);
  },

  /**
   * Delete recipe
   */
  async delete(id: string, getToken: (() => Promise<string | null>) | null): Promise<void> {
    const token = getToken ? await getToken() : null;
    const response = await fetch(`/api/recipe/${encodeURIComponent(id)}`, {
      ...NO_CACHE_OPTIONS,
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(token),
      },
    });
    
    if (response.status === 204 || response.ok) {
      return;
    }
    
    return handleApiResponse<void>(response);
  }
}; 