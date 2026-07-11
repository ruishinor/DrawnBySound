import type { Settings } from '../../app/SettingsStore';

/**
 * A preset is a named bundle that reconfigures the settings that drive the
 * grammar — mode, palette, persistence, bloom, and response curves — so presets
 * differ in behavior, not just color (PRD §13.10).
 */
export interface Preset {
  id: string;
  label: string;
  description: string;
  settings: Partial<Settings>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'warm-room',
    label: 'Warm room',
    description: 'Soft amber trace with moderate trails and a gentle response. Calm and rounded.',
    settings: {
      mode: 'stereo-xy',
      palette: 'warm-amber',
      persistence: 0.91,
      baseScale: 0.9,
      bloom: 0.28,
      baseIntensity: 0.95,
      bassDrive: 0.6,
      onsetDrive: 0.7,
    },
  },
  {
    id: 'mineral-lines',
    label: 'Mineral lines',
    description: 'Cool blue lines with long, clean trails and restrained motion. Smooth rather than punchy.',
    settings: {
      mode: 'mono-phase-xy',
      palette: 'mineral-blue',
      persistence: 0.95,
      baseScale: 0.9,
      bloom: 0.22,
      baseIntensity: 0.9,
      bassDrive: 0.5,
      onsetDrive: 0.4,
    },
  },
  {
    id: 'paper-trace',
    label: 'Paper trace',
    description: 'Low-glow white line with short, dry trails. Minimal and precise.',
    settings: {
      mode: 'stereo-xy',
      palette: 'soft-white',
      persistence: 0.87,
      baseScale: 0.9,
      bloom: 0.08,
      baseIntensity: 0.8,
      bassDrive: 0.4,
      onsetDrive: 0.4,
    },
  },
  {
    id: 'dusty-rose',
    label: 'Dusty rose',
    description: 'Rose-coloured beat loops with moderate glow and a stronger response to attacks.',
    settings: {
      mode: 'beat-lissajous',
      palette: 'dusty-rose',
      persistence: 0.9,
      baseScale: 0.9,
      bloom: 0.25,
      baseIntensity: 0.9,
      bassDrive: 0.55,
      onsetDrive: 0.75,
    },
  },
  {
    id: 'classic-oscilloscope',
    label: 'Classic Oscilloscope',
    description: 'Green stereo trace with balanced trails and restrained glow.',
    settings: {
      mode: 'stereo-xy',
      palette: 'classic-green',
      persistence: 0.88,
      baseScale: 0.9,
      bloom: 0.25,
      baseIntensity: 0.9,
      bassDrive: 0.4,
      onsetDrive: 0.5,
    },
  },
  {
    id: 'fire-trace',
    label: 'Fire Trace',
    description: 'Bright warm colour, stronger glow, and a fast response to hits. High-energy.',
    settings: {
      mode: 'stereo-xy',
      palette: 'fire',
      persistence: 0.93,
      baseScale: 0.9,
      bloom: 0.6,
      baseIntensity: 1.1,
      bassDrive: 0.7,
      onsetDrive: 1.0,
    },
  },
  {
    id: 'neon-lissajous',
    label: 'Neon Lissajous',
    description: 'Beat-driven loops with vivid colour and the strongest glow. Bold and animated.',
    settings: {
      mode: 'beat-lissajous',
      palette: 'neon',
      persistence: 0.9,
      baseScale: 0.9,
      bloom: 0.85,
      baseIntensity: 1.2,
      bassDrive: 0.5,
      onsetDrive: 0.8,
    },
  },
  {
    id: 'deep-bass-field',
    label: 'Deep Bass Field',
    description: 'A larger, slower ice-blue form that expands strongly with low frequencies.',
    settings: {
      mode: 'stereo-xy',
      palette: 'ice',
      persistence: 0.96,
      bloom: 0.5,
      baseIntensity: 0.95,
      baseScale: 1.05,
      bassDrive: 1.0,
      onsetDrive: 0.4,
    },
  },
  {
    id: 'string-ribbons',
    label: 'String Ribbons',
    description: 'Long, smooth phase ribbons with subdued attack response. Suits sustained sound.',
    settings: {
      mode: 'mono-phase-xy',
      palette: 'fire',
      persistence: 0.97,
      baseScale: 0.9,
      bloom: 0.4,
      baseIntensity: 0.85,
      bassDrive: 0.5,
      onsetDrive: 0.3,
    },
  },
  {
    id: 'percussion-sparks',
    label: 'Percussion Sparks',
    description: 'Shorter trails, strong glow, and high transient response. Suits drums and sharp hits.',
    settings: {
      mode: 'band-xy',
      palette: 'ice',
      persistence: 0.8,
      baseScale: 0.9,
      bloom: 0.7,
      baseIntensity: 1.0,
      bassDrive: 0.6,
      onsetDrive: 1.0,
    },
  },
  {
    id: 'synth-grid',
    label: 'Synth Grid',
    description: 'Complex hybrid motion with bright colour and balanced bass and attack response.',
    settings: {
      mode: 'hybrid-grammar',
      palette: 'neon',
      persistence: 0.91,
      baseScale: 0.9,
      bloom: 0.6,
      baseIntensity: 1.05,
      bassDrive: 0.6,
      onsetDrive: 0.7,
    },
  },
  {
    id: 'minimal-monochrome',
    label: 'Minimal Monochrome',
    description: 'Low-glow monochrome stereo trace with short trails. Quiet and uncluttered.',
    settings: {
      mode: 'stereo-xy',
      palette: 'mono',
      persistence: 0.85,
      baseScale: 0.9,
      bloom: 0.1,
      baseIntensity: 0.8,
      bassDrive: 0.4,
      onsetDrive: 0.5,
    },
  },
];

export const PRESET_BY_ID: ReadonlyMap<string, Preset> = new Map(PRESETS.map((p) => [p.id, p]));

/** Return the preset whose defined fields still match the current visual settings. */
export function matchingPresetId(settings: Readonly<Settings>): string | null {
  if (settings.useCustomColor) return null;
  const match = PRESETS.find((preset) =>
    Object.entries(preset.settings).every(
      ([key, value]) => settings[key as keyof Settings] === value,
    ),
  );
  return match?.id ?? null;
}
