import React from 'react';
import { useMealPlan } from '../hooks/useMealPlan';
import { Link } from 'react-router-dom';
import { ROUTES } from '../utils/navigation';
import ShoppingListComponent from '../components/ShoppingListComponent'; // Import the extracted component
import Button from '../components/Button'; // Import the Button component
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';

// Array to map index to day name (ABBREVIATED)
const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const MealPlanPage: React.FC = () => {
  const {
    mealPlan,
    isLoading,
    error,
    generateNewMealPlan,
    rerollRecipeInPlan,
    toggleShoppingListItem
  } = useMealPlan();

  const handleGeneratePlan = () => {
    generateNewMealPlan();
  };

  const handleReroll = (index: number) => {
    rerollRecipeInPlan(index);
  };

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-3xl font-bold mb-6 text-stone-900">7-Day Meal Plan</h1>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 flex items-center rounded-md border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !mealPlan && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-stone-600">Loading meal plan...</span>
        </div>
      )}

      {/* No Plan State */}
      {!isLoading && !mealPlan && !error && (
        <div className="text-center p-6 bg-white rounded-lg shadow border border-stone-200">
          <h2 className="text-xl font-semibold mb-4 text-stone-800">No Meal Plan Generated Yet</h2>
          <p className="mb-6 text-stone-600">Generate a new 7-day meal plan based on your saved recipes.</p>
          <button
            onClick={handleGeneratePlan}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-800 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
            ) : 'Generate Meal Plan'}
          </button>
        </div>
      )}

      {/* Meal Plan Display */}
      {mealPlan && (
        <div className="space-y-8">
          {/* Recipe List */}
          <div className="bg-white p-6 rounded-lg shadow border border-stone-200">
            <h2 className="text-2xl font-semibold mb-4 text-stone-900">Recipes</h2>
            <ul className="space-y-3">
              {mealPlan.recipes.map((recipe, index) => (
                <li 
                  key={`${recipe.id}-${index}-${dayNames[index]}`}
                  className="flex items-center justify-between py-2 border-b border-stone-100 last:border-b-0"
                >
                  <div className="flex-1 flex items-center min-w-0">
                    <span className="w-12 font-medium text-stone-500 mr-3 text-xs uppercase tracking-wider">
                      {dayNames[index]}
                    </span>
                    <Link 
                      to={ROUTES.RECIPE_DETAIL(recipe.id)} 
                      className="text-emerald-800 hover:text-emerald-600 hover:underline flex-grow truncate"
                      title={recipe.title}
                    >
                      {recipe.title}
                    </Link>
                  </div>
                  <Button
                    variant="icon"
                    onClick={() => handleReroll(index)}
                    disabled={isLoading}
                    className="ml-4 p-1.5 rounded-full text-stone-500 hover:bg-stone-100 hover:text-emerald-700 focus:ring-emerald-600"
                    title="Re-roll this recipe"
                    aria-label="Re-roll this recipe"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading && 'animate-spin'}`} />
                  </Button>
                </li>
              ))}
            </ul>
            <button
              onClick={handleGeneratePlan}
              disabled={isLoading}
              className="mt-6 inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
              ) : 'Generate New Plan'}
            </button>
          </div>

          {/* Shopping List */}
          <div className="bg-white p-6 rounded-lg shadow border border-stone-200">
            <h2 className="text-2xl font-semibold mb-4 text-stone-900">Shopping List</h2>
            <ShoppingListComponent 
              shoppingList={mealPlan.shoppingList} 
              onToggleItem={toggleShoppingListItem}
              disabled={isLoading} // Disable toggling while any loading is happening
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlanPage; 