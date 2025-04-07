import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecipes } from '../hooks/useRecipes';
import { Link } from 'react-router-dom';
import { logger } from '../utils/logger';
import { tryCatchAsync } from '../utils/errorHandling';
import { ROUTES } from '../utils/navigation';

const AddRecipePage: React.FC = () => {
  const [recipeInput, setRecipeInput] = useState(''); // Can be raw text or URL
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

    // Simple check if input looks like a URL
    const isUrl = recipeInput.trim().startsWith('http://') || recipeInput.trim().startsWith('https://');
    const requestBody = isUrl ? { url: recipeInput.trim() } : { rawText: recipeInput };
    
    logger.log('AddRecipePage', 'Processing recipe', { type: isUrl ? 'url' : 'text' });

    // Define a separate function for the API call to use with tryCatchAsync
    const processRecipe = async () => {
      const response = await fetch('/api/process-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to process recipe' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    };

    const [result, error] = await tryCatchAsync(
      processRecipe,
      'AddRecipePage',
      'Failed to process recipe'
    );

    if (error) {
      logger.error('AddRecipePage', 'Error submitting recipe:', error);
      setStatusMessage(`Error: ${error.message}`);
      setStatusType('error');
    } else if (result) {
      logger.log('AddRecipePage', 'Recipe processed successfully:', result);
      setStatusMessage(result.message || 'Recipe processed and saved successfully!');
      setRecipeInput(''); // Clear the input field
      
      // Refetch recipes in the background
      refetchRecipes(); 

      // Navigate to the new recipe's detail page using the navigation utility
      navigate(ROUTES.RECIPE_DETAIL(result.id));
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
          <textarea
            id="recipeInput"
            value={recipeInput}
            onChange={(e) => setRecipeInput(e.target.value)}
            rows={10}
            className="mt-1 block w-full rounded-md border-stone-300 bg-white shadow-sm focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm px-3 py-2 placeholder:text-stone-500 text-stone-900"
            placeholder="Enter Recipe URL or Paste Recipe Text..."
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out text-white bg-emerald-800 hover:bg-emerald-700 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Process Recipe'}
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