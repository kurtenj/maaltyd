import { ImageIcon } from 'lucide-react';
import React from 'react';

interface RecipeImagePlaceholderProps {
  className?: string; // To control size and other container styles
}

const RecipeImagePlaceholder: React.FC<RecipeImagePlaceholderProps> = ({ className }) => {
  return (
    <div className={`${className || ''} bg-stone-200 flex items-center justify-center overflow-hidden rounded-md`}>
      <ImageIcon className="w-1/2 h-1/2 max-w-[3rem] max-h-[3rem] text-stone-400" strokeWidth={1.5} /> {/* Icon size relative to container, capped */}
    </div>
  );
};

export default RecipeImagePlaceholder; 