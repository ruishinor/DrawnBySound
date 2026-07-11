import { clamp } from '../util/math';

export type RGB = [number, number, number];

interface Stop {
  t: number;
  c: RGB;
}

/** Colour sets mapped by brightness t∈[0,1]. Muted sets lead; legacy neon sets remain available. */
const PALETTES: Record<string, Stop[]> = {
  'warm-amber': [
    { t: 0, c: [0.55, 0.22, 0.07] },
    { t: 0.55, c: [0.86, 0.48, 0.2] },
    { t: 1, c: [1.0, 0.78, 0.47] },
  ],
  'mineral-blue': [
    { t: 0, c: [0.08, 0.2, 0.28] },
    { t: 0.55, c: [0.2, 0.48, 0.59] },
    { t: 1, c: [0.62, 0.8, 0.83] },
  ],
  'soft-white': [
    { t: 0, c: [0.48, 0.46, 0.41] },
    { t: 1, c: [0.96, 0.91, 0.8] },
  ],
  'dusty-rose': [
    { t: 0, c: [0.42, 0.12, 0.13] },
    { t: 0.55, c: [0.7, 0.31, 0.28] },
    { t: 1, c: [0.94, 0.67, 0.57] },
  ],
  'classic-green': [
    { t: 0, c: [0.1, 0.8, 0.35] },
    { t: 1, c: [0.55, 1.0, 0.7] },
  ],
  neon: [
    { t: 0, c: [0.9, 0.15, 0.8] },
    { t: 0.5, c: [0.5, 0.4, 1.0] },
    { t: 1, c: [0.2, 1.0, 0.95] },
  ],
  fire: [
    { t: 0, c: [0.7, 0.1, 0.02] },
    { t: 0.5, c: [1.0, 0.45, 0.06] },
    { t: 1, c: [1.0, 0.95, 0.5] },
  ],
  ice: [
    { t: 0, c: [0.1, 0.3, 0.8] },
    { t: 0.5, c: [0.3, 0.7, 1.0] },
    { t: 1, c: [0.85, 0.97, 1.0] },
  ],
  mono: [
    { t: 0, c: [0.75, 0.8, 0.85] },
    { t: 1, c: [1.0, 1.0, 1.0] },
  ],
  // Static fallback colours for the dedicated animated Norwegian shaders.
  'norwegian-flow': [
    { t: 0, c: [0.73, 0.05, 0.18] },
    { t: 0.5, c: [1.0, 1.0, 1.0] },
    { t: 1, c: [0.0, 0.13, 0.36] },
  ],
  'norwegian-flag': [
    { t: 0, c: [0.73, 0.05, 0.18] },
    { t: 0.5, c: [1.0, 1.0, 1.0] },
    { t: 1, c: [0.0, 0.13, 0.36] },
  ],
};

const PALETTE_LABELS: Readonly<Record<string, string>> = {
  'warm-amber': 'Warm amber',
  'mineral-blue': 'Mineral blue',
  'soft-white': 'Soft white',
  'dusty-rose': 'Dusty rose',
  'classic-green': 'Oscilloscope green',
  neon: 'Electric spectrum',
  fire: 'Fire',
  ice: 'Ice',
  mono: 'Monochrome',
  'norwegian-flow': 'Norwegian flow',
  'norwegian-flag': 'Norwegian flag',
};

export const PALETTE_IDS = Object.keys(PALETTES);

export function paletteLabel(id: string): string {
  return PALETTE_LABELS[id] ?? id;
}

function lerpStops(stops: Stop[], t: number): RGB {
  const x = clamp(t, 0, 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (x <= b.t) {
      const f = (x - a.t) / (b.t - a.t || 1);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * f,
        a.c[1] + (b.c[1] - a.c[1]) * f,
        a.c[2] + (b.c[2] - a.c[2]) * f,
      ];
    }
  }
  return stops[stops.length - 1].c;
}

/** Resolve a palette colour at brightness `t`, scaled by `intensity`. */
export function paletteColor(id: string, t: number, intensity: number): RGB {
  const stops = PALETTES[id] ?? PALETTES['warm-amber'];
  const base = lerpStops(stops, t);
  const k = clamp(intensity, 0, 4);
  return [base[0] * k, base[1] * k, base[2] * k];
}

/** Resolve a validated #rrggbb colour. Invalid values fall back to warm amber. */
export function customColor(hex: string, intensity: number): RGB {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(hex);
  if (!match) return paletteColor('warm-amber', 0.5, intensity);
  const k = clamp(intensity, 0, 4);
  return [
    (Number.parseInt(match[1], 16) / 255) * k,
    (Number.parseInt(match[2], 16) / 255) * k,
    (Number.parseInt(match[3], 16) / 255) * k,
  ];
}
