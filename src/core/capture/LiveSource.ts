import type { AudioFrameSource } from './AudioFrameSource';
import type { RingBuffer } from '../pipeline/RingBuffer';

/**
 * Renderer-facing view of the live audio captured into the ring buffer by the
 * AudioWorklet. Same `AudioFrameSource` contract as the file source, so the
 * renderer is unchanged across input modes (PRD §15.2).
 */
export class LiveSource implements AudioFrameSource {
  readonly sampleRate: number;
  readonly channels = 2 as const;
  private monoScratch: Float32Array;

  constructor(
    private readonly ring: RingBuffer,
    sampleRate: number,
    maxWindow = 4096,
  ) {
    this.sampleRate = sampleRate;
    this.monoScratch = new Float32Array(maxWindow);
  }

  read(left: Float32Array, right: Float32Array, count: number): boolean {
    if (this.ring.availableFrames() <= 0) return false;
    if (this.monoScratch.length < count) this.monoScratch = new Float32Array(count);
    // ring channels: 0=L, 1=R, 2=mono. Renderer needs L/R; mono goes to scratch.
    return this.ring.readLatest([left, right, this.monoScratch], count);
  }
}
