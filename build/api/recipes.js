"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.development.local' }); // Load env vars for local dev
// Use Upstash SDK
const redis_1 = require("@upstash/redis");
// Remove @vercel/kv import
// import { kv } from '@vercel/kv';
const zod_1 = require("zod");
const server_1 = require("next/server"); // Use NextResponse for consistency
// Initialize Redis client with proper URL prefixing
const redisUrl = process.env.KV_REST_API_URL || '';
const redisToken = process.env.KV_REST_API_TOKEN || '';
// Add a check immediately after initialization
if (!redisUrl || !redisToken) {
    console.error('CRITICAL: Redis URL or Token is missing from environment variables!');
}
// Initialize the Redis client properly
const redis = new redis_1.Redis({
    url: redisUrl, // Must be a complete URL
    token: redisToken,
});
console.log(`[api/recipes.ts] Initializing Redis with URL: ${redisUrl ? redisUrl : 'MISSING!'}`);
console.log('--- !!! api/recipes.ts TOP LEVEL EXECUTION (Explicit Redis Init) !!! ---');
// --- Schemas ---
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.number()]), // Ensure string quantity isn't empty
    unit: zod_1.z.string().optional(), // Make unit optional
});
// Base Recipe Schema (used for validation on read and as base for create)
const RecipeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    main: zod_1.z.string().min(1),
    other: zod_1.z.array(IngredientSchema).min(1),
    instructions: zod_1.z.array(zod_1.z.string().min(1)).min(1), // Ensure instructions aren't empty
});
// Schema for validating data during creation (ID is generated, not provided)
const RecipeCreateSchema = RecipeSchema.omit({ id: true });
// --- End Schemas ---
const RECIPE_PREFIX = 'recipe:';
// --- GET Handler (List Recipes) ---
async function GET(_request) {
    console.log(`[api/recipes]: GET request received (using @upstash/redis).`);
    console.log('[api/recipes]: Attempting to get recipe keys from Redis using SCAN...');
    try {
        const recipeKeys = [];
        let cursor = 0;
        do {
            const [nextCursorStr, keys] = await redis.scan(cursor, { match: `${RECIPE_PREFIX}*` });
            recipeKeys.push(...keys);
            cursor = nextCursorStr;
        } while (cursor !== '0');
        console.log(`[api/recipes]: Found ${recipeKeys.length} recipe keys via SCAN.`);
        if (recipeKeys.length === 0) {
            return server_1.NextResponse.json([]);
        }
        console.log(`[api/recipes]: Fetching ${recipeKeys.length} recipes using mget...`);
        // Use redis.mget - returns array of results (data or null)
        const recipesData = await redis.mget(...recipeKeys);
        console.log(`[api/recipes]: Received ${recipesData ? recipesData.length : 'null'} results from mget.`);
        // Filter out nulls (recipes not found) and invalid data
        const validRecipes = recipesData.filter(recipe => {
            if (!recipe)
                return false;
            const result = RecipeSchema.safeParse(recipe);
            if (!result.success) {
                console.warn(`[GET /api/recipes] Invalid recipe data found in Redis, skipping: ${JSON.stringify(recipe)}`, result.error.flatten());
                return false;
            }
            return true;
        });
        console.log(`[api/recipes]: Returning ${validRecipes.length} valid recipes.`);
        return server_1.NextResponse.json(validRecipes);
    }
    catch (error) {
        console.error('[GET /api/recipes] Error fetching recipes:', error);
        const message = error instanceof Error ? error.message : 'Failed to load recipes.';
        return server_1.NextResponse.json({ message }, { status: 500 });
    }
}
// --- POST Handler (Create Recipe) ---
async function POST(request) {
    console.log(`[api/recipes]: POST request received (using @upstash/redis).`);
    let requestBody;
    try {
        requestBody = await request.json();
    }
    catch (error) {
        console.error(`[api/recipes POST]: Error parsing JSON body:`, error);
        return server_1.NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
    }
    const validationResult = RecipeCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
        console.error('[api/recipes POST]: Recipe validation failed:', validationResult.error.flatten());
        return server_1.NextResponse.json({ message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() }, { status: 400 });
    }
    const validatedData = validationResult.data;
    const newId = Date.now().toString(); // Simple unique ID
    const key = `${RECIPE_PREFIX}${newId}`;
    console.log(`[api/recipes POST]: Generated unique ID: ${newId} and key: ${key}`);
    const newRecipe = {
        ...validatedData,
        id: newId,
    }; // Use type assertion to ensure it matches Recipe type
    try {
        // Use redis.set with 'nx' option to only set if the key doesn't exist
        console.log(`[api/recipes POST]: Saving new recipe to Redis key: ${key} (if not exists)`);
        // redis.set returns the object if NX fails, null if NX succeeds
        const setResult = await redis.set(key, newRecipe, { nx: true });
        console.log(`[api/recipes POST]: redis.set nx result for key ${key}:`, setResult);
        // If setResult is NOT null, it means the key already existed (NX failed)
        if (setResult !== 'OK') {
            console.warn(`[POST /api/recipes] Key ${key} already exists (NX failed).`);
            return server_1.NextResponse.json({ message: `Recipe with generated ID '${newId}' already exists.` }, { status: 409 });
        }
        // If setResult is 'OK', the key was set successfully
        return server_1.NextResponse.json(newRecipe, { status: 201 });
    }
    catch (error) {
        console.error(`[POST /api/recipes] Error saving recipe to Redis for key ${key}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error saving recipe.';
        return server_1.NextResponse.json({ message }, { status: 500 });
    }
}
// No other functions (POST, PUT, DELETE for this file)
// No imports needed for this simple test 
