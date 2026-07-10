// Generates small deterministic WAV fixtures for tests/manual QA.
// Run: node scripts/gen-test-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-assets');
mkdirSync(outDir, { recursive: true });

const SR = 48000;

/** Write 16-bit PCM stereo WAV. `gen(i)` returns [left, right] in [-1,1]. */
function writeWav(name, seconds, gen) {
  const frames = Math.floor(SR * seconds);
  const dataBytes = frames * 2 * 2; // 2 channels * 16-bit
  const buf = Buffer.alloc(44 + dataBytes);
  let o = 0;
  const str = (s) => {
    buf.write(s, o);
    o += s.length;
  };
  const u32 = (v) => {
    buf.writeUInt32LE(v, o);
    o += 4;
  };
  const u16 = (v) => {
    buf.writeUInt16LE(v, o);
    o += 2;
  };
  str('RIFF');
  u32(36 + dataBytes);
  str('WAVE');
  str('fmt ');
  u32(16);
  u16(1); // PCM
  u16(2); // stereo
  u32(SR);
  u32(SR * 2 * 2); // byte rate
  u16(4); // block align
  u16(16); // bits
  str('data');
  u32(dataBytes);
  for (let i = 0; i < frames; i++) {
    const [l, r] = gen(i);
    buf.writeInt16LE(Math.max(-1, Math.min(1, l)) * 32767, o);
    o += 2;
    buf.writeInt16LE(Math.max(-1, Math.min(1, r)) * 32767, o);
    o += 2;
  }
  const path = join(outDir, name);
  writeFileSync(path, buf);
  console.log('wrote', path, `(${(buf.length / 1024).toFixed(1)} kB)`);
}

const TWO_PI = Math.PI * 2;

// Stereo Lissajous: 220 Hz left vs 330 Hz right (2:3) -> a clear XY figure.
writeWav('stereo-lissajous.wav', 2.0, (i) => {
  const t = i / SR;
  return [0.6 * Math.sin(TWO_PI * 220 * t), 0.6 * Math.sin(TWO_PI * 330 * t)];
});

// Mono tone (same in both channels) -> Mono Phase XY opens it into a loop.
writeWav('mono-sine.wav', 2.0, (i) => {
  const t = i / SR;
  const s = 0.6 * Math.sin(TWO_PI * 196 * t);
  return [s, s];
});
