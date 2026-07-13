import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vitest/config';

const PREVIEW_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
].join('; ');

const CROSS_ORIGIN_HEADERS: Readonly<Record<string, string>> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const PREVIEW_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  ...CROSS_ORIGIN_HEADERS,
  'Content-Security-Policy': PREVIEW_CSP,
  'Permissions-Policy': 'microphone=(self), display-capture=(self), camera=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

function applyHeaders(headers: Readonly<Record<string, string>>) {
  return (
    _req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): void => {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    next();
  };
}

/**
 * Cross-origin isolation enables SharedArrayBuffer. The production preview also
 * applies the browser security policy used by Vercel so E2E can verify it.
 */
function browserSecurityHeaders(): Plugin {
  return {
    name: 'vibratoflow:browser-security-headers',
    configureServer(server) {
      server.middlewares.use(applyHeaders(CROSS_ORIGIN_HEADERS));
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders(PREVIEW_SECURITY_HEADERS));
    },
  };
}

export default defineConfig({
  plugins: [browserSecurityHeaders()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4173 },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    pool: 'threads',
  },
});
