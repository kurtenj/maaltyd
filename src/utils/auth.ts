import { verifyToken } from '@clerk/backend';

/**
 * Verify Clerk authentication from request headers.
 * Expects an `Authorization: Bearer <session-token>` header.
 *
 * @param request - The incoming Request object
 * @returns The authenticated user ID, or null if not authenticated
 */
export async function verifyAuth(request: Request): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return null;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      console.warn('[auth] CLERK_SECRET_KEY not configured, skipping token verification');
      return null;
    }

    try {
      const payload = await verifyToken(token, { secretKey });
      return payload.sub ?? null;
    } catch (error) {
      console.error('[auth] Token verification failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  } catch (error) {
    console.error('[auth] Authentication error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Require authentication - throws an error if user is not authenticated
 * 
 * @param request - The incoming Request object
 * @returns The authenticated user ID
 * @throws Error if not authenticated
 */
export async function requireAuth(request: Request): Promise<string> {
  const userId = await verifyAuth(request);
  
  if (!userId) {
    throw new Error('Authentication required');
  }
  
  return userId;
}

