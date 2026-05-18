import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { z } from 'zod';
import { verifyAuth } from '../src/utils/auth';
import { serverLogger } from '../src/utils/serverLogger';
import { STANDARD_UNITS, ANTHROPIC_MODEL } from '../src/utils/constants';
import { IngredientSchema } from '../src/utils/apiSchemas';

const MOD = 'api/import-recipe';
const MODEL = process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL;
const THIN_CONTENT_THRESHOLD = 500;

const client = new Anthropic();

// Validates only the fields Claude extracts — main and imageUrl are left for the user to fill in
const ExtractedRecipeSchema = z.object({
  title: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

const SYSTEM_PROMPT = `You are a recipe adaptation assistant for Maaltyd, a home cooking app. Your job is to take a recipe — provided as either structured JSON-LD data or plain web page text — and adapt it into a clean, simplified version suited for home cooks. Call the extract_recipe tool with the result.

If no recipe is present, call the tool with has_recipe: false and omit all other fields.

Simplification goals:
- Maaltyd uses a flat ingredient list with no sub-groups. Merge all ingredient sections (e.g. "for the sauce", "for the marinade", "for the dough") into a single unified list, combining duplicate ingredients where it makes sense.
- Simplify restaurant-style or overly technical techniques to practical home equivalents.
- Consolidate micro-steps into clear, meaningful instructions. Each step should be a complete action a home cook can follow without professional training.
- Remove optional flourishes (elaborate plating, specialty garnishes) unless they are central to the dish.

Extraction rules:
- "title": the recipe name as written
- "other": ALL ingredients with quantities. Every ingredient needs a numeric quantity.
  - Convert fractions to decimals: 1/2 → 0.5, 1/4 → 0.25, 3/4 → 0.75
  - For "to taste" or unmeasured items, use 0.25 as the quantity
  - For "unit", use ONLY one of these exact values: ${STANDARD_UNITS.filter(u => u !== '').join(', ')}, or "" (empty string) for unitless items like eggs or cloves
  - Map non-standard units to the closest standard unit (e.g. "stick of butter" → 0.5 cup)
- "instructions": each step as a clear, complete sentence written in plain language`;

const extractRecipeTool: Anthropic.Tool = {
  name: 'extract_recipe',
  description: 'Extract structured recipe data from web page content, or signal that no recipe was found',
  input_schema: {
    type: 'object',
    properties: {
      has_recipe: {
        type: 'boolean',
        description: 'Whether a recipe was found on the page',
      },
      title: { type: 'string', description: 'Recipe title' },
      other: {
        type: 'array',
        description: 'All ingredients with quantities',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string', description: 'Standard unit or empty string' },
          },
          required: ['name', 'quantity', 'unit'],
        },
      },
      instructions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Step-by-step instructions',
      },
    },
    required: ['has_recipe'],
  },
};

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
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json({ message: getHttpErrorMessage(res.status) }, { status: 422 });
    }
    html = await res.text();
  } catch (error) {
    serverLogger.error(MOD, 'Fetch error:', error);
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
  let toolInput: Record<string, unknown>;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [extractRecipeTool],
      tool_choice: { type: 'tool', name: 'extract_recipe' },
      messages: [{ role: 'user', content: pageContent }],
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      return NextResponse.json({ message: 'Recipe extraction failed — please try again.' }, { status: 500 });
    }
    toolInput = toolUse.input as Record<string, unknown>;
  } catch (error) {
    serverLogger.error(MOD, 'Claude API error:', error);
    return NextResponse.json({ message: 'Recipe extraction failed — please try again.' }, { status: 500 });
  }

  if (!toolInput.has_recipe) {
    return NextResponse.json(
      {
        message:
          "No recipe was found on that page. Make sure you're linking directly to a recipe, not a search result or category page.",
      },
      { status: 422 }
    );
  }

  const parsed = ExtractedRecipeSchema.safeParse(toolInput);
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
