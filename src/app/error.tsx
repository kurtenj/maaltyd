'use client';

import { useEffect } from 'react';
import { logger } from '../utils/logger';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('app/error', 'Caught an error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center p-4 py-16">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold text-red-800 mb-4">Something went wrong</h2>
        <p className="text-stone-600 mb-4">
          We&apos;re sorry, but something unexpected happened. Please try again.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="text-sm text-stone-500 cursor-pointer mb-2">Error details (development only)</summary>
            <pre className="text-xs bg-stone-100 p-3 rounded overflow-auto max-h-40">
              {error.toString()}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-stone-200 text-stone-800 px-4 py-2 rounded-md hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}
