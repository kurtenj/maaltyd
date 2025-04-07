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
  ADD_RECIPE: '/add-recipe',
} as const;

/**
 * Generate breadcrumbs based on current route
 * Can be extended with more sophisticated logic as needed
 */
export function generateBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  const segments = path.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; path: string }> = [
    { label: 'Home', path: ROUTES.HOME },
  ];

  // Build up breadcrumbs based on path segments
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Special case for recipe/:id
    if (segment === 'recipe' && segments[index + 1]) {
      breadcrumbs.push({ label: 'Recipe Detail', path: currentPath + `/${segments[index + 1]}` });
      return;
    }
    
    if (segment === 'add-recipe') {
      breadcrumbs.push({ label: 'Add Recipe', path: ROUTES.ADD_RECIPE });
      return;
    }
  });

  return breadcrumbs;
} 