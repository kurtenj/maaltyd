/**
 * Navigation utility to centralize route paths and navigation functions.
 * This helps maintain consistency in routes throughout the app and
 * provides a place to add navigation-related logic in the future.
 */

/**
 * Application routes
 */
export const ROUTES = {
  HOME: '/',
  RECIPE_DETAIL: (id: string) => `/recipe/${id}`,
  /** Detail page for a just-created recipe whose photo is still being generated */
  RECIPE_DETAIL_AWAITING_IMAGE: (id: string) => `/recipe/${id}?photo=generating`,
  ADD_RECIPE: '/add-recipe',
} as const;

