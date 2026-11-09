import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SkeletonSuspense } from 'skullet/react';
import RecipeDetailPage from '../../../views/RecipeDetailPage';
import { fetchAllRecipes, fetchRecipeById } from '../../../utils/recipeFetcher';
import { getRelatedRecipes } from '../../../utils/relatedRecipes';
import { SAMPLE_RECIPE, SAMPLE_RELATED } from '../../../utils/sampleRecipes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ recipeId: string }>;
  searchParams: Promise<{ photo?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { recipeId } = await params;
  const recipe = await fetchRecipeById(recipeId);
  if (!recipe) return { title: 'Recipe not found' };

  const description = [recipe.main, ...recipe.other.slice(0, 5).map((i) => i.name)]
    .filter(Boolean)
    .join(', ');

  return {
    title: recipe.title,
    description,
    openGraph: {
      title: recipe.title,
      description,
      type: 'article',
      ...(recipe.imageUrl ? { images: [recipe.imageUrl] } : {}),
    },
  };
}

async function RecipeContent({ recipeId, awaitingImage }: { recipeId: string; awaitingImage: boolean }) {
  const recipe = await fetchRecipeById(recipeId);
  if (!recipe) notFound();

  const allRecipes = await fetchAllRecipes('app/recipe');
  const relatedRecipes = getRelatedRecipes(allRecipes, recipe);

  // key resets edit state when navigating between recipes
  return (
    <RecipeDetailPage
      key={recipe.id}
      initialRecipe={recipe}
      relatedRecipes={relatedRecipes}
      awaitingImage={awaitingImage && !recipe.imageUrl}
    />
  );
}

export default async function Page({ params, searchParams }: PageProps) {
  const { recipeId } = await params;
  const { photo } = await searchParams;

  return (
    <SkeletonSuspense
      // Remember each recipe's real shape, so repeat visits get an exact skeleton
      id={`recipe-${recipeId}`}
      label="Loading recipe"
      skeleton={<RecipeDetailPage initialRecipe={SAMPLE_RECIPE} relatedRecipes={SAMPLE_RELATED} />}
    >
      <RecipeContent recipeId={recipeId} awaitingImage={photo === 'generating'} />
    </SkeletonSuspense>
  );
}
