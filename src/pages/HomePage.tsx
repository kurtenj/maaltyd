import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRecipes } from '../hooks/useRecipes';
import RecipeCard from '../components/RecipeCard';
import { ROUTES } from '../utils/navigation';
import { getRecentRecipeIds } from '../utils/recentRecipes';

import Button from '../components/Button';
import Input from '../components/Input';

const HomePage: React.FC = () => {
  const {
    allRecipes,
    isLoading,
    error,
    filteredRecipes,
    searchTerm,
    setSearchTerm,
    selectedMainIngredient,
    availableMainIngredients,
    handleMainIngredientChange,
  } = useRecipes();

  const recentRecipes = useMemo(() => {
    if (!allRecipes.length) return [];
    const ids = getRecentRecipeIds();
    return ids
      .map((id) => allRecipes.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);
  }, [allRecipes]);

  return (
    <div className="min-h-screen">
      {/* Last Viewed */}
      {!isLoading && recentRecipes.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-stone-900 mb-4">Last Viewed</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {recentRecipes.slice(0, 3).map((recipe, index) => (
              <div key={recipe.id} className={index > 0 ? 'hidden lg:block' : undefined}>
                <RecipeCard recipe={recipe} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Recipes Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-stone-900">All Recipes</h2>
      </div>

      {/* Search Input and Recipe List Area */}
      <div className="mt-8">
        {/* Filter Controls: Search and Main Ingredient Select */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-[2] min-w-0"
            />
            <div className="select-wrapper flex-1 min-w-0 relative">
              <select
                value={selectedMainIngredient || ""}
                onChange={(e) => {
                  handleMainIngredientChange(e.target.value || null);
                  (e.target as HTMLSelectElement).blur();
                }}
                className="select-with-arrow appearance-none w-full h-10 px-3 py-1 pr-8 border border-stone-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-stone-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed truncate"
              >
                <option value="">All</option>
                {availableMainIngredients.map((ingredient) => (
                  <option key={ingredient} value={ingredient}>
                    {ingredient}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Display */}
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
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-stone-500 mb-4">
              {searchTerm || selectedMainIngredient
                ? 'No recipes match your search criteria.'
                : 'No recipes found. Add your first recipe to get started!'
              }
            </p>
            {!searchTerm && !selectedMainIngredient && (
              <Link to={ROUTES.ADD_RECIPE}>
                <Button variant="primary">Add Your First Recipe</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
