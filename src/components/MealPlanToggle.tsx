import React from 'react';

interface MealPlanToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const MealPlanToggle: React.FC<MealPlanToggleProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <label className="text-sm font-medium text-stone-700">
          Exclude from Meal Planning
        </label>
        <p className="text-xs text-stone-500">
          When enabled, this recipe won't appear in generated meal plans
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2
          ${value 
            ? 'bg-emerald-600' 
            : 'bg-stone-200'
          }
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer'
          }
        `}
        role="switch"
        aria-checked={value}
        aria-label="Toggle meal plan exclusion"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${value ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
};

export default MealPlanToggle;
