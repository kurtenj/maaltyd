import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { z } from 'zod';
import { verifyAuth } from '../../../utils/auth';
import { serverLogger } from '../../../utils/serverLogger';
import { STANDARD_UNITS, ANTHROPIC_MODEL } from '../../../utils/constants';
import { IngredientSchema } from '../../../utils/apiSchemas';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../../../utils/redisClient';
import { safeFetchText, UnsafeUrlError, ResponseTooLargeError, HttpStatusError } from '../../../utils/safeFetch';

const MOD = 'api/import-recipe';
const MODEL = process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL;
const THIN_CONTENT_THRESHOLD = 500;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;

// Each import costs a Claude call, so cap it per signed-in user
const importRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'ratelimit:import',
});

// Created lazily so a missing API key fails the request, not the build
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

// Shape Claude must produce (enforced by structured outputs). Every field is required by
// structured outputs, so "no recipe" is signalled with has_recipe: false and empty values.
const ClaudeRecipeOutputSchema = z.object({
  has_recipe: z.boolean(),
  title: z.string(),
  other: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.enum(STANDARD_UNITS),
    })
  ),
  instructions: z.array(z.string()),
});

// Stricter check on the result — main and imageUrl are left for the user to fill in
const ExtractedRecipeSchema = z.object({
  title: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

const SYSTEM_PROMPT = `You are a recipe adaptation assistant for Maaltyd, a home cooking app. Your job is to take a recipe — provided as either structured JSON-LD data or plain web page text — and adapt it into a clean, simplified version suited for home cooks.

If no recipe is present, set has_recipe to false, title to an empty string, and other and instructions to empty lists.

Simplification goals:
- Maaltyd uses a flat ingredient list with no sub-groups. Merge all ingredient sections (e.g. "for the sauce", "for the marinade", "for the dough") into a single unified list, combining duplicate ingredients where it makes sense.
- Simplify restaurant-style or overly technical techniques to practical home equivalents.
- Consolidate micro-steps into clear, meaningful instructions. Each step should be a complete action a home cook can follow without professional training.
- Remove optional flourishes (elaborate plating, specialty garnishes) unless they are central to the dish.

Extraction rules:
- "title": the recipe name as written
- "other": ALL ingredients with quantities. Every ingredient needs a numeric quantity greater than 0.
  - Convert fractions to decimals: 1/2 → 0.5, 1/4 → 0.25, 3/4 → 0.75
  - For "to taste" or unmeasured items, use 0.25 as the quantity
  - "unit" must be one of the allowed values; use "" (empty string) for unitless items like eggs or cloves
  - Map non-standard units to the closest standard unit (e.g. "stick of butter" → 0.5 cup)
- "instructions": each step as a clear, complete sentence written in plain language`;

function extractRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const type = obj['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
    return obj;
  }
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const found = extractRecipeNode(item);
      if (found) return found;
    }
  }
  return null;
}

function findRecipeJsonLd(document: Document): string | null {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const found = extractRecipeNode(JSON.parse(script.textContent ?? ''));
      if (found) return JSON.stringify(found, null, 2);
    } catch {
      // malformed JSON — skip
    }
  }
  return null;
}

function getHttpErrorMessage(status: number): string {
  if (status === 403) {
    return 'This site blocked the request. Try a print-friendly version of the page, or paste the URL from a different recipe source.';
  }
  if (status === 404) {
    return 'Page not found — double-check the URL and try again.';
  }
  if (status >= 500) {
    return 'The recipe site returned a server error. Try again in a moment.';
  }
  return `The page couldn't be loaded (error ${status}). Check the URL and try again.`;
}

