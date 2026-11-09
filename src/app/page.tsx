import { cookies } from 'next/headers';
import { SkeletonSuspense } from 'skullet/react';
import HomePage from '../views/HomePage';
import { fetchAllRecipes } from '../utils/recipeFetcher';
import { SAMPLE_RECIPES } from '../utils/sampleRecipes';
import { RECENT_RECIPES_COOKIE, parseRecentRecipeIds } from '../utils/recentRecipes';

// Recipes live in Redis, so render per request rather than at build time
export const dynamic = 'force-dynamic';

async function HomeContent() {
  const [recipes, cookieStore] = await Promise.all([fetchAllRecipes('app/page'), cookies()]);
  const recentIds = parseRecentRecipeIds(cookieStore.get(RECENT_RECIPES_COOKIE)?.value);
  return <HomePage initialRecipes={recipes} initialRecentIds={recentIds} />;
}

export default function Page() {
  return (
    <SkeletonSuspense id="home" label="Loading recipes" skeleton={<HomePage initialRecipes={SAMPLE_RECIPES} initialRecentIds={[]} />}>
      <HomeContent />
    </SkeletonSuspense>
  );
}
