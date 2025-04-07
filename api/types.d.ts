// Type definitions for missing modules

declare module '@vercel/blob' {
  export function put(
    pathname: string, 
    body: string | Buffer | ReadableStream, 
    options?: { 
      access?: 'public' | 'private'; 
      contentType?: string; 
      addRandomSuffix?: boolean;
      cacheControlMaxAge?: number;
    }
  ): Promise<{ url: string; pathname: string }>;
  
  export function del(pathname: string): Promise<void>;
  
  export function head(pathname: string): Promise<{ url: string; pathname: string }>;
  
  export function list(options?: { prefix?: string; limit?: number; }): Promise<{ 
    blobs: Array<{ url: string; pathname: string; contentType?: string; }>; 
    cursor?: string;
  }>;
}

declare module 'next/server' {
  export class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse;
  }
}

/**
 * Type declarations for API modules
 */

declare module 'recipes' {
  // Use interface declaration instead of import for ambient module
  interface Ingredient {
    name: string;
    quantity: string | number;
    unit: string;
  }

  interface Recipe {
    id: string;
    title: string;
    main: string;
    other: Ingredient[];
    instructions: string[];
  }
} 