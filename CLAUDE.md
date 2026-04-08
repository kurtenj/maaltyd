# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (frontend only)
npm run dev:vercel   # Start with Vercel serverless functions (full stack)
npm run build        # Build for production
npm run lint         # ESLint with eslint.config.mjs
npm run test         # Run Vitest in watch mode
npm run test:coverage # Run tests with coverage report
```

To run a single test file:
```bash
npx vitest run src/components/Header.test.tsx
```

> Use `npm run dev:vercel` when working on API routes — `npm run dev` won't serve the serverless functions.

## Architecture

**Maaltyd** is a recipe management app: React/Vite SPA frontend + Vercel Serverless Functions backend, deployed on Vercel.

### Frontend (`src/`)

- **Entry:** `main.tsx` — sets up `ClerkProvider`, `RouterProvider` with three routes: `/`, `/recipe/:recipeId`, `/add-recipe`
- **Layout:** `App.tsx` — `Header` + `<Outlet />` + `Footer` shell
- **Pages:** `HomePage`, `RecipeDetailPage`, `AddRecipePage`
  - `RecipeDetailPage` handles both read and edit mode inline (toggled via state) — there is no separate edit route
  - `RecipeForm` component is shared between `AddRecipePage` (create) and `RecipeDetailPage` (edit)
- **State:** `src/hooks/useRecipes.ts` — single hook managing all recipe list state (fetch, filter by `main` ingredient, search by title). Exposes `fetchRecipes` for manual refresh.
- **API client:** `src/services/api.ts` — `recipeApi` object wrapping all fetch calls to `/api/*`. Mutation methods (`create`, `update`, `delete`) accept a `getToken` function from Clerk's `useAuth()` and send `Authorization: Bearer <token>`.
- **Navigation:** Use `ROUTES` from `src/utils/navigation.ts` for all route paths in code (e.g., `ROUTES.HOME`, `ROUTES.RECIPE_DETAIL(id)`).

### Backend (`api/`)

Vercel Serverless Functions using Next.js App Router handler convention (`export async function GET/POST/PUT/DELETE`):

- `api/recipes.ts` — `GET` (list all) and `POST` (create) at `/api/recipes`
- `api/recipe/[id].ts` — `GET`, `PUT`, `DELETE` at `/api/recipe/:id`

Both GET handlers use the shared `fetchAllRecipes()` utility in `src/utils/recipeFetcher.ts`, which does a Redis `SCAN` for `recipe:*` keys, then `mget`, then validates each result against `RecipeSchema`.

### Data & Auth

- **Storage:** Upstash Redis (`@upstash/redis`). Keys use prefix `recipe:` followed by UUID. See `src/utils/redisClient.ts`.
- **Auth:** Clerk. Frontend calls `getToken()` from `useAuth()` and sends it as `Authorization: Bearer <token>`. Backend verifies the JWT using `verifyToken(token, { secretKey })` from `@clerk/backend` in `src/utils/auth.ts`. Mutations (POST/PUT/DELETE) require auth; GET is public.
- **Validation:** Zod schemas in `src/utils/apiSchemas.ts` (`RecipeSchema`, `RecipeCreateSchema`, `RecipeUpdateSchema`) are shared between frontend types and API handlers. `unit` on ingredients is validated against the `STANDARD_UNITS` enum from `src/utils/constants.ts`.

### Key Types

`src/types/recipe.ts` defines the central `Recipe` interface: `{ id, title, imageUrl?, main, other: Ingredient[], instructions: string[] }`. `main` is the primary ingredient (used for filtering); `other` is an array of `{ name, quantity, unit? }`.

### Utility Patterns

- **Error handling:** `tryCatchAsync(fn, module, errorMessage?)` from `src/utils/errorHandling.ts` returns `[result, error]` tuples — used throughout pages and hooks instead of bare try/catch.
- **Logging:** `logger` from `src/utils/logger.ts` — logs are suppressed in production by default; can be re-enabled at runtime via `localStorage.setItem('debug', 'true')`.
- **Recent recipes:** `src/utils/recentRecipes.ts` — tracks last 5 viewed recipe IDs in `localStorage`.

## Environment Variables

Required in `.env.development.local` for local development:
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk (frontend)
- `CLERK_SECRET_KEY` — Clerk (backend JWT verification)
