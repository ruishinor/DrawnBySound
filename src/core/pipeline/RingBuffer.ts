/**
 * Lock-free, single-producer / single-consumer ring buffer over a
 * SharedArrayBuffer. The AudioWorklet (producer) writes fixed-size blocks; the
 * render loop (consumer) reads the most-recent window. The consumer never
 * blocks and always gets the latest samples (PRD §15.2/§15.3).
 *
 * Layout: [control: Int32 * 8][data: Float32 * channels * capacity].
 * control[0] = monotonically increasing write position in frames.
 */
export class RingBuffer {
  static readonly CONTROL_INTS = 8;

  readonly sab: SharedArrayBuffer;
  readonly capacity: number;
  readonly channels: number;
  private readonly control: Int32Array;
  private readonly data: Float32Array;

  private constructor(sab: SharedArrayBuffer, capacity: number, channels: number) {
    this.sab = sab;
    this.capacity = capacity;
    this.channels = channels;
    this.control = new Int32Array(sab, 0, RingBuffer.CONTROL_INTS);
    this.data = new Float32Array(sab, RingBuffer.CONTROL_INTS * 4, channels * capacity);
  }

  static byteLength(capacity: number, channels: number): number {
    return RingBuffer.CONTROL_INTS * 4 + channels * capacity * 4;
  }

  static create(capacity: number, channels: number): RingBuffer {
    const sab = new SharedArrayBuffer(RingBuffer.byteLength(capacity, channels));
    return new RingBuffer(sab, capacity, channels);
  }

  /** Attach to an existing SAB (e.g. inside the AudioWorklet). */
  static attach(sab: SharedArrayBuffer, capacity: number, channels: number): RingBuffer {
    return new RingBuffer(sab, capacity, channels);
  }

  /** Total frames written since creation (monotonic). */
  get writeFrame(): number {
    return Atomics.load(this.control, 0);
  }

  /** Frames currently retrievable (capped at capacity). */
  availableFrames(): number {
    return Math.min(this.writeFrame, this.capacity);
  }

  /** Producer: append `frames` samples per channel. */
  write(channelData: readonly Float32Array[], frames: number): void {
    const cap = this.capacity;
    const w = Atomics.load(this.control, 0);
    const pos = ((w % cap) + cap) % cap;
    const firstRun = Math.min(frames, cap - pos);
    for (let c = 0; c < this.channels; c++) {
      const src = channelData[c];
      const base = c * cap;
      for (let i = 0; i < firstRun; i++) this.data[base + pos + i] = src[i];
      for (let i = firstRun; i < frames; i++) this.data[base + (i - firstRun)] = src[i];
    }
    Atomics.store(this.control, 0, w + frames);
  }

  /**
   * Consumer: copy the most-recent `frames` samples into `out` (one Float32Array
   * per channel). Frames before any data are zero-filled. Returns false if
   * nothing has been written yet.
   */
  readLatest(out: Float32Array[], frames: number): boolean {
    const cap = this.capacity;
    const w = Atomics.load(this.control, 0);
    if (w <= 0) return false;
    const start = w - frames;
    for (let c = 0; c < this.channels; c++) {
      const base = c * cap;
      const dst = out[c];
      for (let i = 0; i < frames; i++) {
        const g = start + i;
        dst[i] = g < 0 ? 0 : this.data[base + (g % cap)];
      }
    }
    return true;
  }
}
