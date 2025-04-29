import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Recipe } from '../../src/types/recipe';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
// import { Readability } from '@mozilla/readability'; // Remove unused import
// import { JSDOM } from 'jsdom'; // Remove unused import
// import { STANDARD_UNITS } from '../../src/utils/constants'; // Remove unused import

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
  : null;

// Zod enum validation for units
const standardUnitsTuple: [string, ...string[]] = [
    '', // Need to list empty string first if it's allowed
    'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon', 
    'ml', 'l', 'oz', 'lb', 'g', 'kg', 
    'pinch', 'dash', 'clove', 'slice', 
    'servings' // Add 'servings'
];

// Schema for validating the request body
const ScrapeRequestSchema = z.object({
  url: z.string().url()
});

// Recipe schema for validation
const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(), // Already enforced
  unit: z.enum(standardUnitsTuple).optional(), // Use z.enum with updated tuple
});

const RecipeSchema = z.object({
  title: z.string().min(1),
  main: z.string().min(1),
  other: z.array(IngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  console.log(`[api/scrape-recipe]: POST request received`);
  
  // Check if OpenAI is configured
  if (!openai) {
    console.error('[api/scrape-recipe]: OpenAI API key not configured');
    return NextResponse.json({ 
      message: 'OpenAI service not configured. Add OPENAI_API_KEY to your environment variables.' 
    }, { status: 500 });
  }
  
  // Parse request body
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    console.error(`[api/scrape-recipe]: Error parsing JSON body:`, error);
    return NextResponse.json({ message: 'Invalid JSON in request body.' }, { status: 400 });
  }

  // Validate request body
  const validationResult = ScrapeRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    console.error('[api/scrape-recipe]: URL validation failed:', validationResult.error.flatten());
    return NextResponse.json(
      { message: 'Invalid URL provided.', errors: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const { url } = validationResult.data;
  console.log(`[api/scrape-recipe]: Attempting to scrape recipe from URL: ${url}`);

  try {
    // Step 1: Scrape the recipe content from the URL
    const recipeText = await scrapeRecipe(url);
    if (!recipeText) {
      throw new Error('Could not extract recipe content from the provided URL.');
    }
    console.log(`[api/scrape-recipe]: Successfully scraped ${recipeText.length} characters of recipe content`);
    console.log('\n--- START SCRAPED TEXT ---');
    console.log(recipeText);
    console.log('--- END SCRAPED TEXT ---\n');

    // Step 2: Get the LLM prompt
    const prompt = await getLLMPrompt();
    console.log(`[api/scrape-recipe]: Retrieved LLM prompt template`);

    // Step 3: Process the recipe with OpenAI
    const processedRecipe = await processRecipeWithOpenAI(recipeText, prompt);
    console.log(`[api/scrape-recipe]: Successfully processed recipe with OpenAI`);
    
    // Log the raw data to help with debugging
    console.log('[api/scrape-recipe]: Raw data from OpenAI:', JSON.stringify(processedRecipe));

    // Make sure processedRecipe has all required fields
    const sanitizedRecipe = {
      title: processedRecipe.title || 'Imported Recipe',
      main: processedRecipe.main || 'Main Ingredient',
      other: Array.isArray(processedRecipe.other) ? processedRecipe.other : [],
      instructions: Array.isArray(processedRecipe.instructions) ? processedRecipe.instructions : []
    };

    // Sanitize and PARSE quantities before validation
    if (sanitizedRecipe.other) {
      sanitizedRecipe.other = sanitizedRecipe.other
        .filter(ingredient => ingredient && typeof ingredient === 'object')
        .map(ingredient => {
          const name = typeof ingredient.name === 'string' ? ingredient.name.trim() : 'Ingredient';
          let unit = typeof ingredient.unit === 'string' ? ingredient.unit.trim() : '';
          
          // Normalize units: handle plurals and defaults
          const lowerUnit = unit.toLowerCase();
          if (lowerUnit === 'cups') {
            unit = 'cup';
          } else if (lowerUnit === 'tablespoons' || lowerUnit === 'tbsps') {
            unit = 'tbsp';
          } else if (lowerUnit === 'teaspoons' || lowerUnit === 'tsps') {
            unit = 'tsp';
          } else if (lowerUnit === 'grams' || lowerUnit === 'gram') {
            unit = 'g';
          } else if (lowerUnit === 'kilograms' || lowerUnit === 'kilogram') {
              unit = 'kg';
          } else if (lowerUnit === 'ounces' || lowerUnit === 'ounce') {
              unit = 'oz';
          } else if (lowerUnit === 'pounds' || lowerUnit === 'pound') {
              unit = 'lb';
          } else if (lowerUnit === 'milliliters' || lowerUnit === 'milliliter') {
              unit = 'ml';
          } else if (lowerUnit === 'liters' || lowerUnit === 'liter') {
              unit = 'l';
          } else if (lowerUnit === 'cloves') {
              unit = 'clove';
          } else if (lowerUnit === 'slices') {
              unit = 'slice';
          }
          
          // If unit is still not in the allowed list after normalization, default to 'servings'
          // Note: We check against the *original* tuple values (singular)
          if (!standardUnitsTuple.includes(unit)) {
            console.warn(`[api/scrape-recipe] Unrecognized unit: '${ingredient.unit}', defaulting to 'servings' for ingredient '${name}'`);
            unit = 'servings'; 
          }

          // Attempt to parse quantity, default to 1 if invalid/missing
          let quantity = 1; // Default quantity
          if (ingredient.quantity !== null && ingredient.quantity !== undefined) {
            // Explicitly check if it's a string before using string methods
            if (typeof ingredient.quantity === 'string') {
               const quantityString = ingredient.quantity as string; // Assert as string
               // Basic fraction handling (e.g., "1/2")
               if (quantityString.includes('/')) {
                   const parts = quantityString.split('/');
                   if (parts.length === 2) {
                       const num = parseFloat(parts[0]);
                       const den = parseFloat(parts[1]);
                       if (!isNaN(num) && !isNaN(den) && den !== 0) {
                           quantity = num / den;
                       } else {
                            console.warn(`[api/scrape-recipe] Invalid fraction: ${ingredient.quantity}, using 1`);
                            quantity = 1; // Fallback for invalid fraction
                       }
                   } else {
                        console.warn(`[api/scrape-recipe] Invalid fraction format: ${ingredient.quantity}, using 1`);
                        quantity = 1;
                   }
               } else {
                   const parsed = parseFloat(quantityString);
                   if (!isNaN(parsed)) {
                       quantity = parsed;
                   }
                }
            } else if (typeof ingredient.quantity === 'number') {
                // Handle if it's already a number
                 const parsed = parseFloat(String(ingredient.quantity));
                 if (!isNaN(parsed)) {
                    quantity = parsed;
                 }
            }
          }
          
          // Ensure quantity is positive
          quantity = Math.max(0.01, quantity); // Ensure at least a small positive number
          
          return { name, quantity, unit };
        })
        .filter(ingredient => ingredient.name.length > 0);
      
      // Ensure we have at least one ingredient
      if (sanitizedRecipe.other.length === 0) {
        sanitizedRecipe.other = [{ name: 'Main ingredient (please edit)', quantity: 1, unit: '' }];
      }
    }

    // Ensure the main ingredient is also in the 'other' list if not present
    if (sanitizedRecipe.main && sanitizedRecipe.main !== 'Main Ingredient' && Array.isArray(sanitizedRecipe.other)) {
      const mainIngredientNameLower = sanitizedRecipe.main.toLowerCase().trim();
      const mainExistsInOther = sanitizedRecipe.other.some(ing => ing.name.toLowerCase().trim() === mainIngredientNameLower);
      
      if (!mainExistsInOther) {
        console.log(`[api/scrape-recipe]: Adding main ingredient '${sanitizedRecipe.main}' to 'other' list.`);
        sanitizedRecipe.other.push({
          name: sanitizedRecipe.main, // Use the original casing for the name
          quantity: 1, // Default quantity
          unit: '' // Default unit
        });
      }
    }

    // Filter out any empty instruction steps
    if (sanitizedRecipe.instructions) {
      sanitizedRecipe.instructions = sanitizedRecipe.instructions
        .filter(step => typeof step === 'string' && step.trim().length > 0);
      
      // Ensure we have at least one instruction
      if (sanitizedRecipe.instructions.length === 0) {
        sanitizedRecipe.instructions = ['Preparation instructions (please edit)'];
      }
    }

    console.log('[api/scrape-recipe]: Sanitized recipe data (numeric quantities, main added to other):', JSON.stringify(sanitizedRecipe));

    // Step 4: Validate the sanitized recipe against our schema (which now expects number)
    const validationResult = RecipeSchema.safeParse(sanitizedRecipe);
    if (!validationResult.success) {
      console.error('[api/scrape-recipe]: Recipe validation failed:', validationResult.error.flatten());
      
      // Provide more specific error information to help debugging
      const errors = validationResult.error.flatten();
      const errorMsg = Object.entries(errors.fieldErrors)
        .map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`)
        .join('; ');
        
      throw new Error(`The processed recipe data does not match the expected format. Errors: ${errorMsg || 'unknown validation error'}`);
    }

    // Step 5: Return the validated recipe data
    return NextResponse.json(validationResult.data);
  } catch (error) {
    console.error(`[api/scrape-recipe]: Error processing recipe:`, error);
    const message = error instanceof Error ? error.message : 'Error processing recipe.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * Scrape recipe content from a URL using Cheerio first, then body text as fallback
 */
async function scrapeRecipe(url: string): Promise<string> {
  console.log(`[api/scrape-recipe]: Scraping URL: ${url}`);
  
  try {
    // Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      }
    });
    
    if (!response.data) {
      throw new Error('Failed to fetch content from URL.');
    }
    
    const html = response.data;
    let recipeText = '';
    let cheerioFoundBoth = false;

    // --- Try Cheerio First ---
    console.log('[api/scrape-recipe]: Attempting targeted extraction with Cheerio...');
    try {
      const $ = cheerio.load(html);
      
      // Remove potentially interfering elements
      $('script, style, noscript, header, footer, nav, aside, .comments-area, #comments, .sidebar, form, button, input').remove();

      let title = $('h1').first().text().trim();
      if (!title) title = $('meta[property="og:title"]').attr('content') || $('title').text();

      const ingredients: string[] = [];
      const instructions: string[] = [];

      const ingredientSelectors = [
        '[itemprop="recipeIngredient"]', '.wprm-recipe-ingredient', 
        '.tasty-recipes-ingredients li', '.easyrecipe-ingredient', 
        'ul[class*="ingredient"] li', '.recipe-ingredients li', '.ingredients li'
      ];
      const instructionSelectors = [
        '[itemprop="recipeInstructions"]', '.wprm-recipe-instruction', 
        '.tasty-recipes-instructions li', '.easyrecipe-instruction', 
        'ol[class*="instruction"] li', 'ol[class*="direction"] li', 
        '.recipe-instructions li', '.recipe-directions li', '.directions li', '.method li'
      ];

      const extractFromSelectors = (selectors: string[], targetArray: string[]) => {
        for (const selector of selectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`[api/scrape-recipe]: Cheerio found ${elements.length} elements with selector: ${selector}`);
            elements.each((i, el) => {
              const text = $(el).text().replace(/\s\s+/g, ' ').trim();
              if (text) targetArray.push(text);
            });
            return true; 
          }
        }
        return false;
      };

      const ingredientsFound = extractFromSelectors(ingredientSelectors, ingredients);
      const instructionsFound = extractFromSelectors(instructionSelectors, instructions);

      if (ingredientsFound && instructionsFound) {
        const cleanTitle = title.replace(/\s\s+/g, ' ').trim();
        recipeText = `${cleanTitle}\n\nIngredients:\n${ingredients.join('\n')}\n\nInstructions:\n${instructions.join('\n')}`;
        cheerioFoundBoth = true;
        console.log(`[api/scrape-recipe]: Successfully extracted structured text (${recipeText.length} chars) using Cheerio.`);
      } else {
        console.warn(`[api/scrape-recipe]: Cheerio did not find both ingredients and instructions via targeted selectors.`);
      }
    } catch (cheerioError) {
        console.error('[api/scrape-recipe]: Error during targeted Cheerio extraction:', cheerioError);
    }

    // --- Fallback to Body Text if Cheerio didn't find both --- 
    if (!cheerioFoundBoth) {
       console.warn('[api/scrape-recipe]: Falling back to body text extraction.');
       // Reload HTML or use original if Cheerio load modified it in place
       const $ = cheerio.load(html); 
       $('script, style, noscript, header, footer, nav, aside, form, button, input').remove(); // Basic cleanup for body text
       recipeText = $('body').text().replace(/\s\s+/g, ' ').trim();
       console.log(`[api/scrape-recipe]: Extracted ${recipeText.length} characters using body text fallback.`);
    }

    // Ensure recipeText is not empty
    if (!recipeText) {
        console.error('[api/scrape-recipe]: All scraping methods failed to produce text.');
        throw new Error('Failed to extract any meaningful content from the URL.');
    }

    return recipeText; // Return the best text found

  } catch (error) {
    console.error(`[api/scrape-recipe]: Error in scrapeRecipe function:`, error);
    throw new Error(`Failed to scrape recipe from URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the LLM prompt for recipe processing
 */
async function getLLMPrompt(): Promise<string> {
  // Define standard units here to include in the prompt
  // *** Ensure this list matches the tuple used for Zod validation! ***
  const allowedUnits = [
    'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon', 
    'ml', 'l', 'oz', 'lb', 'g', 'kg', 
    'pinch', 'dash', 'clove', 'slice', 
    // 'unit', // Remove unit
    'servings', // Add servings
    ''
  ];
  const allowedUnitsString = allowedUnits.map(u => u === '' ? `'' (empty string for unitless)` : `'${u}'`).join(', ');

  return `
You are a helpful assistant skilled in organizing cooking instructions.

Your task is to take a full recipe (from a blog or website) and output a clean, simplified JSON version. The output should follow this structure EXACTLY:

{
  "title": "The name of the recipe",
  "main": "The primary ingredient (e.g., chicken, tofu, ground beef) - just the ingredient name",
  "other": [
    { "name": "ingredient name", "quantity": "amount (e.g., 1, 1/2, 2.5)", "unit": "unit of measurement" },
    { "name": "next ingredient name", "quantity": "...", "unit": "..." }
  ],
  "instructions": ["Step-by-step cooking instructions in plain text"]
}

IMPORTANT GUIDELINES:
1. Ensure ALL properties for each ingredient exist: 'name' (non-empty string), 'quantity' (positive number), and 'unit' (string matching Guideline 5).
2. For the ingredient 'name', include necessary descriptive details from the original text (e.g., 'unsalted butter, melted', 'large onion, finely chopped', 'all-purpose flour, sifted'). Do not oversimplify the ingredient name itself.
3. NEVER leave "name" fields empty or blank.
4. If you're uncertain about a quantity or cannot parse it numerically, use the number '1' as a default value.
5. **CRITICAL: For the 'unit' field, you MUST map the unit to one of the following standard values: ${allowedUnitsString}. Normalize common variations (e.g., 'teaspoon' becomes 'tsp', 'pound' becomes 'lb', 'ounces' becomes 'oz'). If no standard unit clearly matches or if the ingredient is naturally unitless (like '1 egg'), use '' (an empty string). If there's a quantity but no unit is specified in the text and it's not obviously unitless, use 'servings' as the default.**
6. **CRITICAL: The 'quantity' field MUST be a positive JSON number (e.g., '1', '0.5', '2.75'), not a string.**
7. Remove any ingredients with empty or null name values.
8. Ensure "other" is always a valid array with at least one ingredient.
9. Ensure "instructions" is always a valid array with at least one instruction.

Focus on clarity and simplicity in the cooking **instructions** array. Remove brand names, product links, story content, or overly verbose language from the steps. Use plain English cooking instructions. However, for the **ingredient list**, preserve important descriptive details within the 'name' field as per Guideline #2.

Here is the raw recipe text:

[PASTED TEXT HERE]

Output only the final JSON that matches the expected format.
`;
}

/**
 * Process recipe text with OpenAI to extract structured data
 */
async function processRecipeWithOpenAI(recipeText: string, prompt: string): Promise<Omit<Recipe, 'id'>> {
  if (!openai) {
    throw new Error('OpenAI client not initialized.');
  }
  
  try {
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: recipeText }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned no content.');
    }
    
    try {
      // Parse the JSON response
      const parsedData = JSON.parse(content);
      
      // Add basic validation here
      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid response format: Not a valid object');
      }
      
      if (!parsedData.title || typeof parsedData.title !== 'string') {
        parsedData.title = 'Imported Recipe';
      }
      
      if (!parsedData.main || typeof parsedData.main !== 'string') {
        parsedData.main = 'Main Ingredient';
      }
      
      if (!Array.isArray(parsedData.other) || parsedData.other.length === 0) {
        parsedData.other = [{ name: 'Ingredient (please edit)', quantity: 1, unit: '' }];
      }
      
      if (!Array.isArray(parsedData.instructions) || parsedData.instructions.length === 0) {
        parsedData.instructions = ['Instructions (please edit)'];
      }
      
      return parsedData;
    } catch (jsonError) {
      console.error('[api/scrape-recipe]: Error parsing OpenAI response as JSON:', jsonError);
      console.error('[api/scrape-recipe]: Raw content received:', content);
      throw new Error('Failed to parse OpenAI response as JSON. The API may have returned an invalid format.');
    }
  } catch (error) {
    console.error('[api/scrape-recipe]: Error from OpenAI API:', error);
    throw error;
  }
}

/**
 * Extract recipe data from HTML content
 * This is a simplified version that uses basic string manipulation
 * A production version would use more sophisticated parsing techniques
 * 
 * @deprecated This function is not currently used; recipe extraction is handled by the OpenAI model
 */
function _extractRecipeData(html: string, sourceUrl: string): Omit<Recipe, 'id'> {
  console.log(`[api/scrape-recipe]: Extracting recipe data from HTML content`);
  
  // Basic extraction logic - this is just a placeholder
  // In a real implementation, you'd use JSON-LD parsing, HTML parsing libraries, etc.
  
  // Search for a recipe title - looking for common patterns
  const title = extractMetaTag(html, 'og:title') || 
              extractMetaTag(html, 'twitter:title') || 
              extractByClass(html, 'recipe-title') ||
              extractByClass(html, 'entry-title') ||
              'Imported Recipe';
  
  // Extract main ingredient (using the first found ingredient or a default)
  const mainIngredient = extractFirstIngredient(html) || 'Main Ingredient';
  
  // Extract other ingredients
  const ingredients = extractIngredients(html);
  const otherIngredients = ingredients.slice(1).map(name => ({
    name, 
    quantity: 1, 
    unit: ''
  }));
  
  // If no ingredients were found, add a placeholder
  if (otherIngredients.length === 0) {
    otherIngredients.push({
      name: 'Ingredient (please edit)',
      quantity: 1,
      unit: ''
    });
  }
  
  // Extract instructions
  const instructions = extractInstructions(html);
  
  // If no instructions were found, add a placeholder
  if (instructions.length === 0) {
    instructions.push('Step 1: Prepare the ingredients');
    instructions.push('Step 2: Cook according to preference');
    instructions.push(`Imported from: ${sourceUrl}`);
  } else {
    // Add source URL as the last instruction
    instructions.push(`Imported from: ${sourceUrl}`);
  }
  
  console.log(`[api/scrape-recipe]: Extracted recipe data with title: "${title}"`);
  
  return {
    title: sanitizeText(title),
    main: sanitizeText(mainIngredient),
    other: otherIngredients,
    instructions: instructions.map(sanitizeText)
  };
}

/**
 * Helper functions for extracting data from HTML
 */

// Extract content from meta tags
function extractMetaTag(html: string, property: string): string | null {
  const regex = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

// Extract content by class name (very basic implementation)
function extractByClass(html: string, className: string): string | null {
  const regex = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([^<]+)`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

// Extract the first ingredient
function extractFirstIngredient(html: string): string | null {
  // Look for common ingredient list patterns
  const ingredientListRegex = /<ul[^>]*class=["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i;
  const ingredientListMatch = html.match(ingredientListRegex);
  
  if (ingredientListMatch && ingredientListMatch[1]) {
    const ingredientItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/i;
    const ingredientMatch = ingredientListMatch[1].match(ingredientItemRegex);
    
    if (ingredientMatch && ingredientMatch[1]) {
      return stripHtmlTags(ingredientMatch[1]).trim();
    }
  }
  
  return null;
}

// Extract all ingredients
function extractIngredients(html: string): string[] {
  const ingredients: string[] = [];
  
  // Look for ingredient lists
  const ingredientListRegex = /<ul[^>]*class=["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i;
  const ingredientListMatch = html.match(ingredientListRegex);
  
  if (ingredientListMatch && ingredientListMatch[1]) {
    const ingredientItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    
    while ((match = ingredientItemRegex.exec(ingredientListMatch[1])) !== null) {
      if (match[1]) {
        ingredients.push(stripHtmlTags(match[1]).trim());
      }
    }
  }
  
  // If no ingredients found through class, try JSON-LD structured data
  if (ingredients.length === 0) {
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
    const jsonLdMatch = html.match(jsonLdRegex);
    
    if (jsonLdMatch && jsonLdMatch[1]) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData.recipeIngredient && Array.isArray(jsonData.recipeIngredient)) {
          return jsonData.recipeIngredient;
        }
      } catch (e) {
        console.error('[api/scrape-recipe]: Error parsing JSON-LD:', e);
      }
    }
  }
  
  // If still no ingredients, add placeholders
  if (ingredients.length === 0) {
    ingredients.push('Main Ingredient');
    ingredients.push('Secondary Ingredient');
  }
  
  return ingredients;
}

// Extract instructions
function extractInstructions(html: string): string[] {
  const instructions: string[] = [];
  
  // Look for instruction lists
  const instructionListRegex = /<ol[^>]*class=["'][^"']*instruction[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i;
  const instructionListMatch = html.match(instructionListRegex);
  
  if (instructionListMatch && instructionListMatch[1]) {
    const instructionItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    
    while ((match = instructionItemRegex.exec(instructionListMatch[1])) !== null) {
      if (match[1]) {
        instructions.push(stripHtmlTags(match[1]).trim());
      }
    }
  }
  
  // If no instructions found through class, try JSON-LD structured data
  if (instructions.length === 0) {
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
    const jsonLdMatch = html.match(jsonLdRegex);
    
    if (jsonLdMatch && jsonLdMatch[1]) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        
        // Handle different structured data formats
        if (jsonData.recipeInstructions) {
          if (Array.isArray(jsonData.recipeInstructions)) {
            jsonData.recipeInstructions.forEach((instruction: string | { text: string }) => {
              if (typeof instruction === 'string') {
                instructions.push(instruction);
              } else if (instruction.text) {
                instructions.push(instruction.text);
              }
            });
          }
        }
      } catch (e) {
        console.error('[api/scrape-recipe]: Error parsing JSON-LD:', e);
      }
    }
  }
  
  return instructions;
}

// Strip HTML tags from a string
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// Sanitize text to remove problematic characters
function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
} 