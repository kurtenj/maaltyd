// Standardized Measurement Units
export const STANDARD_UNITS = [
  'tsp',        // Teaspoon
  'tbsp',       // Tablespoon
  'fl oz',      // Fluid Ounce
  'cup',        // Cup
  'pint',       // Pint
  'quart',      // Quart
  'gallon',     // Gallon
  'ml',         // Milliliter
  'l',          // Liter
  'oz',         // Ounce (weight)
  'lb',         // Pound
  'g',          // Gram
  'kg',         // Kilogram
  'pinch',      // Common non-standard
  'dash',       // Common non-standard
  'clove',      // Common non-standard
  'slice',      // Common non-standard
  'servings',   // Add 'servings' as the new standard/fallback
  ''            // Explicitly allow empty string for truly unitless items
].sort(); // Keep sorted for display 