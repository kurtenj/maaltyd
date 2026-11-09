import type { Recipe } from '../types/recipe';

/**
 * "Related recipes" by content similarity.
 *
 * Each recipe becomes a weighted bag of terms from its title and ingredient names.
 * Terms are weighted by TF-IDF across the whole collection, so distinctive words
 * ("sourdough", "meatballs", "tare", "tortillas") matter and staples that appear
 * everywhere ("salt", "flour", "oil") barely count. Similarity is cosine similarity,
 * with title terms weighted above ingredients (and instructions lowest), plus a small
 * bonus for the same `main`.
 *
 * Weights were tuned against the real collection by comparing the top matches for every
 * recipe; change them the same way, not in isolation.
 */

const TITLE_WEIGHT = 3;
const INGREDIENT_WEIGHT = 1;
const INSTRUCTION_WEIGHT = 0.5;
const SAME_MAIN_BONUS = 0.15;
/** Below this, a recipe isn't meaningfully related — show fewer (or no) suggestions instead. */
const MIN_SCORE = 0.12;

// Words that say nothing about what a dish is
const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'with', 'for', 'in', 'on', 'to', 'into', 'from', 'my', 'your',
  'recipe', 'recipes', 'best', 'easy', 'quick', 'simple', 'homemade', 'classic', 'perfect', 'ultimate',
  'minute', 'minutes', 'dump', 'bake', 'style', 'free', 'gluten', 'healthy',
  // preparation / size / state words in ingredient names
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'crushed', 'shredded', 'peeled', 'deveined', 'finely',
  'roughly', 'thinly', 'freshly', 'fresh', 'dried', 'large', 'small', 'medium', 'whole', 'raw', 'cooked',
  'softened', 'melted', 'room', 'temperature', 'cold', 'warm', 'hot', 'optional', 'taste', 'divided',
  'plus', 'extra', 'more', 'about', 'cut', 'pieces', 'piece', 'packed', 'toasted', 'boneless', 'skinless',
]);

/** Lowercase, strip punctuation and numbers, drop stopwords, and crudely singularize. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(singularize);
}

function singularize(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`; // berries -> berry
  if (word.length > 4 && /(ches|shes|sses|xes|oes)$/.test(word)) return word.slice(0, -2); // tomatoes -> tomato
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1); // muffins -> muffin
  return word;
}

type TermWeights = Map<string, number>;

function rawTerms(recipe: Recipe): TermWeights {
  const terms: TermWeights = new Map();
  const add = (words: string[], weight: number) => {
    for (const w of new Set(words)) terms.set(w, (terms.get(w) ?? 0) + weight);
  };
  add(tokenize(recipe.title), TITLE_WEIGHT);
  add(recipe.other.flatMap((i) => tokenize(i.name)), INGREDIENT_WEIGHT);
  add(recipe.instructions.flatMap(tokenize), INSTRUCTION_WEIGHT);
  return terms;
}

/** TF-IDF vectors (L2-normalized) for every recipe, keyed by id. */
function buildVectors(recipes: Recipe[]): Map<string, TermWeights> {
  const raw = new Map(recipes.map((r) => [r.id, rawTerms(r)]));

  const docFreq = new Map<string, number>();
  for (const terms of raw.values()) {
    for (const t of terms.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
  const n = recipes.length;
  const idf = (t: string) => Math.log((n + 1) / ((docFreq.get(t) ?? 0) + 1)) + 1;

  const vectors = new Map<string, TermWeights>();
  for (const [id, terms] of raw) {
    const v: TermWeights = new Map();
    let norm = 0;
    for (const [t, w] of terms) {
      const weighted = w * idf(t);
      v.set(t, weighted);
      norm += weighted * weighted;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    vectors.set(id, v);
  }
  return vectors;
}

function cosine(a: TermWeights, b: TermWeights): number {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small) dot += w * (large.get(t) ?? 0);
  return dot;
}

/** Similarity score for every other recipe, highest first. Exported for tests and tuning. */
export function scoreRelatedRecipes(allRecipes: Recipe[], recipe: Recipe): { recipe: Recipe; score: number }[] {
  const pool = allRecipes.some((r) => r.id === recipe.id) ? allRecipes : [...allRecipes, recipe];
  const vectors = buildVectors(pool);
  const target = vectors.get(recipe.id)!;

  return pool
    .filter((r) => r.id !== recipe.id)
    .map((r) => ({
      recipe: r,
      score: cosine(target, vectors.get(r.id)!) + (r.main === recipe.main ? SAME_MAIN_BONUS : 0),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
}

/** The most similar recipes to `recipe`, excluding itself. */
export function getRelatedRecipes(allRecipes: Recipe[], recipe: Recipe, limit = 2): Recipe[] {
  return scoreRelatedRecipes(allRecipes, recipe)
    .filter((s) => s.score >= MIN_SCORE)
    .slice(0, limit)
    .map((s) => s.recipe);
}
