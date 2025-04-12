// Simple script to generate a meal plan
require('dotenv').config({ path: '.env.development.local' });
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

// Initialize Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function main() {
  console.log('Starting meal plan generation script...');
  
  try {
    // 1. Fetch recipes from the recipes API or local file
    let recipes = [];
    try {
      const response = await fetch('http://localhost:3000/api/recipes');
      if (!response.ok) {
        throw new Error(`Failed to fetch recipes: ${response.status}`);
      }
      recipes = await response.json();
      console.log(`Fetched ${recipes.length} recipes from API`);
    } catch (fetchError) {
      console.error('Error fetching recipes, trying local file:', fetchError);
      // Try to read sample data from a local file
      const data = fs.readFileSync(path.join(__dirname, 'sample-recipes.json'), 'utf8');
      recipes = JSON.parse(data);
      console.log(`Loaded ${recipes.length} recipes from local file`);
    }
    
    if (recipes.length === 0) {
      throw new Error('No recipes available to generate a meal plan');
    }
    
    // 2. Generate a simple meal plan
    console.log('Generating meal plan...');
    const selectedRecipes = [];
    for (let i = 0; i < 7; i++) {
      const randomIndex = Math.floor(Math.random() * recipes.length);
      selectedRecipes.push(recipes[randomIndex]);
    }
    
    // 3. Create a simplified shopping list
    const shoppingList = [];
    const ingredients = new Map();
    
    // Collect ingredients
    for (const recipe of selectedRecipes) {
      if (recipe.other && Array.isArray(recipe.other)) {
        for (const ingredient of recipe.other) {
          const name = ingredient.name.toLowerCase();
          if (!ingredients.has(name)) {
            ingredients.set(name, {
              name,
              quantity: 1,
              unit: ingredient.unit || '',
              acquired: false
            });
          } else {
            const existing = ingredients.get(name);
            existing.quantity += 1;
          }
        }
      }
    }
    
    // Convert Map to array for shopping list
    for (const [_, value] of ingredients) {
      shoppingList.push(value);
    }
    
    // 4. Create the complete meal plan object
    const mealPlan = {
      recipes: selectedRecipes,
      shoppingList
    };
    
    // 5. Save to Redis
    console.log('Saving meal plan to Redis...');
    await redis.set('mealplan:current', mealPlan);
    console.log('Meal plan saved successfully!');
    
    // Print a summary
    console.log('\nMeal Plan Summary:');
    console.log('=================');
    for (let i = 0; i < selectedRecipes.length; i++) {
      console.log(`Day ${i + 1}: ${selectedRecipes[i].title}`);
    }
    console.log('\nShopping List:');
    console.log('=============');
    for (const item of shoppingList) {
      console.log(`- ${item.name} (${item.quantity} ${item.unit})`);
    }
    
  } catch (error) {
    console.error('Error in meal plan generator:', error);
    process.exit(1);
  }
}

main(); 