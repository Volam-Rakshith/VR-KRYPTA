import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Project-repo GitHub Pages hosting: https://volam-rakshith.github.io/VR-KRYPTA/
export default defineConfig({
  base: '/VR-KRYPTA/',
  plugins: [react()],
  server: {
    // Dev-server host allowlist must accept the sandboxed preview host.
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    target: 'es2021',
    chunkSizeWarningLimit: 900
  },
  worker: {
    format: 'iife'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
