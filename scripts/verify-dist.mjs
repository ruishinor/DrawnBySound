import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const assets = path.join(dist, 'assets');
const assetNames = await readdir(assets);
const worklets = assetNames.filter((name) => /^preprocessor\.worklet-.*\.js$/.test(name));

if (worklets.length !== 1) {
  throw new Error(`Expected one bundled AudioWorklet chunk, found ${worklets.length}.`);
}

const jsFiles = assetNames.filter((name) => name.endsWith('.js'));
for (const name of jsFiles) {
  const text = await readFile(path.join(assets, name), 'utf8');
  if (text.includes('data:video/mp2t')) {
    throw new Error(`${name} contains an invalid TypeScript data URL for the AudioWorklet.`);
  }
}

const workletText = await readFile(path.join(assets, worklets[0]), 'utf8');
if (!/registerProcessor\(["']vibrato-preprocessor["']/.test(workletText)) {
  throw new Error('Bundled AudioWorklet does not register vibrato-preprocessor.');
}

console.log(`Verified production AudioWorklet bundle: assets/${worklets[0]}`);
