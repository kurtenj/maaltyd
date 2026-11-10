import { describe, it, expect } from 'vitest';
import { sortRecipesByTitle } from './recipeSort';
import type { Recipe } from '../types/recipe';

const r = (title: string): Recipe => ({ id: title, title, main: 'x', other: [], instructions: ['x'] });
const titles = (rs: Recipe[]) => rs.map((x) => x.title);

describe('sortRecipesByTitle', () => {
  it('sorts alphabetically, ignoring case and surrounding whitespace', () => {
    const sorted = sortRecipesByTitle([r('pizza'), r('Focaccia '), r('apple Cake'), r('BBQ Meatballs')]);
    expect(titles(sorted)).toEqual(['apple Cake', 'BBQ Meatballs', 'Focaccia ', 'pizza']);
  });

  it('orders numbers naturally and treats accents like plain letters', () => {
    const sorted = sortRecipesByTitle([r('20-Minute Stir Fry'), r('3-Bean Chili'), r('Crème Brûlée'), r('Cream Pie')]);
    expect(titles(sorted)).toEqual(['3-Bean Chili', '20-Minute Stir Fry', 'Cream Pie', 'Crème Brûlée']);
  });

  it('does not mutate the input', () => {
    const input = [r('b'), r('a')];
    sortRecipesByTitle(input);
    expect(titles(input)).toEqual(['b', 'a']);
  });
});
