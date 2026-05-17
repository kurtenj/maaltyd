import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { verifyAuth } from '../src/utils/auth';
import { serverLogger } from '../src/utils/serverLogger';
import { STANDARD_UNITS, ANTHROPIC_MODEL } from '../src/utils/constants';
import { RecipeCreateSchema } from '../src/utils/apiSchemas';

const MOD = 'api/import-recipe';
const MODEL = process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL;

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract structured recipe data from the provided web page text and call the extract_recipe tool with the result.

Rules for extraction:
- "title": the recipe name as written
- "main": the single primary protein or star ingredient in one word or short phrase (e.g. "chicken", "salmon", "pasta")
- "other": ALL ingredients including the main one if it has a measurable quantity. Every ingredient needs a numeric quantity.
  - Convert fractions to decimals: 1/2 → 0.5, 1/4 → 0.25, 3/4 → 0.75
  - For "to taste" or unmeasured items, use 0.25 as the quantity
  - For "unit", use ONLY one of these exact values: ${STANDARD_UNITS.filter(u => u !== '').join(', ')}, or "" (empty string) for unitless items like eggs or cloves
  - Map non-standard units to the closest standard unit (e.g. "stick of butter" → 0.5 cup)
- "instructions": each step as a complete sentence or short paragraph, as written
- "imageUrl": include if clearly present in the content, otherwise omit`;

const extractRecipeTool: Anthropic.Tool = {
  name: 'extract_recipe',
  description: 'Extract structured recipe data from web page content',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Recipe title' },
      main: { type: 'string', description: 'Primary/star ingredient' },
      imageUrl: { type: 'string', description: 'Recipe image URL if present' },
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
    required: ['title', 'main', 'other', 'instructions'],
  },
};

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
      return NextResponse.json({ message: 'A valid URL is required.' }, { status: 400 });
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ message: 'Only HTTP and HTTPS URLs are supported.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ message: 'Invalid request body or URL.' }, { status: 400 });
  }

  serverLogger.log(MOD, `Fetching URL: ${url}`);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeImporter/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { message: `Could not fetch the page (HTTP ${res.status}). Check the URL and try again.` },
        { status: 422 }
      );
    }
    html = await res.text();
  } catch (error) {
    serverLogger.error(MOD, 'Fetch error:', error);
    return NextResponse.json(
      { message: 'Could not reach that URL. It may be blocked or unavailable.' },
      { status: 422 }
    );
  }

  // Extract readable content using Readability
  let pageContent: string;
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    pageContent = article?.textContent?.trim() ?? '';
    if (!pageContent) {
      pageContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 15000);
    } else {
      pageContent = pageContent.substring(0, 15000);
    }
  } catch (error) {
    serverLogger.error(MOD, 'Readability error:', error);
    pageContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 15000);
  }

  serverLogger.log(MOD, `Extracted ${pageContent.length} chars of content`);

  // Call Claude
  let toolInput: Record<string, unknown>;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [extractRecipeTool],
      tool_choice: { type: 'tool', name: 'extract_recipe' },
      messages: [{ role: 'user', content: pageContent }],
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      return NextResponse.json({ message: 'Could not extract a recipe from that page.' }, { status: 422 });
    }
    toolInput = toolUse.input as Record<string, unknown>;
  } catch (error) {
    serverLogger.error(MOD, 'Claude API error:', error);
    return NextResponse.json({ message: 'Recipe extraction failed. Please try again.' }, { status: 500 });
  }

  // Validate against RecipeCreateSchema
  const parsed = RecipeCreateSchema.safeParse(toolInput);
  if (!parsed.success) {
    serverLogger.error(MOD, 'Schema validation failed:', parsed.error.flatten());
    return NextResponse.json(
      { message: 'Extracted recipe data was invalid. Try a different URL.' },
      { status: 422 }
    );
  }

  serverLogger.log(MOD, `Successfully extracted recipe: ${parsed.data.title}`);
  return NextResponse.json(parsed.data);
}
