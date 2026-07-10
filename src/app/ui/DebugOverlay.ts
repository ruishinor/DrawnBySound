/**
 * Optional technical overlay (PRD §19.3): RMS, clipping, fps, gain, brightness,
 * onset, dominant band. Off by default; shown when settings.showDebug is on.
 */
export interface DebugStats {
  fps: number;
  rms: number;
  gain: number;
  clipped: boolean;
  centroid: number;
  onset: number;
  dominantBand: number;
  mode: string;
  category: string;
  confidence: number;
  voicePresent: number;
}

const BAND_NAMES = ['sub', 'bass', 'low-mid', 'mid', 'high-mid', 'treble', 'air'];

export class DebugOverlay {
  private readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'padding:8px 10px',
      'font:12px ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#9fe',
      'background:#0009',
      'border:1px solid #2a2a44',
      'border-radius:8px',
      'white-space:pre',
      'pointer-events:none',
      'z-index:10',
    ].join(';');
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  update(s: DebugStats): void {
    if (this.el.hidden) return;
    this.el.textContent = [
      `fps      ${s.fps.toFixed(0)}`,
      `mode     ${s.mode}`,
      `rms      ${s.rms.toFixed(3)}`,
      `gain     ${s.gain.toFixed(2)}`,
      `clip     ${s.clipped ? 'YES' : 'no'}`,
      `bright   ${s.centroid.toFixed(3)}`,
      `onset    ${s.onset.toFixed(3)}`,
      `dom band ${BAND_NAMES[s.dominantBand] ?? '-'}`,
      `category ${s.category} ${(s.confidence * 100).toFixed(0)}%`,
      `voice    ${s.voicePresent > 0.5 ? 'present (no lyrics)' : s.voicePresent.toFixed(2)}`,
    ].join('\n');
  }
}
