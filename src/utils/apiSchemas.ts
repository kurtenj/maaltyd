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
  imageUrl: z.preprocess(
    (val) => {
      // Convert empty string, null, or undefined to null
      if (val === '' || val === null || val === undefined) {
        return null;
      }
      return val;
    },
    z.string().url().nullable().optional()
  ),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

// Schema for creating new recipes (omits ID since it's generated)
export const RecipeCreateSchema = RecipeSchema.omit({ id: true });

// Schema for updating existing recipes (omits ID since it comes from URL)
export const RecipeUpdateSchema = RecipeSchema.omit({ id: true });
