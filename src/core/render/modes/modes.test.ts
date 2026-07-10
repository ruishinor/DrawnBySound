import { describe, it, expect } from 'vitest';
import { MODES, StereoXY, MonoPhaseXY } from './index';
import type { ModeContext } from './types';
import { createFeatureFrame } from '../../features/FeatureFrame';

function ctx(over: Partial<ModeContext> = {}): ModeContext {
  const count = over.count ?? 4;
  return {
    left: over.left ?? new Float32Array(count),
    right: over.right ?? new Float32Array(count),
    count,
    sampleRate: 48000,
    timeSec: 0,
    gain: 1,
    scale: 1,
    spread: 1,
    phaseDelaySamples: 0,
    frame: over.frame ?? createFeatureFrame(),
    ...over,
  };
}

describe('StereoXY.build', () => {
  it('maps left->x and right->y with gain*scale', () => {
    const out = new Float32Array(4);
    StereoXY.build(
      out,
      ctx({ count: 2, left: new Float32Array([0.5, -0.25]), right: new Float32Array([-0.5, 0.25]) }),
    );
    expect(Array.from(out)).toEqual([0.5, -0.5, -0.25, 0.25]);
  });

  it('clamps to the NDC frame', () => {
    const out = new Float32Array(2);
    StereoXY.build(out, ctx({ count: 1, left: new Float32Array([5]), right: new Float32Array([-5]) }));
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(-1);
  });

  it('applies stereo-width spread to the X axis only (PRD §18.2)', () => {
    const out = new Float32Array(2);
    StereoXY.build(
      out,
      ctx({ count: 1, left: new Float32Array([0.8]), right: new Float32Array([0.8]), spread: 0.5 }),
    );
    expect(out[0]).toBeCloseTo(0.4, 6); // x halved by spread
    expect(out[1]).toBeCloseTo(0.8, 6); // y untouched
  });
});

describe('MonoPhaseXY.build', () => {
  it('uses mono on x and delayed mono on y', () => {
    const out = new Float32Array(6);
    const ch = new Float32Array([0.2, 0.4, 0.6]);
    MonoPhaseXY.build(out, ctx({ count: 3, left: ch, right: ch, phaseDelaySamples: 1 }));
    expect(out[0]).toBeCloseTo(0.2, 6);
    expect(out[1]).toBe(0); // delayed before start
    expect(out[3]).toBeCloseTo(0.2, 6);
  });
});

describe('all five modes', () => {
  it('produce finite, in-frame output for a representative context', () => {
    const count = 256;
    const l = new Float32Array(count);
    const r = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      l[i] = Math.sin((2 * Math.PI * 5 * i) / count);
      r[i] = Math.sin((2 * Math.PI * 3 * i) / count);
    }
    const frame = createFeatureFrame();
    frame.rms = 0.5;
    frame.onset = 0.4;
    frame.stereoWidth = 0.5;
    const out = new Float32Array(count * 2);
    expect(MODES.length).toBe(5);
    for (const mode of MODES) {
      out.fill(0);
      mode.build(out, ctx({ count, left: l, right: r, frame }));
      for (let i = 0; i < count * 2; i++) {
        expect(Number.isFinite(out[i])).toBe(true);
        expect(out[i]).toBeGreaterThanOrEqual(-1);
        expect(out[i]).toBeLessThanOrEqual(1);
      }
    }
  });
});
