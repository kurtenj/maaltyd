# Maaltyd App - Testing Guide

## ✅ Pre-Test Status
- ✅ TypeScript compilation: **PASSED**
- ✅ Linting: **PASSED**  
- ✅ Build: **PASSED**
- ✅ All imports verified

## 🧪 Manual Testing Steps

### 1. Start the Development Server

**Important:** Since the API routes are Vercel serverless functions, you need to use `vercel dev` to run both the frontend and API:

```bash
npx vercel dev
```

Or if you have Vercel CLI installed globally:
```bash
vercel dev
```

Alternatively, you can use the npm script:
```bash
npm run dev:vercel
```

The app should start at `http://localhost:3000` (or the port Vercel assigns).

**Note:** Using `npm run dev` (Vite only) will start the frontend but API routes won't work. Use `vercel dev` for full functionality.

### 2. Test Authentication Flow

#### Sign In
1. Navigate to the app
2. Click "Sign In" button in header
3. Complete Clerk authentication
4. Verify you're signed in (UserButton should appear)

#### Sign Out
1. Click UserButton
2. Select "Sign Out"
3. Verify you're redirected to home page
4. Verify "Sign In" button appears again

### 3. Test Recipe Management

#### View Recipes (No Auth Required)
1. Navigate to home page (`/`)
2. Verify recipes are displayed (if any exist)
3. Test search functionality:
   - Type in search box
   - Verify filtered results appear
4. Test ingredient filter:
   - Select a main ingredient from dropdown
   - Verify filtered results appear

#### Create Recipe (Auth Required)
1. Sign in if not already signed in
2. Click "+" button in header (or navigate to `/add-recipe`)
3. Fill in recipe form:
   - Title
   - Main ingredient
   - Other ingredients (add multiple)
   - Instructions (add multiple steps)
4. Click "Save"
5. Verify recipe is created and you're redirected to home
6. Verify new recipe appears in list

#### View Recipe Details
1. Click on any recipe card
2. Verify recipe detail page loads (`/recipe/:id`)
3. Verify all recipe information displays:
   - Title
   - Ingredients with quantities/units
   - Instructions
   - Image (if available)

#### Edit Recipe (Auth Required)
1. On recipe detail page, click "Edit"
2. Modify recipe fields
3. Click "Save"
4. Verify changes are saved
5. Verify updated recipe displays correctly

#### Delete Recipe (Auth Required)
1. On recipe detail page, click "Delete"
2. Confirm deletion in dialog
3. Verify recipe is deleted
4. Verify redirect to home page
5. Verify deleted recipe no longer appears in list

### 4. Test Error Handling

#### Network Errors
1. Disconnect internet
2. Try to fetch recipes
3. Verify error message displays
4. Reconnect internet
5. Verify app recovers

#### Invalid Data
1. Try to create recipe with missing required fields
2. Verify validation error messages appear
3. Try to access non-existent recipe (`/recipe/invalid-id`)
4. Verify 404 error handling

#### Authentication Errors
1. Sign out
2. Try to create/edit/delete recipe
3. Verify authentication required message

#### React Error Boundary
1. If a React error occurs, verify:
   - Error boundary catches it
   - Fallback UI displays
   - "Try Again" and "Refresh Page" buttons work

### 5. Test UI/UX

#### Loading States
1. Navigate between pages
2. Verify loading indicators appear during data fetching
3. Verify smooth transitions

#### Empty States
1. Delete all recipes
2. Verify empty state message appears
3. Verify "Add Your First Recipe" button appears

#### Responsive Design
1. Resize browser window
2. Test on mobile viewport (dev tools)
3. Verify layout adapts correctly
4. Verify all buttons/links are accessible

### 6. Test Data Persistence

#### Refresh Test
1. Create a recipe
2. Refresh the page
3. Verify recipe still exists

#### UUID Format Test
1. Create a new recipe
2. Check the recipe ID in browser dev tools (Network tab)
3. Verify ID is a UUID format (not timestamp)

## 🔍 Console Checks

While testing, check browser console for:
- ✅ No React errors
- ✅ No network errors (except expected 401s when not signed in)
- ✅ Proper logging messages

Check server logs for:
- ✅ Authentication verification messages
- ✅ Recipe fetching logs

## 🐛 Known Issues to Watch For

1. **Authentication**: If `CLERK_SECRET_KEY` is not set, auth will fall back to header-based (less secure but functional)

## ✅ Success Criteria

All functionality should work correctly:
- ✅ Better security (server-side auth verification)
- ✅ Better error handling (error boundaries)
- ✅ Cleaner code (no duplicate code)
- ✅ Better IDs (UUIDs instead of timestamps)

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Authentication: [ ] Pass [ ] Fail
Recipe CRUD: [ ] Pass [ ] Fail
Error Handling: [ ] Pass [ ] Fail
UI/UX: [ ] Pass [ ] Fail
Data Persistence: [ ] Pass [ ] Fail

Notes:
_______________________________________
_______________________________________
```
