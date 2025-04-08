import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Assuming recipeApi.create exists and POSTs to /api/recipes
// If not, we can use direct fetch
import { recipeApi } from '../services/api'; // Adjust if path is different
import { useRecipes } from '../hooks/useRecipes';
import { Link } from 'react-router-dom';
import { logger } from '../utils/logger';
import { tryCatchAsync } from '../utils/errorHandling';
import { ROUTES } from '../utils/navigation';
// Import the Recipe type
import type { Recipe } from '../types/recipe';

const AddRecipePage: React.FC = () => {
  const [recipeInput, setRecipeInput] = useState(''); // Expect JSON string here
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'error' | 'success'>('success');
  const navigate = useNavigate();
  const { refetchRecipes } = useRecipes();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);
    setStatusType('success');
    
    let parsedData: any;

    // 1. Parse the input as JSON
    try {
      parsedData = JSON.parse(recipeInput);
      logger.log('AddRecipePage', 'Parsed recipe JSON');
    } catch (parseError: unknown) {
      logger.error('AddRecipePage', 'Invalid JSON input:', parseError);
      setStatusMessage(`Error: Invalid JSON format. Please paste valid recipe JSON. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      setStatusType('error');
      setIsLoading(false);
      return;
    }

    // Assert the type before passing to the API
    // Use Omit<Recipe, 'id'> as the expected type for creation
    const recipeDataForApi = parsedData as Omit<Recipe, 'id'>;

    // 2. Define function to call POST /api/recipes
    const createRecipe = async () => {
      const newRecipe = await recipeApi.create(recipeDataForApi);
      return newRecipe;
    };

    // 3. Call the create function with error handling
    const [newRecipeResult, error] = await tryCatchAsync(
      createRecipe,
      'AddRecipePage',
      'Failed to save recipe' // Generic error message
    );

    if (error) {
      logger.error('AddRecipePage', 'Error submitting recipe:', error);
      // Check for specific conflict error from the API
      const errorMessage = (error instanceof Error && error.message.includes('already exists')) 
        ? error.message 
        : `Error saving recipe: ${error.message}`;
      setStatusMessage(errorMessage);
      setStatusType('error');
    } else if (newRecipeResult) {
      logger.log('AddRecipePage', 'Recipe saved successfully:', newRecipeResult);
      setStatusMessage('Recipe saved successfully!');
      setStatusType('success');
      setRecipeInput(''); // Clear the input field
      
      refetchRecipes(); 

      // Navigate using the ID returned from the backend
      if (newRecipeResult.id) {
        navigate(ROUTES.RECIPE_DETAIL(newRecipeResult.id));
      } else {
        // Fallback if ID is missing in response (shouldn't happen)
        navigate(ROUTES.HOME);
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen p-4">
      <Link 
        to={ROUTES.HOME}
        className="mb-4 inline-block text-emerald-800 hover:text-emerald-600"
      >
        &larr; Back to Recipes
      </Link>
      <h1 className="text-3xl font-bold mb-6 text-stone-900">Add New Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recipeInput" className="block text-sm font-medium text-stone-700 mb-1">Recipe Data (JSON format)</label>
          <textarea
            id="recipeInput"
            value={recipeInput}
            onChange={(e) => setRecipeInput(e.target.value)}
            rows={15} // Increased rows for JSON
            className="mt-1 block w-full rounded-md border-stone-300 bg-white shadow-sm focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm px-3 py-2 placeholder:text-stone-500 text-stone-900 font-mono" // Added font-mono
            placeholder={'{ "title": "...", "main": "...", "other": [{ "name": "Ing Name", "quantity": 1, "unit": "cup" }, ...], "instructions": ["Step 1...", ...] }'} // More detailed placeholder
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !recipeInput.trim()}
          className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out text-white bg-emerald-800 hover:bg-emerald-700 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Recipe'}
        </button>
      </form>

      {statusMessage && (
        <div className={`mt-4 p-3 rounded text-center ${statusType === 'error' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-green-100 text-green-800 border border-green-300'}`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export default AddRecipePage; 