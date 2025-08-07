import React from 'react';
import { Loader2 } from 'lucide-react';

const MealPlanLoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      <span className="ml-3 text-stone-600">Loading meal plan...</span>
    </div>
  );
};

export default MealPlanLoadingState;
