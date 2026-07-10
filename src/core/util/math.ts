/** Small, dependency-free math helpers shared across the DOM-free core. */

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** GLSL-style smoothstep with clamped, eased interpolation between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * One-pole exponential-moving-average coefficient for a target time constant.
 * Used to smooth noisy audio features (PRD §15.4). Returns a value in (0, 1].
 */
export function emaAlpha(dtSeconds: number, tauSeconds: number): number {
  if (tauSeconds <= 0) return 1;
  return 1 - Math.exp(-dtSeconds / tauSeconds);
}
