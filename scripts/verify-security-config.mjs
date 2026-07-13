import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const catchAll = config.headers?.find((entry) => entry.source === '/(.*)');
if (!catchAll) throw new Error('vercel.json is missing the catch-all security-header rule.');

const headers = new Map(
  catchAll.headers.map(({ key, value }) => [String(key).toLowerCase(), String(value)]),
);

const requiredExact = new Map([
  ['cross-origin-opener-policy', 'same-origin'],
  ['cross-origin-embedder-policy', 'require-corp'],
  ['cross-origin-resource-policy', 'same-origin'],
  ['referrer-policy', 'no-referrer'],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['x-permitted-cross-domain-policies', 'none'],
]);

for (const [name, expected] of requiredExact) {
  if (headers.get(name) !== expected) {
    throw new Error(`Expected ${name}: ${expected}.`);
  }
}

const csp = headers.get('content-security-policy') ?? '';
for (const directive of [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "connect-src 'self'",
  "worker-src 'self'",
]) {
  if (!csp.includes(directive)) throw new Error(`CSP is missing: ${directive}.`);
}
if (csp.includes("'unsafe-eval'") || /script-src[^;]*'unsafe-inline'/u.test(csp)) {
  throw new Error('CSP permits unsafe script execution.');
}

const permissions = headers.get('permissions-policy') ?? '';
for (const policy of ['microphone=(self)', 'display-capture=(self)', 'camera=()', 'geolocation=()']) {
  if (!permissions.includes(policy)) throw new Error(`Permissions-Policy is missing: ${policy}.`);
}

if (!/^max-age=\d+$/u.test(headers.get('strict-transport-security') ?? '')) {
  throw new Error('Strict-Transport-Security must use a finite max-age.');
}

console.log('Verified Vercel security-header configuration.');
