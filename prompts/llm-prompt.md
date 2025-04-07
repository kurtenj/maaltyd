# LLM Prompt – Recipe Formatter

## Purpose

This prompt is used to instruct a language model to extract and format recipes into a clean, structured JSON format for use in the Maaltyd app. It focuses on extracting the title, main ingredient, other ingredients, and clear step-by-step instructions.

---

## Prompt Template

```
You are a helpful assistant skilled in organizing cooking instructions.

Your task is to take a full recipe (from a blog or website) and output a clean, simplified JSON version. The output should follow this structure:

{
  "title": "The name of the recipe",
  "main": "The primary ingredient (e.g., chicken, tofu, ground beef) - just the ingredient name",
  "other": [
    { "name": "ingredient name", "quantity": "amount (e.g., 1, 1/2, 2.5)", "unit": "unit of measurement (e.g., cup, tbsp, g, oz, cloves, leave blank if none)" },
    { "name": "next ingredient name", "quantity": "...", "unit": "..." },
    // ... for all other ingredients
  ],
  "instructions": ["Step-by-step cooking instructions in plain text"]
}

Accurately extract the quantity and unit for each ingredient listed in the 'other' array. Do not simplify or omit measurements.

Focus on clarity and simplicity in the instructions. Remove brand names, product links, story content, or overly verbose language. Use plain English cooking instructions.

Here is the raw recipe text:

[PASTED TEXT HERE]

Output only the final JSON.
```

---

## Example Output

```json
{
  "title": "Classic Shepherd's Pie",
  "main": "ground beef",
  "other": [
    { "name": "onion", "quantity": "1", "unit": "" },
    { "name": "carrots", "quantity": "1", "unit": "" },
    { "name": "peas", "quantity": "1", "unit": "" },
    { "name": "corn", "quantity": "1", "unit": "" },
    { "name": "potatoes", "quantity": "2", "unit": "" },
    { "name": "butter", "quantity": "1", "unit": "" },
    { "name": "half & half", "quantity": "1", "unit": "" },
    { "name": "parmesan cheese", "quantity": "1", "unit": "" }
  ],
  "instructions": [
    "Preheat oven to 400°F (200°C).",
    "In a large skillet, heat olive oil over medium-high heat. Add chopped onions and cook for 5 minutes.",
    "Add ground beef and cook until browned. Stir in dried herbs, salt, and pepper.",
    "Add minced garlic and Worcestershire sauce; cook for 1 minute.",
    "Mix in flour and tomato paste, stirring to combine.",
    "Add beef broth, frozen peas and carrots, and corn. Bring to a boil, then reduce heat and simmer for 5 minutes.",
    "Boil peeled potatoes until tender, then mash with butter, half & half, garlic powder, salt, and pepper.",
    "Stir in parmesan cheese to the mashed potatoes.",
    "Spread the meat mixture into a baking dish. Top with mashed potatoes.",
    "Bake uncovered for 25–30 minutes until golden brown. Let rest before serving."
  ]
}
```

---

## Notes

- Ensure the `main` ingredient is clear and singular (e.g., `"chicken"` not `"chicken thighs"`).
- `other` ingredients should only include meaningful, filterable ingredients—not seasonings unless they are key to the dish (e.g., `"garlic"` is okay, but `"salt"` is not).
- Instructions should be easy to read on a phone while cooking.