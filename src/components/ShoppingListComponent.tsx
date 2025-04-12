import React, { useMemo } from 'react';
import type { ShoppingListItem } from '../types/mealPlan';

interface ShoppingListComponentProps {
  shoppingList: ShoppingListItem[];
  onToggleItem: (itemName: string, currentStatus: boolean) => void;
  disabled?: boolean;
}

// Common food categories for grouping items
type FoodCategory = 'Produce' | 'Dairy' | 'Meat' | 'Grains' | 'Canned Goods' | 'Spices' | 'Other';

// Simple categorization logic
const categorizeItem = (itemName: string): FoodCategory => {
  const name = itemName.toLowerCase();
  
  // Produce
  if (/lettuce|tomato|potato|onion|garlic|carrot|pepper|broccoli|spinach|fruit|apple|banana|lemon|lime|orange|berry|berries|avocado|cucumber|cabbage|celery/.test(name)) {
    return 'Produce';
  }
  
  // Dairy
  if (/milk|cheese|yogurt|cream|butter|egg|eggs|margarine/.test(name)) {
    return 'Dairy';
  }
  
  // Meat
  if (/chicken|beef|pork|fish|meat|steak|turkey|bacon|sausage|ham/.test(name)) {
    return 'Meat';
  }
  
  // Grains
  if (/bread|pasta|rice|flour|oat|cereal|grain|noodle/.test(name)) {
    return 'Grains';
  }
  
  // Canned Goods
  if (/can|canned|beans|soup|broth|stock|sauce|paste/.test(name)) {
    return 'Canned Goods';
  }
  
  // Spices
  if (/spice|herb|salt|pepper|cinnamon|oregano|basil|thyme|cumin|paprika|curry/.test(name)) {
    return 'Spices';
  }
  
  // Default
  return 'Other';
};

const ShoppingListComponent: React.FC<ShoppingListComponentProps> = ({ 
  shoppingList, 
  onToggleItem, 
  disabled 
}) => {
  // Group items by category
  const categorizedItems = useMemo(() => {
    const grouped: Record<FoodCategory, ShoppingListItem[]> = {
      'Produce': [],
      'Dairy': [],
      'Meat': [],
      'Grains': [],
      'Canned Goods': [],
      'Spices': [],
      'Other': []
    };
    
    // Sort items into categories
    shoppingList.forEach(item => {
      const category = categorizeItem(item.name);
      grouped[category].push(item);
    });
    
    // Sort items alphabetically within each category
    Object.keys(grouped).forEach(category => {
      grouped[category as FoodCategory].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return grouped;
  }, [shoppingList]);
  
  if (shoppingList.length === 0) {
    return <p className="text-stone-500">No items in shopping list.</p>;
  }

  // Filter out empty categories
  const nonEmptyCategories = Object.entries(categorizedItems)
    .filter(([_, items]) => items.length > 0)
    .sort(([a], [b]) => a.localeCompare(b)) as [FoodCategory, ShoppingListItem[]][];

  return (
    <div className="space-y-6">
      {nonEmptyCategories.map(([category, items]) => (
        <div key={category} className="border-b border-stone-200 pb-4 last:border-b-0">
          <h3 className="font-medium text-stone-800 mb-2">{category}</h3>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.name} className="flex items-center">
                <input 
                  type="checkbox" 
                  id={`item-${item.name}`}
                  checked={item.acquired}
                  onChange={() => onToggleItem(item.name, item.acquired)}
                  disabled={disabled}
                  className={`mr-3 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 ${
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                />
                <label 
                  htmlFor={`item-${item.name}`} 
                  className={`flex-grow text-stone-700 ${
                    item.acquired ? 'line-through text-stone-400' : ''
                  } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="font-medium">{item.quantity}</span> 
                  <span className="text-sm text-stone-500 ml-1 mr-2">{item.unit || ''}</span>
                  {item.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default ShoppingListComponent; 