/**
 * Regenerate AI photos for existing recipes.
 *
 *   npm run backfill:images -- --dry-run   # list what would change, generate nothing
 *   npm run backfill:images                # recipes without an AI-generated photo
 *   npm run backfill:images -- --all       # every recipe (e.g. after changing IMAGE_STYLE)
 *   npm run backfill:images -- --limit 3   # only the first N matching recipes
 *
 * Uses the Redis/Blob/OpenAI credentials in .env.local — i.e. it writes to whatever
 * database those point at. Before changing anything it writes a JSON record of every
 * recipe's previous imageUrl to scripts/backfill-output/, so old URLs can be restored.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchAllRecipes } from '../src/utils/recipeFetcher';
import { attachGeneratedImage, isOwnBlobUrl } from '../src/utils/recipeImage';

const CONCURRENCY = 3;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;

async function main() {
  const recipes = await fetchAllRecipes('backfill');
  const targets = recipes
    .filter((r) => all || !isOwnBlobUrl(r.imageUrl))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, limit);

  console.log(
    `${recipes.length} recipes, ${targets.length} to regenerate` +
      `${all ? ' (--all)' : ' (skipping ones that already have an AI photo)'}` +
      `${dryRun ? ' — DRY RUN' : ''}\n`
  );
  for (const r of targets) {
    console.log(`  ${r.title}  [${r.imageUrl ? new URL(r.imageUrl).hostname : 'no image'}]`);
  }
  if (dryRun || targets.length === 0) return;

  mkdirSync('scripts/backfill-output', { recursive: true });
  const recordPath = `scripts/backfill-output/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const record = targets.map((r) => ({ id: r.id, title: r.title, previousImageUrl: r.imageUrl ?? null, newImageUrl: null as string | null, error: null as string | null }));
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  console.log(`\nPrevious image URLs saved to ${recordPath}\n`);

  let next = 0;
  let done = 0;
  let failed = 0;
  const worker = async () => {
    while (next < record.length) {
      const entry = record[next++];
      try {
        entry.newImageUrl = (await attachGeneratedImage(entry.id, { onlyIfMissing: false }))?.imageUrl ?? null;
        done++;
        console.log(`  ✓ (${done + failed}/${record.length}) ${entry.title}`);
      } catch (error) {
        failed++;
        entry.error = error instanceof Error ? error.message : String(error);
        console.log(`  ✗ (${done + failed}/${record.length}) ${entry.title}: ${entry.error}`);
      }
      writeFileSync(recordPath, JSON.stringify(record, null, 2));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone: ${done} regenerated, ${failed} failed. Record: ${recordPath}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
