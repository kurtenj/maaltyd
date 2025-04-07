import React from 'react';

// Updated ButtonProps to include 'danger' and 'icon' variants
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'icon'; // Added 'icon'
  isLoading?: boolean; // Optional loading state
  // Add size prop later if needed
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  isLoading = false,
  disabled = false,
  ...props 
}) => {

  // Base styles - adjusted padding and font-semibold based on common Tailwind UI buttons
  const baseStyles =
    // Removed px-4 py-2 from base - will be added by variants if needed
    'inline-flex items-center justify-center rounded-md border border-transparent text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out';

  // Determine styles based on variant and disabled state
  let variantStyles = '';
  switch (variant) {
    case 'icon': // Added icon variant - applies no padding
      variantStyles = `${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;
      // Note: Specific bg/text/size for icon buttons should be set via className prop
      break;
    case 'secondary':
      // Use stone palette for consistency
      // Removed px-4 py-2 - Padding now controlled by className
      variantStyles = `text-stone-700 bg-stone-200 hover:bg-stone-300 focus:ring-stone-500 ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;
      break;
    case 'danger': // Added danger case
      // Removed px-4 py-2 - Padding now controlled by className
      variantStyles = `text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;
      break;
    case 'primary':
    default:
      // Removed px-4 py-2 - Padding now controlled by className
      variantStyles = 
        `text-white bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-600 ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;
      break;
  }

  return (
    <button
      type="button" // Default type if not specified
      {...props} // Spread other native button props (like type="submit", onClick)
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles} ${className}`} // Combine styles
    >
      {isLoading ? (
        <>
          {/* Basic Spinner */} 
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button; 