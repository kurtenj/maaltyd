// This file is now vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  // Remove optimizeDeps and ssr sections
  // optimizeDeps: {
  //  include: [
  //      '@testing-library/jest-dom', 
  //      'vitest-fetch-mock'
  //  ]
  // },
  // ssr: {
  //   noExternal: [
  //     '@testing-library/jest-dom', 
  //     'vitest-fetch-mock'
  //   ]
  // }
});