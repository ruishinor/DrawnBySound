import { describe, it, expect } from 'vitest';
import { fftRadix2, realMagnitude } from './fft';

/** Naive O(n^2) DFT magnitude for cross-checking. */
function dftMagnitude(x: number[]): number[] {
  const n = x.length;
  const mag: number[] = [];
  for (let k = 0; k <= n / 2; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * k * t) / n;
      re += x[t] * Math.cos(a);
      im += x[t] * Math.sin(a);
    }
    mag.push(Math.hypot(re, im));
  }
  return mag;
}

describe('fftRadix2 / realMagnitude', () => {
  it('matches a naive DFT for a random signal', () => {
    const n = 16;
    const x = Array.from({ length: n }, () => Math.random() * 2 - 1);
    const re = Float32Array.from(x);
    const im = new Float32Array(n);
    fftRadix2(re, im);
    const ref = dftMagnitude(x);
    for (let k = 0; k <= n / 2; k++) {
      expect(Math.hypot(re[k], im[k])).toBeCloseTo(ref[k], 3);
    }
  });

  it('puts a pure tone in the expected bin', () => {
    const n = 64;
    const bin = 8;
    const frame = new Float32Array(n);
    for (let i = 0; i < n; i++) frame[i] = Math.sin((2 * Math.PI * bin * i) / n);
    const out = new Float32Array(n / 2 + 1);
    realMagnitude(frame, new Float32Array(n), new Float32Array(n), out);
    let peak = 0;
    let peakK = -1;
    for (let k = 0; k < out.length; k++) {
      if (out[k] > peak) {
        peak = out[k];
        peakK = k;
      }
    }
    expect(peakK).toBe(bin);
  });

  it('rejects non-power-of-two lengths', () => {
    expect(() => fftRadix2(new Float32Array(6), new Float32Array(6))).toThrow();
  });
});
