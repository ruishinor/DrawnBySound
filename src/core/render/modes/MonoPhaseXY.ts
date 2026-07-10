import { clamp } from '../../util/math';
import type { XYMode } from './types';

/**
 * Mono Phase XY (PRD §18.1): x = mono[i], y = mono[i - d]. A pure mono signal
 * traces a diagonal; phase/stereo content opens it into a figure, so mono input
 * still produces interesting visuals.
 */
export const MonoPhaseXY: XYMode = {
  id: 'mono-phase-xy',
  label: 'Mono Phase XY',
  build(out, ctx) {
    const { left, right, count } = ctx;
    const k = ctx.gain * ctx.scale;
    const d = ctx.phaseDelaySamples | 0;
    for (let i = 0; i < count; i++) {
      const mono = 0.5 * (left[i] + right[i]);
      const j = i - d;
      const delayed = j >= 0 ? 0.5 * (left[j] + right[j]) : 0;
      out[2 * i] = clamp(mono * k, -1, 1);
      out[2 * i + 1] = clamp(delayed * k, -1, 1);
    }
  },
};
