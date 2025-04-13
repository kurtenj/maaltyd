import { STANDARD_UNITS } from '../utils/constants'; // Import the constant

// Define the standard unit type based on the constant array
export type StandardUnit = typeof STANDARD_UNITS[number]; // Creates a union type from the array values

export interface Ingredient {
  name: string;
  quantity: number; // Enforce numeric quantity
  unit?: StandardUnit; // Use the specific union type, keep optional
}

export interface Recipe {
  id: string; // Unique identifier derived from the filename
  title: string;
  main: string;
  other: Ingredient[]; // Changed to array of Ingredient objects
  instructions: string[];
} 