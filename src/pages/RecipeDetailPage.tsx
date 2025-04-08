import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRecipes } from '../hooks/useRecipes';
import { Recipe } from '../types/recipe';
import Button from '../components/Button';
import RecipeForm from '../components/RecipeForm';
import { recipeApi } from '../services/api';
import { logger } from '../utils/logger';
import { tryCatchAsync } from '../utils/errorHandling';
import { ROUTES } from '../utils/navigation';

const RecipeDetailPage: React.FC = () => {
  const params = useParams<{ recipeId: string }>();
  const recipeId = params.recipeId;

  const { allRecipes, isLoading: isLoadingList, isUsingDummyData, refetchRecipes } = useRecipes();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState<boolean>(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  // --- Edit Mode State ---
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editableRecipe, setEditableRecipe] = useState<Recipe | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // --- Button Action Handlers ---
  const handleEdit = () => {
    if (!recipe) return; 
    setEditableRecipe(JSON.parse(JSON.stringify(recipe))); // Deep copy to prevent direct state mutation
    setIsEditing(true);
    setEditError(null); // Clear previous errors
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditableRecipe(recipe); // Reset editable state back to original recipe
    setEditError(null); // Clear errors
  };

  const handleSave = async (updatedRecipe: Recipe) => {
    if (!recipeId) return;

    setIsSaving(true);
    setEditError(null);

    const [result, error] = await tryCatchAsync(
      () => recipeApi.update(recipeId, updatedRecipe),
      'RecipeDetailPage',
      'Failed to update recipe'
    );

    if (error) {
      logger.error('RecipeDetailPage', 'Save error:', error);
      setEditError(error.message);
    } else if (result) {
      setRecipe(result);
      setEditableRecipe(result);
      setIsEditing(false);
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!recipe || !recipe.id) {
      logger.error('RecipeDetailPage', 'Delete attempt failed: Recipe or Recipe ID not available.');
      setEditError('Cannot delete recipe: Recipe data is missing.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
      setIsDeleting(true);
      setEditError(null);

      const [, error] = await tryCatchAsync(
        () => {
          logger.log('RecipeDetailPage', `Attempting to delete recipe with actual ID: ${recipe.id}`);
          return recipeApi.delete(recipe.id);
        },
        'RecipeDetailPage',
        'Failed to delete recipe'
      );

      if (error) {
        logger.error('RecipeDetailPage', 'Delete error:', error);
        setEditError(error.message);
        setIsDeleting(false);
      } else {
        logger.log('RecipeDetailPage', 'Recipe deleted successfully');
        logger.log('RecipeDetailPage', 'Triggering recipe list refetch after delete...');
        refetchRecipes();
        navigate(ROUTES.HOME);
      }
    }
  };

  useEffect(() => {
    setRecipe(null);
    setEditableRecipe(null);
    setDetailError(null);
    setIsFetchingDetails(true);

    // Rename for clarity: this ID should now be the actual database ID from the URL
    const actualRecipeIdFromUrl = params.recipeId; 
    
    if (actualRecipeIdFromUrl) {
      logger.log('RecipeDetailPage', `useEffect: Found recipe ID in URL: ${actualRecipeIdFromUrl}`);
      // Attempt 1: Find in the hook state using the ACTUAL ID
      const initialData = allRecipes.find(r => r.id === actualRecipeIdFromUrl);
      if (initialData) {
        logger.log('RecipeDetailPage', `useEffect: Found recipe in pre-loaded list (ID: ${initialData.id})`);
        setRecipe(initialData);
        setEditableRecipe(JSON.parse(JSON.stringify(initialData)));
        setIsFetchingDetails(false);
      } else {
        logger.log('RecipeDetailPage', `useEffect: Recipe not found in pre-loaded list, fetching directly using ID: ${actualRecipeIdFromUrl}`);
        // Attempt 2: If not found in hook state, fetch directly using the ACTUAL ID
        const fetchRecipe = async () => {
          const [data, error] = await tryCatchAsync(
            () => recipeApi.getById(actualRecipeIdFromUrl), // Use the actual ID for fetching
            'RecipeDetailPage',
            'Failed to load recipe details'
          );
          
          if (error) {
            logger.error('RecipeDetailPage', `useEffect: Error fetching recipe details for ID ${actualRecipeIdFromUrl}:`, error);
            setDetailError(error.message);
            setRecipe(null);
            setEditableRecipe(null);
          } else if (data) {
            logger.log('RecipeDetailPage', `useEffect: Successfully fetched recipe details (ID: ${data.id})`);
            setRecipe(data); // Should have the correct ID now
            setEditableRecipe(JSON.parse(JSON.stringify(data)));
            setDetailError(null);
          }
          
          setIsFetchingDetails(false);
        };
        
        fetchRecipe();
      }
    } else {
      // No recipeId present
      logger.warn('RecipeDetailPage', 'useEffect: No recipe ID found in URL parameters.');
      setIsFetchingDetails(false);
      setDetailError('No recipe ID provided.');
    }
  }, [params.recipeId, allRecipes]); // Depend on params.recipeId

  // --- Render Logic ---
  // Combined loading state
  const isLoading = isLoadingList || isFetchingDetails;

  if (isLoading) {
    return <p className="text-center text-stone-500 italic py-10">Loading recipe...</p>;
  }

  // Explicit not found check after loading attempts
  if (!recipe) { 
    return (
      <div className="text-center text-red-700 bg-red-100 border border-red-300 p-4 rounded max-w-2xl mx-auto mt-8">
        {detailError || 'Recipe not found!'} 
      </div>
    );
  }

  if (recipe) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto p-6">
          {/* Back Link */} 
          {!isEditing && (
            <Link 
              to={ROUTES.HOME}
              className="inline-flex items-center text-emerald-700 hover:text-emerald-900 mb-4 group text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Recipes
            </Link>
          )}

          {isUsingDummyData && (
            <div className="mb-4 p-3 rounded text-center bg-yellow-100 text-yellow-800 border border-yellow-300">
              Note: Displaying placeholder data due to local API fetch failure.
            </div>
          )}

          {/* Existing Recipe Content or Edit Form */} 
          <div className="bg-white p-6 rounded-lg shadow-md border border-stone-200">
            {!recipe && !isLoadingList && <p className="text-center text-red-500">Recipe not found.</p>}
            {isLoadingList && <p className="text-center text-stone-500 italic">Loading recipe...</p>}
            
            {recipe && editableRecipe && (
               isEditing ? (
                // --- EDIT MODE - Use RecipeForm component ---
                <RecipeForm
                  initialRecipe={editableRecipe}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isSaving={isSaving}
                  isDeleting={isDeleting}
                  error={editError}
                />
               ) : (
                // --- READ-ONLY MODE ---
                <>
                  <h1 className="text-3xl font-bold mb-4 capitalize border-b border-stone-200 pb-2 text-stone-900">{recipe.title}</h1>
                  
                  <h2 className="text-xl font-semibold mb-2 text-stone-800">Ingredients</h2>
                  <p className="text-stone-700 mb-1">
                    <span className="font-medium">Main:</span> <span className="capitalize">{recipe.main}</span>
                  </p>
                  {recipe.other.length > 0 && (
                    <div className="mb-3">
                      <p className="font-medium text-stone-700 mb-1">Other:</p>
                      <ul className="list-disc list-inside ml-4 text-stone-700">
                        {recipe.other.map((ingredient, index) => (
                          <li key={index} className="mb-1">
                            <span className="capitalize">{ingredient.name}</span>
                            {ingredient.quantity && ingredient.unit && ` - ${ingredient.quantity} ${ingredient.unit}`}
                            {ingredient.quantity && !ingredient.unit && ` - ${ingredient.quantity}`}
                            {!ingredient.quantity && ingredient.unit && ` - ${ingredient.unit}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <h2 className="text-xl font-semibold mb-2 mt-6 text-stone-800">Instructions</h2>
                  <ol className="list-decimal list-inside ml-4 mb-6 space-y-2">
                    {recipe.instructions.map((instruction, index) => (
                      <li key={index} className="text-stone-700">{instruction}</li>
                    ))}
                  </ol>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-stone-200">
                    <Button 
                      onClick={handleEdit}
                      variant="primary"
                      className="px-4 py-2"
                    >
                      Edit Recipe
                    </Button>
                    <Button
                      onClick={handleDelete}
                      variant="danger"
                      className="px-4 py-2"
                      isLoading={isDeleting}
                    >
                      Delete Recipe
                    </Button>
                  </div>
                </>
               )
            )}
          </div>
        </div>
      </div>
    );
  }

  return null; // Should never reach here
};

export default RecipeDetailPage; 