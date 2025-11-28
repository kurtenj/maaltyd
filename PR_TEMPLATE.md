# Pull Request Description

> **Note**: This file is updated for each PR. Replace the content below with your PR details.

## Overview
This PR adds quick action toggle buttons ("Cook" and "Bake") to the homepage, allowing users to quickly filter recipes by cooking method. The implementation includes a new reusable `ToggleGroup` component with smooth animations and polished styling.

## Features

### Quick Action Filters
- **Cook Button**: Filters to show all recipes except those with flour as the main ingredient
- **Bake Button**: Filters to show all recipes with flour as the main ingredient
- Mutually exclusive selection (only one can be active at a time)
- Toggle functionality (clicking the same button deselects it)

### New ToggleGroup Component
- Reusable toggle group component with support for single/multiple selection
- Outline variant with emerald color scheme for selected state
- Customizable sizes (sm, default, lg)
- Responsive design that works on both web and mobile
- Proper accessibility with ARIA attributes

### Visual Enhancements
- Icons (Beef for Cook, CakeSlice for Bake) appear only when selected
- Smooth fade-in animation for icons
- Rounded outer edges matching recipe card border radius
- Emerald-50 background with emerald-500 border on selected state
- Shared border between buttons colors correctly when either is selected
- Smooth text transitions when icons appear/disappear
- Increased button height for better touch targets

## Files Changed

### New Files
- `src/components/ToggleGroup.tsx` - New reusable toggle group component

### Modified Files
- `src/pages/HomePage.tsx` - Added toggle group with quick action filters
- `src/hooks/useRecipes.ts` - Added quick action filter state and logic
- `src/index.css` - Added fade-in animation keyframes

## Technical Details

### Filtering Logic
- Cook filter: `recipe.main.toLowerCase() !== 'flour'`
- Bake filter: `recipe.main.toLowerCase() === 'flour'`
- Filters work in combination with existing search and main ingredient filters

### Styling
- Uses Tailwind CSS with custom emerald color scheme
- Border radius matches recipe cards (`rounded-lg`)
- Height increased from `h-12` to `h-14` for better usability
- Smooth transitions for all interactive states

## Testing
- ✅ Linter: No errors
- ✅ TypeScript: No type errors
- ✅ All files compile successfully
- ✅ Manual testing: Toggle functionality works correctly
- ✅ Manual testing: Icons animate smoothly
- ✅ Manual testing: Border colors update correctly

## Screenshots
(Add screenshots of the toggle buttons in both states)

## Commit Message

```
feat: Add quick action toggle buttons for recipe filtering

Add Cook and Bake quick action filters to the homepage with a new
reusable ToggleGroup component.

Features:
- Cook filter: Shows all recipes except those with flour as main ingredient
- Bake filter: Shows all recipes with flour as main ingredient
- Mutually exclusive toggle buttons with smooth animations
- Icons (Beef/CakeSlice) appear only when selected with fade-in animation
- Emerald color scheme for selected state matching app theme
- Rounded edges matching recipe card border radius
- Increased button height for better touch targets

New Components:
- ToggleGroup: Reusable toggle group component with outline variant
  - Supports single/multiple selection modes
  - Customizable sizes (sm, default, lg)
  - Proper accessibility with ARIA attributes

Files Changed:
- src/components/ToggleGroup.tsx (new)
- src/pages/HomePage.tsx
- src/hooks/useRecipes.ts
- src/index.css (added fade-in animation)

Testing:
- All linter checks pass
- TypeScript compilation successful
- Manual testing completed
```

