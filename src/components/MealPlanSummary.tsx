import React, { useState, useEffect } from "react";
import { useMealPlan } from "../hooks/useMealPlan";
import { Link } from "react-router-dom";
import { ROUTES } from "../utils/navigation";
import { Loader2, AlertCircle, CalendarHeart } from "lucide-react";
import RecipeImagePlaceholder from "./RecipeImagePlaceholder";
import { Recipe } from "../types/recipe";
import { logger } from "../utils/logger";
import {
  getCurrentWeekDates,
  formatDateMonthDay,
} from "../utils/dateFunctions";

// Short day names for the new layout
const shortDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Internal component for displaying each day's meal in the summary
interface MealDayDisplayProps {
  dayName: string;
  recipe: Recipe;
}

const MealDayDisplay: React.FC<MealDayDisplayProps> = ({ dayName, recipe }) => {
  const [imageLoadError, setImageLoadError] = useState(false);

  return (
    <div className="flex flex-col items-center pt-2 w-full text-center">
      <span className="uppercase text-xs font-bold mb-1 text-stone-400">
        {dayName}
      </span>
      <Link
        to={ROUTES.RECIPE_DETAIL(recipe.id)}
        className="w-14 h-14 block rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        title={recipe.title}
      >
        {recipe.imageUrl && !imageLoadError ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={() => {
              logger.warn(
                "MealDayDisplay",
                `Image failed to load: ${recipe.imageUrl}`
              );
              setImageLoadError(true);
            }}
          />
        ) : (
          <RecipeImagePlaceholder className="w-full h-full" />
        )}
      </Link>
    </div>
  );
};

const MealPlanSummary: React.FC = () => {
  const { mealPlan, isLoading, error } = useMealPlan();
  const [dateRangeTitle, setDateRangeTitle] = useState<string>(
    "Mon-Fri Meal Preview"
  );

  useEffect(() => {
    const { monday, friday } = getCurrentWeekDates();
    const formattedMonday = formatDateMonthDay(monday);
    const formattedFriday = formatDateMonthDay(friday);

    // Check if Monday and Friday are in the same month for formatting "Month Day1 - Day2"
    if (monday.getMonth() === friday.getMonth()) {
      setDateRangeTitle(
        `${
          formattedMonday.split(" ")[0]
        } ${monday.getDate()} - ${friday.getDate()}`
      );
    } else {
      setDateRangeTitle(`${formattedMonday} - ${formattedFriday}`);
    }
  }, []);

  // Loading State
  if (isLoading) {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow border border-stone-200 flex items-center justify-center h-24 w-full md:w-auto md:max-w-md">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mr-3" />
        <span className="text-stone-600">Loading meal plan...</span>
      </div>
    );
  }

  // Error State
  if (error && !mealPlan) {
    // Only show full error if no plan is loaded at all
    return (
      <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 flex items-center h-24 w-full md:w-auto md:max-w-md">
        <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
        <span className="text-sm text-red-800">
          Error loading meal plan: {error}
        </span>
      </div>
    );
  }

  // No Meal Plan State
  if (!mealPlan) {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow border border-stone-200 text-center h-24 flex flex-col items-center justify-center w-full md:w-auto md:max-w-md">
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

  // Meal Plan Exists - Display New Summary Layout
  return (
    <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-stone-200 w-full md:w-auto md:max-w-md">
      <div className="flex justify-between items-center">
        <h2 className="text-md font-bold mb-1 capitalize text-stone-800">
          {dateRangeTitle}
        </h2>
        <Link
          to={ROUTES.MEAL_PLAN}
          className="text-sm text-emerald-800 hover:underline hover:text-emerald-600 font-medium"
        >
          View Week
        </Link>
      </div>
      {/* Grid for displaying MealDayDisplay components - strictly 5 columns */}
      <div className="grid grid-cols-5 gap-4">
        {mealPlan.recipes.slice(0, 5).map(
          (
            recipe,
            index // Slice to get only the first 5 days (Mon-Fri)
          ) => (
            <MealDayDisplay
              key={`${recipe.id}-${index}`}
              dayName={shortDayNames[index]} // Direct index, as we only have 5 items
              recipe={recipe}
            />
          )
        )}
      </div>
    </div>
  );
};

export default MealPlanSummary;
