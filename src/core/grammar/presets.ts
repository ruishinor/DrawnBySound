import type { Settings } from '../../app/SettingsStore';

/**
 * A preset is a named bundle that reconfigures the settings that drive the
 * grammar — mode, palette, persistence, bloom, and response curves — so presets
 * differ in behavior, not just color (PRD §13.10).
 */
export interface Preset {
  id: string;
  label: string;
  settings: Partial<Settings>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'classic-oscilloscope',
    label: 'Classic Oscilloscope',
    settings: {
      mode: 'stereo-xy',
      palette: 'classic-green',
      persistence: 0.88,
      bloom: 0.25,
      baseIntensity: 0.9,
      bassDrive: 0.4,
      onsetDrive: 0.5,
    },
  },
  {
    id: 'fire-trace',
    label: 'Fire Trace',
    settings: {
      mode: 'stereo-xy',
      palette: 'fire',
      persistence: 0.93,
      bloom: 0.6,
      baseIntensity: 1.1,
      bassDrive: 0.7,
      onsetDrive: 1.0,
    },
  },
  {
    id: 'neon-lissajous',
    label: 'Neon Lissajous',
    settings: {
      mode: 'beat-lissajous',
      palette: 'neon',
      persistence: 0.9,
      bloom: 0.85,
      baseIntensity: 1.2,
      bassDrive: 0.5,
      onsetDrive: 0.8,
    },
  },
  {
    id: 'deep-bass-field',
    label: 'Deep Bass Field',
    settings: {
      mode: 'stereo-xy',
      palette: 'ice',
      persistence: 0.96,
      bloom: 0.5,
      baseScale: 1.05,
      bassDrive: 1.0,
      onsetDrive: 0.4,
    },
  },
  {
    id: 'string-ribbons',
    label: 'String Ribbons',
    settings: {
      mode: 'mono-phase-xy',
      palette: 'fire',
      persistence: 0.97,
      bloom: 0.4,
      baseIntensity: 0.85,
      bassDrive: 0.5,
      onsetDrive: 0.3,
    },
  },
  {
    id: 'percussion-sparks',
    label: 'Percussion Sparks',
    settings: {
      mode: 'band-xy',
      palette: 'ice',
      persistence: 0.8,
      bloom: 0.7,
      baseIntensity: 1.0,
      bassDrive: 0.6,
      onsetDrive: 1.0,
    },
  },
  {
    id: 'synth-grid',
    label: 'Synth Grid',
    settings: {
      mode: 'hybrid-grammar',
      palette: 'neon',
      persistence: 0.91,
      bloom: 0.6,
      baseIntensity: 1.05,
      bassDrive: 0.6,
      onsetDrive: 0.7,
    },
  },
  {
    id: 'minimal-monochrome',
    label: 'Minimal Monochrome',
    settings: {
      mode: 'stereo-xy',
      palette: 'mono',
      persistence: 0.85,
      bloom: 0.1,
      baseIntensity: 0.8,
      bassDrive: 0.4,
      onsetDrive: 0.5,
    },
  },
];

export const PRESET_BY_ID: ReadonlyMap<string, Preset> = new Map(PRESETS.map((p) => [p.id, p]));
