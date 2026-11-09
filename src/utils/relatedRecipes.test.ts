import { describe, it, expect } from 'vitest';
import { getRelatedRecipes } from './relatedRecipes';
import type { Recipe } from '../types/recipe';

const make = (id: string, main: string): Recipe => ({ id, title: `Recipe ${id}`, main, other: [], instructions: ['x'] });

describe('getRelatedRecipes', () => {
  const current = make('1', 'chicken');
  const all = [current, make('2', 'chicken'), make('3', 'beef'), make('4', 'chicken'), make('5', 'chicken')];

  it('returns recipes with the same main ingredient, excluding the current recipe', () => {
    const related = getRelatedRecipes(all, current);
    expect(related.map((r) => r.id)).toEqual(['2', '4']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(getRelatedRecipes([current, make('3', 'beef')], current)).toEqual([]);
  });
});
