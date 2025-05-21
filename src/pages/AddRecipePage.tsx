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

/**
 * Add Recipe Page with URL scraping functionality
 */
const AddRecipePage: React.FC = () => {
  // State for URL input and processing
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);

  // State for photo input and processing
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // State for imported recipe
  const [importedRecipe, setImportedRecipe] = useState<Omit<Recipe, 'id'> | null>(null);
  const defaultRecipe: Omit<Recipe, 'id'> = {
    title: '',
    main: '',
    other: [{ name: '', quantity: '', unit: '' }],
    instructions: ['']
  };
  
  // State for form/saving
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'error' | 'success'>('success');
  
  const navigate = useNavigate();
  const { refetchRecipes } = useRecipes();

  /**
   * Handle file selection for photo import
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setStatusMessage(null); // Clear previous status messages
    } else {
      setSelectedFile(null);
    }
  };

  /**
   * Handle processing the selected photo
   */
  const handleProcessPhoto = async (event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setStatusMessage('Please select an image file.');
      setStatusType('error');
      return;
    }

    setIsProcessingImage(true);
    setStatusMessage('Processing image...');
    setStatusType('success');
    logger.log('AddRecipePage', 'Processing photo:', selectedFile.name);

    try {
      const processedRecipeData = await recipeApi.processImage(selectedFile);
      
      logger.log('AddRecipePage', 'Recipe data processed from image:', processedRecipeData);
      setImportedRecipe(processedRecipeData);
      setStatusMessage('Recipe extracted from image! Review and make any changes before saving.');
      setStatusType('success');
      setSelectedFile(null); // Clear the selected file
      // No recipeImageUrl state to clear in this component as per current code.
    } catch (error) {
      logger.error('AddRecipePage', 'Error processing photo via API:', error);
      // Check if the error has a 'message' property, otherwise stringify it.
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Failed to process image: ${errorMessage}`);
      setStatusType('error');
    } finally {
      setIsProcessingImage(false);
    }
  };

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
    
    setIsScrapingUrl(true);
    setStatusMessage('Importing recipe from URL...');
    setStatusType('success');
    
    try {
      const response = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
   * Handle saving the recipe
   */
  const handleSaveRecipe = async (recipeToSave: Recipe | Omit<Recipe, 'id'>): Promise<void> => {
    setIsCreating(true);
    setStatusMessage(null);
    
    // Remove any existing ID as we're creating a new recipe
    // This handles cases where a Recipe type might be passed with an id
    const { id: _id, ...recipeWithoutId } = recipeToSave as Recipe;
    
    logger.log('AddRecipePage', 'Saving recipe:', recipeWithoutId);

    const [newRecipeResult, error] = await tryCatchAsync(
      () => recipeApi.create(recipeWithoutId),
      'AddRecipePage',
      'Failed to save recipe'
    );

    if (error) {
      logger.error('AddRecipePage', 'Error submitting recipe:', error);
      const errorMessage = (error instanceof Error && error.message.includes('already exists')) 
        ? error.message 
        : `Error saving recipe: ${error.message}`;
      setStatusMessage(errorMessage);
      setStatusType('error');
      setIsCreating(false);
    } else if (newRecipeResult) {
      logger.log('AddRecipePage', 'Recipe saved successfully:', newRecipeResult);
      
      // Reset form state
      setImportedRecipe(null);
      refetchRecipes();

      // Navigate to the recipe detail page
      if (newRecipeResult.id) {
        navigate(ROUTES.RECIPE_DETAIL(newRecipeResult.id));
      } else {
        navigate(ROUTES.HOME);
      }
    }
  };

  /**
   * Handle canceling the form
   */
  const handleCancel = () => {
    setImportedRecipe(null);
    setStatusMessage(null);
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

      {/* Show URL import section only when not editing a recipe */}
      {!importedRecipe && (
        <>
        <div className="mb-8 p-4 bg-stone-50 rounded-lg border border-stone-200">
          <h2 className="text-xl font-semibold mb-3 text-stone-900">Import from URL</h2>
          <form onSubmit={handleImportFromUrl} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="Paste recipe URL here..."
                className="flex-grow rounded-md border-stone-300 shadow-sm focus:ring-2 focus:ring-inset focus:ring-emerald-600 px-3 py-2"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                disabled={isScrapingUrl}
              />
              <button
                type="submit"
                disabled={isScrapingUrl || !recipeUrl.trim()}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScrapingUrl ? 'Importing...' : 'Import Recipe'}
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Paste the URL of a recipe page to automatically extract the recipe data.
              Note: This feature works best with recipe sites that use structured data.
            </p>
          </form>
        </div>

        {/* Import from Photo Section */}
        <div className="mb-8 p-4 bg-stone-50 rounded-lg border border-stone-200">
          <h2 className="text-xl font-semibold mb-3 text-stone-900">Import from Photo</h2>
          <form onSubmit={handleProcessPhoto} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessingImage}
              />
              <button
                type="submit"
                disabled={isProcessingImage || !selectedFile}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingImage ? 'Processing...' : 'Create Recipe from Photo'}
              </button>
            </div>
            {selectedFile && (
              <p className="text-xs text-stone-600">Selected file: {selectedFile.name}</p>
            )}
            <p className="text-xs text-stone-500">
              Upload a photo of a recipe. This feature will attempt to extract recipe details from the image.
            </p>
          </form>
        </div>
        
        {/* Create Manually Section */}
        <div className="mb-8 p-4 bg-stone-50 rounded-lg border border-stone-200">
          <h2 className="text-xl font-semibold mb-3 text-stone-900">Or Create Manually</h2>
          <button
            type="button"
            onClick={() => setImportedRecipe(defaultRecipe)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out"
          >
            Create New Recipe
          </button>
          <p className="text-xs text-stone-500 mt-2">
            Start with a blank recipe form.
          </p>
        </div>
        </>
      )}

      {/* Show the recipe form when we have an imported recipe */}
      {importedRecipe && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-stone-200">
          <h2 className="text-xl font-semibold mb-4 text-stone-900">Edit Recipe Details</h2>
          <RecipeForm
            initialRecipe={{ ...importedRecipe, id: 'temp-id' }} // Provide a temp ID since RecipeForm expects the full Recipe type
            onSave={handleSaveRecipe}
            onCancel={handleCancel}
            isSaving={isCreating}
            isDeleting={false}
            error={statusType === 'error' ? statusMessage : null}
          />
        </div>
      )}

      {/* Display status messages only when not showing the form and a message exists, and not currently processing an image or url (to avoid double messages) */}
      {!importedRecipe && statusMessage && !isProcessingImage && !isScrapingUrl && (
        <div className={`mt-4 p-3 rounded text-center ${
          statusType === 'error' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-green-100 text-green-800 border border-green-300'
        }`}>
          {statusMessage}
        </div>
      )}
      {/* Specific loading messages for URL scraping or image processing */}
      {(isScrapingUrl || isProcessingImage) && statusMessage && (
         <div className={`mt-4 p-3 rounded text-center bg-blue-100 text-blue-800 border border-blue-300`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export default AddRecipePage; 