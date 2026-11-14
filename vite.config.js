import { defineConfig } from 'vite';

// Relative base so the build works on any host or subpath (Cloudflare Pages, Vercel, itch).
export default defineConfig({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 1500 }, // three.js alone is ~530 kB
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
