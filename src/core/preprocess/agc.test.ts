import { describe, it, expect } from 'vitest';
import { Agc, softLimit, DEFAULT_AGC } from './agc';

/** Make a constant-RMS block (DC magnitude = rms). */
function block(amp: number, n = 128): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = i % 2 === 0 ? amp : -amp; // |x| = amp, rms = amp
  return b;
}

function settle(agc: Agc, amp: number, iterations = 400): number {
  let last = 1;
  for (let i = 0; i < iterations; i++) last = agc.update(block(amp)).gain;
  return last;
}

describe('Agc', () => {
  it('raises gain for quiet input toward targetRms/level', () => {
    const agc = new Agc();
    const gain = settle(agc, 0.02);
    // quiet -> gain well above 1, driving rms toward target
    expect(gain).toBeGreaterThan(1);
    expect(0.02 * gain).toBeCloseTo(DEFAULT_AGC.targetRms, 1);
  });

  it('lowers gain for loud input toward target', () => {
    const agc = new Agc();
    const gain = settle(agc, 0.8);
    expect(gain).toBeLessThan(1);
    expect(0.8 * gain).toBeCloseTo(DEFAULT_AGC.targetRms, 1);
  });

  it('respects gain bounds', () => {
    const agc = new Agc({ maxGain: 5, minGain: 0.2 });
    expect(settle(agc, 0.0001)).toBeLessThanOrEqual(5 + 1e-6);
    agc.reset();
    expect(settle(agc, 50)).toBeGreaterThanOrEqual(0.2 - 1e-6);
  });

  it('flags clipping on loud input', () => {
    const agc = new Agc();
    expect(agc.update(block(1.0)).clipped).toBe(true);
  });

  it('does not flag clipping on quiet input', () => {
    const agc = new Agc();
    expect(agc.update(block(0.05)).clipped).toBe(false);
  });
});

describe('softLimit', () => {
  it('is identity below the knee', () => {
    expect(softLimit(0.5, 0.8)).toBeCloseTo(0.5, 6);
    expect(softLimit(-0.3, 0.8)).toBeCloseTo(-0.3, 6);
  });

  it('bounds large magnitudes to at most 1', () => {
    expect(Math.abs(softLimit(100))).toBeLessThanOrEqual(1);
    expect(Math.abs(softLimit(-100))).toBeLessThanOrEqual(1);
    expect(Math.abs(softLimit(1.5))).toBeGreaterThan(0.8); // past the knee
  });

  it('is monotonic and sign-preserving', () => {
    expect(softLimit(2)).toBeGreaterThan(softLimit(1.5));
    expect(softLimit(-2)).toBeLessThan(softLimit(-1.5));
  });
});
