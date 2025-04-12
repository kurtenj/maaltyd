import React from 'react';
// import { Link } from 'react-router-dom'; // Removed unused import
import { useRecipes } from '../hooks/useRecipes';
import RecipeFilter from '../components/RecipeFilter';
import RecipeList from '../components/RecipeList';
import MealPlanSummary from '../components/MealPlanSummary';

const HomePage: React.FC = () => {
  const {
    isLoading,
    error,
    selectedMainIngredient,
    selectedOtherIngredients,
    availableMainIngredients,
    availableOtherIngredients,
    filteredRecipes,
    handleMainIngredientChange,
    toggleOtherIngredient,
    isUsingDummyData,
  } = useRecipes();

  return (
    <div className="min-h-screen font-sans container mx-auto p-4">
      {/* H1 Title Removed 
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-stone-900 font-serif">Maaltyd Recipe Finder</h1>
      </div>
      */}

      {/* Add MealPlanSummary here */}
      <MealPlanSummary />
      
      {/* Adjust top margin if needed after removing H1 container */} 
      <div className="mt-4"> 
          {/* Only show error if NOT using dummy data */}
          {!isUsingDummyData && error && (
        <div className="mb-4 p-4 text-center text-red-800 bg-red-100 border border-red-300 rounded">
          Error loading recipes: {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-stone-500 italic">Loading recipes...</p>
      ) : (
        <>
          <RecipeFilter
            availableMainIngredients={availableMainIngredients}
            selectedMainIngredient={selectedMainIngredient}
            onMainIngredientChange={handleMainIngredientChange}
            availableOtherIngredients={availableOtherIngredients}
            selectedOtherIngredients={selectedOtherIngredients}
            onOtherIngredientToggle={toggleOtherIngredient}
          />
          <RecipeList recipes={filteredRecipes} selectedMainIngredient={selectedMainIngredient} />
        </>
      )}
      </div>
    </div>
  );
};

export default HomePage; 