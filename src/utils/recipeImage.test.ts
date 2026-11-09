// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Recipe } from '../types/recipe';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  redisSet: vi.fn(),
  getRecipeById: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    images = { generate: mocks.generate };
  },
}));
vi.mock('@vercel/blob', () => ({ put: mocks.put, del: mocks.del }));
vi.mock('./redisClient', () => ({
  redis: { set: mocks.redisSet },
  getRecipeKey: (id: string) => `recipe:${id}`,
}));
vi.mock('./recipeFetcher', () => ({ getRecipeById: mocks.getRecipeById }));
vi.mock('./serverLogger', () => ({ serverLogger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { buildImagePrompt, attachGeneratedImage } = await import('./recipeImage');

const NEW_URL = 'https://abc.public.blob.vercel-storage.com/recipe-images/r1-2.webp';
const OLD_OWN_URL = 'https://abc.public.blob.vercel-storage.com/recipe-images/r1-1.webp';

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'r1',
  title: 'Chicken Curry',
  main: 'chicken',
  other: [{ name: 'coconut milk', quantity: 1, unit: 'cup' }, { name: 'onion', quantity: 1 }],
  instructions: ['Cook it.'],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generate.mockResolvedValue({ data: [{ b64_json: Buffer.from('img').toString('base64') }] });
  mocks.put.mockResolvedValue({ url: NEW_URL });
  mocks.del.mockResolvedValue(undefined);
  mocks.redisSet.mockResolvedValue('OK');
});

describe('buildImagePrompt', () => {
  it('includes the title, main ingredient and ingredient names', () => {
    const prompt = buildImagePrompt(recipe());
    expect(prompt).toContain('"Chicken Curry"');
    expect(prompt).toContain('main ingredient is chicken');
    expect(prompt).toContain('coconut milk, onion');
    expect(prompt).toMatch(/no text/i);
  });

  it('caps the ingredient list and skips blank names', () => {
    const other = Array.from({ length: 12 }, (_, i) => ({ name: i === 0 ? '  ' : `ing${i}`, quantity: 1 }));
    const prompt = buildImagePrompt(recipe({ other }));
    expect(prompt).toContain('ing1, ing2');
    expect(prompt).not.toContain('ing9');
  });
});

describe('attachGeneratedImage', () => {
  it('generates, uploads, and saves the image when the recipe has none', async () => {
    mocks.getRecipeById.mockResolvedValue(recipe());

    await expect(attachGeneratedImage('r1', { onlyIfMissing: true })).resolves.toBe(NEW_URL);
    expect(mocks.put).toHaveBeenCalledWith(
      expect.stringMatching(/^recipe-images\/r1-\d+\.webp$/),
      expect.any(Buffer),
      expect.objectContaining({ access: 'public', contentType: 'image/webp' })
    );
    expect(mocks.redisSet).toHaveBeenCalledWith('recipe:r1', expect.objectContaining({ imageUrl: NEW_URL }), { xx: true });
  });

  it('does nothing in onlyIfMissing mode when the recipe already has an image', async () => {
    mocks.getRecipeById.mockResolvedValue(recipe({ imageUrl: 'https://example.com/mine.jpg' }));

    await expect(attachGeneratedImage('r1', { onlyIfMissing: true })).resolves.toBeNull();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('keeps edits made during generation and discards the image if the user added one meanwhile', async () => {
    mocks.getRecipeById
      .mockResolvedValueOnce(recipe())
      .mockResolvedValueOnce(recipe({ imageUrl: 'https://example.com/added-meanwhile.jpg' }));

    await expect(attachGeneratedImage('r1', { onlyIfMissing: true })).resolves.toBeNull();
    expect(mocks.redisSet).not.toHaveBeenCalled();
    expect(mocks.del).toHaveBeenCalledWith(NEW_URL);
  });

  it('saves on top of the latest recipe data, not the stale copy', async () => {
    mocks.getRecipeById
      .mockResolvedValueOnce(recipe())
      .mockResolvedValueOnce(recipe({ title: 'Renamed While Generating' }));

    await attachGeneratedImage('r1', { onlyIfMissing: true });
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'recipe:r1',
      expect.objectContaining({ title: 'Renamed While Generating', imageUrl: NEW_URL }),
      { xx: true }
    );
  });

  it('cleans up the uploaded image if the recipe was deleted during generation', async () => {
    mocks.getRecipeById.mockResolvedValueOnce(recipe()).mockResolvedValueOnce(null);

    await expect(attachGeneratedImage('r1', { onlyIfMissing: false })).resolves.toBeNull();
    expect(mocks.del).toHaveBeenCalledWith(NEW_URL);
  });

  it('replaces an existing image when regenerating and deletes the old one only if we created it', async () => {
    mocks.getRecipeById.mockResolvedValue(recipe({ imageUrl: OLD_OWN_URL }));
    await expect(attachGeneratedImage('r1', { onlyIfMissing: false })).resolves.toBe(NEW_URL);
    expect(mocks.del).toHaveBeenCalledWith(OLD_OWN_URL);

    vi.clearAllMocks();
    mocks.generate.mockResolvedValue({ data: [{ b64_json: 'aW1n' }] });
    mocks.put.mockResolvedValue({ url: NEW_URL });
    mocks.redisSet.mockResolvedValue('OK');
    mocks.getRecipeById.mockResolvedValue(recipe({ imageUrl: 'https://example.com/someone-elses.jpg' }));
    await attachGeneratedImage('r1', { onlyIfMissing: false });
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('returns null for a missing recipe without generating anything', async () => {
    mocks.getRecipeById.mockResolvedValue(null);
    await expect(attachGeneratedImage('nope', { onlyIfMissing: false })).resolves.toBeNull();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
