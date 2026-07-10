import { describe, it, expect } from 'vitest';
import {
  hannWindow,
  spectralCentroidHz,
  bandEnergies,
  spectralFlux,
  stereoWidth,
  BAND_COUNT,
  BAND_EDGES_HZ,
} from './spectral';
import { realMagnitude } from './fft';

const SR = 8000;
const N = 1024;

function tone(freq: number, n = N, sr = SR, amp = 1): Float32Array {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return x;
}

function magOf(frame: Float32Array): Float32Array {
  const win = hannWindow(frame.length);
  const w = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) w[i] = frame[i] * win[i];
  const out = new Float32Array((frame.length >> 1) + 1);
  realMagnitude(w, new Float32Array(frame.length), new Float32Array(frame.length), out);
  return out;
}

describe('spectralCentroidHz', () => {
  it('locates a pure tone near its frequency', () => {
    const centroid = spectralCentroidHz(magOf(tone(1000)), SR, N);
    expect(centroid).toBeGreaterThan(850);
    expect(centroid).toBeLessThan(1150);
  });

  it('is higher for a brighter tone', () => {
    const low = spectralCentroidHz(magOf(tone(500)), SR, N);
    const high = spectralCentroidHz(magOf(tone(3000)), SR, N);
    expect(high).toBeGreaterThan(low);
  });

  it('returns 0 for silence', () => {
    expect(spectralCentroidHz(magOf(new Float32Array(N)), SR, N)).toBe(0);
  });
});

describe('bandEnergies', () => {
  it('concentrates a bass tone in a low band', () => {
    const out = new Float32Array(BAND_COUNT);
    bandEnergies(magOf(tone(100)), SR, N, out);
    let maxB = 0;
    for (let b = 1; b < BAND_COUNT; b++) if (out[b] > out[maxB]) maxB = b;
    // 100 Hz falls in band index 1 (60..150)
    expect(maxB).toBe(1);
  });

  it('concentrates a treble tone in a high band', () => {
    const out = new Float32Array(BAND_COUNT);
    bandEnergies(magOf(tone(3000)), SR, N, out);
    let maxB = 0;
    for (let b = 1; b < BAND_COUNT; b++) if (out[b] > out[maxB]) maxB = b;
    // 3000 Hz falls in band index 5 (2500..6000)
    expect(BAND_EDGES_HZ[maxB]).toBeLessThanOrEqual(3000);
    expect(BAND_EDGES_HZ[maxB + 1]).toBeGreaterThan(3000);
  });
});

describe('spectralFlux', () => {
  it('is large when energy appears, ~0 when unchanged', () => {
    const silence = magOf(new Float32Array(N));
    const loud = magOf(tone(1000));
    expect(spectralFlux(loud, silence)).toBeGreaterThan(0.1);
    expect(spectralFlux(loud, loud)).toBeCloseTo(0, 5);
  });
});

describe('stereoWidth', () => {
  it('is ~0 for identical channels (mono)', () => {
    const m = tone(440);
    expect(stereoWidth(m, m, N)).toBeCloseTo(0, 5);
  });

  it('is high for anti-phase channels', () => {
    const l = tone(440);
    const r = tone(440, N, SR, -1); // inverted
    expect(stereoWidth(l, r, N)).toBeGreaterThan(0.8);
  });
});
