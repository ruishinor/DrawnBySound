import { describe, it, expect } from 'vitest';
import { HeuristicClassifier } from './HeuristicClassifier';
import type { ClassifierInput } from './Classifier';

function input(over: Partial<ClassifierInput>): ClassifierInput {
  return {
    bands: new Float32Array(7),
    centroid: 0,
    flux: 0,
    onset: 0,
    stereoWidth: 0,
    rms: 0.3,
    zcr: 0,
    ...over,
  };
}

function settle(c: HeuristicClassifier, inp: ClassifierInput, n = 30) {
  let r = c.classify(inp);
  for (let i = 0; i < n; i++) r = c.classify(inp);
  return r;
}

describe('HeuristicClassifier', () => {
  it('calls bass-heavy, dark material "bass"', () => {
    const c = new HeuristicClassifier();
    const r = settle(c, input({ bands: new Float32Array([0.8, 0.9, 0.2, 0, 0, 0, 0]), centroid: 0.05 }));
    expect(r.dominant).toBe('bass');
  });

  it('calls transient-heavy material "percussion"', () => {
    const c = new HeuristicClassifier();
    const r = settle(c, input({ onset: 0.95, flux: 0.9, bands: new Float32Array([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]) }));
    expect(r.dominant).toBe('percussion');
  });

  it('treats silence as ambient/unknown', () => {
    const c = new HeuristicClassifier();
    const r = settle(c, input({ rms: 0, bands: new Float32Array(7) }));
    expect(['ambient', 'unknown']).toContain(r.dominant);
  });

  it('reports low confidence for ambiguous broadband material (-> grammar fallback)', () => {
    const c = new HeuristicClassifier();
    const r = settle(
      c,
      input({ bands: new Float32Array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), centroid: 0.5, onset: 0.3, stereoWidth: 0.3 }),
    );
    expect(r.confidence).toBeLessThan(0.6);
  });

  it('detects vocal presence in mid-band material without transcription', () => {
    const c = new HeuristicClassifier();
    const r = settle(c, input({ bands: new Float32Array([0, 0.1, 0.2, 0.9, 0.8, 0.2, 0]), onset: 0.1 }));
    expect(r.voicePresent).toBeGreaterThan(0.4);
  });

  it('does not flip dominant on a single off-frame (hysteresis)', () => {
    const c = new HeuristicClassifier();
    settle(c, input({ bands: new Float32Array([0.8, 0.9, 0.1, 0, 0, 0, 0]), centroid: 0.05 }));
    // one frame of bright synthy content shouldn't immediately flip from bass
    const r = c.classify(input({ stereoWidth: 1, bands: new Float32Array([0, 0, 0, 0, 1, 1, 1]), centroid: 0.9 }));
    expect(r.dominant).toBe('bass');
  });
});
