export const PANTRY_STAPLES = [
  'salt',
  'pepper',
  'black pepper',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'sugar',
  'water',
  'flour', // Debatable, could be project-specific
  // Add more common staples as needed
];

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

// Day names for meal planning
export const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const; 