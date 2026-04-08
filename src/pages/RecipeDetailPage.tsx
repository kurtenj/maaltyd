import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { Recipe } from "../types/recipe";
import Button from "../components/Button";
import RecipeForm from "../components/RecipeForm";
import RecipeImagePlaceholder from "../components/RecipeImagePlaceholder";
import { recipeApi } from "../services/api";
import { logger } from "../utils/logger";
import { tryCatchAsync } from "../utils/errorHandling";
import { ROUTES } from "../utils/navigation";
import { recordRecentRecipe } from "../utils/recentRecipes";
import { Check, ChevronLeft, Link } from "lucide-react";
import { SignedIn, useAuth } from '@clerk/clerk-react';

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// --- Read-only recipe view ---

interface RecipeReadViewProps {
  recipe: Recipe;
}

const RecipeReadView: React.FC<RecipeReadViewProps> = ({ recipe }) => {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "error">("idle");

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, url });
        setShareState("shared");
        setTimeout(() => setShareState("idle"), 2000);
      } catch (_error) {
        // User likely cancelled, no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      } catch (_error) {
        setShareState("error");
        setTimeout(() => setShareState("idle"), 2000);
      }
    }
  };

  const isSuccess = shareState === "shared" || shareState === "copied";

  return (
    <>
      <div className="w-full mb-6 rounded-md overflow-hidden bg-stone-100 flex items-center justify-center">
        {recipe.imageUrl && !imageLoadError ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-44 object-cover object-center"
            onError={() => {
              logger.warn("RecipeDetailPage", `Image failed to load: ${recipe.imageUrl}`);
              setImageLoadError(true);
            }}
          />
        ) : (
          <RecipeImagePlaceholder />
        )}
      </div>

      <h1 className="text-3xl font-bold mb-4 capitalize pb-2 text-stone-900 flex items-center gap-3">
        <span>{recipe.title}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShare}
            className={`transition-colors p-0.5 ${isSuccess ? "text-green-500" : "text-stone-400 hover:text-stone-600"}`}
            aria-label="Share recipe"
            title="Share recipe"
          >
            {isSuccess ? <Check size={20} /> : <Link size={20} />}
          </button>
          {shareState === "copied" && (
            <span className="text-xs font-normal text-green-600">Copied!</span>
          )}
          {shareState === "error" && (
            <span className="text-xs font-normal text-red-500">Failed to copy</span>
          )}
        </div>
      </h1>

      <h2 className="uppercase text-xs font-bold mb-2 mt-6 text-stone-400">
        Ingredients
      </h2>
      {recipe.other.length > 0 && (
        <div className="mb-3">
          <div className="text-stone-700">
            {recipe.other.map((ingredient, index) => (
              <div key={index} className="mb-1">
                <span className="font-bold capitalize">{ingredient.name}</span>
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
  );
};

// --- Main page component ---

const RecipeDetailPage: React.FC = () => {
  const params = useParams<{ recipeId: string }>();
  const recipeId = params.recipeId;

  const navigate = useNavigate();
  const { isSignedIn, isLoaded, getToken } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState<boolean>(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editableRecipe, setEditableRecipe] = useState<Recipe | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEdit = () => {
    if (!recipe) return;
    setEditableRecipe(deepCopy(recipe));
    setIsEditing(true);
    setEditError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (recipe) setEditableRecipe(deepCopy(recipe));
    setEditError(null);
  };

  const handleSave = async (updatedRecipe: Recipe) => {
    if (!recipeId) return;

    if (!isLoaded) {
      setEditError('Please wait for authentication to load.');
      return;
    }

    if (!isSignedIn) {
      setEditError('You must be signed in to update recipes.');
      return;
    }

    setIsSaving(true);
    setEditError(null);

    const [result, error] = await tryCatchAsync(
      () => recipeApi.update(recipeId, updatedRecipe, getToken),
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
    if (!recipe?.id) {
      setEditError("Cannot delete recipe: Recipe data is missing.");
      return;
    }

    if (!isLoaded) {
      setEditError('Please wait for authentication to load.');
      return;
    }

    if (!isSignedIn) {
      setEditError('You must be signed in to delete recipes.');
      return;
    }

    if (window.confirm("Are you sure you want to delete this recipe? This cannot be undone.")) {
      setIsDeleting(true);
      setEditError(null);

      const [, error] = await tryCatchAsync(
        () => recipeApi.delete(recipe.id, getToken),
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

  useEffect(() => {
    setRecipe(null);
    setEditableRecipe(null);
    setDetailError(null);
    setIsFetchingDetails(true);

    const actualRecipeIdFromUrl = params.recipeId;

    if (actualRecipeIdFromUrl) {
      const fetchRecipe = async () => {
        const [data, error] = await tryCatchAsync(
          () => recipeApi.getById(actualRecipeIdFromUrl),
          "RecipeDetailPage",
          "Failed to load recipe details"
        );

        if (error) {
          logger.error("RecipeDetailPage", `Error fetching recipe ${actualRecipeIdFromUrl}:`, error);
          setDetailError(error.message);
          setRecipe(null);
          setEditableRecipe(null);
        } else if (data) {
          setRecipe(data);
          setEditableRecipe(deepCopy(data));
          setDetailError(null);
          recordRecentRecipe(data.id);
        }

        setIsFetchingDetails(false);
      };

      fetchRecipe();
    } else {
      logger.warn("RecipeDetailPage", "No recipe ID found in URL parameters.");
      setIsFetchingDetails(false);
      setDetailError("No recipe ID provided.");
    }
  }, [params.recipeId]);

  if (isFetchingDetails) {
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

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto p-1">
        {!isEditing && (
          <RouterLink
            to={ROUTES.HOME}
            className="inline-flex items-center text-stone-500 hover:text-stone-800 mb-4 group text-sm"
          >
            <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Recipes
          </RouterLink>
        )}

        <div className="bg-white p-5 rounded-xl">
          {editableRecipe && (
            isEditing ? (
              <RecipeForm
                initialRecipe={editableRecipe}
                onSave={handleSave}
                onCancel={handleCancel}
                isSaving={isSaving}
                isDeleting={isDeleting}
                error={editError}
                hideFormButtons
                formId="recipe-edit-form"
              />
            ) : (
              <RecipeReadView recipe={recipe} />
            )
          )}
        </div>

        <SignedIn>
          <div className="flex justify-start space-x-2 pt-4">
            {!isEditing && (
              <Button onClick={handleEdit} variant="primary" className="px-4 py-2">
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  onClick={handleCancel}
                  variant="secondary"
                  className="px-4 py-2"
                  disabled={isSaving || isDeleting}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="recipe-edit-form"
                  variant="primary"
                  className="px-4 py-2"
                  disabled={isSaving || isDeleting}
                  isLoading={isSaving}
                >
                  Save Recipe
                </Button>
              </>
            )}
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
};

export default RecipeDetailPage;
