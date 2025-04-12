// Quick fix for meal plan issues
require('dotenv').config({ path: '.env.development.local' });
const { Redis } = require('@upstash/redis');

// Sample recipes to use if we can't fetch from API
const SAMPLE_RECIPES = [
  {
    id: "sample1",
    title: "Pasta Carbonara",
    main: "Pasta",
    other: [
      { name: "spaghetti", quantity: "1", unit: "pound" },
      { name: "eggs", quantity: "4", unit: "" },
      { name: "bacon", quantity: "8", unit: "slices" },
      { name: "parmesan", quantity: "1", unit: "cup" },
      { name: "black pepper", quantity: "1", unit: "tsp" }
    ],
    instructions: ["Cook pasta", "Fry bacon", "Mix eggs with cheese", "Combine all ingredients"]
  },
  {
    id: "sample2",
    title: "Roast Chicken",
    main: "Chicken",
    other: [
      { name: "whole chicken", quantity: "1", unit: "" },
      { name: "olive oil", quantity: "2", unit: "tbsp" },
      { name: "rosemary", quantity: "2", unit: "sprigs" },
      { name: "garlic", quantity: "4", unit: "cloves" },
      { name: "salt", quantity: "1", unit: "tsp" }
    ],
    instructions: ["Preheat oven", "Season chicken", "Roast for 1.5 hours", "Let rest before serving"]
  },
  {
    id: "sample3",
    title: "Beef Stir Fry",
    main: "Beef",
    other: [
      { name: "beef strips", quantity: "1", unit: "pound" },
      { name: "bell peppers", quantity: "2", unit: "" },
      { name: "broccoli", quantity: "2", unit: "cups" },
      { name: "soy sauce", quantity: "3", unit: "tbsp" },
      { name: "ginger", quantity: "1", unit: "tbsp" }
    ],
    instructions: ["Marinate beef", "Stir fry vegetables", "Add beef", "Season and serve"]
  },
  {
    id: "sample4",
    title: "Vegetable Curry",
    main: "Vegetable",
    other: [
      { name: "potatoes", quantity: "2", unit: "large" },
      { name: "carrots", quantity: "2", unit: "" },
      { name: "curry powder", quantity: "2", unit: "tbsp" },
      { name: "coconut milk", quantity: "1", unit: "can" },
      { name: "onion", quantity: "1", unit: "large" }
    ],
    instructions: ["Dice vegetables", "Sauté onions", "Add curry powder", "Simmer with coconut milk", "Serve over rice"]
  },
  {
    id: "sample5",
    title: "Salmon with Lemon",
    main: "Salmon",
    other: [
      { name: "salmon fillets", quantity: "4", unit: "" },
      { name: "lemon", quantity: "1", unit: "" },
      { name: "dill", quantity: "2", unit: "tbsp" },
      { name: "butter", quantity: "2", unit: "tbsp" },
      { name: "salt", quantity: "1", unit: "tsp" }
    ],
    instructions: ["Preheat oven", "Season salmon", "Bake for 15 minutes", "Garnish with lemon and serve"]
  },
  {
    id: "sample6",
    title: "Mushroom Risotto",
    main: "Rice",
    other: [
      { name: "arborio rice", quantity: "1", unit: "cup" },
      { name: "mushrooms", quantity: "8", unit: "oz" },
      { name: "onion", quantity: "1", unit: "small" },
      { name: "white wine", quantity: "1/2", unit: "cup" },
      { name: "vegetable broth", quantity: "4", unit: "cups" }
    ],
    instructions: ["Sauté mushrooms and onions", "Add rice", "Gradually add broth", "Stir until creamy", "Finish with cheese"]
  },
  {
    id: "sample7",
    title: "Tacos",
    main: "Beef",
    other: [
      { name: "ground beef", quantity: "1", unit: "pound" },
      { name: "taco seasoning", quantity: "1", unit: "packet" },
      { name: "tortillas", quantity: "8", unit: "" },
      { name: "lettuce", quantity: "1", unit: "cup" },
      { name: "tomato", quantity: "1", unit: "" }
    ],
    instructions: ["Brown beef", "Add seasoning", "Warm tortillas", "Assemble tacos with toppings"]
  }
];

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

async function saveSampleMealPlan() {
  console.log('Creating and saving a sample meal plan...');
  
  try {
    // Use our sample recipes to create a meal plan
    const selectedRecipes = [...SAMPLE_RECIPES]; // Use all 7 sample recipes
    
    // Create shopping list
    const shoppingList = [];
    const ingredients = new Map();
    
    for (const recipe of selectedRecipes) {
      if (recipe.other && Array.isArray(recipe.other)) {
        for (const ing of recipe.other) {
          const name = ing.name.toLowerCase();
          if (!ingredients.has(name)) {
            ingredients.set(name, {
              name,
              quantity: 1,
              unit: ing.unit || '',
              acquired: false
            });
          } else {
            ingredients.get(name).quantity += 1;
          }
        }
      }
    }
    
    // Convert Map to array
    for (const [_, item] of ingredients) {
      shoppingList.push(item);
    }
    
    // Create meal plan object
    const mealPlan = {
      recipes: selectedRecipes,
      shoppingList
    };
    
    // Save to Redis
    console.log('Saving meal plan to Redis...');
    await redis.set('mealplan:current', mealPlan);
    console.log('Meal plan saved successfully!');
    
    // Print summary
    console.log('\nMeal Plan Summary:');
    console.log('=================');
    for (let i = 0; i < selectedRecipes.length; i++) {
      console.log(`Day ${i + 1}: ${selectedRecipes[i].title}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error saving meal plan:', error);
    process.exit(1);
  }
}

// Run the function
saveSampleMealPlan(); 