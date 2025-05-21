import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' }); // Ensure this path is correct for your setup

import { NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

// --- Logger ---
const logger = {
  log: (...args: any[]) => console.log('[api/process-recipe-image]', ...args),
  error: (...args: any[]) => console.error('[api/process-recipe-image]', ...args),
  warn: (...args: any[]) => console.warn('[api/process-recipe-image]', ...args),
};

// --- Initialize OpenAI Client ---
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
  : null;

if (!openai) {
  logger.error('OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.');
}

// --- Zod Schemas (Copied and adapted from api/scrape-recipe/index.ts) ---
const standardUnitsTuple: [string, ...string[]] = [
    '', 'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon', 
    'ml', 'l', 'oz', 'lb', 'g', 'kg', 
    'pinch', 'dash', 'clove', 'slice', 
    'servings' 
];

const IngredientSchema = z.object({
  name: z.string().min(1, "Ingredient name cannot be empty."),
  quantity: z.number().positive("Quantity must be a positive number."),
  unit: z.enum(standardUnitsTuple).optional().default(''), // Default to empty string if undefined
});

const RecipeSchema = z.object({
  title: z.string().min(1, "Recipe title cannot be empty."),
  main: z.string().min(1, "Main ingredient cannot be empty."),
  other: z.array(IngredientSchema).min(1, "Recipe must have at least one ingredient in 'other'."),
  instructions: z.array(z.string().min(1, "Instruction step cannot be empty.")).min(1, "Recipe must have at least one instruction."),
});

// Type for the expected recipe structure from OpenAI (before full validation and id)
type RawRecipeOutput = Omit<z.infer<typeof RecipeSchema>, 'id'>;

// --- Helper Function for Error Handling (Simplified tryCatch for NextApiResponse) ---
async function tryCatchNextResponse<T>(
  fn: () => Promise<NextResponse<T> | NextResponse<{ message: string }>>
): Promise<NextResponse<T> | NextResponse<{ message: string }>> {
  try {
    return await fn();
  } catch (error: unknown) {
    logger.error('An unexpected error occurred:', error);
    const message = error instanceof Error ? error.message : 'An unexpected internal server error occurred.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// --- Main POST Handler ---
export async function POST(request: Request): Promise<NextResponse> {
  return tryCatchNextResponse(async () => {
    logger.log('POST request received');

    if (!openai) {
      logger.error('OpenAI service not configured.');
      return NextResponse.json({ 
        message: 'OpenAI service not configured. Add OPENAI_API_KEY to your environment variables.' 
      }, { status: 500 });
    }

    // Step 1: Parse FormData
    let formData;
    try {
      formData = await request.formData();
    } catch (error) {
      logger.error('Error parsing FormData:', error);
      return NextResponse.json({ message: 'Invalid request format: Could not parse FormData.' }, { status: 400 });
    }
    
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      logger.warn('No image file provided in the "image" field.');
      return NextResponse.json({ message: 'No image file provided in the "image" field.' }, { status: 400 });
    }

    // Validate file type (basic check)
    if (!imageFile.type.startsWith('image/')) {
      logger.warn(`Invalid file type: ${imageFile.type}. Only images are allowed.`);
      return NextResponse.json({ message: `Invalid file type: ${imageFile.type}. Only images are allowed.` }, { status: 400 });
    }
    
    logger.log(`Received image: ${imageFile.name}, type: ${imageFile.type}, size: ${imageFile.size} bytes`);

    // Step 2: Convert image to base64
    let imageBase64: string;
    try {
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      imageBase64 = imageBuffer.toString('base64');
      logger.log('Image successfully converted to base64.');
    } catch (error) {
      logger.error('Error converting image to base64:', error);
      return NextResponse.json({ message: 'Error processing image file.' }, { status: 500 });
    }

    // Step 3: Image-to-JSON with GPT-4o
    const imagePrompt = getRecipeImageLLMPrompt();
    
    logger.log('Sending request to OpenAI GPT-4o...');
    let openAIResponseContent: string | null;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Use the GPT-4o model
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: imagePrompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:${imageFile.type};base64,${imageBase64}`,
                  detail: "low" // Use "low" detail for faster processing if full resolution isn't critical
                } 
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Lower temperature for more deterministic JSON output
      });

      openAIResponseContent = completion.choices[0]?.message?.content;
      if (!openAIResponseContent) {
        logger.error('OpenAI returned no content.');
        throw new Error('OpenAI returned no content.');
      }
      logger.log('Received response from OpenAI.');
    } catch (error) {
      logger.error('Error calling OpenAI API:', error);
      const message = error instanceof Error && error.message.includes('insufficient_quota')
        ? 'OpenAI API request failed due to insufficient quota. Please check your billing details.'
        : `Error communicating with OpenAI: ${error instanceof Error ? error.message : String(error)}`;
      return NextResponse.json({ message }, { status: 503 }); // 503 Service Unavailable
    }

    // Step 4: Parse and Sanitize Data
    let parsedRecipe: any;
    try {
      parsedRecipe = JSON.parse(openAIResponseContent);
      logger.log('Successfully parsed OpenAI JSON response.');
    } catch (jsonError) {
      logger.error('Error parsing OpenAI response as JSON:', jsonError);
      logger.error('Raw content received from OpenAI:', openAIResponseContent);
      return NextResponse.json({ 
        message: 'Failed to parse recipe data from AI. The format was invalid.',
        details: openAIResponseContent // Optionally send back raw content for debugging
      }, { status: 500 });
    }

    // Step 4b: Sanitize the parsed data (RawRecipeOutput type is expected by sanitizeRecipeData)
    const sanitizedRecipeData = sanitizeRecipeData(parsedRecipe as RawRecipeOutput);
    logger.log('Sanitized recipe data:', JSON.stringify(sanitizedRecipeData, null, 2));

    // Step 5: Validate the sanitized recipe
    const validationResult = RecipeSchema.safeParse(sanitizedRecipeData);
    if (!validationResult.success) {
      logger.error('Recipe validation failed after sanitization:', validationResult.error.flatten());
      const errors = validationResult.error.flatten();
      const errorMsg = Object.entries(errors.fieldErrors)
        .map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`)
        .join('; ');
      return NextResponse.json({ 
        message: `The extracted recipe data does not match the required format. Errors: ${errorMsg || 'Unknown validation error.'}`,
        details: errors
      }, { status: 400 });
    }

    logger.log('Recipe validated successfully.');
    return NextResponse.json(validationResult.data);
  });
}

