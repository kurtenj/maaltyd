import HomePage from '../views/HomePage';
import { fetchAllRecipes } from '../utils/recipeFetcher';

// Recipes live in Redis, so render per request rather than at build time
export const dynamic = 'force-dynamic';

export default async function Page() {
  const recipes = await fetchAllRecipes('app/page');
  return <HomePage initialRecipes={recipes} />;
}
