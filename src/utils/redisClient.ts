import { Redis } from '@upstash/redis';

// Initialize Redis client with proper URL prefixing
const redisUrl = process.env.KV_REST_API_URL || '';
const redisToken = process.env.KV_REST_API_TOKEN || '';

// Add a check immediately after initialization
if (!redisUrl || !redisToken) {
  console.error('CRITICAL: Redis URL or Token is missing from environment variables!');
}

// Initialize the Redis client properly
export const redis = new Redis({
  url: redisUrl,  // Must be a complete URL
  token: redisToken,
});

// Common Redis key prefixes
export const RECIPE_PREFIX = 'recipe:';

// Helper function to get recipe key
export const getRecipeKey = (id: string) => `${RECIPE_PREFIX}${id}`;

// Helper function to validate Redis connection
export const validateRedisConnection = () => {
  if (!redisUrl || !redisToken) {
    throw new Error('Redis configuration is missing. Please check environment variables.');
  }
};
