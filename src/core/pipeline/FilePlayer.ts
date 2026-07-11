import { clamp } from '../util/math';
import type { AudioGraph } from './AudioGraph';
import type { TransportPlayer } from './TransportPlayer';

/**
 * In-app file player with transport (PRD §13.3). AudioBufferSourceNode has no
 * native pause/seek, so we recreate the node at an offset. The visualizer reads
 * from the ring buffer, so it stays synchronized through pause/seek automatically.
 */
export class FilePlayer implements TransportPlayer {
  private node: AudioBufferSourceNode | null = null;
  private startCtxTime = 0;
  private offset = 0;
  private playing = false;

  constructor(
    private readonly graph: AudioGraph,
    private readonly buffer: AudioBuffer,
  ) {}

  get duration(): number {
    return this.buffer.duration;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentTime(): number {
    if (!this.playing) return this.offset;
    return clamp(this.offset + (this.graph.ctx.currentTime - this.startCtxTime), 0, this.duration);
  }

  async play(): Promise<void> {
    if (this.playing) return;
    await this.graph.resume();
    this.startAt(this.offset >= this.duration ? 0 : this.offset);
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.currentTime;
    this.stopNode();
    this.playing = false;
  }

  seek(seconds: number): void {
    const t = clamp(seconds, 0, this.duration);
    this.offset = t;
    if (this.playing) {
      this.stopNode();
      this.startAt(t);
    }
  }

  stop(): void {
    this.stopNode();
    this.playing = false;
    this.offset = 0;
  }

  private startAt(off: number): void {
    const ctx = this.graph.ctx;
    const node = ctx.createBufferSource();
    node.buffer = this.buffer;
    node.connect(this.graph.node); // analysis (ring + features)
    node.connect(ctx.destination); // audible
    node.onended = () => {
      // Natural end (not a manual stop/seek): settle at the end, paused.
      if (this.node === node) {
        this.playing = false;
        this.offset = this.duration;
        this.node = null;
      }
    };
    node.start(0, off);
    this.node = node;
    this.startCtxTime = ctx.currentTime;
    this.playing = true;
  }

  private stopNode(): void {
    if (this.node) {
      this.node.onended = null;
      try {
        this.node.stop();
      } catch {
        /* already stopped */
      }
      this.node.disconnect();
      this.node = null;
    }
  }
}
