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
- **API client:** `src/services/api.ts` — `recipeApi` object wrapping all fetch calls to `/api/*`. Mutation methods (`create`, `update`, `delete`, `importFromUrl`) accept a `getToken` function from Clerk's `useAuth()` and send `Authorization: Bearer <token>`.
- **Navigation:** Use `ROUTES` from `src/utils/navigation.ts` for all route paths in code (e.g., `ROUTES.HOME`, `ROUTES.RECIPE_DETAIL(id)`).

### Backend (`api/`)

Vercel Serverless Functions using Next.js App Router handler convention (`export async function GET/POST/PUT/DELETE`):

- `api/recipes.ts` — `GET` (list all) and `POST` (create) at `/api/recipes`
- `api/recipe/[id].ts` — `GET`, `PUT`, `DELETE` at `/api/recipe/:id`
- `api/import-recipe.ts` — `POST` at `/api/import-recipe`: accepts `{ url }`, fetches the page, then tries to extract `schema.org/Recipe` from `<script type="application/ld+json">` tags first; falls back to `@mozilla/readability` + `jsdom` text extraction if no JSON-LD is found. Passes whichever content to Claude (tool use, forced `extract_recipe` call) for simplification and structuring, validates against `RecipeCreateSchema`, and returns the recipe data for user review. Auth required. The server log line includes `contentSource` (`json-ld` | `readability` | `raw`) for debugging import failures.

Both GET handlers use the shared `fetchAllRecipes()` utility in `src/utils/recipeFetcher.ts`, which does a Redis `SCAN` for `recipe:*` keys, then `mget`, then validates each result against `RecipeSchema`.

### Data & Auth

- **Storage:** Upstash Redis (`@upstash/redis`). Keys use prefix `recipe:` followed by UUID. See `src/utils/redisClient.ts`.
- **Auth:** Clerk. Frontend calls `getToken()` from `useAuth()` and sends it as `Authorization: Bearer <token>`. Backend verifies the JWT using `verifyToken(token, { secretKey })` from `@clerk/backend` in `src/utils/auth.ts`. Mutations (POST/PUT/DELETE) require auth; GET is public.
- **Validation:** Zod schemas in `src/utils/apiSchemas.ts` (`RecipeSchema`, `RecipeCreateSchema`, `RecipeUpdateSchema`) are shared between frontend types and API handlers. `unit` on ingredients is validated against the `STANDARD_UNITS` enum from `src/utils/constants.ts`.

### Key Types

`src/types/recipe.ts` defines the central `Recipe` interface: `{ id, title, imageUrl?, main, other: Ingredient[], instructions: string[] }`. `main` is the primary ingredient (used for filtering); `other` is an array of `{ name, quantity, unit? }`.

### RecipeForm props

`RecipeForm` is used in both create and edit flows. Key props:
- `onImportUrl?: (url: string) => Promise<Omit<Recipe, 'id'>>` — when provided, renders a URL import field above the title. On success it populates the form; the user reviews and saves manually. Only passed from `AddRecipePage`, not the edit flow.
- `hideFormButtons` / `formId` — used by the edit flow in `RecipeDetailPage` where the parent renders the action buttons externally.

### AI / URL Import

`api/import-recipe.ts` uses the Anthropic SDK with Claude tool use (`tool_choice: { type: 'tool', name: 'extract_recipe' }`) to force structured JSON output. The default model is `ANTHROPIC_MODEL` from `src/utils/constants.ts` (`claude-haiku-4-5-20251001`), overridable via the `ANTHROPIC_MODEL` env var. The system prompt uses `cache_control: ephemeral` for prompt caching. Only `http:` and `https:` URLs are accepted (SSRF protection).

The content pipeline tries three sources in order: (1) `findRecipeJsonLd()` scans all `<script type="application/ld+json">` tags for a `@type: "Recipe"` node (handles both direct objects and `@graph` wrappers); (2) `@mozilla/readability` text extraction; (3) raw HTML tag-stripping. Claude always runs regardless of source — its role is adaptation (flatten ingredient groups, simplify techniques, consolidate steps) not just extraction. `main` and `imageUrl` are intentionally omitted from Claude's output and left for the user to fill in.

### Button component

`Button` (`src/components/Button.tsx`) supports four variants: `primary` (emerald), `secondary` (stone), `danger` (red), `icon` (unstyled). **Padding is not included in any variant** — always pass it via `className` (e.g. `className="px-4 py-2"`). The `isLoading` prop replaces children with a spinner and "Processing…" text.

### RecipeDetailPage structure

`RecipeDetailPage` contains a private `RecipeReadView` sub-component (read-only display with 1×/2×/3× ingredient multiplier and share/copy-link button). When `isEditing` is true, it renders `RecipeForm` with `hideFormButtons` and `formId="recipe-edit-form"`; the parent renders Cancel/Save/Delete buttons outside the form, with the Save button wired via `form="recipe-edit-form"`.

### Animations

`motion` (formerly Framer Motion, imported as `motion/react`) is the animation library. `CookingPotIcon` (`src/components/CookingPotIcon.tsx`) is the pattern to follow for imperative animation: it uses `useAnimation()` controls driven by an `isAnimating` prop, with `motion.g` elements and named variant states (`normal` / `animate`). New animated icons should follow this same shape.

### Utility Patterns

- **Error handling:** `tryCatchAsync(fn, module, errorMessage?)` from `src/utils/errorHandling.ts` returns `[result, error]` tuples — used throughout pages and hooks instead of bare try/catch.
- **Logging:** `logger` from `src/utils/logger.ts` — logs are suppressed in production by default; can be re-enabled at runtime via `localStorage.setItem('debug', 'true')`. Server-side uses `serverLogger` from `src/utils/serverLogger.ts`.
- **Recent recipes:** `src/utils/recentRecipes.ts` — tracks last 5 viewed recipe IDs in `localStorage`.

### Deployment

`vercel.json` configures SPA fallback rewrites so that deep links (e.g. `/recipe/:id`) are served by `index.html` and handled by React Router client-side. The `/api/*` prefix is reserved for serverless functions.

## Environment Variables

Required in `.env.local` for local development:
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk (frontend)
- `CLERK_SECRET_KEY` — Clerk (backend JWT verification)
- `ANTHROPIC_API_KEY` — Anthropic API (URL import feature)
- `ANTHROPIC_MODEL` — (optional) override the default Claude model
