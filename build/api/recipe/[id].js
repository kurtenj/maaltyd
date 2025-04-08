"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.DELETE = DELETE;
exports.PUT = PUT;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.development.local' }); // Load env vars for local dev
// Use Upstash SDK
const redis_1 = require("@upstash/redis");
// Remove @vercel/kv import
// import { kv } from '@vercel/kv';
const server_1 = require("next/server");
const zod_1 = require("zod");
// Remove import for recipe actions
// import { deleteRecipeAction, updateRecipeAction } from '../../../lib/recipeActions';
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
console.log(`[api/recipe/[id].ts] Initializing Redis with URL: ${redisUrl ? redisUrl : 'MISSING!'}`);
const RECIPE_PREFIX = 'recipe:';
// --- Schemas ---
// Define these once, outside handlers
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.number()]),
    unit: zod_1.z.string().optional(),
});
const RecipeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    main: zod_1.z.string().min(1),
    other: zod_1.z.array(IngredientSchema).min(1),
    instructions: zod_1.z.array(zod_1.z.string().min(1)).min(1),
});
const RecipeUpdateSchema = RecipeSchema.omit({ id: true });
// Remove or comment out to use default Node.js runtime
// export const runtime = 'edge';
console.log('--- !!! api/recipe/[id].ts TOP LEVEL EXECUTION (Explicit Redis Init) !!! ---');
// --- GET Handler (Get Single Recipe) ---
async function GET(request, context) {
    // Log full context to debug
    console.log(`[GET /api/recipe/{id}] Context:`, JSON.stringify(context));
    // Extract the ID from the URL path parameter
    const id = context?.params?.id;
    console.log(`[GET /api/recipe/{id}] Request received. ID from context.params: "${id}" (type: ${typeof id})`);
    // Also log the URL to check if ID is in the path
    const url = new URL(request.url);
    console.log(`[GET /api/recipe/{id}] Request URL: ${url.pathname}`);
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    const key = `${RECIPE_PREFIX}${id}`;
    try {
        console.log(`[GET /api/recipe/{id}] Fetching key: ${key}`);
        const recipeData = await redis.get(key);
        console.log(`[GET /api/recipe/{id}] Result for key ${key}:`, recipeData);
        if (recipeData === null) {
            return server_1.NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
        }
        // Optional: Validate data read from DB, though often trusted if written by same app
        const validation = RecipeSchema.safeParse(recipeData);
        if (!validation.success) {
            console.warn(`[GET /api/recipe/{id}] Invalid data found in Redis for key ${key}:`, validation.error.flatten());
            // Return 500 as data integrity issue
            return server_1.NextResponse.json({ message: 'Invalid recipe data stored.' }, { status: 500 });
        }
        return server_1.NextResponse.json(validation.data);
    }
    catch (error) {
        console.error(`[GET /api/recipe/{id}] Error fetching recipe for key ${key}:`, error);
        const message = error instanceof Error ? error.message : 'Error fetching recipe.';
        return server_1.NextResponse.json({ message }, { status: 500 });
    }
}
// --- DELETE Handler (Delete Recipe) ---
async function DELETE(request, context) {
    // Extract the ID from the URL path parameter
    const id = context?.params?.id;
    console.log(`[DELETE /api/recipe/{id}] Request received. ID from context.params: "${id}" (type: ${typeof id})`);
    // Also log the URL to check if ID is in the path
    const url = new URL(request.url);
    console.log(`[DELETE /api/recipe/{id}] Request URL: ${url.pathname}`);
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    const key = `${RECIPE_PREFIX}${id}`;
    try {
        const result = await redis.del(key);
        // redis.del returns number of keys deleted (0 or 1)
        // We return 204 whether it existed or not, as the goal is deletion
        console.log(`[DELETE /api/recipe/{id}] Delete result for key ${key}: ${result}`);
        return new server_1.NextResponse(null, { status: 204 }); // Use NextResponse for consistency
    }
    catch (error) {
        console.error(`[DELETE /api/recipe/{id}] Error deleting recipe for key ${key}:`, error);
        const message = error instanceof Error ? error.message : 'Error deleting recipe.';
        return server_1.NextResponse.json({ message }, { status: 500 });
    }
}
// --- PUT Handler (Update Recipe) ---
async function PUT(request, context) {
    // Extract the ID from the URL path parameter
    const id = context?.params?.id;
    console.log(`[PUT /api/recipe/{id}] Request received. ID from context.params: "${id}" (type: ${typeof id})`);
    // Also log the URL to check if ID is in the path
    const url = new URL(request.url);
    console.log(`[PUT /api/recipe/{id}] Request URL: ${url.pathname}`);
    if (!id) {
        return server_1.NextResponse.json({ message: 'Recipe ID is required.' }, { status: 400 });
    }
    const key = `${RECIPE_PREFIX}${id}`;
    let requestBody;
    try {
        requestBody = await request.json();
    }
    catch (_error) {
        return server_1.NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
    }
    const validationResult = RecipeUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) {
        return server_1.NextResponse.json({ message: 'Invalid recipe data provided.', errors: validationResult.error.flatten() }, { status: 400 });
    }
    // Construct the full recipe object, including the ID from the route
    const recipeToSave = {
        ...validationResult.data,
        id: id,
    }; // Use type assertion to ensure it matches Recipe type
    try {
        // Overwrite the key with the new validated data
        const setResult = await redis.set(key, recipeToSave);
        if (setResult !== 'OK') {
            console.error(`[PUT /api/recipe/{id}] Failed to update recipe in Redis for key ${key}. Result: ${setResult}`);
            throw new Error(`Failed to update recipe. Result: ${setResult}`); // Let catch block handle response
        }
        return server_1.NextResponse.json(recipeToSave); // Return the updated recipe
    }
    catch (error) {
        console.error(`[PUT /api/recipe/{id}] Error updating recipe for key ${key}:`, error);
        const message = error instanceof Error ? error.message : 'Error updating recipe.';
        return server_1.NextResponse.json({ message }, { status: 500 });
    }
}
