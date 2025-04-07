"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const blob_1 = require("@vercel/blob");
// import { NextResponse } from 'next/server'; // Remove this line
const zod_1 = require("zod");
// Zod schema for Ingredient
const IngredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]), // Allow string or number
    unit: zod_1.z.string(), // Unit can be empty string
});
// Updated Recipe Schema
const RecipeSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    main: zod_1.z.string().min(1),
    other: zod_1.z.array(IngredientSchema).min(1), // Use IngredientSchema
    instructions: zod_1.z.array(zod_1.z.string()).min(1),
});
// export const runtime = 'edge'; // Keep commented out
// Remove eslint-disable comment (already handled by rule config)
async function GET(_request) {
    // console.log('[api/recipes]: GET request received (Simplified Test)'); // Remove test log
    // --- TEMP: Return hardcoded data --- 
    // return new Response(JSON.stringify([{id: 'test-123', title: 'Hardcoded Test Recipe', main: 'Test Main', other: ['Test Other'], instructions: ['Step 1']}]), {
    //   status: 200,
    //   headers: { 'Content-Type': 'application/json' },
    // });
    // --- END TEMP ---
    // Original Code Commented Out:
    console.log('[api/recipes]: GET request received');
    try {
        const { blobs } = await (0, blob_1.list)({
            prefix: 'recipes/'
        });
        console.log(`[api/recipes]: Found ${blobs.length} blobs in recipes/ prefix.`);
        const recipes = [];
        for (const blob of blobs) {
            try {
                console.log(`[api/recipes]: Fetching content for ${blob.pathname}`);
                const response = await fetch(blob.url);
                if (!response.ok) {
                    console.warn(`[api/recipes]: Failed to fetch blob content for ${blob.pathname}, status: ${response.status}`);
                    continue;
                }
                const recipeData = await response.json();
                const validationResult = RecipeSchema.safeParse(recipeData);
                if (!validationResult.success) {
                    console.warn(`[api/recipes]: Skipping invalid recipe blob ${blob.pathname}:`, validationResult.error.errors);
                    continue;
                }
                const recipeId = blob.pathname.split('/').pop()?.replace('.json', '') || 'unknown';
                recipes.push({
                    ...validationResult.data,
                    id: recipeId
                });
            }
            catch (fetchError) {
                console.error(`[api/recipes]: Error fetching or parsing blob ${blob.pathname}:`, fetchError);
            }
        }
        console.log(`[api/recipes]: Returning ${recipes.length} valid recipes.`);
        return new Response(JSON.stringify(recipes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('[api/recipes]: Error listing blobs:', error);
        const message = error instanceof Error ? error.message : 'Failed to load recipes.';
        return new Response(JSON.stringify({ message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
//# sourceMappingURL=recipes.js.map