export async function POST(request: Request): Promise<NextResponse> {
  serverLogger.log(MOD, 'POST request received');

  const userId = await verifyAuth(request);
  if (!userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const { success, reset } = await importRateLimit.limit(userId);
  if (!success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return NextResponse.json(
      { message: `You've hit the import limit. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { message: 'Please enter a valid URL (e.g. https://example.com/recipe).' },
        { status: 400 }
      );
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json(
        { message: 'Only http:// and https:// URLs are supported.' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { message: 'Please enter a valid URL (e.g. https://example.com/recipe).' },
      { status: 400 }
    );
  }

  serverLogger.log(MOD, `Fetching URL: ${url}`);

  let html: string;
  try {
    html = await safeFetchText(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      timeoutMs: 10_000,
      maxBytes: MAX_PAGE_BYTES,
    });
  } catch (error) {
    serverLogger.error(MOD, 'Fetch error:', error);
    if (error instanceof HttpStatusError) {
      return NextResponse.json({ message: getHttpErrorMessage(error.status) }, { status: 422 });
    }
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json(
        { message: "That address can't be imported. Use a public recipe page URL (e.g. https://example.com/recipe)." },
        { status: 400 }
      );
    }
    if (error instanceof ResponseTooLargeError) {
      return NextResponse.json(
        { message: 'That page is too large to import. Try a print-friendly version of the recipe.' },
        { status: 422 }
      );
    }
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    const message = isTimeout
      ? 'The request timed out. The site may be slow — try again, or try a different URL.'
      : "Couldn't reach that address. Check the URL and try again.";
    return NextResponse.json({ message }, { status: 422 });
  }

  // Build page content for Claude: prefer structured JSON-LD, fall back to Readability
  let pageContent: string;
  let contentSource: 'json-ld' | 'readability' | 'raw';
  try {
    const dom = new JSDOM(html, { url });
    const jsonLd = findRecipeJsonLd(dom.window.document);
    if (jsonLd) {
      pageContent = jsonLd;
      contentSource = 'json-ld';
    } else {
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      const text = article?.textContent?.trim() ?? '';
      if (text) {
        pageContent = text.substring(0, 15000);
        contentSource = 'readability';
      } else {
        pageContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 15000);
        contentSource = 'raw';
      }
    }
  } catch (error) {
    serverLogger.error(MOD, 'Content extraction error:', error);
    pageContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 15000);
    contentSource = 'raw';
  }

  if (pageContent.length < THIN_CONTENT_THRESHOLD) {
    return NextResponse.json(
      {
        message:
          "This page's content couldn't be read — it may require JavaScript to load. Try a print-friendly version of the recipe.",
      },
      { status: 422 }
    );
  }

  serverLogger.log(MOD, `Extracted ${pageContent.length} chars via ${contentSource}`);

  // Call Claude
  let output: z.infer<typeof ClaudeRecipeOutputSchema>;
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 16000, // leaves room for adaptive thinking before the JSON answer
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: {
        effort: 'low',
        format: zodOutputFormat(ClaudeRecipeOutputSchema),
      },
      messages: [{ role: 'user', content: pageContent }],
    });

    serverLogger.log(MOD, 'Claude usage:', {
      stop_reason: response.stop_reason,
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cache_read: response.usage.cache_read_input_tokens,
      cache_write: response.usage.cache_creation_input_tokens,
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { message: "This page couldn't be processed. Try a different recipe URL." },
        { status: 422 }
      );
    }
    if (!response.parsed_output) {
      serverLogger.error(MOD, `No parsed output (stop_reason: ${response.stop_reason})`);
      return NextResponse.json({ message: 'Recipe extraction failed — please try again.' }, { status: 500 });
    }
    output = response.parsed_output;
  } catch (error) {
    serverLogger.error(MOD, 'Claude API error:', error);
    return NextResponse.json({ message: 'Recipe extraction failed — please try again.' }, { status: 500 });
  }

  if (!output.has_recipe) {
    return NextResponse.json(
      {
        message:
          "No recipe was found on that page. Make sure you're linking directly to a recipe, not a search result or category page.",
      },
      { status: 422 }
    );
  }

  const { has_recipe: _hasRecipe, ...recipeFields } = output;
  const parsed = ExtractedRecipeSchema.safeParse(recipeFields);
  if (!parsed.success) {
    serverLogger.error(MOD, 'Schema validation failed:', parsed.error.flatten());
    return NextResponse.json(
      { message: 'The extracted recipe data was incomplete. Try a different URL.' },
      { status: 422 }
    );
  }

  serverLogger.log(MOD, `Successfully extracted recipe: ${parsed.data.title}`);
  return NextResponse.json({ ...parsed.data, main: '' });
}
