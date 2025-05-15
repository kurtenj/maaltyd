import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // We can add custom props later if needed, e.g., error states
}

const Input: React.FC<InputProps> = ({ className, ...props }) => {
  const baseClasses = 
    "h-8 px-3 py-1 border border-stone-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-stone-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  // If w-full is almost always desired, it can be part of baseClasses.
  // Otherwise, consumers can add it via `className` prop when needed, or we can add a `fullWidth` boolean prop.
  // For now, let's assume w-full is common but not universal, so it's not in baseClasses.
  // Users can pass `className="w-full"` or other width utilities.

  return (
    <input 
      className={`${baseClasses} ${className || ''}`}
      {...props} 
    />
  );
};

export default Input; 