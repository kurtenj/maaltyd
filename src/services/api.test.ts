import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recipeApi } from './api';
import type { Recipe } from '../types/recipe';

const sampleRecipe: Recipe = {
  id: '1',
  title: 'Test Recipe',
  main: 'chicken',
  other: [{ name: 'Salt', quantity: 1, unit: 'pinch' }],
  instructions: ['Step 1'],
};

const recipeWithoutId: Omit<Recipe, 'id'> = {
  title: 'Test Recipe',
  main: 'chicken',
  other: [{ name: 'Salt', quantity: 1, unit: 'pinch' }],
  instructions: ['Step 1'],
};

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

describe('recipeApi', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('getAll', () => {
    it('fetches all recipes', async () => {
      const spy = mockFetch([sampleRecipe]);
      const result = await recipeApi.getAll();
      expect(result).toEqual([sampleRecipe]);
      expect(spy).toHaveBeenCalledWith('/api/recipes', expect.objectContaining({ cache: 'no-store' }));
    });

    it('throws on server error', async () => {
      mockFetch({ message: 'Server error' }, 500);
      await expect(recipeApi.getAll()).rejects.toThrow('Server error');
    });
  });

  describe('getById', () => {
    it('fetches a single recipe by id', async () => {
      const spy = mockFetch(sampleRecipe);
      const result = await recipeApi.getById('1');
      expect(result).toEqual(sampleRecipe);
      expect(spy).toHaveBeenCalledWith('/api/recipe/1', expect.any(Object));
    });

    it('throws Not found on 404', async () => {
      mockFetch({ message: 'Not found' }, 404);
      await expect(recipeApi.getById('missing')).rejects.toThrow('Not found.');
    });
  });

  describe('create', () => {
    it('posts a new recipe with bearer token', async () => {
      const spy = mockFetch(sampleRecipe, 201);
      const getToken = vi.fn().mockResolvedValue('token-123');
      const result = await recipeApi.create(recipeWithoutId, getToken);
      expect(result).toEqual(sampleRecipe);
      expect(getToken).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(
        '/api/recipes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        })
      );
    });

    it('posts without auth header when getToken returns null', async () => {
      const spy = mockFetch(sampleRecipe, 201);
      await recipeApi.create(recipeWithoutId, () => Promise.resolve(null));
      const [, options] = spy.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('update', () => {
    it('sends PUT with bearer token to the correct URL', async () => {
      const spy = mockFetch(sampleRecipe);
      const getToken = vi.fn().mockResolvedValue('token-abc');
      const result = await recipeApi.update('1', sampleRecipe, getToken);
      expect(result).toEqual(sampleRecipe);
      expect(spy).toHaveBeenCalledWith(
        '/api/recipe/1',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('delete', () => {
    it('sends DELETE and resolves on 204', async () => {
      const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      } as Response);
      await expect(recipeApi.delete('1', vi.fn().mockResolvedValue('tok'))).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith(
        '/api/recipe/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws on error response', async () => {
      mockFetch({ message: 'Unauthorized' }, 401);
      await expect(recipeApi.delete('1', () => Promise.resolve(null))).rejects.toThrow('Unauthorized');
    });
  });
});
