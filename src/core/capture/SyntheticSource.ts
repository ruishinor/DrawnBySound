import type { AudioFrameSource } from './AudioFrameSource';

/**
 * Deterministic Lissajous test signal — no AudioContext needed. Drives the
 * default first-run visual and gives the M1 gate a stable, reproducible figure
 * to screenshot. Each window holds one complete figure; phase drifts for motion.
 */
export class SyntheticSource implements AudioFrameSource {
  readonly sampleRate = 48000;
  readonly channels = 2 as const;
  private t = 0;

  constructor(
    private readonly freqX = 3,
    private readonly freqY = 2,
    private readonly driftPerFrame = 0.012,
  ) {}

  read(left: Float32Array, right: Float32Array, count: number): boolean {
    const twoPi = Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const theta = (twoPi * i) / count;
      left[i] = Math.sin(this.freqX * theta + this.t);
      right[i] = Math.sin(this.freqY * theta);
    }
    this.t += this.driftPerFrame;
    return true;
  }
}
