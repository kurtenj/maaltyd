import React from 'react';
import Skeleton from './Skeleton';

const RecipeDetailSkeleton: React.FC = () => {
  return (
    <>
      <Skeleton className="w-full h-44 mb-6 rounded-md" />

      <Skeleton className="h-8 w-2/3 mb-4" />

      <div className="flex items-center justify-between mt-6 mb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/3" />
      </div>

      <Skeleton className="h-3 w-28 mb-3 mt-6" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </>
  );
};

export default RecipeDetailSkeleton;
