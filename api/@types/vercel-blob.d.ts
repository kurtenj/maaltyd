/**
 * Type definitions for @vercel/blob
 */

declare module '@vercel/blob' {
  export interface BlobResult {
    url: string;
    pathname: string;
  }

  export interface ListResult {
    blobs: Array<{
      url: string;
      pathname: string;
    }>;
  }

  export function put(pathname: string, content: string | Buffer, options?: {
    access?: 'public' | 'private';
    addRandomSuffix?: boolean;
    contentType?: string;
  }): Promise<BlobResult>;

  export function list(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<ListResult>;

  export function del(pathname: string): Promise<void>;

  export function head(pathname: string): Promise<BlobResult>;
} 