import React, { useState, useEffect } from "react";
import { Recipe, Ingredient } from "../types/recipe";
import Button from "./Button";
import Input from "./Input";
import { Trash2 } from "lucide-react";
import { STANDARD_UNITS } from "../utils/constants";

interface RecipeFormProps {
  initialRecipe: Recipe;
  onSave: (recipe: Recipe) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  error: string | null;
}

const RecipeForm: React.FC<RecipeFormProps> = ({
  initialRecipe,
  onSave,
  onCancel,
  isSaving,
  isDeleting,
  error,
}) => {
  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);

  // Update form when initialRecipe changes
  useEffect(() => {
    setRecipe(initialRecipe);
  }, [initialRecipe]);

  // --- Helper functions for Edit Mode ---
  const handleIngredientChange = (
    index: number,
    field: keyof Omit<Ingredient, "id">,
    value: string | number
  ) => {
    const updatedIngredients = [...recipe.other];
    let processedValue: string | number = value;

    if (field === "quantity") {
      // Attempt to parse quantity as a number
      const num = parseFloat(String(value)); // Ensure value is string for parseFloat
      processedValue = isNaN(num) ? 0 : num;
    } // No special processing needed for unit select value (it's already a string)

    updatedIngredients[index] = {
      ...updatedIngredients[index],
      [field]: processedValue,
    };
    setRecipe({ ...recipe, other: updatedIngredients });
  };

  const addIngredient = () => {
    setRecipe({
      ...recipe,
      other: [...recipe.other, { name: "", quantity: 1, unit: "" }], // Default new quantity to 1 (must be positive)
    });
  };

  const removeIngredient = (index: number) => {
    const updatedIngredients = recipe.other.filter((_, i) => i !== index);
    setRecipe({ ...recipe, other: updatedIngredients });
  };

  const handleInstructionChange = (index: number, value: string) => {
    const updatedInstructions = [...recipe.instructions];
    updatedInstructions[index] = value;
    setRecipe({ ...recipe, instructions: updatedInstructions });
  };

  const addInstruction = () => {
    setRecipe({ ...recipe, instructions: [...recipe.instructions, ""] });
  };

  const removeInstruction = (index: number) => {
    const updatedInstructions = recipe.instructions.filter(
      (_, i) => i !== index
    );
    setRecipe({ ...recipe, instructions: updatedInstructions });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSave(recipe);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Error Display */}
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded">
          Error: {error}
        </div>
      )}

      {/* Title Field */}
      <div>
        <label
          htmlFor="title"
          className="block uppercase text-xs font-bold text-stone-400 mb-1"
        >
          Title
        </label>
        <Input
          type="text"
          id="title"
          value={recipe.title}
          onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
          className="w-full"
          disabled={isSaving || isDeleting}
          required
        />
      </div>

      {/* Image URL Field */}
      <div>
        <label
          htmlFor="imageUrl"
          className="block uppercase text-xs font-bold text-stone-400 mb-1"
        >
          Image URL (Optional)
        </label>
        <Input
          type="url"
          id="imageUrl"
          value={recipe.imageUrl || ''} // Ensure value is not undefined
          onChange={(e) => setRecipe({ ...recipe, imageUrl: e.target.value || undefined })}
          className="w-full"
          placeholder="https://example.com/image.jpg"
          disabled={isSaving || isDeleting}
        />
      </div>

      {/* Main Ingredient Field */}
      <div>
        <label
          htmlFor="mainIngredient"
          className="block uppercase text-xs font-bold text-stone-400 mb-1"
        >
          Main Ingredient
        </label>
        <Input
          type="text"
          id="mainIngredient"
          value={recipe.main}
          onChange={(e) => setRecipe({ ...recipe, main: e.target.value })}
          className="w-full"
          disabled={isSaving || isDeleting}
          required
        />
      </div>

      {/* Other Ingredients */}
      <div>
        <label className="block uppercase text-xs font-bold text-stone-400 mb-1">
          Other Ingredients
        </label>
        <div className="space-y-4">
          {recipe.other.map((ingredient, index) => {
            return (
              <div key={index} className="flex flex-wrap space-x-2 space-y-2">
                <Input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="Qty"
                  value={ingredient.quantity === 0 ? "" : ingredient.quantity}
                  onChange={(e) =>
                    handleIngredientChange(index, "quantity", e.target.value)
                  }
                  className="w-20"
                  disabled={isSaving || isDeleting}
                  required
                />
                <select
                  value={ingredient.unit || ""}
                  onChange={(e) =>
                    handleIngredientChange(index, "unit", e.target.value)
                  }
                  className="w-24 h-8 px-2 py-1 border border-stone-300 rounded-md shadow-sm sm:text-sm text-stone-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving || isDeleting}
                >
                  {STANDARD_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit === "" ? "(none)" : unit}
                    </option>
                  ))}
                </select>
                <Input
                  type="text"
                  placeholder="Ingredient Name"
                  value={ingredient.name}
                  onChange={(e) =>
                    handleIngredientChange(index, "name", e.target.value)
                  }
                  className="flex-grow"
                  disabled={isSaving || isDeleting}
                  required
                />
                <Button
                  onClick={() => removeIngredient(index)}
                  variant="icon"
                  type="button"
                  className="flex items-center justify-center w-8 h-8 rounded bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving || isDeleting || recipe.other.length <= 1}
                  aria-label="Remove Ingredient"
                >
                  <Trash2 className="h-4 w-4 text-white" strokeWidth={1.5} />
                </Button>
              </div>
            );
          })}
        </div>
        <Button
          onClick={addIngredient}
          variant="secondary"
          className="mt-2 text-sm px-4 py-2"
          disabled={isSaving || isDeleting}
          type="button"
        >
          Add Ingredient
        </Button>
      </div>

      {/* Instructions */}
      <div>
        <label className="block uppercase text-xs font-bold text-stone-400 mb-1">
          Instructions
        </label>
        <div className="space-y-2">
          {recipe.instructions.map((step, index) => (
            <div key={index} className="flex items-start space-x-2">
              <span className="pt-2 text-sm font-medium text-stone-500 text-left">
                {index + 1}.
              </span>
              <textarea
                value={step}
                onChange={(e) => handleInstructionChange(index, e.target.value)}
                rows={3}
                className="flex-grow px-2 py-1 border border-stone-300 rounded-md shadow-sm sm:text-sm text-stone-900"
                disabled={isSaving || isDeleting}
                placeholder={`Step ${index + 1}`}
                required
              />
              <Button
                onClick={() => removeInstruction(index)}
                variant="icon"
                type="button"
                className="flex items-center justify-center w-8 h-8 rounded bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  isSaving || isDeleting || recipe.instructions.length <= 1
                }
                aria-label="Remove Instruction"
              >
                <Trash2 className="h-4 w-4 text-white" strokeWidth={1.5} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          onClick={addInstruction}
          variant="secondary"
          className="mt-4 text-sm px-4 py-2"
          disabled={isSaving || isDeleting}
          type="button"
        >
          Add Instruction
        </Button>
      </div>

      {/* Form Buttons */}
      <div className="flex justify-start space-x-3 pt-4 border-t border-stone-200">
        <Button
          onClick={onCancel}
          variant="secondary"
          className="px-4 py-2"
          disabled={isSaving || isDeleting}
          type="button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="px-4 py-2"
          disabled={isSaving || isDeleting}
          isLoading={isSaving}
        >
          Save Recipe
        </Button>
      </div>
    </form>
  );
};

export default RecipeForm;
