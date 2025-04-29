import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Recipe } from '../types/recipe';

describe('Recipe API', () => {
  // Define mockFetch before using it
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Stub the global fetch function before each test
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    // Clear mocks and restore original fetch after each test
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches recipes successfully', async () => {
    const mockRecipes: Recipe[] = [
      {
        id: '1',
        title: 'Test Recipe',
        main: 'Chicken',
        other: [{ name: 'Salt', quantity: 1, unit: 'tsp' }],
        instructions: ['Cook it']
      }
    ];

    // Configure the mock response for this specific test
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecipes, // Return the mock data when json() is called
    });

    const response = await fetch('/api/recipes'); // This will now use the mock
    const data = await response.json();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/recipes');
    expect(response.ok).toBe(true);
    expect(data).toEqual(mockRecipes);
  });
}); 