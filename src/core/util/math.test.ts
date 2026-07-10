import { describe, it, expect } from 'vitest';
import { clamp, lerp, smoothstep, emaAlpha } from './math';

describe('clamp', () => {
  it('bounds values to the range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('smoothstep', () => {
  it('clamps below/above the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
  it('eases through the midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
  it('handles degenerate equal edges', () => {
    expect(smoothstep(1, 1, 0)).toBe(0);
    expect(smoothstep(1, 1, 2)).toBe(1);
  });
});

describe('emaAlpha', () => {
  it('returns 1 for non-positive tau', () => {
    expect(emaAlpha(0.016, 0)).toBe(1);
  });
  it('stays within (0,1) for a positive tau', () => {
    const a = emaAlpha(0.016, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });
});
