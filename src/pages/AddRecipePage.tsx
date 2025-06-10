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
import RecipeForm from '../components/RecipeForm';
import { useAuth } from '@clerk/clerk-react';

/**
 * Add Recipe Page with URL scraping functionality
 */
const AddRecipePage: React.FC = () => {
  // State for URL input and processing
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  
  // State for imported recipe
  const [importedRecipe, setImportedRecipe] = useState<Omit<Recipe, 'id'> | null>(null);
  const defaultRecipe: Omit<Recipe, 'id'> = {
    title: '',
    main: '',
    other: [{ name: '', quantity: 0, unit: '' }],
    instructions: ['']
  };
  
  // State for form/saving
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'error' | 'success'>('success');
  
  const navigate = useNavigate();
  const { refetchRecipes } = useRecipes();
  const { getToken, isSignedIn, isLoaded } = useAuth();

  /**
   * Handle importing recipe from URL
   */
  const handleImportFromUrl = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!recipeUrl.trim()) {
      setStatusMessage('Please enter a valid recipe URL');
      setStatusType('error');
      return;
    }

    if (!isSignedIn) {
      setStatusMessage('Please sign in to import recipes');
      setStatusType('error');
      return;
    }
    
    setIsScrapingUrl(true);
    setStatusMessage('Importing recipe from URL...');
    setStatusType('success');
    
    try {
      // Get the authentication token from Clerk
      const token = await getToken();
      
      if (!token) {
        throw new Error('Authentication failed. Please try signing in again.');
      }

      const response = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: recipeUrl }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error importing recipe: ${response.statusText}`);
      }
      
      const recipeData = await response.json();
      logger.log('AddRecipePage', 'Recipe data scraped from URL:', recipeData);
      
      // Set the imported recipe to display in the form
      setImportedRecipe(recipeData);
      setStatusMessage('Recipe imported! Review and make any changes before saving.');
      setStatusType('success');
      
      // Clear the URL field
      setRecipeUrl('');
    } catch (error) {
      logger.error('AddRecipePage', 'Error importing recipe from URL:', error);
      setStatusMessage(`Failed to import recipe: ${error instanceof Error ? error.message : String(error)}`);
      setStatusType('error');
    } finally {
      setIsScrapingUrl(false);
    }
  };

  /**
   * Handle creating a new recipe
   */
  const handleCreateRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    setIsCreating(true);
    setStatusMessage('Creating recipe...');
    setStatusType('success');

    const [newRecipe, createError] = await tryCatchAsync(
      () => recipeApi.create(recipe),
      'AddRecipePage',
      'Failed to create recipe'
    );

    if (createError) {
      logger.error('AddRecipePage', 'Error creating recipe:', createError);
      setStatusMessage(`Failed to create recipe: ${createError.message}`);
      setStatusType('error');
      setIsCreating(false);
      return;
    }

    if (newRecipe) {
      logger.log('AddRecipePage', 'Recipe created successfully:', newRecipe);
      await refetchRecipes(); // Refresh the recipes list
      navigate(ROUTES.HOME); // Redirect to home page or recipe detail page
    }

    setIsCreating(false);
  };

  /**
   * Handle saving the recipe from the form
   */
  const handleSaveRecipe = async (recipe: Recipe) => {
    // Remove the id from the recipe since we're creating, not updating
    const { id: _id, ...recipeWithoutId } = recipe;
    await handleCreateRecipe(recipeWithoutId);
  };

  /**
   * Handle canceling the form
   */
  const handleCancelForm = () => {
    // Clear any imported recipe and reset form
    setImportedRecipe(null);
    setStatusMessage(null);
  };

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          Loading...
        </div>
      </div>
    );
  }

  // Show sign-in message if user is not authenticated
  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-4">
            Please sign in to add recipes to your collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Add New Recipe</h1>
        <Link 
          to={ROUTES.HOME} 
          className="text-emerald-600 hover:text-emerald-700 font-medium"
        >
          ← Back to Recipes
        </Link>
      </div>

      {/* URL Import Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Import from URL</h2>
        <form onSubmit={handleImportFromUrl} className="space-y-4">
          <div>
            <label htmlFor="recipe-url" className="block text-sm font-medium text-gray-700 mb-1">
              Recipe URL
            </label>
            <input
              id="recipe-url"
              type="url"
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="https://example.com/recipe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={isScrapingUrl}
            />
          </div>
          <button
            type="submit"
            disabled={isScrapingUrl || !recipeUrl.trim()}
            className="w-full bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isScrapingUrl ? 'Importing...' : 'Import Recipe'}
          </button>
        </form>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-md ${
          statusType === 'error' 
            ? 'bg-red-50 text-red-800 border border-red-200' 
            : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Recipe Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">
          {importedRecipe ? 'Review Imported Recipe' : 'Manual Entry'}
        </h2>
        <RecipeForm
          initialRecipe={{
            id: 'temp-id', // Temporary ID since RecipeForm expects it
            ...(importedRecipe || defaultRecipe)
          }}
          onSave={handleSaveRecipe}
          onCancel={handleCancelForm}
          isSaving={isCreating}
          isDeleting={false}
          error={statusType === 'error' ? statusMessage : null}
        />
      </div>
    </div>
  );
};

export default AddRecipePage; 