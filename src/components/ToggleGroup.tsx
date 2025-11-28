import React from 'react';

interface ToggleGroupContextValue {
  value: string | null;
  onValueChange: (value: string) => void;
  type: 'single' | 'multiple';
  variant: 'default' | 'outline';
  size: 'sm' | 'default' | 'lg';
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

interface ToggleGroupProps {
  type?: 'single' | 'multiple';
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  children: React.ReactNode;
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({
  type = 'single',
  value,
  onValueChange,
  variant = 'default',
  size = 'default',
  className = '',
  children,
}) => {
  const [internalValue, setInternalValue] = React.useState<string | null>(null);
  
  const currentValue = value !== undefined ? value : internalValue;
  const handleValueChange = onValueChange || setInternalValue;

  const handleItemClick = (itemValue: string) => {
    if (type === 'single') {
      // Toggle: if clicking the same item, deselect it
      const newValue = currentValue === itemValue ? null : itemValue;
      handleValueChange(newValue);
    } else {
      // Multiple selection (not currently used, but kept for future use)
      // For now, just treat it like single selection
      const newValue = currentValue === itemValue ? null : itemValue;
      handleValueChange(newValue);
    }
  };

  return (
    <ToggleGroupContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleItemClick,
        type,
        variant,
        size,
      }}
    >
      <div className={`inline-flex items-center justify-center ${className}`} role="group">
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
};

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'default' | 'lg';
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ value, className = '', variant, size, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext);
    
    if (!context) {
      throw new Error('ToggleGroupItem must be used within ToggleGroup');
    }

    const { value: groupValue, onValueChange, variant: groupVariant, size: groupSize } = context;
    const activeVariant = variant ?? groupVariant;
    const activeSize = size ?? groupSize;
    const isSelected = groupValue === value;
    const hasSelection = groupValue !== null;

    const sizeStyles = {
      sm: 'h-10 px-3 text-sm',
      default: 'h-12 px-4 text-sm',
      lg: 'h-14 px-6 text-lg',
    };

    // Base styles - greyscale by default
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50';

    // Default (unselected) styles - greyscale
    const defaultStyles = activeVariant === 'outline'
      ? 'border border-stone-300 text-stone-700 hover:bg-stone-100'
      : 'text-stone-700 hover:bg-stone-300';

    // Selected styles - emerald (always include border for outline variant)
    const selectedStyles = isSelected
      ? activeVariant === 'outline'
        ? 'border border-emerald-500 bg-emerald-50 text-emerald-700'
        : 'bg-emerald-50 text-emerald-700'
      : defaultStyles;

    // When any item is selected, color the shared borders with emerald
    // This handles the case where cook is selected (bake's left border) 
    // and bake is selected (cook's right border, even though it has border-r-0)
    const sharedBorderStyles = hasSelection && activeVariant === 'outline' && !isSelected
      ? 'border-emerald-500'
      : '';

    // Focus styles - no ring when selected
    const focusStyles = isSelected
      ? 'focus:outline-none'
      : 'focus:outline-none focus:ring-0';

    return (
      <button
        ref={ref}
        type="button"
        role="button"
        aria-pressed={isSelected}
        onClick={() => onValueChange(value)}
        className={`
          ${baseStyles}
          ${sizeStyles[activeSize]}
          ${focusStyles}
          ${selectedStyles}
          ${sharedBorderStyles}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };

