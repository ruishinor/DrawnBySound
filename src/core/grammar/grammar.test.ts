import { describe, it, expect } from 'vitest';
import { toRenderParams } from './mappings';
import { matchingPresetId, PRESETS } from './presets';
import { PALETTE_IDS, paletteLabel } from './palettes';
import { DEFAULT_SETTINGS, type Settings } from '../../app/SettingsStore';
import { createFeatureFrame, type FeatureFrame } from '../features/FeatureFrame';

function frameWith(p: Partial<FeatureFrame>): FeatureFrame {
  return { ...createFeatureFrame(), ...p };
}

describe('toRenderParams (deterministic grammar)', () => {
  it('is a pure function — same input yields identical output', () => {
    const f = frameWith({ rms: 0.5, onset: 0.4, centroid: 0.3, bands: new Float32Array([0, 0.6, 0.4, 0, 0, 0, 0]) });
    const a = toRenderParams(f, DEFAULT_SETTINGS);
    const b = toRenderParams(f, DEFAULT_SETTINGS);
    expect(a).toEqual(b);
  });

  it('matches a known snapshot for fixed input', () => {
    const f = frameWith({
      rms: 0.5,
      onset: 0.8,
      centroid: 0.5,
      stereoWidth: 0.4,
      bands: new Float32Array([0.1, 0.6, 0.4, 0, 0, 0, 0]),
    });
    const p = toRenderParams(f, DEFAULT_SETTINGS);
    expect(p.scale).toBeCloseTo(0.9 * (0.7 + 0.6 * 0.5), 6); // bass=(0.6+0.4)/2=0.5
    expect(p.spread).toBeCloseTo(0.7, 6); // 0.5+0.5*0.4
    expect(p.burst).toBeGreaterThan(0);
    expect(p.intensity).toBeGreaterThan(0);
    expect(p.color.length).toBe(3);
  });

  it('silence falls back gracefully (low, finite, non-strobing)', () => {
    const p = toRenderParams(createFeatureFrame(), DEFAULT_SETTINGS);
    expect(Number.isFinite(p.intensity)).toBe(true);
    expect(p.intensity).toBeGreaterThanOrEqual(0);
    expect(p.burst).toBe(0);
  });

  it('reduced-motion removes transient bursts and bloom pumping', () => {
    const f = frameWith({ rms: 0.6, onset: 1.0 });
    const normal = toRenderParams(f, DEFAULT_SETTINGS);
    const reduced = toRenderParams(f, { ...DEFAULT_SETTINGS, reducedMotion: true });
    expect(normal.burst).toBeGreaterThan(0);
    expect(reduced.burst).toBe(0);
    expect(reduced.decay).toBeGreaterThanOrEqual(0.92);
  });

  it('low-power disables bloom and lowers resolution', () => {
    const p = toRenderParams(frameWith({ rms: 0.5 }), { ...DEFAULT_SETTINGS, lowPower: true });
    expect(p.bloom).toBe(0);
    expect(p.resolutionScale).toBeLessThan(1);
  });

  it('isolates NorwegianFlow animation from all existing palettes', () => {
    const f = frameWith({ rms: 0.5, centroid: 0.5 });
    const normal = toRenderParams(f, DEFAULT_SETTINGS, 12.5);
    const norwegian = toRenderParams(
      f,
      { ...DEFAULT_SETTINGS, palette: 'norwegian-flow' },
      12.5,
    );
    const flag = toRenderParams(
      f,
      { ...DEFAULT_SETTINGS, palette: 'norwegian-flag' },
      12.5,
    );
    const reduced = toRenderParams(
      f,
      { ...DEFAULT_SETTINGS, palette: 'norwegian-flow', reducedMotion: true },
      12.5,
    );

    expect(normal.colorMode).toBe('solid');
    expect(normal.colorFlowTime).toBe(0);
    expect(norwegian.colorMode).toBe('norwegian-flow');
    expect(norwegian.colorFlowTime).toBe(12.5);
    expect(flag.colorMode).toBe('norwegian-flag');
    expect(flag.colorFlowTime).toBe(12.5);
    expect(reduced.colorMode).toBe('norwegian-flow');
    expect(reduced.colorFlowTime).toBe(0);
  });

  it('exposes separate NorwegianFlow and NorwegianFlag labels', () => {
    expect(PALETTE_IDS).toContain('norwegian-flow');
    expect(PALETTE_IDS).toContain('norwegian-flag');
    expect(paletteLabel('norwegian-flow')).toBe('Norwegian flow');
    expect(paletteLabel('norwegian-flag')).toBe('Norwegian flag');
  });

  it('uses a user-picked colour and disables animated palette modes', () => {
    const p = toRenderParams(
      frameWith({ rms: 0.5, centroid: 0.8 }),
      {
        ...DEFAULT_SETTINGS,
        palette: 'norwegian-flow',
        useCustomColor: true,
        customColor: '#336699',
      },
      12.5,
    );

    expect(p.colorMode).toBe('solid');
    expect(p.color[0] / p.color[1]).toBeCloseTo(0.5, 4);
    expect(p.color[2] / p.color[1]).toBeCloseTo(1.5, 4);
  });
});

describe('preset identity and guidance', () => {
  it('provides guidance and complete visual tuning for every preset', () => {
    const controlledKeys = [
      'mode',
      'palette',
      'customColor',
      'useCustomColor',
      'sensitivity',
      'persistence',
      'bloom',
      'baseScale',
      'baseIntensity',
      'bassDrive',
      'onsetDrive',
    ] as const;
    for (const preset of PRESETS) {
      expect(preset.description.trim().length).toBeGreaterThan(20);
      for (const key of controlledKeys) expect(preset.settings[key]).toBeDefined();
    }
  });

  it('identifies an applied preset and rejects a modified preset', () => {
    const preset = PRESETS.find((candidate) => candidate.id === 'deep-bass-field');
    expect(preset).toBeDefined();
    const applied = { ...DEFAULT_SETTINGS, ...preset!.settings };
    expect(matchingPresetId(applied)).toBe('deep-bass-field');
    expect(matchingPresetId({ ...applied, bloom: 0.1 })).toBeNull();
    expect(matchingPresetId({ ...applied, sensitivity: 1.1 })).toBeNull();
    expect(matchingPresetId({ ...applied, useCustomColor: true })).toBeNull();
  });
});

describe('presets differ meaningfully (not just color)', () => {
  it('produce distinct behavior signatures', () => {
    const f = frameWith({ rms: 0.5, onset: 0.5, centroid: 0.4, bands: new Float32Array([0, 0.5, 0.5, 0, 0, 0, 0]) });
    const sigs = new Set<string>();
    for (const preset of PRESETS) {
      const s: Settings = { ...DEFAULT_SETTINGS, ...preset.settings };
      const p = toRenderParams(f, s);
      // Signature excludes color, so distinctness proves behavioral difference.
      sigs.add([s.mode, p.decay.toFixed(3), p.bloom.toFixed(3), p.scale.toFixed(3)].join('|'));
    }
    // The expanded set must still differ by behavior, not merely by colour.
    expect(sigs.size).toBeGreaterThanOrEqual(9);
  });
});
