import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

const RecipeImagePlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-44 bg-stone-200 rounded-md">
      <ImageIcon className="w-full h-16 text-stone-300" />
    </div>
  );
};

export default RecipeImagePlaceholder; 