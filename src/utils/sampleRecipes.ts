import type { Recipe } from '../types/recipe';

/**
 * Stand-in data that Skullet renders invisibly and measures to draw skeletons in the exact
 * shape of the real content. Lengths roughly match typical recipes so nothing jumps on reveal.
 */

// 1×1 transparent GIF, so cards draw their image area instead of the "no photo" placeholder
const SAMPLE_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const sample = (n: number, title: string, main: string, ingredients: string[]): Recipe => ({
  id: `sample-${n}`,
  title,
  main,
  imageUrl: SAMPLE_IMAGE,
  other: ingredients.map((name) => ({ name, quantity: 1, unit: 'cup' })),
  instructions: [
    'Heat the oil in a large pan over medium heat and add the onion and garlic.',
    'Add the main ingredients and cook, stirring occasionally, until golden and cooked through.',
    'Stir in the sauce ingredients and simmer for about ten minutes until slightly thickened.',
    'Season to taste and serve warm with your favourite sides.',
  ],
});

export const SAMPLE_RECIPES: Recipe[] = [
  sample(1, 'Lemon Herb Roast Chicken', 'Chicken', ['lemon', 'garlic', 'rosemary', 'olive oil']),
  sample(2, 'Creamy Mushroom Pasta', 'Vegetable', ['mushrooms', 'cream', 'parmesan', 'spinach']),
  sample(3, 'Beef and Broccoli', 'Beef', ['flank steak', 'broccoli', 'soy sauce', 'ginger']),
  sample(4, 'Sourdough Pancakes', 'Flour', ['sourdough starter', 'flour', 'egg', 'milk']),
  sample(5, 'Roasted Carrot Soup', 'Vegetable', ['carrots', 'onion', 'stock', 'cumin']),
  sample(6, 'Chicken Fajitas', 'Chicken', ['chicken thighs', 'peppers', 'onion', 'tortillas']),
];

export const SAMPLE_RECIPE: Recipe = {
  ...sample(0, 'Lemon Herb Roast Chicken', 'Chicken', [
    'whole chicken', 'lemon', 'garlic cloves', 'fresh rosemary', 'olive oil', 'butter', 'salt', 'black pepper', 'onion',
  ]),
  instructions: [
    'Preheat the oven to 425°F and pat the chicken dry with paper towels.',
    'Mix the softened butter with the garlic, rosemary, lemon zest, salt, and pepper.',
    'Rub the butter mixture under and over the skin, then place the lemon halves and onion inside the cavity.',
    'Roast for about an hour, basting halfway, until the juices run clear and the skin is golden.',
    'Rest for ten minutes before carving and serving with the pan juices.',
  ],
};

export const SAMPLE_RELATED: Recipe[] = SAMPLE_RECIPES.slice(0, 2);
