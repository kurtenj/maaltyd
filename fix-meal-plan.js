// Quick fix for meal plan issues
require('dotenv').config({ path: '.env.development.local' });
const { Redis } = require('@upstash/redis');

async function main() {
  try {
    console.log('Starting meal plan fix...');
    
    // 1. Initialize Redis connection
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    
    // 2. Fetch all recipes
    const recipes = await redis.get('recipes');
    
    if (!recipes || recipes.length === 0) {
      console.error('No recipes found in database');
      process.exit(1);
    }
    
    console.log(`Found ${recipes.length} recipes`);
    
    // 3. Select 7 random recipes
    const selectedRecipes = [];
    for (let i = 0; i < 7; i++) {
      const randomIndex = Math.floor(Math.random() * recipes.length);
      selectedRecipes.push(recipes[randomIndex]);
    }
    
    // 4. Create the complete meal plan object
    const mealPlan = {
      recipes: selectedRecipes
    };
    
    // 5. Save to Redis
    console.log('Saving fixed meal plan to Redis...');
    await redis.set('mealplan:current', mealPlan);
    console.log('Meal plan fixed and saved successfully!');
    
    // Print a summary
    console.log('\nFixed Meal Plan Summary:');
    console.log('=======================');
    for (let i = 0; i < selectedRecipes.length; i++) {
      console.log(`Day ${i + 1}: ${selectedRecipes[i].title}`);
    }
    
  } catch (error) {
    console.error('Error in meal plan fix:', error);
    process.exit(1);
  }
}

// Run the function
main(); 