// --- LLM Prompt Function ---
function getRecipeImageLLMPrompt(): string {
  const allowedUnitsString = standardUnitsTuple.map(u => u === '' ? `'' (empty string for unitless items like '1 egg')` : `'${u}'`).join(', ');

  return `
You are an expert culinary assistant specialized in interpreting images of recipes and converting them into structured JSON format.
Analyze the provided image, which could be a photo of a cookbook page, a handwritten recipe card, or a screenshot.
Extract the recipe details and return a clean, simplified JSON object.

The JSON output MUST follow this EXACT structure:
{
  "title": "The full name of the recipe",
  "main": "The single primary ingredient (e.g., chicken, salmon, tofu, broccoli). Be concise.",
  "other": [
    { "name": "Full ingredient description including preparation (e.g., 'large red onion, finely chopped', 'unsalted butter, melted', 'all-purpose flour, sifted')", "quantity": 1, "unit": "tsp" }
  ],
  "instructions": ["First step of the recipe.", "Second step of the recipe.", "..."]
}

CRITICAL GUIDELINES FOR JSON OUTPUT:
1.  **TITLE ("title")**: Must be a non-empty string. Extract the most prominent title. If unclear, use a descriptive placeholder like "Recipe from Image".
2.  **MAIN INGREDIENT ("main")**: Must be a non-empty string. Identify the single most central ingredient. If multiple are prominent, pick one or use a general term like "Mixed Vegetables".
3.  **OTHER INGREDIENTS ("other")**:
    *   Must be an array of objects, with at least one ingredient. If no ingredients are clearly visible, provide a placeholder: \`[{ "name": "Ingredient from image (please verify)", "quantity": 1, "unit": "" }]\`.
    *   Each ingredient object MUST have three properties:
        *   **"name"**: A non-empty string. Capture the full ingredient name and any relevant preparation details (e.g., "2 large eggs, lightly beaten", "1 cup chopped walnuts", "fresh parsley, chopped, for garnish").
        *   **"quantity"**: A positive JSON number (e.g., 1, 0.5, 2.75). If a quantity is unclear or written as text (e.g., "a pinch"), try to infer a sensible number (e.g., 0.25 for "a pinch") or default to 1 if truly ambiguous. NEVER use a string for quantity.
        *   **"unit"**: A string that MUST be one of these exact values: ${allowedUnitsString}. Normalize common variations (e.g., "tablespoons" to "tbsp", "grams" to "g"). If an ingredient is unitless (e.g., "1 lemon"), use an empty string \`""\`. If a unit is present but not on the list, try to map it to the closest equivalent or use \`""\` if no clear match.
4.  **INSTRUCTIONS ("instructions")**:
    *   Must be an array of strings, with at least one instruction. If no instructions are visible, provide a placeholder: \`["See image for instructions (please verify)."]\`.
    *   Each string should be a distinct step.
    *   Extract instructions as accurately as possible. Preserve the original meaning and steps.
5.  **GENERAL JSON RULES**:
    *   Ensure the entire output is a single valid JSON object.
    *   Do not include any text or explanations outside of the main JSON structure.
    *   Pay close attention to commas, brackets, and braces.

If the image is blurry, unreadable, or not a recipe, try your best to return the basic JSON structure with placeholder text indicating the issue, for example:
{
  "title": "Unclear Recipe from Image",
  "main": "Unknown",
  "other": [{ "name": "Could not decipher ingredients from image", "quantity": 1, "unit": "" }],
  "instructions": ["Could not decipher instructions from image."]
}

Focus on accuracy. Do not add ingredients or steps that are not visible or clearly implied by the image.
Output ONLY the JSON.
`;
}

