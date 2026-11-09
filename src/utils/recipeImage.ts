import OpenAI from 'openai';
import { put, del } from '@vercel/blob';
import { redis, getRecipeKey } from './redisClient';
import { getRecipeById } from './recipeFetcher';
import { serverLogger } from './serverLogger';
import type { Recipe } from '../types/recipe';

const MOD = 'recipeImage';

/** "Fast, high-quality everyday image generation" per OpenAI's docs. Override via env. */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.6-flare';

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
export const IMAGE_STYLE = [
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

/** Generate an image for the recipe and upload it to Vercel Blob. Returns the public URL. */
export async function generateRecipeImage(recipe: Recipe): Promise<string> {
  const started = Date.now();
  const result = await getOpenAI().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL,
    prompt: buildImagePrompt(recipe),
    size: '1536x1024',
    complexity: 'medium',
    output_format: 'webp',
    output_compression: 80,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('Image generation returned no image data');
  }

  const blob = await put(`recipe-images/${recipe.id}-${Date.now()}.webp`, Buffer.from(b64, 'base64'), {
    access: 'public',
    contentType: 'image/webp',
  });

  serverLogger.log(MOD, `generated image for ${recipe.id} in ${Date.now() - started}ms`, {
    usage: result.usage,
    url: blob.url,
  });
  return blob.url;
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

/**
 * Generate an image and store it on the recipe.
 *
 * - `onlyIfMissing`: skip if the recipe already has an image (used for automatic
 *   generation on create, so a URL the user typed in is never replaced).
 * - The recipe is re-read after generation so edits made in the meantime are kept;
 *   only `imageUrl` is changed.
 *
 * Returns the new image URL, or null if nothing was changed.
 */
export async function attachGeneratedImage(
  recipeId: string,
  { onlyIfMissing }: { onlyIfMissing: boolean }
): Promise<string | null> {
  const before = await getRecipeById(recipeId);
  if (!before) return null;
  if (onlyIfMissing && before.imageUrl) return null;

  const imageUrl = await generateRecipeImage(before);

  // Re-read: generation takes a while and the recipe may have been edited or deleted
  const current = await getRecipeById(recipeId);
  if (!current || (onlyIfMissing && current.imageUrl)) {
    await del(imageUrl).catch(() => undefined);
    return null;
  }

  const updated: Recipe = { ...current, imageUrl };
  const setResult = await redis.set(getRecipeKey(recipeId), updated, { xx: true });
  if (setResult === null) {
    await del(imageUrl).catch(() => undefined);
    return null;
  }

  if (isOwnBlobUrl(current.imageUrl) && current.imageUrl !== imageUrl) {
    await del(current.imageUrl).catch((error) =>
      serverLogger.warn(MOD, `failed to delete old image ${current.imageUrl}:`, error)
    );
  }

  return imageUrl;
}
