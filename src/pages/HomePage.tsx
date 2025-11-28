import React from 'react';
import { Link } from 'react-router-dom';
import { useRecipes } from '../hooks/useRecipes';
import RecipeCard from '../components/RecipeCard';
import { ROUTES } from '../utils/navigation';
import { Beef, CakeSlice } from 'lucide-react';

import Button from '../components/Button';
import Input from '../components/Input';
import { ToggleGroup, ToggleGroupItem } from '../components/ToggleGroup';

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
    quickActionFilter,
    handleQuickActionToggle,
  } = useRecipes();

  return (
    <div className="min-h-screen">
      {/* Quick Action Toggle Group */}
      <div className="mb-6 pt-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="lg"
          value={quickActionFilter}
          onValueChange={(value) => handleQuickActionToggle(value as 'cook' | 'bake' | null)}
          className="w-full gap-0"
        >
          <ToggleGroupItem 
            value="cook" 
            className={`flex-1 rounded-l-lg rounded-r-none ${
              quickActionFilter === 'cook' || quickActionFilter === 'bake'
                ? 'border-r border-emerald-500' 
                : 'border-r-0'
            }`}
          >
            {quickActionFilter === 'cook' && (
              <Beef className="mr-2 h-5 w-5 animate-fade-in" />
            )}
            <span className="transition-all duration-200">Cook</span>
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="bake" 
            className={`flex-1 rounded-r-lg rounded-l-none ${
              quickActionFilter === 'cook' || quickActionFilter === 'bake'
                ? 'border-l border-emerald-500'
                : ''
            }`}
          >
            {quickActionFilter === 'bake' && (
              <CakeSlice className="mr-2 h-5 w-5 animate-fade-in" />
            )}
            <span className="transition-all duration-200">Bake</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-stone-900">All Recipes</h2>
      </div>

      {/* Search Input and Recipe List Area */}
      <div className="mt-8">
        {/* Filter Controls: Search and Main Ingredient Select */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Search and Main Ingredient Row */}
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-2/3 shadow-sm"
            />
            <select
              value={selectedMainIngredient || ""}
              onChange={(e) => handleMainIngredientChange(e.target.value || null)}
              className="w-1/3 h-8 px-3 py-1 border border-stone-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-stone-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Ingredients</option>
              {availableMainIngredients.map((ingredient) => (
                <option key={ingredient} value={ingredient}>
                  {ingredient}
                </option>
              ))}
            </select>
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
