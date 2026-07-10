import { CATEGORIES } from '../classify/Classifier';

const N = CATEGORIES.length;

/**
 * Shared bus for classifier outputs written by the features Worker and read by
 * the main thread. Layout: scores[N], voicePresent, confidence, dominantIdx,
 * counter.
 */
export const CLASS = {
  SCORES: 0,
  VOICE: N,
  CONFIDENCE: N + 1,
  DOMINANT: N + 2,
  COUNTER: N + 3,
  LEN: N + 4,
} as const;

export class ClassBus {
  readonly sab: SharedArrayBuffer;
  private readonly f: Float32Array;

  private constructor(sab: SharedArrayBuffer) {
    this.sab = sab;
    this.f = new Float32Array(sab, 0, CLASS.LEN);
  }

  static create(): ClassBus {
    return new ClassBus(new SharedArrayBuffer(CLASS.LEN * 4));
  }

  static attach(sab: SharedArrayBuffer): ClassBus {
    return new ClassBus(sab);
  }

  set(index: number, value: number): void {
    this.f[index] = value;
  }

  readScores(out: Float32Array): void {
    for (let i = 0; i < N; i++) out[i] = this.f[CLASS.SCORES + i];
  }

  get voicePresent(): number {
    return this.f[CLASS.VOICE];
  }
  get confidence(): number {
    return this.f[CLASS.CONFIDENCE];
  }
  get dominant(): number {
    return this.f[CLASS.DOMINANT];
  }
  get counter(): number {
    return this.f[CLASS.COUNTER];
  }
}
