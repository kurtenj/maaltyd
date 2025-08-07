import React from 'react';
import { Loader2 } from 'lucide-react';

interface MealPlanEmptyStateProps {
  isLoading: boolean;
  onGenerate: () => void;
}

const MealPlanEmptyState: React.FC<MealPlanEmptyStateProps> = ({
  isLoading,
  onGenerate
}) => {
  return (
    <div className="text-center p-6 bg-white rounded-lg shadow border border-stone-200">
      <h2 className="text-xl font-semibold mb-4 text-stone-800">No Meal Plan Generated Yet</h2>
      <p className="mb-6 text-stone-600">Generate a new 7-day meal plan based on your saved recipes.</p>
      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-800 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
        ) : 'Generate Meal Plan'}
      </button>
    </div>
  );
};

export default MealPlanEmptyState;
