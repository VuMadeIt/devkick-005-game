import { defineConfig, loadEnv } from 'vite';

// Serves POST /api/otter during `npm run dev` / `npm run preview` with keys from .env (server side
// only: nothing here reaches the browser bundle). On Vercel, api/otter.js serves the same route.
function otterApi() {
  let env = {};
  // Must return nothing: Vite treats a returned function as a "post" hook.
  const mount = (server) => {
    server.middlewares.use('/api/otter', async (req, res) => {
      const { nodeHandler } = await import('./server/otter.js');
      await nodeHandler(req, res, env);
    });
  };
  return {
    name: 'otter-api',
    configResolved(config) {
      env = { ...loadEnv(config.mode, process.cwd(), ''), ...process.env };
    },
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

// Relative base so the build works on any host or subpath (Cloudflare Pages, Vercel, itch).
export default defineConfig({
  base: './',
  plugins: [otterApi()],
  server: { host: true },
  build: { chunkSizeWarningLimit: 1500 }, // three.js alone is ~530 kB
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
