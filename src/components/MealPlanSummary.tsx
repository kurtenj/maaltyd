import React from 'react';
import { useMealPlan } from '../hooks/useMealPlan';
import { Link } from 'react-router-dom';
import { ROUTES } from '../utils/navigation';
import { Loader2, AlertCircle, CalendarHeart } from 'lucide-react';

// Array to map index to day name
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MealPlanSummary: React.FC = () => {
  const {
    mealPlan,
    isLoading,
    error
  } = useMealPlan();

  // Loading State
  if (isLoading) {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow border border-stone-200 flex items-center justify-center h-24">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mr-3" />
        <span className="text-stone-600">Loading meal plan...</span>
      </div>
    );
  }

  // Error State
  if (error && !mealPlan) { // Only show full error if no plan is loaded at all
    return (
      <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 flex items-center h-24">
        <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
        <span className="text-sm text-red-800">Error loading meal plan: {error}</span>
      </div>
    );
  }

  // No Meal Plan State
  if (!mealPlan) {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow border border-stone-200 text-center h-24 flex flex-col items-center justify-center">
        <p className="text-stone-600 mb-3">No meal plan generated yet.</p>
        <Link 
          to={ROUTES.MEAL_PLAN}
          className="inline-flex items-center justify-center rounded-md border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out"
        >
          <CalendarHeart className="mr-2 h-4 w-4" />
          Go to Plan
        </Link>
      </div>
    );
  }

  // Meal Plan Exists - Display Summary
  return (
    <div className="mb-6 p-4 bg-white rounded-lg shadow border border-stone-200">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-stone-800">
          Current Meal Plan
        </h2>
        <Link 
          to={ROUTES.MEAL_PLAN}
          className="text-sm text-emerald-800 hover:underline hover:text-emerald-600 font-medium"
        >
          View Full Plan
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {mealPlan.recipes.map((recipe, index) => (
          <Link
            key={`${recipe.id}-${index}`}
            to={ROUTES.RECIPE_DETAIL(recipe.id)}
            title={recipe.title}
            className="block p-2 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 text-center truncate text-sm text-stone-700 hover:text-emerald-800 transition duration-150 ease-in-out"
          >
            <span className="font-medium">{dayNames[index]}</span>
            <span className="block truncate text-xs text-stone-500">{recipe.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MealPlanSummary; 