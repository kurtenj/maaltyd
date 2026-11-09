# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Next.js dev server (pages + API routes)
npm run build         # Production build (also type-checks)
npm run start         # Serve the production build
npm run lint          # ESLint with eslint.config.mjs
npm run typecheck     # tsc --noEmit
npm run test          # Vitest in watch mode
npm run test:coverage # Tests with coverage report
```

To run a single test file:
```bash
npx vitest run src/components/Header.test.tsx
```

## Architecture

**Maaltyd** is a recipe management app built on **Next.js 16 (App Router)**, deployed on Vercel. Everything lives under `src/`.

### Routes (`src/app/`)

- `layout.tsx` — root layout: `ClerkProvider`, `next/font` Bricolage Grotesque (`--font-bricolage`), `Header` + `PageTransition` + `Footer`, site metadata.
- `page.tsx` (`/`) — server component; loads recipes with `fetchAllRecipes()` and passes them to the `HomePage` view.
- `recipe/[recipeId]/page.tsx` — server component; loads the recipe + related recipes, sets `generateMetadata` (title / Open Graph image) and calls `notFound()` for missing IDs.
- `add-recipe/page.tsx` — renders the `AddRecipePage` view.
- `loading.tsx`, `error.tsx`, `not-found.tsx` — skeletons, error boundary, 404.
- Recipe pages use `export const dynamic = 'force-dynamic'` because Redis reads don't go through `fetch` and would otherwise be frozen at build time.

### Views (`src/views/`)

Client components (`'use client'`) holding the interactive page UI: `HomePage`, `RecipeDetailPage`, `AddRecipePage`. The folder is deliberately **not** called `pages/` — Next would treat `src/pages` as the Pages Router.

- `RecipeDetailPage` takes `initialRecipe` and `relatedRecipes` props from the server page and handles read and edit mode inline (no separate edit route). The server page renders it with `key={recipe.id}` so edit state resets between recipes.
- `RecipeForm` is shared between create (`AddRecipePage`) and edit (`RecipeDetailPage`).
- **State:** `src/hooks/useRecipes.ts` manages the list (filter by `main`, debounced title search). Pass `initialRecipes` to start populated and skip the client fetch.
- **API client:** `src/services/api.ts` — `recipeApi` wraps `fetch` calls to `/api/*` for mutations and import. Mutation methods take `getToken` from Clerk's `useAuth()` and send `Authorization: Bearer <token>`.
- **Navigation:** use `next/link` / `useRouter` from `next/navigation`, with paths from `ROUTES` in `src/utils/navigation.ts`.
- Anything reading `localStorage` (e.g. `recentRecipes`) must run in an effect, not during render, to avoid hydration mismatches.

### API routes (`src/app/api/`)

Next.js route handlers (`export async function GET/POST/PUT/DELETE`; dynamic `params` is a Promise):

- `api/recipes/route.ts` — `GET` (list) and `POST` (create).
- `api/recipe/[id]/route.ts` — `GET`, `PUT` (update-only, `xx`; 404 if missing), `DELETE`.
- `api/import-recipe/route.ts` — `POST`: accepts `{ url }`, fetches the page, tries `schema.org/Recipe` JSON-LD first, falls back to `@mozilla/readability` + `jsdom`, then raw tag stripping; sends the content to Claude for structuring, validates, and returns the recipe for user review. Auth required. Logs `contentSource` (`json-ld` | `readability` | `raw`). `jsdom` is listed in `serverExternalPackages` in `next.config.ts`.

Server data access goes through `src/utils/recipeFetcher.ts`: `fetchAllRecipes()` (Redis `SCAN` for `recipe:*` + `MGET`, validated against `RecipeSchema`) and `fetchRecipeById()`. Both are wrapped in React `cache()` so `generateMetadata` and the page share one read. `getRelatedRecipes()` in `src/utils/relatedRecipes.ts` is the pure filtering logic.

### Data & Auth

- **Storage:** Upstash Redis (`@upstash/redis`). Keys use prefix `recipe:` followed by UUID. See `src/utils/redisClient.ts`.
- **Auth:** Clerk via `@clerk/nextjs` (Core 3). `src/proxy.ts` runs `clerkMiddleware()` (Next 16 renamed `middleware.ts` to `proxy.ts`). Use `<Show when="signed-in">` / `<Show when="signed-out">` — `SignedIn`/`SignedOut` were removed in Core 3 and throw. API routes verify the Bearer token with `verifyToken` from `@clerk/backend` in `src/utils/auth.ts`. Mutations (POST/PUT/DELETE) require auth; GET is public.
- **Validation:** Zod schemas in `src/utils/apiSchemas.ts` (`RecipeSchema`, `RecipeCreateSchema`, `RecipeUpdateSchema`) are shared between frontend types and API handlers. `unit` on ingredients is validated against the `STANDARD_UNITS` enum from `src/utils/constants.ts`.

### Key Types

`src/types/recipe.ts` defines the central `Recipe` interface: `{ id, title, imageUrl?: string | null, main, other: Ingredient[], instructions: string[] }`. `main` is the primary ingredient (used for filtering); `other` is an array of `{ name, quantity, unit? }`.

### RecipeForm props

`RecipeForm` is used in both create and edit flows. Key props:
- `onImportUrl?: (url: string) => Promise<Omit<Recipe, 'id'>>` — when provided, renders a URL import field above the title. On success it populates the form; the user reviews and saves manually. Only passed from `AddRecipePage`, not the edit flow.
- `hideFormButtons` / `formId` — used by the edit flow in `RecipeDetailPage` where the parent renders the action buttons externally.

### AI / URL Import

`src/app/api/import-recipe/route.ts` uses the Anthropic SDK (client created lazily on first request) with Claude tool use (`tool_choice: { type: 'tool', name: 'extract_recipe' }`) to force structured JSON output. The default model is `ANTHROPIC_MODEL` from `src/utils/constants.ts` (`claude-haiku-4-5-20251001`), overridable via the `ANTHROPIC_MODEL` env var. The system prompt uses `cache_control: ephemeral` for prompt caching. Only `http:` and `https:` URLs are accepted (SSRF protection).

The content pipeline tries three sources in order: (1) `findRecipeJsonLd()` scans all `<script type="application/ld+json">` tags for a `@type: "Recipe"` node (handles both direct objects and `@graph` wrappers); (2) `@mozilla/readability` text extraction; (3) raw HTML tag-stripping. Claude always runs regardless of source — its role is adaptation (flatten ingredient groups, simplify techniques, consolidate steps) not just extraction. `main` and `imageUrl` are intentionally omitted from Claude's output and left for the user to fill in.

### Button component

`Button` (`src/components/Button.tsx`) supports four variants: `primary` (emerald), `secondary` (stone), `danger` (red), `icon` (unstyled). **Padding is not included in any variant** — always pass it via `className` (e.g. `className="px-4 py-2"`). The `isLoading` prop replaces children with a spinner and "Processing…" text.

### RecipeDetailPage structure

`RecipeDetailPage` contains a private `RecipeReadView` sub-component (read-only display with 1×/2×/3× ingredient multiplier and share/copy-link button). When `isEditing` is true, it renders `RecipeForm` with `hideFormButtons` and `formId="recipe-edit-form"`; the parent renders Cancel/Save/Delete buttons outside the form, with the Save button wired via `form="recipe-edit-form"`.

### Animations

`motion` (formerly Framer Motion, imported as `motion/react`) is the animation library. Page transitions live in `src/components/PageTransition.tsx` (`LazyMotion` + `m.div` keyed by pathname): an enter-only slide whose direction comes from `useNavigationDirection`. There is no exit animation, because the App Router swaps route content before an `AnimatePresence` exit could play. `CookingPotIcon` (`src/components/CookingPotIcon.tsx`) is the pattern to follow for imperative animation: it uses `useAnimation()` controls driven by an `isAnimating` prop, with `motion.g` elements and named variant states (`normal` / `animate`). New animated icons should follow this same shape.

### Utility Patterns

- **Error handling:** `tryCatchAsync(fn, module, errorMessage?)` from `src/utils/errorHandling.ts` returns `[result, error]` tuples — used throughout pages and hooks instead of bare try/catch.
- **Logging:** `logger` from `src/utils/logger.ts` — logs are suppressed when `NODE_ENV === 'production'`; can be re-enabled at runtime via `localStorage.setItem('debug', 'true')`. Server-side uses `serverLogger` from `src/utils/serverLogger.ts`.
- **Recent recipes:** `src/utils/recentRecipes.ts` — tracks last 5 viewed recipe IDs in `localStorage`.

### Deployment

`vercel.json` pins `"framework": "nextjs"`. The app version shown in the footer comes from `package.json` via `NEXT_PUBLIC_APP_VERSION` (set in `next.config.ts`).

## Environment Variables

Required in `.env.local` for local development:
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk (frontend; read automatically by `ClerkProvider`)
- `CLERK_SECRET_KEY` — Clerk (backend JWT verification)
- `ANTHROPIC_API_KEY` — Anthropic API (URL import feature)
- `ANTHROPIC_MODEL` — (optional) override the default Claude model
