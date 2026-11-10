/**
 * Create thumbnails for recipes that have a photo but no thumbnail yet — by downloading
 * and resizing the existing photo, not regenerating it (no OpenAI cost).
 *
 *   npm run backfill:thumbnails -- --dry-run   # list what would change
 *   npm run backfill:thumbnails                # create missing thumbnails
 *
 * Uses the credentials in .env.local, i.e. it writes to whatever database those point at.
 * Only `thumbnailUrl` is changed; each recipe is re-read right before saving so concurrent
 * edits are kept.
 */
import { put } from '@vercel/blob';
import { fetchAllRecipes, getRecipeById } from '../src/utils/recipeFetcher';
import { redis, getRecipeKey } from '../src/utils/redisClient';
import { createThumbnail } from '../src/utils/recipeImage';

const CONCURRENCY = 4;
const dryRun = process.argv.includes('--dry-run');

async function thumbnailFor(recipeId: string, imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`downloading photo failed: HTTP ${res.status}`);
  const thumbnail = await createThumbnail(Buffer.from(await res.arrayBuffer()));

  // Name it after the photo when it's one of ours (…/recipe-images/<name>.webp -> <name>-thumb.webp)
  const name = new URL(imageUrl).pathname.split('/').pop()?.replace(/\.\w+$/, '') ?? `${recipeId}-${Date.now()}`;
  const blob = await put(`recipe-images/${name}-thumb.webp`, thumbnail, {
    access: 'public',
    contentType: 'image/webp',
    allowOverwrite: true, // re-running the script replaces a half-finished earlier attempt
  });
  return blob.url;
}

async function main() {
  const recipes = await fetchAllRecipes('backfill-thumbnails');
  const targets = recipes.filter((r) => r.imageUrl && !r.thumbnailUrl);
  console.log(`${recipes.length} recipes, ${targets.length} need a thumbnail${dryRun ? ' — DRY RUN' : ''}`);
  if (dryRun || targets.length === 0) return;

  let next = 0;
  let done = 0;
  let failed = 0;
  let bytesSaved = 0;
  const worker = async () => {
    while (next < targets.length) {
      const recipe = targets[next++];
      try {
        const thumbnailUrl = await thumbnailFor(recipe.id, recipe.imageUrl!);
        const current = await getRecipeById(recipe.id);
        if (!current) throw new Error('recipe was deleted');
        if (current.imageUrl !== recipe.imageUrl) throw new Error('photo changed meanwhile; skipped');
        await redis.set(getRecipeKey(recipe.id), { ...current, thumbnailUrl }, { xx: true });

        const [full, thumb] = await Promise.all(
          [recipe.imageUrl!, thumbnailUrl].map(async (u) => Number((await fetch(u, { method: 'HEAD' })).headers.get('content-length') ?? 0))
        );
        bytesSaved += full - thumb;
        done++;
        console.log(`  ✓ ${recipe.title.trim()}  ${(full / 1024).toFixed(0)} KB -> ${(thumb / 1024).toFixed(0)} KB`);
      } catch (error) {
        failed++;
        console.log(`  ✗ ${recipe.title.trim()}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone: ${done} thumbnails, ${failed} failed. Cards now load ${(bytesSaved / 1024 / 1024).toFixed(1)} MB less in total.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
