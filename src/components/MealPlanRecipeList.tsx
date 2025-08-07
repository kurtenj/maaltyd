import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../utils/navigation';
import { DAY_NAMES } from '../utils/constants';
import Button from './Button';
import RecipeCard from './RecipeCard';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Recipe } from '../types/recipe';

interface MealPlanRecipeListProps {
  recipes: Recipe[];
  isLoading: boolean;
  onReroll: (index: number) => void;
  onGenerateNew: () => void;
}

const MealPlanRecipeList: React.FC<MealPlanRecipeListProps> = ({
  recipes,
  isLoading,
  onReroll,
  onGenerateNew
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow border border-stone-200">
      <h2 className="text-2xl font-semibold mb-4 text-stone-900">Recipes</h2>
      
      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {recipes.map((recipe, index) => (
          <div key={`${recipe.id}-${index}-${DAY_NAMES[index]}`} className="relative">
            {/* Day Label */}
            <div className="absolute top-2 left-2 z-10">
              <span className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium uppercase tracking-wider">
                {DAY_NAMES[index]}
              </span>
            </div>
            
            {/* Reroll Button */}
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="icon"
                onClick={() => onReroll(index)}
                disabled={isLoading}
                className="p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-stone-500 hover:bg-white hover:text-emerald-700 focus:ring-emerald-600 shadow-sm"
                title="Re-roll this recipe"
                aria-label="Re-roll this recipe"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading && 'animate-spin'}`} />
              </Button>
            </div>
            
            {/* Recipe Card */}
            <RecipeCard recipe={recipe} />
          </div>
        ))}
      </div>
      
      {/* Generate New Plan Button */}
      <button
        onClick={onGenerateNew}
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
        ) : 'Generate New Plan'}
      </button>
    </div>
  );
};

export default MealPlanRecipeList;
