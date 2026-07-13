import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const assets = path.join(dist, 'assets');
const assetNames = await readdir(assets);
const worklets = assetNames.filter((name) => /^preprocessor\.worklet-.*\.js$/u.test(name));

if (worklets.length !== 1) {
  throw new Error(`Expected one bundled AudioWorklet chunk, found ${worklets.length}.`);
}

const jsFiles = assetNames.filter((name) => name.endsWith('.js'));
for (const name of jsFiles) {
  const text = await readFile(path.join(assets, name), 'utf8');
  if (text.includes('data:video/mp2t')) {
    throw new Error(`${name} contains an invalid TypeScript data URL for the AudioWorklet.`);
  }
  for (const forbidden of ['__vibrato', '/@vite/client', '@react-refresh', 'sourceMappingURL=']) {
    if (text.includes(forbidden)) throw new Error(`${name} contains production-forbidden marker: ${forbidden}.`);
  }
}

const workletText = await readFile(path.join(assets, worklets[0]), 'utf8');
if (!/registerProcessor\(["'`]vibrato-preprocessor["'`]/u.test(workletText)) {
  throw new Error('Bundled AudioWorklet does not register vibrato-preprocessor.');
}

const rootNames = await readdir(dist);
if (rootNames.some((name) => name.endsWith('.map')) || assetNames.some((name) => name.endsWith('.map'))) {
  throw new Error('Production source maps must not be emitted.');
}

const themeInit = path.join(dist, 'theme-init.js');
if (!(await stat(themeInit)).isFile()) throw new Error('theme-init.js is missing from the production build.');

const indexHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
const scriptTags = [...indexHtml.matchAll(/<script\b([^>]*)>/giu)];
if (scriptTags.length === 0) throw new Error('Production HTML contains no scripts.');
for (const [, attributes] of scriptTags) {
  if (!/\bsrc=["'][^"']+["']/iu.test(attributes)) {
    throw new Error('Production HTML contains an inline script, which would weaken CSP.');
  }
}

console.log(`Verified production AudioWorklet bundle: assets/${worklets[0]}`);
console.log('Verified production bundle has no source maps, dev hooks, or inline scripts.');
