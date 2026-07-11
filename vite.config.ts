import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vitest/config';

/**
 * Cross-origin isolation enables SharedArrayBuffer (used from M2 onward for the
 * lock-free audio ring buffer / FeatureBus). Required headers: COOP + COEP.
 */
function crossOriginIsolation(): Plugin {
  const setHeaders = (
    _req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): void => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  };
  return {
    name: 'vibratoflow:cross-origin-isolation',
    configureServer(server) {
      server.middlewares.use(setHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(setHeaders);
    },
  };
}

export default defineConfig({
  plugins: [crossOriginIsolation()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Use worker_threads instead of the default forks pool: forking child
    // processes can fail in constrained environments (spawn UNKNOWN).
    pool: 'threads',
  },
});
