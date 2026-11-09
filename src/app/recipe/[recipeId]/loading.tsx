import RecipeDetailSkeleton from '../../../components/RecipeDetailSkeleton';

export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto p-1">
        <div className="bg-white p-5 rounded-xl">
          <RecipeDetailSkeleton />
        </div>
      </div>
    </div>
  );
}
