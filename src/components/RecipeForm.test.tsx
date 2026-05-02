import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecipeForm from './RecipeForm';
import type { Recipe } from '../types/recipe';

const baseRecipe: Recipe = {
  id: '1',
  title: 'Test Recipe',
  main: 'chicken',
  other: [{ name: 'Salt', quantity: 1, unit: 'pinch' }],
  instructions: ['Step one'],
};

function renderForm(overrides: Partial<Parameters<typeof RecipeForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <RecipeForm
      initialRecipe={baseRecipe}
      onSave={onSave}
      onCancel={onCancel}
      isSaving={false}
      isDeleting={false}
      error={null}
      {...overrides}
    />
  );
  return { onSave, onCancel };
}

describe('RecipeForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders initial recipe data', () => {
    renderForm();
    expect(screen.getByDisplayValue('Test Recipe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('chicken')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Salt')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Step one')).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    renderForm({ error: 'Something went wrong' });
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with updated recipe on form submit', async () => {
    const { onSave } = renderForm();
    fireEvent.change(screen.getByDisplayValue('Test Recipe'), {
      target: { value: 'Updated Title' },
    });
    fireEvent.click(screen.getByText('Save Recipe'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].title).toBe('Updated Title');
  });

  it('adds a new ingredient row when Add Ingredient is clicked', () => {
    renderForm();
    const before = screen.getAllByPlaceholderText('Ingredient Name').length;
    fireEvent.click(screen.getByText('Add Ingredient'));
    expect(screen.getAllByPlaceholderText('Ingredient Name').length).toBe(before + 1);
  });

  it('adds a new instruction step when Add Instruction is clicked', () => {
    renderForm();
    expect(screen.getAllByPlaceholderText(/^Step \d+/).length).toBe(1);
    fireEvent.click(screen.getByText('Add Instruction'));
    expect(screen.getAllByPlaceholderText(/^Step \d+/).length).toBe(2);
  });

  it('disables all inputs while saving', () => {
    renderForm({ isSaving: true });
    expect(screen.getByDisplayValue('Test Recipe')).toBeDisabled();
    expect(screen.getByDisplayValue('chicken')).toBeDisabled();
  });

  it('hides Cancel and Save buttons when hideFormButtons is true', () => {
    renderForm({ hideFormButtons: true });
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.queryByText('Save Recipe')).not.toBeInTheDocument();
  });
});
