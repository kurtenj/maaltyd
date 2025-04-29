import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config'; // Import the Vite config

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Add specific Vitest settings here if needed in the future
    // For now, primarily setting up environment and setupFiles
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/setup.ts',
        'vite.config.ts', // Exclude Vite config from coverage
        'vitest.config.ts' // Exclude Vitest config itself
      ],
    },
  },
})); 