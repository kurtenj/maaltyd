import React from 'react';
import { useMealPlan } from '../hooks/useMealPlan';
import MealPlanErrorState from '../components/MealPlanErrorState';
import MealPlanLoadingState from '../components/MealPlanLoadingState';
import MealPlanEmptyState from '../components/MealPlanEmptyState';
import MealPlanRecipeList from '../components/MealPlanRecipeList';

const MealPlanPage: React.FC = () => {
  const {
    mealPlan,
    isLoading,
    error,
    generateNewMealPlan,
    rerollRecipeInPlan
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
      {error && <MealPlanErrorState error={error} />}

      {/* Loading State */}
      {isLoading && !mealPlan && <MealPlanLoadingState />}

      {/* No Plan State */}
      {!isLoading && !mealPlan && !error && (
        <MealPlanEmptyState 
          isLoading={isLoading} 
          onGenerate={handleGeneratePlan} 
        />
      )}

      {/* Meal Plan Display */}
      {mealPlan && (
        <div className="space-y-8">
          <MealPlanRecipeList
            recipes={mealPlan.recipes}
            isLoading={isLoading}
            onReroll={handleReroll}
            onGenerateNew={handleGeneratePlan}
          />
        </div>
      )}
    </div>
  );
};

export default MealPlanPage; 