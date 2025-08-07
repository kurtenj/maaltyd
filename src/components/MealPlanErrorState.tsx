import React from 'react';
import { AlertCircle } from 'lucide-react';

interface MealPlanErrorStateProps {
  error: string;
}

const MealPlanErrorState: React.FC<MealPlanErrorStateProps> = ({ error }) => {
  return (
    <div className="mb-4 flex items-center rounded-md border border-red-300 bg-red-100 p-3 text-sm text-red-800">
      <AlertCircle className="mr-2 h-5 w-5" />
      <span>{error}</span>
    </div>
  );
};

export default MealPlanErrorState;
