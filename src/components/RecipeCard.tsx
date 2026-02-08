import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Recipe } from "../types/recipe";
import RecipeImagePlaceholder from "./RecipeImagePlaceholder";
import { logger } from "../utils/logger";

interface RecipeCardProps {
  recipe: Recipe;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe }) => {
  const [imageLoadError, setImageLoadError] = useState(false);

  return (
    <Link
      key={recipe.id}
      to={`/recipe/${recipe.id}`}
      className="block hover:shadow-md transition-all duration-200 ease-in-out rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-800 focus:ring-offset-2 overflow-hidden relative border border-stone-200 hover:border-stone-300 bg-white/75"
    >
      <div className="flex h-full">
        {/* Image Section (Square) */}
        <div className="w-28 h-28 flex-shrink-0">
          {recipe.imageUrl && !imageLoadError ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
              onError={() => {
                logger.warn(
                  "RecipeCard",
                  `Image failed to load: ${recipe.imageUrl}`
                );
                setImageLoadError(true);
              }}
            />
          ) : (
            <RecipeImagePlaceholder className="w-full h-full" />
          )}
        </div>

        {/* Text Content Section */}
        <div className="p-4 flex flex-col justify-center flex-grow min-w-0">
          <h3 className="text-md font-bold mb-1 capitalize text-stone-800 truncate">
            {recipe.title}
          </h3>
          <h2 className="uppercase text-xs font-bold mb-2 mt-2 text-stone-400">
            Ingredients
          </h2>
          <p className="text-xs text-stone-500 capitalize truncate">
            {recipe.main},{" "}
            {recipe.other
              .slice(0, 3)
              .map((ingredient) => ingredient.name)
              .join(", ")}
            {recipe.other.length > 3 ? "..." : ""}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default RecipeCard;
