export interface Ingredient {
  name: string;
  quantity: string | number; // Allow flexibility (e.g., "1", 1, "1/2", "to taste")
  unit: string; // e.g., "cup", "tbsp", "g", "oz", "cloves", "" (for whole items like eggs)
}

export interface Recipe {
  id: string; // Unique identifier derived from the filename
  title: string;
  main: string;
  other: Ingredient[]; // Changed to array of Ingredient objects
  instructions: string[];
} 