"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const blob_1 = require("@vercel/blob");
// import { del } from '@vercel/blob'; // Removed unused import
// import { NextResponse } from 'next/server'; // Use standard Response
const zod_1 = require("zod");
const openai_1 = __importDefault(require("openai"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const readability_1 = require("@mozilla/readability");
const jsdom_1 = require("jsdom");
const path_1 = __importDefault(require("path")); // Still needed for prompt path
const promises_1 = __importDefault(require("fs/promises")); // Still needed for prompt reading
// --- Config and Initialization ---
// Ensure environment variables are loaded (Vercel does this automatically, but good for local)
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const openai = process.env.OPENAI_API_KEY ? new openai_1.default({ apiKey: process.env.OPENAI_API_KEY }) : null;
// Zod schema for Ingredient
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    unit: zod_1.z.string(),
});
// Updated Recipe Schema
const RecipeSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    main: zod_1.z.string().min(1),
    other: zod_1.z.array(IngredientSchema).min(1), // Use IngredientSchema
    instructions: zod_1.z.array(zod_1.z.string()).min(1),
});
// type ValidatedRecipe = z.infer<typeof RecipeSchema>; // Removed unused type alias
// --- Helper Functions ---
function sanitizeFilename(title) {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50);
}
// Scrape function (consider moving to lib)
async function scrapeRecipe(url) {
    console.log(`[api/process-recipe]: Scraping URL: ${url}`);
    const { data: html } = await axios_1.default.get(url, { /* headers, timeout */});
    try {
        const dom = new jsdom_1.JSDOM(html, { url });
        const reader = new readability_1.Readability(dom.window.document);
        const article = reader.parse();
        if (!article || !article.textContent)
            throw new Error('Readability failed.');
        const text = `${article.title}\n\n${article.textContent}`;
        return text.replace(/\s\s+/g, ' ').trim();
    }
    catch (_readabilityError) {
        console.warn(`[api/process-recipe]: Readability failed, falling back to Cheerio.`);
        const $ = cheerio.load(html);
        // ... (Cheerio fallback logic remains the same) ...
        $('header, footer, nav, script, style, noscript, aside, .comments-area, #comments, .sidebar').remove();
        let recipeContainer = $('[itemtype="http://schema.org/Recipe"]') || $('.wprm-recipe-container') || $('.tasty-recipes') || $('.easyrecipe') || $('article.recipe') || $('.recipe-content');
        let recipeText = recipeContainer.length > 0 ? recipeContainer.first().text() : null;
        if (!recipeText) {
            recipeContainer = $('main').length ? $('main') : $('article');
            recipeText = recipeContainer.length > 0 ? recipeContainer.first().text() : null;
        }
        if (!recipeText)
            throw new Error('Cheerio fallback failed.');
        return recipeText.replace(/\s\s+/g, ' ').trim();
    }
}
// Prompt reading function (consider moving to lib)
async function getSystemPrompt() {
    // Path relative to the built function location (might need adjustment)
    // Vercel often puts api files in .vercel/output/functions/api/
    // Trying relative path from assumed root
    const promptPath = path_1.default.join(process.cwd(), 'prompts', 'llm-prompt.md');
    console.log(`[api/process-recipe]: Reading prompt from: ${promptPath}`);
    try {
        return await promises_1.default.readFile(promptPath, 'utf-8');
    }
    catch (error) {
        console.error(`[api/process-recipe]: Failed to read prompt:`, error);
        throw new Error('Could not load system prompt.');
    }
}
// --- API Route Handler ---
async function POST(request) {
    console.log('[api/process-recipe]: POST request received');
    if (!openai) {
        // return NextResponse.json({ message: 'OpenAI service not configured.' }, { status: 500 });
        return new Response(JSON.stringify({ message: 'OpenAI service not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        // return NextResponse.json({ message: 'Blob storage not configured.' }, { status: 500 });
        return new Response(JSON.stringify({ message: 'Blob storage not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    let requestBody;
    try {
        requestBody = await request.json();
    }
    catch (_e) {
        // return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
        return new Response(JSON.stringify({ message: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    const { rawText, url } = requestBody;
    console.log(`[api/process-recipe]: Body contains - rawText: ${!!rawText}, url: ${!!url}`);
    if (!rawText && !url) {
        // return NextResponse.json({ message: 'Request body must contain either \'rawText\' or \'url\'.' }, { status: 400 });
        return new Response(JSON.stringify({ message: 'Request body must contain either "rawText" or "url".' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    try {
        // 1. Get Input Text
        let recipeInputText = rawText;
        if (url && !rawText) {
            recipeInputText = await scrapeRecipe(url);
        }
        if (!recipeInputText) {
            throw new Error('Could not obtain recipe text from input.');
        }
        console.log(`[api/process-recipe]: Text length: ${recipeInputText.length}`);
        // 2. Get Prompt
        const systemPrompt = await getSystemPrompt();
        // 3. Call OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: recipeInputText }],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });
        const aiResponseContent = completion.choices[0]?.message?.content;
        if (!aiResponseContent)
            throw new Error('OpenAI returned no content.');
        // 4. Validate Response
        let recipeJson;
        try {
            recipeJson = JSON.parse(aiResponseContent);
        }
        catch {
            throw new Error('OpenAI response was not valid JSON.');
        }
        const validationResult = RecipeSchema.safeParse(recipeJson);
        if (!validationResult.success) {
            console.error('Validation failed:', validationResult.error.errors);
            throw new Error('OpenAI response did not match recipe format.');
        }
        const validatedRecipe = validationResult.data;
        // 5. Save to Blob Storage
        const filename = `${sanitizeFilename(validatedRecipe.title)}.json`;
        const pathname = `recipes/${filename}`;
        console.log(`[api/process-recipe]: Attempting to save blob to: ${pathname}`);
        const blobResult = await (0, blob_1.put)(pathname, JSON.stringify(validatedRecipe, null, 2), {
            access: 'public', // Blobs need to be public to be fetched by URL in GET /api/recipes
            // Add content type if needed: contentType: 'application/json',
            addRandomSuffix: false // Explicitly disable the random suffix
        });
        console.log(`[api/process-recipe]: Blob save successful: ${blobResult.url}`);
        // return NextResponse.json({
        //     message: 'Recipe processed and saved successfully!',
        //     recipe: validatedRecipe,
        //     filename: filename,
        //     url: blobResult.url // Return the blob URL
        // }, { status: 201 });
        return new Response(JSON.stringify({
            message: 'Recipe processed and saved successfully!',
            recipe: validatedRecipe,
            filename: filename,
            url: blobResult.url // Return the blob URL
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('[api/process-recipe]: Error processing:', error);
        // Determine message from unknown error type
        const message = error instanceof Error ? error.message : 'Failed to process recipe.';
        return new Response(JSON.stringify({ message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
//# sourceMappingURL=process-recipe.js.map