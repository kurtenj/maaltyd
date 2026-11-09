import type { NextConfig } from 'next';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // jsdom uses dynamic requires that break when bundled; load it from node_modules at runtime
  serverExternalPackages: ['jsdom'],
};

export default nextConfig;
