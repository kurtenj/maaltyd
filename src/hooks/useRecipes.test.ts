import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRecipes } from './useRecipes';
import { recipeApi } from '../services/api';
import type { Recipe } from '../types/recipe';

vi.mock('../services/api', () => ({
  recipeApi: { getAll: vi.fn() },
}));

vi.mock('../utils/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const sampleRecipes: Recipe[] = [
  { id: '1', title: 'Pasta', main: 'pasta', other: [], instructions: ['Boil water'] },
  { id: '2', title: 'Salad', main: 'lettuce', other: [], instructions: ['Chop lettuce'] },
];

describe('useRecipes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recipeApi.getAll).mockResolvedValue(sampleRecipes);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useRecipes());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns recipes after loading', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allRecipes).toEqual(sampleRecipes);
    expect(result.current.filteredRecipes).toEqual(sampleRecipes);
  });

  it('sets error and empty array when API fails', async () => {
    vi.mocked(recipeApi.getAll).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.allRecipes).toEqual([]);
  });

  it('derives sorted availableMainIngredients from recipes', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.availableMainIngredients).toEqual(['lettuce', 'pasta']);
  });

  it('filters by selectedMainIngredient', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.handleMainIngredientChange('pasta');
    });
    expect(result.current.filteredRecipes).toEqual([sampleRecipes[0]]);
  });

  it('clears filter when selectedMainIngredient is set to null', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.handleMainIngredientChange('pasta'); });
    act(() => { result.current.handleMainIngredientChange(null); });
    expect(result.current.filteredRecipes).toEqual(sampleRecipes);
  });

  it('filters by search term after debounce', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setSearchTerm('sal');
    });
    await waitFor(
      () => expect(result.current.filteredRecipes).toEqual([sampleRecipes[1]]),
      { timeout: 500 }
    );
  });

  it('refetches recipes when fetchRecipes is called', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const newRecipes = [...sampleRecipes, { id: '3', title: 'Soup', main: 'tomato', other: [], instructions: ['Heat'] }];
    vi.mocked(recipeApi.getAll).mockResolvedValue(newRecipes);
    await act(async () => {
      await result.current.fetchRecipes();
    });
    expect(result.current.allRecipes).toEqual(newRecipes);
  });
});
