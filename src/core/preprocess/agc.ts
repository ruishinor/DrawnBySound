import { clamp } from '../util/math';

export interface AgcOptions {
  /** Target RMS the gain drives the signal toward. */
  targetRms: number;
  /** Gain bounds. */
  minGain: number;
  maxGain: number;
  /** Smoothing of the measured input level (0..1 per block). */
  levelSmoothing: number;
  /** Gain-change rate when reducing gain (level rising) — fast. */
  attack: number;
  /** Gain-change rate when increasing gain (level falling) — slow. */
  release: number;
  /** |sample| at/above this counts as clipping. */
  clipThreshold: number;
}

export const DEFAULT_AGC: AgcOptions = {
  targetRms: 0.2,
  minGain: 0.1,
  maxGain: 20,
  levelSmoothing: 0.2,
  attack: 0.5,
  release: 0.02,
  clipThreshold: 0.99,
};

export interface AgcResult {
  gain: number;
  rms: number;
  peak: number;
  clipped: boolean;
}

/**
 * Soft limiter: linear below the knee, tanh-saturating above, so loud peaks are
 * tamed without hard edges. Output is bounded to (-1, 1).
 */
export function softLimit(x: number, knee = 0.8): number {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const over = a - knee;
  const limited = knee + (1 - knee) * Math.tanh(over / (1 - knee));
  return Math.sign(x) * limited;
}

/**
 * Automatic gain control with clipping protection (PRD §13.2). Computes a
 * smoothed gain per block from the input level; callers apply `gain` (then
 * softLimit) to the samples. Because gain backs off on loud input, the signal
 * recovers rather than staying distorted.
 */
export class Agc {
  private gain = 1;
  private levelEnv = 0;
  private readonly opt: AgcOptions;

  constructor(options: Partial<AgcOptions> = {}) {
    this.opt = { ...DEFAULT_AGC, ...options };
  }

  get currentGain(): number {
    return this.gain;
  }

  reset(): void {
    this.gain = 1;
    this.levelEnv = 0;
  }

  /** Analyze a block and advance the internal gain. Does not mutate `block`. */
  update(block: Float32Array, n = block.length): AgcResult {
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const x = block[i];
      sumSq += x * x;
      const a = Math.abs(x);
      if (a > peak) peak = a;
    }
    const rms = n > 0 ? Math.sqrt(sumSq / n) : 0;

    this.levelEnv = this.levelEnv + (rms - this.levelEnv) * this.opt.levelSmoothing;
    const target = clamp(
      this.opt.targetRms / (this.levelEnv + 1e-6),
      this.opt.minGain,
      this.opt.maxGain,
    );
    const rate = target < this.gain ? this.opt.attack : this.opt.release;
    this.gain += (target - this.gain) * rate;

    const clipped = peak >= this.opt.clipThreshold || peak * this.gain >= this.opt.clipThreshold;
    return { gain: this.gain, rms, peak, clipped };
  }
}
