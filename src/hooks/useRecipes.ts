import { useState, useMemo, useEffect, useCallback } from 'react';
import { Recipe } from '../types/recipe';
import { recipeApi } from '../services/api';
import { logger } from '../utils/logger';
import { tryCatchAsync } from '../utils/errorHandling';

// Dummy Data for Local Fallback (Updated Structure)
const DUMMY_RECIPES: Recipe[] = [
  {
    id: 'dummy-1',
    title: 'Placeholder Recipe Card',
    main: 'Test Ingredient',
    other: [
      { name: 'Dummy Data', quantity: 1, unit: 'item' }, 
      { name: 'Local Dev', quantity: 1, unit: '' },
      { name: 'Water', quantity: 0.5, unit: 'cup' }
    ],
    instructions: ['This is placeholder data because the local API fetch failed.', 'Check vercel dev logs.']
  },
  {
    id: 'dummy-2',
    title: 'Another Placeholder Card',
    main: 'Placeholder',
    other: [
      { name: 'Testing', quantity: 2, unit: 'units' }, 
      { name: 'UI Layout', quantity: 1 , unit: '' }
    ],
    instructions: ['This appears when /api/recipes fails locally.']
  }
];

export function useRecipes() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]); // State for all recipes
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [error, setError] = useState<string | null>(null); // Error state
  const [fetchAttempted, setFetchAttempted] = useState<boolean>(false); // Track if fetch has been tried

  // Renamed state variables
  const [selectedMainIngredient, setSelectedMainIngredient] = useState<string | null>(null);
  const [selectedOtherIngredients, setSelectedOtherIngredients] = useState<string[]>([]);

  // Function to fetch recipes from the backend
  const fetchRecipes = useCallback(async () => {
    logger.log('useRecipes', 'Fetching recipes from API...');
    setIsLoading(true);
    setError(null);
    setFetchAttempted(true);
    
    const [data, apiError] = await tryCatchAsync(
      async () => await recipeApi.getAll(),
      'useRecipes',
      'Failed to load recipes'
    );

    if (apiError) {
      logger.error('useRecipes', 'Error fetching recipes:', apiError);
      setError(apiError.message);
      setAllRecipes(DUMMY_RECIPES);
      logger.warn('useRecipes', 'Fetch failed, using dummy data.');
    } else if (data) {
      setAllRecipes(data);
      logger.log('useRecipes', `Successfully fetched ${data.length} recipes (state set).`);
    } else {
       setAllRecipes([]);
    }
    
    setIsLoading(false);
  }, []);

  // Fetch recipes on initial mount
  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // --- Filtering logic (uses renamed fields) ---
  const availableMainIngredients = useMemo(() => {
    // Use 'main' field
    const mains = new Set(allRecipes.map(r => r.main)); 
    return Array.from(mains).sort();
  }, [allRecipes]);

  const availableOtherIngredients = useMemo(() => {
    const relevantRecipes = selectedMainIngredient
      ? allRecipes.filter(r => r.main === selectedMainIngredient) // Filter by 'main'
      : allRecipes;
    // Use 'other' field
    const others = new Set(relevantRecipes.flatMap(r => r.other.map(i => i.name))); 
    return Array.from(others).sort();
  }, [allRecipes, selectedMainIngredient]);

  const filteredRecipes = useMemo(() => {
    // If fetch hasn't finished and there's no error, don't filter yet
    if (isLoading || (!fetchAttempted && !error)) { 
        return [];
    }
    // If there's an error, dummy data is already in allRecipes, filter it
    // If fetch succeeded, allRecipes has real data, filter it
    
    if (!selectedMainIngredient) {
        // If error (showing dummy data) or no main selection, return all (dummy) recipes or none
        return error ? allRecipes : []; 
    }
    
    let recipes = allRecipes.filter(recipe => recipe.main === selectedMainIngredient);
    if (selectedOtherIngredients.length > 0) {
      recipes = recipes.filter(recipe =>
        selectedOtherIngredients.some(other => recipe.other.some(i => i.name === other))
      );
    }
    return recipes;
  }, [allRecipes, selectedMainIngredient, selectedOtherIngredients, isLoading, error, fetchAttempted]);
  // ---

  // Renamed handler
  const handleMainIngredientChange = (mainIngredient: string | null) => {
    setSelectedMainIngredient(mainIngredient);
    setSelectedOtherIngredients([]); // Reset others when main changes
  };

  // Renamed handler
  const toggleOtherIngredient = (otherIngredient: string) => {
    setSelectedOtherIngredients(prev =>
      prev.includes(otherIngredient)
        ? prev.filter(o => o !== otherIngredient)
        : [...prev, otherIngredient]
    );
  };

  return {
    allRecipes, // Expose all recipes if needed elsewhere
    isLoading,
    error,
    // Renamed exports
    selectedMainIngredient,
    selectedOtherIngredients,
    availableMainIngredients,
    availableOtherIngredients,
    filteredRecipes,
    handleMainIngredientChange,
    toggleOtherIngredient,
    refetchRecipes: fetchRecipes, // Expose refetch function
    isUsingDummyData: !!error && !isLoading && allRecipes.length > 0 && allRecipes[0]?.id.startsWith('dummy-'), 
  };
} 