import React from "react";
import { Link } from "react-router-dom";
import { Recipe } from "../types/recipe";

interface RecipeListProps {
  recipes: Recipe[];
}

const RecipeList: React.FC<RecipeListProps> = ({ recipes }) => {
  if (recipes.length === 0) {
    return (
      <p className="text-center text-stone-500 italic">No recipes found.</p>
    );
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((recipe) => (
          <Link
            key={recipe.id}
            to={`/recipe/${recipe.id}`}
            className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-stone-200 flex flex-col h-full">
              <div className="p-4 flex-grow">
                <h3 className="text-lg font-semibold mb-2 text-stone-800">
                  {recipe.title}
                </h3>
                <p className="text-sm text-stone-600 mb-1 capitalize">
                  <span className="font-medium text-stone-700">Main:</span>{" "}
                  {recipe.main}
                </p>
                <p className="text-sm text-stone-600 capitalize">
                  <span className="font-medium text-stone-700">Other:</span>{" "}
                  {recipe.other
                    .slice(0, 3)
                    .map((ingredient) => ingredient.name)
                    .join(", ")}{" "}
                  {recipe.other.length > 3 ? "..." : ""}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RecipeList;
