import OpenAI from 'openai';
import sharp from 'sharp';
import { put, del } from '@vercel/blob';
import { redis, getRecipeKey } from './redisClient';
import { getRecipeById } from './recipeFetcher';
import { serverLogger } from './serverLogger';
import type { Recipe } from '../types/recipe';
import { RECIPE_IMAGE_SIZE, RECIPE_THUMBNAIL_SIZE } from './constants';

const MOD = 'recipeImage';

/** "Fast, high-quality everyday image generation" per OpenAI's docs. Override via env. */
const DEFAULT_IMAGE_MODEL = 'gpt-image-2.6-flare';

// Created lazily so a missing API key fails the request, not the build
let openai: OpenAI | null = null;
const getOpenAI = () => (openai ??= new OpenAI());

type RecipeForPrompt = Pick<Recipe, 'title' | 'main' | 'other'>;

/**
 * Fixed photographic style shared by every recipe photo. Everything that could vary between
 * shots (angle, surface, vessel, light, props, framing, grade) is pinned down here, so the only
 * thing that changes from image to image is the food itself.
 *
 * Changing this changes the look of every *new* photo — re-run the backfill script
 * (`npm run backfill:images -- --all`) to bring existing recipes in line.
 */
const IMAGE_STYLE = [
  'Camera: 45-degree three-quarter angle, 50mm lens look, the dish centered with generous space around it, the whole dish in frame.',
  'Surface: the same light natural oak tabletop in every shot, slightly blurred toward the back.',
  'Vessel: one plain matte off-white ceramic plate, or a matching matte off-white ceramic bowl for soups, stews, noodles in broth, and other liquid dishes.',
  'Light: soft diffused daylight from the left, gentle natural shadows, no harsh highlights.',
  'Grade: warm, natural, true-to-life colors, bright and airy, moderate contrast.',
  'Props: at most one or two small raw ingredients from the recipe placed casually beside the dish; no cutlery, napkins, or other tableware.',
  'Realistic home-cooked food, appetizing but not over-styled. No text, labels, or watermarks. No hands or people.',
].join(' ');

/** Prompt for one recipe: the dish description plus the shared IMAGE_STYLE. */
export function buildImagePrompt(recipe: RecipeForPrompt): string {
  const ingredients = recipe.other
    .map((i) => i.name.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');

  return [
    `Food photograph of a finished home-cooked dish: "${recipe.title}".`,
    recipe.main ? `The main ingredient is ${recipe.main}.` : '',
    ingredients ? `It is made with ${ingredients}.` : '',
    IMAGE_STYLE,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface RecipeImageUrls {
  imageUrl: string;
  thumbnailUrl: string;
}

/**
 * Downscale a full recipe photo for cards and previews: 576×384 WebP, ~25KB vs ~150KB+.
 * That's still sharp on 3× phone screens, where a 112px card is 336 device pixels tall.
 */
export async function createThumbnail(fullImage: Buffer): Promise<Buffer> {
  return sharp(fullImage)
    .resize({ width: RECIPE_THUMBNAIL_SIZE.width, height: RECIPE_THUMBNAIL_SIZE.height, fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();
}

/** Upload a full photo and its thumbnail under one shared name. */
async function uploadRecipeImages(recipeId: string, fullImage: Buffer): Promise<RecipeImageUrls> {
  const base = `recipe-images/${recipeId}-${Date.now()}`;
  const thumbnail = await createThumbnail(fullImage);
  const [full, thumb] = await Promise.all([
    put(`${base}.webp`, fullImage, { access: 'public', contentType: 'image/webp' }),
    put(`${base}-thumb.webp`, thumbnail, { access: 'public', contentType: 'image/webp' }),
  ]);
  return { imageUrl: full.url, thumbnailUrl: thumb.url };
}

/** Generate a photo for the recipe and upload it (plus thumbnail) to Vercel Blob. */
async function generateRecipeImage(recipe: Recipe): Promise<RecipeImageUrls> {
  const started = Date.now();
  const result = await getOpenAI().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL,
    prompt: buildImagePrompt(recipe),
    size: `${RECIPE_IMAGE_SIZE.width}x${RECIPE_IMAGE_SIZE.height}`,
    complexity: 'medium',
    output_format: 'webp',
    output_compression: 80,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('Image generation returned no image data');
  }

  const urls = await uploadRecipeImages(recipe.id, Buffer.from(b64, 'base64'));

  serverLogger.log(MOD, `generated image for ${recipe.id} in ${Date.now() - started}ms`, {
    usage: result.usage,
    ...urls,
  });
  return urls;
}

/** Only delete images we created ourselves (Vercel Blob, recipe-images/ folder). */
export function isOwnBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.endsWith('.public.blob.vercel-storage.com') && pathname.startsWith('/recipe-images/');
  } catch {
    return false;
  }
}

/** Delete whichever of these blobs are ours; failures are logged, never thrown. */
async function deleteOwnBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const own = urls.filter(isOwnBlobUrl);
  if (own.length === 0) return;
  await del(own).catch((error) => serverLogger.warn(MOD, `failed to delete old images ${own.join(', ')}:`, error));
}

/**
 * Generate a photo (and thumbnail) and store both on the recipe.
 *
 * - `onlyIfMissing`: skip if the recipe already has an image (used for automatic
 *   generation on create, so an existing photo is never replaced).
 * - The recipe is re-read after generation so edits made in the meantime are kept;
 *   only `imageUrl` and `thumbnailUrl` are changed.
 *
 * Returns the new URLs, or null if nothing was changed.
 */
export async function attachGeneratedImage(
  recipeId: string,
  { onlyIfMissing }: { onlyIfMissing: boolean }
): Promise<RecipeImageUrls | null> {
  const before = await getRecipeById(recipeId);
  if (!before) return null;
  if (onlyIfMissing && before.imageUrl) return null;

  const urls = await generateRecipeImage(before);

  // Re-read: generation takes a while and the recipe may have been edited or deleted
  const current = await getRecipeById(recipeId);
  if (!current || (onlyIfMissing && current.imageUrl)) {
    await deleteOwnBlobs([urls.imageUrl, urls.thumbnailUrl]);
    return null;
  }

  const updated: Recipe = { ...current, ...urls };
  const setResult = await redis.set(getRecipeKey(recipeId), updated, { xx: true });
  if (setResult === null) {
    await deleteOwnBlobs([urls.imageUrl, urls.thumbnailUrl]);
    return null;
  }

  await deleteOwnBlobs([current.imageUrl, current.thumbnailUrl].filter((u) => u !== urls.imageUrl && u !== urls.thumbnailUrl));
  return urls;
}
