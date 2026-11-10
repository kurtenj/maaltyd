import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../../../../../utils/redisClient';
import { verifyAuth } from '../../../../../utils/auth';
import { attachGeneratedImage } from '../../../../../utils/recipeImage';
import { serverLogger } from '../../../../../utils/serverLogger';

const MOD = 'api/recipe/[id]/image';

export const maxDuration = 60;

// Each generation costs money, so cap regenerations per signed-in user
const imageRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'ratelimit:image',
});

type RouteContext = { params: Promise<{ id: string }> };

/** Generate a new photo for the recipe, replacing the current one. Returns { imageUrl, thumbnailUrl }. */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const userId = await verifyAuth(request);
  if (!userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const { success, reset } = await imageRateLimit.limit(userId);
  if (!success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return NextResponse.json(
      { message: `You've hit the photo generation limit. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  const { id } = await params;

  try {
    const urls = await attachGeneratedImage(id, { onlyIfMissing: false });
    if (!urls) {
      return NextResponse.json({ message: 'Recipe not found.' }, { status: 404 });
    }
    return NextResponse.json(urls);
  } catch (error) {
    serverLogger.error(MOD, `image generation failed for ${id}:`, error);
    return NextResponse.json({ message: 'Photo generation failed — please try again.' }, { status: 500 });
  }
}
