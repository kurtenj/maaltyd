import { logger } from './logger';

/**
 * Standard error structure
 */
export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Format error for display to users
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  
  return 'An unexpected error occurred';
}

/**
 * Process an error with consistent logging
 */
export function handleError(module: string, error: unknown, userMessage?: string): AppError {
  // Log the error
  logger.error(module, 'Error caught:', error);
  
  // Format the error message for the UI
  const formattedMessage = userMessage || formatErrorMessage(error);
  
  // Extract additional details from the error
  let details: unknown = error instanceof Error ? { name: error.name, stack: error.stack } : error;
  
  // If the error has a response property (from API errors), include it
  if (error instanceof Error && 'response' in error) {
    details = {
      ...(typeof details === 'object' && details !== null ? details : {}),
      response: (error as Error & { response?: unknown }).response
    };
  }
  
  // Return a standardized error object
  return {
    message: formattedMessage,
    details
  };
}

/**
 * Try/catch wrapper for async functions
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  module: string,
  errorMessage?: string
): Promise<[T | null, AppError | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, handleError(module, error, errorMessage)];
  }
}

/**
 * Try/catch wrapper for synchronous functions
 */
export function tryCatch<T>(
  fn: () => T,
  module: string,
  errorMessage?: string
): [T | null, AppError | null] {
  try {
    const result = fn();
    return [result, null];
  } catch (error) {
    return [null, handleError(module, error, errorMessage)];
  }
} 