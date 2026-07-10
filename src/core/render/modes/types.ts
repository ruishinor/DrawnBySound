import type { FeatureFrame } from '../../features/FeatureFrame';

/**
 * Everything a mode needs to build its XY geometry: the raw sample windows, the
 * normalized features, a wall clock for parametric motion, and derived shaping
 * parameters. Modes are deterministic and allocation-free in `build`.
 */
export interface ModeContext {
  left: Float32Array;
  right: Float32Array;
  count: number;
  sampleRate: number;
  timeSec: number;
  gain: number;
  scale: number;
  spread: number;
  phaseDelaySamples: number;
  frame: FeatureFrame;
}

export interface XYMode {
  readonly id: string;
  readonly label: string;
  /** Fill `out` (length >= count*2, interleaved x,y in NDC [-1,1]). */
  build(out: Float32Array, ctx: ModeContext): void;
}
