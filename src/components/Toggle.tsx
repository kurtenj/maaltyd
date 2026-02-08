import React from 'react';

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      pressed = false,
      onPressedChange,
      variant = 'default',
      size = 'default',
      className = '',
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: 'h-10 px-2 text-sm',
      default: 'h-12 px-4 text-sm',
      lg: 'h-14 px-6 text-lg',
    };

    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 rounded-lg';

    const variantStyles =
      variant === 'ghost'
        ? pressed
          ? 'border-0 bg-stone-800 text-white'
          : ' border border-stone-300 bg-white text-stone-400 hover:bg-stone-100'
        : variant === 'outline'
          ? pressed
            ? 'border border-emerald-500 bg-stone-800 text-white'
            : 'border border-stone-300 text-stone-700 hover:bg-stone-100'
          : pressed
            ? 'bg-emerald-500 text-white'
            : 'text-stone-700 hover:bg-stone-300';

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onPressedChange?.(!pressed);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="button"
        aria-pressed={pressed}
        onClick={handleClick}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Toggle.displayName = 'Toggle';

export { Toggle };
