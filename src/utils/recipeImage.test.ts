// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Recipe } from '../types/recipe';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  redisSet: vi.fn(),
  getRecipeById: vi.fn(),
  resize: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    images = { generate: mocks.generate };
  },
}));
vi.mock('@vercel/blob', () => ({ put: mocks.put, del: mocks.del }));
vi.mock('sharp', () => ({
  default: () => {
    const chain = {
      resize: (opts: unknown) => (mocks.resize(opts), chain),
      webp: () => chain,
      toBuffer: async () => Buffer.from('thumb'),
    };
    return chain;
  },
}));
vi.mock('./redisClient', () => ({
  redis: { set: mocks.redisSet },
  getRecipeKey: (id: string) => `recipe:${id}`,
}));
vi.mock('./recipeFetcher', () => ({ getRecipeById: mocks.getRecipeById }));
vi.mock('./serverLogger', () => ({ serverLogger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { buildImagePrompt, attachGeneratedImage } = await import('./recipeImage');

const BLOB = 'https://abc.public.blob.vercel-storage.com/';
const OLD_OWN_URL = `${BLOB}recipe-images/r1-1.webp`;
const OLD_OWN_THUMB = `${BLOB}recipe-images/r1-1-thumb.webp`;
const isNewPhoto = (u: string) => /recipe-images\/r1-\d{6,}\.webp$/.test(u);
const isNewThumb = (u: string) => /recipe-images\/r1-\d{6,}-thumb\.webp$/.test(u);

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
  mocks.put.mockImplementation(async (pathname: string) => ({ url: `${BLOB}${pathname}` }));
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
  it('generates, uploads the photo and a 576x384 thumbnail, and saves both', async () => {
    mocks.getRecipeById.mockResolvedValue(recipe());

    const urls = await attachGeneratedImage('r1', { onlyIfMissing: true });
    expect(isNewPhoto(urls!.imageUrl)).toBe(true);
    expect(isNewThumb(urls!.thumbnailUrl)).toBe(true);
    expect(mocks.resize).toHaveBeenCalledWith(expect.objectContaining({ width: 576, height: 384 }));
    expect(mocks.put).toHaveBeenCalledTimes(2);
    for (const call of mocks.put.mock.calls) {
      expect(call[2]).toEqual(expect.objectContaining({ access: 'public', contentType: 'image/webp' }));
    }
    expect(mocks.redisSet).toHaveBeenCalledWith('recipe:r1', expect.objectContaining(urls), { xx: true });
  });

  it('does nothing in onlyIfMissing mode when the recipe already has an image', async () => {
    mocks.getRecipeById.mockResolvedValue(recipe({ imageUrl: 'https://example.com/mine.jpg' }));

    await expect(attachGeneratedImage('r1', { onlyIfMissing: true })).resolves.toBeNull();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('discards both uploads if a photo was added while generating', async () => {
    mocks.getRecipeById
      .mockResolvedValueOnce(recipe())
      .mockResolvedValueOnce(recipe({ imageUrl: 'https://example.com/added-meanwhile.jpg' }));

    await expect(attachGeneratedImage('r1', { onlyIfMissing: true })).resolves.toBeNull();
    expect(mocks.redisSet).not.toHaveBeenCalled();
    const deleted: string[] = mocks.del.mock.calls[0][0];
    expect(deleted).toHaveLength(2);
    expect(deleted.some(isNewPhoto) && deleted.some(isNewThumb)).toBe(true);
  });

  it('saves on top of the latest recipe data, not the stale copy', async () => {
    mocks.getRecipeById
      .mockResolvedValueOnce(recipe())
      .mockResolvedValueOnce(recipe({ title: 'Renamed While Generating' }));

    await attachGeneratedImage('r1', { onlyIfMissing: true });
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'recipe:r1',
      expect.objectContaining({ title: 'Renamed While Generating' }),
      { xx: true }
    );
  });

  it('cleans up both uploads if the recipe was deleted during generation', async () => {
    mocks.getRecipeById.mockResolvedValueOnce(recipe()).mockResolvedValueOnce(null);

    await expect(attachGeneratedImage('r1', { onlyIfMissing: false })).resolves.toBeNull();
    expect(mocks.del.mock.calls[0][0]).toHaveLength(2);
  });

  it('on regenerate, deletes the old photo and thumbnail only if we created them', async () => {
    mocks.getRecipeById.mockResolvedValue(recipe({ imageUrl: OLD_OWN_URL, thumbnailUrl: OLD_OWN_THUMB }));
    await attachGeneratedImage('r1', { onlyIfMissing: false });
    expect(mocks.del).toHaveBeenCalledWith([OLD_OWN_URL, OLD_OWN_THUMB]);

    mocks.del.mockClear();
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
