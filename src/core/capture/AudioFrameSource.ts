/**
 * The renderer's view of audio, independent of where samples come from
 * (decoded file in M1; live mic via ring buffer in M2; system capture in M7).
 * Keeping this seam stable means the renderer never changes as inputs evolve.
 */
export interface AudioFrameSource {
  readonly sampleRate: number;
  readonly channels: 1 | 2;
  /**
   * Copy the most recent `count` samples into `left`/`right`. Mono sources
   * duplicate into both. Returns false when no audio is currently available
   * (so the caller lets the trace decay).
   */
  read(left: Float32Array, right: Float32Array, count: number): boolean;
}
