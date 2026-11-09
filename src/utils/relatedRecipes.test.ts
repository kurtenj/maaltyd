import { describe, it, expect } from 'vitest';
import { getRelatedRecipes, scoreRelatedRecipes, tokenize } from './relatedRecipes';
import type { Recipe } from '../types/recipe';

let nextId = 0;
const make = (title: string, main: string, ingredients: string[], instructions: string[] = ['Cook it.']): Recipe => ({
  id: `r${nextId++}`,
  title,
  main,
  other: ingredients.map((name) => ({ name, quantity: 1 })),
  instructions,
});

// A small collection shaped like the real one: a broad "Flour" group mixing breads,
// bakes, and noodles, so the old "same main ingredient" rule picks poorly.
const sourdoughBread = make('No-Knead Sourdough Bread', 'Flour', ['bread flour', 'water', 'salt', 'sourdough starter']);
const ryeSourdough = make('Rye Sourdough', 'Flour', ['rye flour', 'bread flour', 'water', 'salt', 'sourdough starter']);
const cookies = make('Chocolate Chip Cookies', 'Flour', ['flour', 'butter', 'sugar', 'eggs', 'chocolate chips']);
const cupcakes = make('Vanilla Cupcakes', 'Flour', ['flour', 'butter', 'sugar', 'eggs', 'vanilla']);
const noodles = make('Ramen Noodles', 'Flour', ['bread flour', 'water', 'baking soda']);
const appleMuffins = make('Cinnamon Apple Muffins', 'Flour', ['flour', 'apples', 'cinnamon', 'sugar', 'butter']);
const bananaMuffins = make('Easy Banana Muffins', 'Flour', ['flour', 'bananas', 'sugar', 'butter', 'eggs']);
const beefTaco = make('Homemade Taco', 'Beef', ['ground beef', 'taco seasoning', 'tortillas', 'cheese']);
const chickenTaco = make('Chicken Taco Casserole', 'Chicken', ['chicken breast', 'taco seasoning', 'tortillas', 'salsa']);
const meatballs = make('BBQ Meatballs', 'Beef', ['ground beef', 'breadcrumbs', 'bbq sauce', 'egg']);
const roastChicken = make('Lemon Herb Roasted Chicken', 'Chicken', ['whole chicken', 'lemon', 'rosemary', 'garlic']);
const chickenSweetPotato = make('Chicken and Sweet Potato', 'Chicken', ['chicken thighs', 'sweet potatoes', 'garlic', 'paprika']);
const carrotSoup = make('Creamy Roasted Carrot Soup', 'Vegetable', ['carrots', 'onion', 'vegetable stock', 'cream']);

const all = [
  sourdoughBread, ryeSourdough, cookies, cupcakes, noodles, appleMuffins, bananaMuffins,
  beefTaco, chickenTaco, meatballs, roastChicken, chickenSweetPotato, carrotSoup,
];
const titles = (rs: Recipe[]) => rs.map((r) => r.title);

describe('tokenize', () => {
  it('lowercases, drops stopwords and prep words, and singularizes', () => {
    expect(tokenize('The Best Homemade Muffins, freshly Chopped Tomatoes & Berries (2 cups)')).toEqual([
      'muffin',
      'tomato',
      'berry',
      'cup',
    ]);
  });
});

describe('getRelatedRecipes', () => {
  it('never includes the recipe itself and respects the limit', () => {
    const related = getRelatedRecipes(all, cookies, 3);
    expect(related).not.toContainEqual(cookies);
    expect(related.length).toBeLessThanOrEqual(3);
  });

  it('matches on distinctive shared words, not just the broad main ingredient', () => {
    expect(titles(getRelatedRecipes(all, sourdoughBread, 1))).toEqual(['Rye Sourdough']);
    expect(titles(getRelatedRecipes(all, appleMuffins, 1))).toEqual(['Easy Banana Muffins']);
  });

  it('can cross main-ingredient groups when the dishes are clearly alike', () => {
    expect(titles(getRelatedRecipes(all, beefTaco, 1))).toEqual(['Chicken Taco Casserole']);
    expect(titles(getRelatedRecipes(all, chickenTaco, 1))).toEqual(['Homemade Taco']);
  });

  it('does not let staples like flour, water, or salt make unrelated recipes look similar', () => {
    // Noodles share only staples with the breads; sweets share only staples with each other
    const forCookies = titles(getRelatedRecipes(all, cookies, 2));
    expect(forCookies).not.toContain('Ramen Noodles');
    expect(forCookies).not.toContain('No-Knead Sourdough Bread');
  });

  it('prefers the same main ingredient over a single shared cooking word', () => {
    // "Roasted" alone shouldn't pull a vegetable soup above the other chicken dishes
    const related = getRelatedRecipes(all, roastChicken, 2);
    expect(related.map((r) => r.main)).toEqual(['Chicken', 'Chicken']);
    expect(titles(related)).not.toContain('Creamy Roasted Carrot Soup');
  });

  it('returns nothing rather than a weak match when no recipe is meaningfully related', () => {
    const odd = make('Pickled Quail Eggs', 'Spice', ['quail eggs', 'brine', 'beetroot']);
    expect(getRelatedRecipes([...all, odd], odd)).toEqual([]);
  });

  it('works for a recipe that is not part of the list', () => {
    const newBread = make('Sourdough Focaccia', 'Flour', ['bread flour', 'sourdough starter', 'olive oil', 'rosemary']);
    expect(titles(getRelatedRecipes(all, newBread, 2))).toContain('No-Knead Sourdough Bread');
  });

  it('is deterministic, breaking score ties by title', () => {
    const a = scoreRelatedRecipes(all, meatballs).map((s) => s.recipe.id);
    const b = scoreRelatedRecipes([...all].reverse(), meatballs).map((s) => s.recipe.id);
    expect(a).toEqual(b);
  });

  it('returns an empty list for an empty collection', () => {
    expect(getRelatedRecipes([], cupcakes)).toEqual([]);
  });
});
