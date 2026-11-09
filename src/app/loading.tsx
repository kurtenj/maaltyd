import RecipeCardSkeleton from '../components/RecipeCardSkeleton';

export default function Loading() {
  return (
    <div className="min-h-screen">
      <h2 className="text-2xl font-semibold text-stone-900 mb-6">All Recipes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {Array.from({ length: 6 }).map((_, index) => (
          <RecipeCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
