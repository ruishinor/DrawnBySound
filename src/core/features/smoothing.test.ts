import { describe, it, expect } from 'vitest';
import { Ema, AdaptiveNormalizer } from './smoothing';

describe('Ema', () => {
  it('initializes to the first sample', () => {
    const ema = new Ema(0.1);
    expect(ema.push(5)).toBe(5);
  });

  it('converges toward a constant input', () => {
    const ema = new Ema(0.3);
    ema.push(0);
    let v = 0;
    for (let i = 0; i < 200; i++) v = ema.push(10);
    expect(v).toBeCloseTo(10, 3);
  });
});

describe('AdaptiveNormalizer', () => {
  it('keeps output within [0,1]', () => {
    const n = new AdaptiveNormalizer();
    for (const x of [0.1, 5, 100, -3, 0.001]) {
      const y = n.normalize(x);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('maps the current maximum to ~1', () => {
    const n = new AdaptiveNormalizer();
    n.normalize(2);
    expect(n.normalize(2)).toBeCloseTo(1, 5);
  });
});
