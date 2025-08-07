import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { Recipe } from "../types/recipe";
import Button from "../components/Button";
import RecipeForm from "../components/RecipeForm";
import { recipeApi } from "../services/api";
import { logger } from "../utils/logger";
import { tryCatchAsync } from "../utils/errorHandling";
import { ROUTES } from "../utils/navigation";
import { ArrowLeft, Link } from "lucide-react";
import RecipeImagePlaceholder from "../components/RecipeImagePlaceholder";
import { SignedIn, useAuth } from '@clerk/clerk-react';

const RecipeDetailPage: React.FC = () => {
  const params = useParams<{ recipeId: string }>();
  const recipeId = params.recipeId;

  const navigate = useNavigate();
  const { userId } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState<boolean>(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);

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
      () => recipeApi.update(recipeId, updatedRecipe, userId),
      "RecipeDetailPage",
      "Failed to update recipe"
    );

    if (error) {
      logger.error("RecipeDetailPage", "Save error:", error);
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
      logger.error(
        "RecipeDetailPage",
        "Delete attempt failed: Recipe or Recipe ID not available."
      );
      setEditError("Cannot delete recipe: Recipe data is missing.");
      return;
    }

    if (
      window.confirm(
        "Are you sure you want to delete this recipe? This cannot be undone."
      )
    ) {
      setIsDeleting(true);
      setEditError(null);

      const [, error] = await tryCatchAsync(
        () => {
          return recipeApi.delete(recipe.id, userId);
        },
        "RecipeDetailPage",
        "Failed to delete recipe"
      );

      if (error) {
        logger.error("RecipeDetailPage", "Delete error:", error);
        setEditError(error.message);
        setIsDeleting(false);
      } else {
        navigate(ROUTES.HOME);
      }
    }
  };

  const handleShare = async () => {
    if (!recipe) return;

    const ingredientsText = recipe.other
      .map(
        (ingredient) =>
          `- ${ingredient.quantity || ""} ${ingredient.unit || ""} ${
            ingredient.name
          }`
      )
      .join("\n");

    const instructionsText = recipe.instructions
      .map((instruction, index) => `${index + 1}. ${instruction}`)
      .join("\n");

    const shareText = `Recipe: ${recipe.title}\n\nIngredients:\n${ingredientsText}\n\nInstructions:\n${instructionsText}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: shareText,
        });
      } catch (_error) {
        // User likely cancelled, no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        window.alert("Recipe copied to clipboard!");
      } catch (_error) {
        window.alert("Could not copy recipe to clipboard.");
      }
    }
  };

  useEffect(() => {
    setRecipe(null);
    setEditableRecipe(null);
    setDetailError(null);
    setIsFetchingDetails(true);
    setImageLoadError(false);

    const actualRecipeIdFromUrl = params.recipeId;

    if (actualRecipeIdFromUrl) {
      const fetchRecipe = async () => {
        const [data, error] = await tryCatchAsync(
          () => recipeApi.getById(actualRecipeIdFromUrl),
          "RecipeDetailPage",
          "Failed to load recipe details"
        );

        if (error) {
          logger.error(
            "RecipeDetailPage",
            `useEffect: Error fetching recipe details for ID ${actualRecipeIdFromUrl}:`,
            error
          );
          setDetailError(error.message);
          setRecipe(null);
          setEditableRecipe(null);
        } else if (data) {
          setRecipe(data);
          setEditableRecipe(JSON.parse(JSON.stringify(data)));
          setDetailError(null);
          setImageLoadError(false);
        }

        setIsFetchingDetails(false);
      };

      fetchRecipe();
    } else {
      logger.warn(
        "RecipeDetailPage",
        "useEffect: No recipe ID found in URL parameters."
      );
      setIsFetchingDetails(false);
      setDetailError("No recipe ID provided.");
    }
  }, [params.recipeId]);

  // --- Render Logic ---
  const isLoading = isFetchingDetails;

  if (isLoading) {
    return (
      <p className="text-center text-stone-500 italic py-10">
        Loading recipe...
      </p>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center text-red-700 bg-red-100 border border-red-300 p-4 rounded max-w-2xl mx-auto mt-8">
        {detailError || "Recipe not found!"}
      </div>
    );
  }

  if (recipe) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto p-1">
          {/* Back Link */}
          {!isEditing && (
            <RouterLink
              to={ROUTES.HOME}
              className="inline-flex items-center text-emerald-700 hover:text-emerald-900 mb-4 group text-sm"
            >
              <ArrowLeft
                size={16}
                className="mr-1 group-hover:-translate-x-1 transition-transform"
              />
              Back to Recipes
            </RouterLink>
          )}

          {/* Main recipe content */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
            {!recipe && !isFetchingDetails && (
              <p className="text-center text-red-500">Recipe not found.</p>
            )}

            {recipe &&
              editableRecipe &&
              (isEditing ? (
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
                  {/* Recipe Image Display */}
                  <div className="w-full mb-6 rounded-md overflow-hidden bg-stone-100 flex items-center justify-center">
                    {recipe.imageUrl && !imageLoadError ? (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        className="w-full h-44 object-cover object-center"
                        onError={() => {
                          logger.warn(
                            "RecipeDetailPage",
                            `Image failed to load: ${recipe.imageUrl}`
                          );
                          setImageLoadError(true);
                        }}
                      />
                    ) : (
                      <RecipeImagePlaceholder />
                    )}
                  </div>

                  <h1 className="text-3xl font-bold mb-4 capitalize pb-2 text-stone-900 flex items-center gap-3">
                    <span>{recipe.title}</span>
                    <button
                      onClick={handleShare}
                      className="text-stone-400 hover:text-stone-600 transition-colors p-0.5"
                      title="Share recipe"
                    >
                      <Link size={20} />
                    </button>
                  </h1>

                  <h2 className="uppercase text-xs font-bold mb-2 mt-6 text-stone-400">
                    Ingredients
                  </h2>
                  {recipe.other.length > 0 && (
                    <div className="mb-3">
                      <div className="text-stone-700">
                        {recipe.other.map((ingredient, index) => (
                          <div key={index} className="mb-1">
                            <span className="font-bold capitalize">
                              {ingredient.name}
                            </span>
                            {ingredient.quantity && ingredient.unit && (
                              <span className="text-stone-400">{` ${ingredient.quantity} ${ingredient.unit}`}</span>
                            )}
                            {ingredient.quantity && !ingredient.unit && (
                              <span className="text-stone-400">{` ${ingredient.quantity}`}</span>
                            )}
                            {!ingredient.quantity && ingredient.unit && (
                              <span className="text-stone-400">{` ${ingredient.unit}`}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h2 className="uppercase text-xs font-bold mb-2 mt-6 text-stone-400">
                    Instructions
                  </h2>
                  <ol className="list-decimal list-inside mb-6 space-y-4">
                    {recipe.instructions.map((instruction, index) => (
                      <li key={index} className="text-stone-900">
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </>
              ))}
          </div>
          {/* Action Buttons */}
          <SignedIn>
            <div className="flex justify-start space-x-2 pt-4">
              <Button
                onClick={handleEdit}
                variant="primary"
                className="px-4 py-2"
              >
                Edit
              </Button>
              <Button
                onClick={handleDelete}
                variant="danger"
                className="px-4 py-2"
                isLoading={isDeleting}
              >
                Delete
              </Button>
            </div>
          </SignedIn>
        </div>
      </div>
    );
  }

  return null; // Should never reach here
};

export default RecipeDetailPage;
