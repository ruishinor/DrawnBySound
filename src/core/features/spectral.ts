import { clamp } from '../util/math';
import { realMagnitude } from './fft';
import { Ema, AdaptiveNormalizer } from './smoothing';

/** Band edges in Hz -> 7 bands: sub-bass, bass, low-mid, mid, high-mid, treble, air. */
export const BAND_EDGES_HZ = [20, 60, 150, 400, 1000, 2500, 6000, 20000] as const;
export const BAND_COUNT = BAND_EDGES_HZ.length - 1;

export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

/** Spectral centroid (brightness) in Hz; 0 when the frame is silent. */
export function spectralCentroidHz(mag: Float32Array, sampleRate: number, fftSize: number): number {
  let num = 0;
  let den = 0;
  const binHz = sampleRate / fftSize;
  for (let k = 0; k < mag.length; k++) {
    num += k * binHz * mag[k];
    den += mag[k];
  }
  return den > 1e-9 ? num / den : 0;
}

/** Energy per band (sum of magnitude^2 in each band's bin range). */
export function bandEnergies(
  mag: Float32Array,
  sampleRate: number,
  fftSize: number,
  out: Float32Array,
  edges: readonly number[] = BAND_EDGES_HZ,
): void {
  const binHz = sampleRate / fftSize;
  for (let b = 0; b < out.length; b++) out[b] = 0;
  for (let k = 0; k < mag.length; k++) {
    const hz = k * binHz;
    for (let b = 0; b < edges.length - 1; b++) {
      if (hz >= edges[b] && hz < edges[b + 1]) {
        out[b] += mag[k] * mag[k];
        break;
      }
    }
  }
}

/** Spectral flux: sum of positive bin-to-bin magnitude increases (onset cue). */
export function spectralFlux(mag: Float32Array, prevMag: Float32Array): number {
  let flux = 0;
  for (let k = 0; k < mag.length; k++) {
    const d = mag[k] - prevMag[k];
    if (d > 0) flux += d;
  }
  return flux;
}

/** Stereo width via mid/side energy ratio; ~0 for mono, larger for wide/anti-phase. */
export function stereoWidth(left: Float32Array, right: Float32Array, n: number): number {
  let midSq = 0;
  let sideSq = 0;
  for (let i = 0; i < n; i++) {
    const mid = 0.5 * (left[i] + right[i]);
    const side = 0.5 * (left[i] - right[i]);
    midSq += mid * mid;
    sideSq += side * side;
  }
  const mid = Math.sqrt(midSq / n);
  const side = Math.sqrt(sideSq / n);
  return clamp(side / (mid + side + 1e-9), 0, 1);
}

export interface SpectralResult {
  bands: Float32Array; // normalized [0,1]
  centroid: number; // normalized [0,1] (0..Nyquist)
  flux: number; // normalized [0,1]
  onset: number; // normalized [0,1], emphasized transients
  stereoWidth: number; // [0,1]
}

/**
 * Stateful spectral analyzer (runs in the features Worker). Produces smoothed,
 * normalized features so the renderer sees stable [0,1] values (PRD §13.5).
 */
export class SpectralAnalyzer {
  readonly fftSize: number;
  private readonly sampleRate: number;
  private readonly window: Float32Array;
  private readonly re: Float32Array;
  private readonly im: Float32Array;
  private readonly mag: Float32Array;
  private readonly prevMag: Float32Array;
  private readonly windowed: Float32Array;
  private readonly bandsRaw: Float32Array;

  private readonly result: SpectralResult;
  private readonly bandNorm: AdaptiveNormalizer[];
  private readonly bandEma: Ema[];
  private readonly fluxNorm = new AdaptiveNormalizer();
  private readonly centroidEma = new Ema(0.3);
  private readonly widthEma = new Ema(0.2);
  private readonly onsetEma = new Ema(0.5);

  constructor(fftSize: number, sampleRate: number) {
    this.fftSize = fftSize;
    this.sampleRate = sampleRate;
    this.window = hannWindow(fftSize);
    this.re = new Float32Array(fftSize);
    this.im = new Float32Array(fftSize);
    this.mag = new Float32Array((fftSize >> 1) + 1);
    this.prevMag = new Float32Array(this.mag.length);
    this.windowed = new Float32Array(fftSize);
    this.bandsRaw = new Float32Array(BAND_COUNT);
    this.result = {
      bands: new Float32Array(BAND_COUNT),
      centroid: 0,
      flux: 0,
      onset: 0,
      stereoWidth: 0,
    };
    this.bandNorm = Array.from({ length: BAND_COUNT }, () => new AdaptiveNormalizer());
    this.bandEma = Array.from({ length: BAND_COUNT }, () => new Ema(0.4));
  }

  process(mono: Float32Array, left: Float32Array, right: Float32Array, n: number): SpectralResult {
    for (let i = 0; i < this.fftSize; i++) {
      this.windowed[i] = i < n ? mono[i] * this.window[i] : 0;
    }
    realMagnitude(this.windowed, this.re, this.im, this.mag);

    bandEnergies(this.mag, this.sampleRate, this.fftSize, this.bandsRaw);
    for (let b = 0; b < BAND_COUNT; b++) {
      this.result.bands[b] = this.bandEma[b].push(this.bandNorm[b].normalize(this.bandsRaw[b]));
    }

    const centroidHz = spectralCentroidHz(this.mag, this.sampleRate, this.fftSize);
    this.result.centroid = this.centroidEma.push(clamp(centroidHz / (this.sampleRate / 2), 0, 1));

    const fluxRaw = spectralFlux(this.mag, this.prevMag);
    this.prevMag.set(this.mag);
    const fluxN = this.fluxNorm.normalize(fluxRaw);
    this.result.flux = fluxN;
    this.result.onset = this.onsetEma.push(fluxN);

    this.result.stereoWidth = this.widthEma.push(stereoWidth(left, right, n));
    return this.result;
  }
}
