const KEY = 'recentRecipeIds';
const MAX = 5;

export function getRecentRecipeIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function recordRecentRecipe(id: string): void {
  // Skeletons render the detail view with sample data (ids "sample-*"); never record those
  if (id.startsWith('sample-')) return;
  const ids = getRecentRecipeIds().filter((rid) => rid !== id);
  ids.unshift(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // localStorage unavailable
  }
}
