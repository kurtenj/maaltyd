import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { recipeApi } from '../services/api';
import { logger } from '../utils/logger';
import { ROUTES } from '../utils/navigation';
import type { Recipe } from '../types/recipe';
import RecipeForm from '../components/RecipeForm';
import { useAuth } from '@clerk/clerk-react';

/**
 * Add Recipe Page - manual recipe entry
 */
const AddRecipePage: React.FC = () => {
  const defaultRecipe: Omit<Recipe, 'id'> = {
    title: '',
    main: '',
    other: [{ name: '', quantity: 1, unit: '' }],
    instructions: ['']
  };

  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'error' | 'success'>('success');

  const navigate = useNavigate();
  const { isSignedIn, isLoaded, userId } = useAuth();

  /**
   * Handle creating a new recipe
   */
  const handleCreateRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    setIsCreating(true);
    setStatusMessage('Creating recipe...');
    setStatusType('success');

    // Validate recipe data before sending
    const validationErrors: string[] = [];
    
    if (!recipe.title.trim()) {
      validationErrors.push('Title is required');
    }
    
    if (!recipe.main.trim()) {
      validationErrors.push('Main ingredient is required');
    }
    
    if (recipe.other.length === 0) {
      validationErrors.push('At least one ingredient is required');
    }
    
    recipe.other.forEach((ingredient, index) => {
      if (!ingredient.name.trim()) {
        validationErrors.push(`Ingredient ${index + 1}: name is required`);
      }
      if (ingredient.quantity <= 0) {
        validationErrors.push(`Ingredient ${index + 1}: quantity must be greater than 0`);
      }
    });
    
    if (recipe.instructions.length === 0) {
      validationErrors.push('At least one instruction is required');
    }
    
    recipe.instructions.forEach((instruction, index) => {
      if (!instruction.trim()) {
        validationErrors.push(`Instruction ${index + 1} cannot be empty`);
      }
    });

    if (validationErrors.length > 0) {
      logger.error('AddRecipePage', 'Validation errors:', validationErrors);
      setStatusMessage(`Please fix the following errors:\n${validationErrors.join('\n')}`);
      setStatusType('error');
      setIsCreating(false);
      return;
    }

    let newRecipe: Recipe | null = null;
    let createError: Error | null = null;
    
    try {
      newRecipe = await recipeApi.create(recipe, userId);
    } catch (error) {
      logger.error('AddRecipePage', 'Error creating recipe:', error);
      createError = error instanceof Error ? error : new Error(String(error));
    }

    if (createError) {
      // Try to extract the actual error message from the API response
      let errorMessage = 'Unknown error occurred';
      
      // Check if error has a response property (from handleApiResponse)
      if (createError && typeof createError === 'object' && 'response' in createError) {
        const response = (createError as { response?: unknown }).response;
        
        if (response && typeof response === 'object') {
          if ('message' in response && typeof response.message === 'string') {
            errorMessage = response.message;
          } else if ('errors' in response) {
            // Handle validation errors
            const errors = response.errors;
            if (errors && typeof errors === 'object') {
              const errorDetails = JSON.stringify(errors, null, 2);
              errorMessage = `Validation failed:\n${errorDetails}`;
            }
          }
        }
      } else if (createError.message) {
        // Fall back to error message
        errorMessage = createError.message;
      }
      
      setStatusMessage(`Failed to create recipe: ${errorMessage}`);
      setStatusType('error');
      setIsCreating(false);
      return;
    }

    if (newRecipe) {
      logger.log('AddRecipePage', 'Recipe created successfully:', newRecipe);
      // The original code had refetchRecipes here, but it's not available in useRecipes hook
      // For now, we'll just navigate to home or recipe detail page
      navigate(ROUTES.HOME); 
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

      {/* Status Message */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-md whitespace-pre-line ${
          statusType === 'error' 
            ? 'bg-red-50 text-red-800 border border-red-200' 
            : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Recipe Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Add Recipe</h2>
        <RecipeForm
          initialRecipe={{
            id: 'temp-id', // Temporary ID since RecipeForm expects it
            ...defaultRecipe
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