// --- Sanitization and Normalization Functions (Adapted from api/scrape-recipe) ---
function normalizeUnit(unitString: string | undefined | null): string {
  if (!unitString) return '';
  const lowerUnit = unitString.toLowerCase().trim();

  const unitMap: Record<string, string> = {
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsps': 'tsp',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsps': 'tbsp',
    'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
    'cup': 'cup', 'cups': 'cup',
    'pint': 'pint', 'pints': 'pint',
    'quart': 'quart', 'quarts': 'quart',
    'gallon': 'gallon', 'gallons': 'gallon',
    'milliliter': 'ml', 'milliliters': 'ml', 'mls': 'ml',
    'liter': 'l', 'liters': 'l',
    'ounce': 'oz', 'ounces': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb',
    'gram': 'g', 'grams': 'g', 'gs': 'g',
    'kilogram': 'kg', 'kilograms': 'kg', 'kgs': 'kg',
    'clove': 'clove', 'cloves': 'clove',
    'slice': 'slice', 'slices': 'slice',
    'pinch': 'pinch', 'pinches': 'pinch',
    'dash': 'dash', 'dashes': 'dash',
    'serving': 'servings', 'servings': 'servings',
  };

  const normalized = unitMap[lowerUnit];
  if (normalized && standardUnitsTuple.includes(normalized as (typeof standardUnitsTuple)[number])) {
    return normalized;
  }
  // If it's already a standard unit (or empty string)
  if (standardUnitsTuple.includes(lowerUnit as (typeof standardUnitsTuple)[number])) {
    return lowerUnit;
  }
  
  logger.warn(`Unrecognized unit: '${unitString}', defaulting to empty string after trying to map.`);
  return ''; // Default for unrecognized units after mapping attempt
}

function normalizeQuantity(quantityValue: any): number {
  if (typeof quantityValue === 'number' && quantityValue > 0) {
    return quantityValue;
  }
  if (typeof quantityValue === 'string') {
    const quantityString = quantityValue.trim();
    // Handle fractions like "1/2", "3/4"
    if (quantityString.includes('/')) {
      const parts = quantityString.split('/');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          const result = num / den;
          return result > 0 ? result : 0.01; // Ensure positive
        }
      }
    }
    // Handle ranges like "1-2", take the first number or average
    if (quantityString.includes('-')) {
        const parts = quantityString.split('-');
        const firstNum = parseFloat(parts[0]);
        if (!isNaN(firstNum) && firstNum > 0) return firstNum;
    }
    // Handle mixed numbers like "1 1/2"
    const mixedMatch = quantityString.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
        const whole = parseInt(mixedMatch[1], 10);
        const num = parseInt(mixedMatch[2], 10);
        const den = parseInt(mixedMatch[3], 10);
        if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
            const result = whole + (num / den);
            return result > 0 ? result : 0.01;
        }
    }
    const parsed = parseFloat(quantityString);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  logger.warn(`Could not parse quantity: '${quantityValue}', defaulting to 1.`);
  return 1; // Default quantity
}

function sanitizeRecipeData(data: any): Partial<RawRecipeOutput> {
  if (!data || typeof data !== 'object') {
    logger.warn('Raw data from AI is not an object. Returning default structure.');
    return {
      title: 'Imported Recipe (Processing Error)',
      main: 'Main Ingredient (Processing Error)',
      other: [{ name: 'Ingredient (Processing Error)', quantity: 1, unit: '' }],
      instructions: ['Instructions (Processing Error)'],
    };
  }

  const title = typeof data.title === 'string' && data.title.trim() !== '' ? data.title.trim() : 'Untitled Recipe from Image';
  const main = typeof data.main === 'string' && data.main.trim() !== '' ? data.main.trim() : 'Main Ingredient (From Image)';

  let other: z.infer<typeof IngredientSchema>[] = [];
  if (Array.isArray(data.other)) {
    other = data.other
      .map((ing: any) => {
        if (!ing || typeof ing !== 'object') return null;
        const name = typeof ing.name === 'string' ? ing.name.trim() : '';
        if (!name) return null; // Skip ingredients with no name

        return {
          name: name,
          quantity: normalizeQuantity(ing.quantity),
          unit: normalizeUnit(ing.unit),
        };
      })
      .filter((ing): ing is z.infer<typeof IngredientSchema> => ing !== null && ing.name !== '');
  }
  
  if (other.length === 0) {
    other = [{ name: 'Ingredient from Image (please verify)', quantity: 1, unit: '' }];
  }

  // Ensure the main ingredient is in 'other' if not already present by name (case-insensitive)
  const mainLower = main.toLowerCase();
  if (!other.some(ing => ing.name.toLowerCase() === mainLower)) {
      other.push({ name: main, quantity: 1, unit: normalizeUnit('') });
      logger.log(`Main ingredient "${main}" was not found in 'other' list, adding it.`);
  }


  let instructions: string[] = [];
  if (Array.isArray(data.instructions)) {
    instructions = data.instructions
      .map((step: any) => (typeof step === 'string' ? step.trim() : ''))
      .filter(step => step !== '');
  }
  if (instructions.length === 0) {
    instructions = ['See image for instructions (please verify).'];
  }
  
  return { title, main, other, instructions };
}
