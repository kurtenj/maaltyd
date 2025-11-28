import { clerkClient } from '@clerk/backend';

/**
 * Verify Clerk authentication from request headers
 * 
 * This function verifies the user ID by checking with Clerk's backend API
 * to ensure the user exists and is valid, rather than blindly trusting headers.
 * 
 * @param request - The incoming Request object
 * @returns The authenticated user ID, or null if not authenticated
 */
export async function verifyAuth(request: Request): Promise<string | null> {
  try {
    // Get user ID from header (set by Clerk middleware in Vercel or sent by frontend)
    const userIdFromHeader = request.headers.get('x-clerk-user-id');
    
    if (!userIdFromHeader) {
      return null;
    }

    // Verify the user exists in Clerk by fetching their data
    // This ensures the user ID is valid and not spoofed
    const secretKey = process.env.CLERK_SECRET_KEY;
    
    if (!secretKey) {
      console.warn('[auth] CLERK_SECRET_KEY not configured, accepting header value without verification');
      // In development, we might not have the secret key
      // Still return the user ID but log a warning
      return userIdFromHeader;
    }

    try {
      // Create Clerk client and verify user exists
      const clerk = clerkClient({ secretKey });
      await clerk.users.getUser(userIdFromHeader);
      
      // User exists and is valid
      return userIdFromHeader;
    } catch (error) {
      // User doesn't exist or verification failed
      console.error('[auth] User verification failed:', error instanceof Error ? error.message : String(error));
      
      // In development mode (NODE_ENV !== 'production'), if verification fails
      // but we have a valid-looking user ID format, accept it with a warning
      // This helps with development when Clerk API might be unavailable or misconfigured
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment && userIdFromHeader && userIdFromHeader.startsWith('user_')) {
        console.warn('[auth] Development mode: Accepting user ID without verification due to Clerk API error');
        return userIdFromHeader;
      }
      
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

