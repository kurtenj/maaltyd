export interface Ingredient {
  name: string;
  quantity: string | number;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  main: string;
  other: Ingredient[];
  instructions: string[];
} 