import { clamp } from '../util/math';

/** One-pole exponential moving average. */
export class Ema {
  private y = 0;
  private initialized = false;

  constructor(private readonly alpha: number) {}

  push(x: number): number {
    if (!this.initialized) {
      this.y = x;
      this.initialized = true;
    } else {
      this.y += (x - this.y) * this.alpha;
    }
    return this.y;
  }

  get value(): number {
    return this.y;
  }

  reset(): void {
    this.y = 0;
    this.initialized = false;
  }
}

/**
 * Maps an unbounded positive feature into [0,1] against a slowly-decaying
 * running maximum, so features auto-scale to the material (PRD §15.4) without
 * fixed magic thresholds.
 */
export class AdaptiveNormalizer {
  private max: number;

  constructor(
    private readonly decay = 0.9995,
    private readonly floor = 1e-5,
  ) {
    this.max = floor;
  }

  normalize(x: number): number {
    const ax = Math.abs(x);
    if (ax > this.max) this.max = ax;
    else this.max = Math.max(this.floor, this.max * this.decay);
    return clamp(ax / this.max, 0, 1);
  }

  reset(): void {
    this.max = this.floor;
  }
}
