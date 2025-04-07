import React from 'react';
import { 
    Drumstick, // chicken
    Beef, 
    Fish, 
    CakeSlice, // cake
    Wheat, // bread, maybe flour?
    Carrot, // vegetables generic
    UtensilsCrossed // Default
} from 'lucide-react';

// Mapping from main ingredient string (lowercase) to Lucide icon component
const ingredientIconMap: Record<string, React.ElementType> = {
    chicken: Drumstick,
    beef: Beef,
    fish: Fish,
    cake: CakeSlice,
    bread: Wheat,
    'ground beef': Beef,
    'sweet potato': Carrot, // Representing vegetable main
    default: UtensilsCrossed, 
};

// Helper function to get icon based on ingredient name
const getIconForIngredient = (ingredient: string): React.ElementType => {
    return ingredientIconMap[ingredient.toLowerCase()] || ingredientIconMap.default;
};

interface RecipeFilterProps {
  availableMainIngredients: string[];
  selectedMainIngredient: string | null;
  onMainIngredientChange: (main: string | null) => void;
  availableOtherIngredients: string[];
  selectedOtherIngredients: string[];
  onOtherIngredientToggle: (other: string) => void;
}

const RecipeFilter: React.FC<RecipeFilterProps> = ({
  availableMainIngredients,
  selectedMainIngredient,
  onMainIngredientChange,
  availableOtherIngredients,
  selectedOtherIngredients,
  onOtherIngredientToggle,
}) => {
  return (
    <div className="mb-8 p-4 border border-stone-200 rounded-lg shadow-sm bg-white">

      {/* Main Ingredient Selection */}
      <div className="mb-2">
        <h3 className="text-lg font-medium mb-2 text-stone-800">Select Main Ingredient:</h3>
        <div className="flex flex-wrap gap-2">
          {availableMainIngredients.map(main => {
            const Icon = getIconForIngredient(main);
            return (
              <button
                key={main}
                onClick={() => onMainIngredientChange(main === selectedMainIngredient ? null : main)}
                className={`flex items-center space-x-2 px-4 py-2 rounded capitalize transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 
                  ${selectedMainIngredient === main
                    ? 'bg-emerald-800 text-white font-semibold'
                    : 'bg-stone-200 text-stone-800 hover:bg-stone-300 font-medium'}
                `}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{main}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Other Ingredient Selection */}
      {selectedMainIngredient && (
        <div>
          <h3 className="text-lg font-medium mb-3 text-stone-800">Optional Other Ingredients:</h3>
          {availableOtherIngredients.length > 0 ? (
             <div className="max-h-48 overflow-y-auto space-y-2 border border-stone-200 p-3 rounded-md bg-stone-50">
              {availableOtherIngredients.map(other => (
                <label key={other} className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedOtherIngredients.includes(other)}
                    onChange={() => onOtherIngredientToggle(other)}
                    className="h-4 w-4 text-emerald-700 border-stone-300 rounded focus:ring-emerald-600 mr-2"
                  />
                  <span className="capitalize text-stone-700">{other}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 italic">No specific other ingredients found for {selectedMainIngredient}.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RecipeFilter; 