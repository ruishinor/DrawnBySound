import { clamp } from '../util/math';

export type RGB = [number, number, number];

interface Stop {
  t: number;
  c: RGB;
}

/** Color palettes mapped by brightness t∈[0,1] (spectral centroid). PRD §13.9. */
const PALETTES: Record<string, Stop[]> = {
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
};

export const PALETTE_IDS = Object.keys(PALETTES);

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

/** Resolve a palette color at brightness `t`, scaled by `intensity`. */
export function paletteColor(id: string, t: number, intensity: number): RGB {
  const stops = PALETTES[id] ?? PALETTES['classic-green'];
  const base = lerpStops(stops, t);
  const k = clamp(intensity, 0, 4);
  return [base[0] * k, base[1] * k, base[2] * k];
}
