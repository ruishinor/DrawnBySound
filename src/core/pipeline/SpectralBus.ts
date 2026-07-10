import { BAND_COUNT } from '../features/spectral';

/**
 * Shared scalar bus for spectral features written by the features Worker and
 * read by the main thread. Layout: bands[BAND_COUNT], centroid, flux, onset,
 * stereoWidth, counter.
 */
export const SPEC = {
  BANDS: 0,
  CENTROID: BAND_COUNT,
  FLUX: BAND_COUNT + 1,
  ONSET: BAND_COUNT + 2,
  WIDTH: BAND_COUNT + 3,
  COUNTER: BAND_COUNT + 4,
  LEN: BAND_COUNT + 5,
} as const;

export class SpectralBus {
  readonly sab: SharedArrayBuffer;
  private readonly f: Float32Array;

  private constructor(sab: SharedArrayBuffer) {
    this.sab = sab;
    this.f = new Float32Array(sab, 0, SPEC.LEN);
  }

  static create(): SpectralBus {
    return new SpectralBus(new SharedArrayBuffer(SPEC.LEN * 4));
  }

  static attach(sab: SharedArrayBuffer): SpectralBus {
    return new SpectralBus(sab);
  }

  set(index: number, value: number): void {
    this.f[index] = value;
  }

  get(index: number): number {
    return this.f[index];
  }

  readBands(out: Float32Array): void {
    for (let b = 0; b < BAND_COUNT; b++) out[b] = this.f[SPEC.BANDS + b];
  }

  get centroid(): number {
    return this.f[SPEC.CENTROID];
  }
  get flux(): number {
    return this.f[SPEC.FLUX];
  }
  get onset(): number {
    return this.f[SPEC.ONSET];
  }
  get stereoWidth(): number {
    return this.f[SPEC.WIDTH];
  }
  get counter(): number {
    return this.f[SPEC.COUNTER];
  }
}
