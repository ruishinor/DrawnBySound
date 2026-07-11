/** Per-frame rendering parameters produced by the visual grammar (PRD §13.7). */
export interface RenderParams {
  /** Geometry scale (bass-driven). */
  scale: number;
  /** Trace brightness (amplitude-driven). */
  intensity: number;
  /** Temporal persistence / decay in [0,1]. */
  decay: number;
  /** Bloom strength (0 disables). */
  bloom: number;
  /** Base trace color from palette × brightness. */
  color: [number, number, number];
  /** Trace color behavior. Existing palettes remain uniform/solid. */
  colorMode: 'solid' | 'norwegian-flow' | 'norwegian-flag';
  /** Seconds driving only animated Norwegian color fields; 0 freezes them. */
  colorFlowTime: number;
  /** Transient burst amount in [0,1] (onset-driven). */
  burst: number;
  /** Horizontal/vertical spread from stereo width. */
  spread: number;
  /** Internal render-target scale for low-power mode (<1 lowers resolution). */
  resolutionScale: number;
}
