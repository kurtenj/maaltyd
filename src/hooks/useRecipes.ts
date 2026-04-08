import { useState, useMemo, useEffect, useCallback } from "react";
import { Recipe } from "../types/recipe";
import { recipeApi } from "../services/api";
import { logger } from "../utils/logger";
import { tryCatchAsync } from "../utils/errorHandling";

interface UseRecipesReturn {
  allRecipes: Recipe[];
  isLoading: boolean;
  error: string | null;
  filteredRecipes: Recipe[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedMainIngredient: string | null;
  availableMainIngredients: string[];
  handleMainIngredientChange: (main: string | null) => void;
  fetchRecipes: () => Promise<void>;
}

export function useRecipes(): UseRecipesReturn {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [selectedMainIngredient, setSelectedMainIngredient] = useState<
    string | null
  >(null);

  // Function to fetch recipes from the backend
  const fetchRecipes = useCallback(async () => {
    logger.log("useRecipes", "Fetching recipes from API...");
    setIsLoading(true);
    setError(null);
    setFetchAttempted(true);

    const [data, apiError] = await tryCatchAsync(
      async () => await recipeApi.getAll(),
      "useRecipes",
      "Failed to load recipes"
    );

    if (apiError) {
      logger.error("useRecipes", "Error fetching recipes:", apiError);
      setError(apiError.message);
      setAllRecipes([]); // Set to empty array on API error
      logger.warn("useRecipes", "Fetch failed, API error occurred.");
    } else if (data) {
      setAllRecipes(data);
      logger.log(
        "useRecipes",
        `Successfully fetched ${data.length} recipes (state set).`
      );
    } else {
      setAllRecipes([]); // Also set to empty if data is null/undefined for some reason
    }

    setIsLoading(false);
  }, []);

  // Fetch recipes on initial mount
  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Debounce search term by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const availableMainIngredients = useMemo(() => {
    const mains = new Set(allRecipes.map((r) => r.main).filter((m) => m)); // Filter out empty/null mains
    return Array.from(mains).sort();
  }, [allRecipes]);

  const filteredRecipes = useMemo(() => {
    if (isLoading || (!fetchAttempted && !error)) {
      return [];
    }

    let recipesToFilter = allRecipes;

    // 1. Filter by selectedMainIngredient
    if (selectedMainIngredient) {
      recipesToFilter = recipesToFilter.filter(
        (recipe) => recipe.main === selectedMainIngredient
      );
    }

    // 2. Filter by searchTerm (title)
    if (debouncedSearchTerm) {
      recipesToFilter = recipesToFilter.filter((recipe) =>
        recipe.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    return recipesToFilter;
  }, [
    allRecipes,
    isLoading,
    error,
    fetchAttempted,
    debouncedSearchTerm,
    selectedMainIngredient,
  ]);

  const handleMainIngredientChange = (mainIngredient: string | null) => {
    setSelectedMainIngredient(mainIngredient);
  };

  return {
    allRecipes,
    isLoading,
    error,
    filteredRecipes,
    searchTerm,
    setSearchTerm,
    selectedMainIngredient,
    availableMainIngredients,
    handleMainIngredientChange,
    fetchRecipes, // Expose fetchRecipes for manual refresh
  };
}
