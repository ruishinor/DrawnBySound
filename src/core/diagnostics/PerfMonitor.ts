/** Smoothed frame-rate monitor (PRD §19.3). Feed frame deltas in milliseconds. */
export class PerfMonitor {
  private fps = 60;

  constructor(private readonly alpha = 0.1) {}

  /** Update with the latest frame delta (ms) and return the smoothed fps. */
  update(dtMs: number): number {
    const inst = 1000 / Math.max(dtMs, 1e-3);
    this.fps += (inst - this.fps) * this.alpha;
    return this.fps;
  }

  get value(): number {
    return this.fps;
  }
}
