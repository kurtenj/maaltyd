import { SkeletonSuspense } from 'skullet/react';
import HomePage from '../views/HomePage';
import { fetchAllRecipes } from '../utils/recipeFetcher';
import { SAMPLE_RECIPES } from '../utils/sampleRecipes';

// Recipes live in Redis, so render per request rather than at build time
export const dynamic = 'force-dynamic';

async function HomeContent() {
  const recipes = await fetchAllRecipes('app/page');
  return <HomePage initialRecipes={recipes} />;
}

export default function Page() {
  return (
    <SkeletonSuspense id="home" label="Loading recipes" skeleton={<HomePage initialRecipes={SAMPLE_RECIPES} />}>
      <HomeContent />
    </SkeletonSuspense>
  );
}
