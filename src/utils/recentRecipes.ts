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
  const ids = getRecentRecipeIds().filter((rid) => rid !== id);
  ids.unshift(id);
  localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
}
