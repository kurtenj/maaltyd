import React from 'react';
import Skeleton from './Skeleton';

const RecipeCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-xl overflow-hidden border border-stone-200 bg-white/75">
      <div className="flex h-full">
        <Skeleton className="w-28 h-28 shrink-0 rounded-none" />
        <div className="p-4 flex flex-col justify-center grow min-w-0 gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3 mt-1" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
};

export default RecipeCardSkeleton;
