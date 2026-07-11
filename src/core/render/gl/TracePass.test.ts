import { describe, expect, it } from 'vitest';
import { traceAspectScale } from './TracePass';

describe('traceAspectScale', () => {
  it('preserves proportions and lifts occupancy on wide render targets', () => {
    const [x, y] = traceAspectScale(1600, 800);
    expect(x).toBeCloseTo(0.58, 6);
    expect(y).toBeCloseTo(1.16, 6);
    expect(x * 1600).toBeCloseTo(y * 800, 6);
  });

  it('keeps square and portrait targets unchanged', () => {
    expect(traceAspectScale(800, 800)).toEqual([1, 1]);
    expect(traceAspectScale(600, 900)).toEqual([1, 1]);
  });
});
