/**
 * Tiny shared scalar bus for fast frame features written by the AudioWorklet
 * and read by the main thread each render frame. 32-bit float reads/writes;
 * occasional tearing is harmless for visualization (PRD §15.4). The COUNTER
 * lets the consumer detect a stalled audio thread.
 */
export const FAST = {
  RMS: 0,
  PEAK: 1,
  CLIP: 2,
  ZCR: 3,
  ENVELOPE: 4,
  GAIN: 5,
  COUNTER: 6,
  LEN: 7,
} as const;

export class FeatureBus {
  readonly sab: SharedArrayBuffer;
  private readonly f: Float32Array;

  private constructor(sab: SharedArrayBuffer) {
    this.sab = sab;
    this.f = new Float32Array(sab, 0, FAST.LEN);
  }

  static create(): FeatureBus {
    return new FeatureBus(new SharedArrayBuffer(FAST.LEN * 4));
  }

  static attach(sab: SharedArrayBuffer): FeatureBus {
    return new FeatureBus(sab);
  }

  set(index: number, value: number): void {
    this.f[index] = value;
  }

  get(index: number): number {
    return this.f[index];
  }

  get rms(): number {
    return this.f[FAST.RMS];
  }
  get peak(): number {
    return this.f[FAST.PEAK];
  }
  get clipped(): boolean {
    return this.f[FAST.CLIP] >= 0.5;
  }
  get gain(): number {
    return this.f[FAST.GAIN];
  }
  get counter(): number {
    return this.f[FAST.COUNTER];
  }
}
