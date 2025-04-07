/**
 * API path constants to ensure consistency in API requests
 */
export const API_PATHS = {
  RECIPES: {
    BASE: '/api/recipes',
    DETAIL: (id: string) => `/api/recipes/${id}`,
  }
} as const; 