// Simple script to generate a meal plan
require('dotenv').config({ path: '.env.development.local' });
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log('Starting meal plan generation...');
    
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
    console.log('Saving meal plan to Redis...');
    await redis.set('mealplan:current', mealPlan);
    console.log('Meal plan saved successfully!');
    
    // Print a summary
    console.log('\nMeal Plan Summary:');
    console.log('=================');
    for (let i = 0; i < selectedRecipes.length; i++) {
      console.log(`Day ${i + 1}: ${selectedRecipes[i].title}`);
    }
    
  } catch (error) {
    console.error('Error in meal plan generator:', error);
    process.exit(1);
  }
}

main(); 