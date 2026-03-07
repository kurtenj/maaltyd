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
- **State:** `src/hooks/useRecipes.ts` — single hook managing all recipe list state (fetch, filter by main ingredient, search by title, bake toggle for flour-based recipes)
- **API client:** `src/services/api.ts` — `recipeApi` object wrapping all fetch calls to `/api/*`

### Backend (`api/`)

Vercel Serverless Functions using Next.js App Router handler convention (`export async function GET/POST/PUT/DELETE`):

- `api/recipes.ts` — `GET` (list all) and `POST` (create) at `/api/recipes`
- `api/recipe/[id].ts` — `GET`, `PUT`, `DELETE` at `/api/recipe/:id`

### Data & Auth

- **Storage:** Upstash Redis (`@upstash/redis`). Keys use prefix `recipe:` followed by UUID. See `src/utils/redisClient.ts`.
- **Auth:** Clerk. Frontend sends `x-clerk-user-id` header; `src/utils/auth.ts` verifies it against Clerk's backend API. Mutations (POST/PUT/DELETE) require auth; GET is public.
- **Validation:** Zod schemas in `src/utils/apiSchemas.ts` (`RecipeSchema`, `RecipeCreateSchema`, `RecipeUpdateSchema`) are shared between frontend types and API handlers.

### Key Types

`src/types/recipe.ts` defines the central `Recipe` interface: `{ id, title, imageUrl?, main, other: Ingredient[], instructions: string[] }`. `main` is the primary ingredient (used for filtering); `other` is an array of `{ name, quantity, unit? }`.

## Environment Variables

Required in `.env.development.local` for local development:
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk (frontend)
- `CLERK_SECRET_KEY` — Clerk (backend API verification)
