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

  it('has no image URL field, and explains photos are generated when creating', () => {
    renderForm();
    expect(screen.queryByText('Generate new photo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/image url/i)).not.toBeInTheDocument();
    expect(screen.getByText(/photo will be generated automatically/i)).toBeInTheDocument();
  });

  it('shows the new photo after regenerating, and keeps it on save', async () => {
    const onRegenerateImage = vi.fn().mockResolvedValue({
      imageUrl: 'https://img.example.com/new.webp',
      thumbnailUrl: 'https://img.example.com/new-thumb.webp',
    });
    const { onSave } = renderForm({ onRegenerateImage });

    fireEvent.click(screen.getByText('Generate new photo'));
    // The preview is small, so it shows the thumbnail
    await waitFor(() => {
      expect(screen.getByAltText('Photo of Test Recipe')).toHaveAttribute('src', 'https://img.example.com/new-thumb.webp');
    });

    fireEvent.click(screen.getByText('Save Recipe'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://img.example.com/new.webp' }));
    });
  });

  it('shows an error when photo generation fails', async () => {
    const onRegenerateImage = vi.fn().mockRejectedValue(new Error('Rate limited'));
    renderForm({ onRegenerateImage });

    fireEvent.click(screen.getByText('Generate new photo'));
    expect(await screen.findByText('Rate limited')).toBeInTheDocument();
  });
});
