import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Root-path hosting (user/organization GitHub Pages site).
export default defineConfig({
  base: '/',
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
