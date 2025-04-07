import { Recipe } from '../types/recipe';

// Use Vite's import.meta.glob to find all JSON files in the recipes directory
const recipeModules = import.meta.glob<Omit<Recipe, 'id'> & { default?: Omit<Recipe, 'id'> }>('/recipes/*.json', { eager: true });

const recipes: Recipe[] = Object.entries(recipeModules).map(([path, module]) => {
  // Extract filename without extension to use as ID
  const id = path.split('/').pop()?.replace('.json', '') || 'unknown-recipe';
  // Use the default export if available, otherwise the module itself
  const recipeData = module.default || module;
  return {
    id,
    ...recipeData,
  };
});

export function loadRecipes(): Recipe[] {
  return recipes;
}

export function getRecipeById(id: string): Recipe | undefined {
    return recipes.find(recipe => recipe.id === id);
} 