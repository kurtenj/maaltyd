export interface Ingredient {
  name: string;
  quantity: number; // Enforce numeric quantity
  unit?: string; // Make unit optional here too
}

export interface Recipe {
  id: string; // Unique identifier derived from the filename
  title: string;
  main: string;
  other: Ingredient[]; // Changed to array of Ingredient objects
  instructions: string[];
} 