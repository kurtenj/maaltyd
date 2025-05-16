import React from "react";
import { useRecipes } from "../hooks/useRecipes";
import RecipeList from "../components/RecipeList";
import MealPlanSummary from "../components/MealPlanSummary";
import Input from "../components/Input";

const HomePage: React.FC = () => {
  const {
    isLoading,
    error,
    filteredRecipes,
    searchTerm,
    setSearchTerm,
    selectedMainIngredient,
    availableMainIngredients,
    handleMainIngredientChange,
  } = useRecipes();

  return (
    <div className="min-h-screen container mx-auto">
      <MealPlanSummary />

      {/* Search Input and Recipe List Area */}
      <div className="mt-8">
        {/* Filter Controls: Search and Main Ingredient Select */}
        <div className="flex flex-start gap-2 mb-6 items-center">
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-2/3 shadow-sm"
          />
          <select
            value={selectedMainIngredient || ""} // Use empty string for "All" option
            onChange={(e) => handleMainIngredientChange(e.target.value || null)} // Pass null if empty string selected
            className="w-1/3 h-8 px-3 py-1 border border-stone-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-stone-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All</option>
            {availableMainIngredients.map((ingredient) => (
              <option key={ingredient} value={ingredient}>
                {ingredient}
              </option>
            ))}
          </select>
        </div>

        {/* Error Display - Simplified condition */}
        {error && (
          <div className="mb-4 p-4 text-center text-red-800 bg-red-100 border border-red-300 rounded">
            Error loading recipes: {error}
          </div>
        )}

        {/* Loading or Recipe List Display */}
        {isLoading ? (
          <p className="text-center text-stone-500 italic">
            Loading recipes...
          </p>
        ) : (
          // Display RecipeList even if there's an error, will show "No recipes found" if filteredRecipes is empty.
          <RecipeList recipes={filteredRecipes} />
        )}
      </div>
    </div>
  );
};

export default HomePage;
