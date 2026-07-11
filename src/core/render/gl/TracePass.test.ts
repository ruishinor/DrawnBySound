import { describe, expect, it } from 'vitest';
import { traceAspectScale } from './TracePass';

describe('traceAspectScale', () => {
  it('compensates wide render targets without reducing vertical extent', () => {
    expect(traceAspectScale(1600, 800)).toEqual([0.5, 1]);
  });

  it('keeps square and portrait targets unchanged', () => {
    expect(traceAspectScale(800, 800)).toEqual([1, 1]);
    expect(traceAspectScale(600, 900)).toEqual([1, 1]);
  });
});
