/**
 * Type declarations for recipes module
 */

// Declare the recipes module
declare module 'recipes' {
  // Ingredient interface
  export interface Ingredient {
    name: string;
    quantity: string | number;
    unit: string;
  }

  // Recipe interface
  export interface Recipe {
    id: string;
    title: string;
    main: string;
    other: Ingredient[];
    instructions: string[];
  }
} 