import { Redis } from '@upstash/redis';

const redisUrl = process.env.KV_REST_API_URL || '';
const redisToken = process.env.KV_REST_API_TOKEN || '';

if (!redisUrl || !redisToken) {
  console.error('CRITICAL: Redis URL or Token is missing from environment variables!');
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

export const RECIPE_PREFIX = 'recipe:';

export const getRecipeKey = (id: string) => `${RECIPE_PREFIX}${id}`;
