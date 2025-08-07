import { z } from 'zod';
import { STANDARD_UNITS } from './constants';

// Convert STANDARD_UNITS array to tuple for Zod enum
const standardUnitsTuple: [string, ...string[]] = STANDARD_UNITS as [string, ...string[]];

// Base schemas that can be reused across API endpoints
export const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(standardUnitsTuple).optional(),
});

export const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  excludeFromMealPlan: z.boolean().optional(),
});

// Schema for creating new recipes (omits ID since it's generated)
export const RecipeCreateSchema = RecipeSchema.omit({ id: true });

// Schema for updating existing recipes (omits ID since it comes from URL)
export const RecipeUpdateSchema = RecipeSchema.omit({ id: true });

// Simplified schema for meal plan operations (omits optional fields)
export const RecipeSchema_Simple = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  excludeFromMealPlan: z.boolean().optional(),
});
