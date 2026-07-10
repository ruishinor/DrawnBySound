import { clamp } from '../../util/math';
import type { XYMode } from './types';

/** Stereo XY (PRD §18.1): x = left, y = right. */
export const StereoXY: XYMode = {
  id: 'stereo-xy',
  label: 'Stereo XY',
  build(out, ctx) {
    const { left, right, count } = ctx;
    const k = ctx.gain * ctx.scale;
    const kx = k * ctx.spread; // stereo width -> horizontal spread (PRD §18.2)
    for (let i = 0; i < count; i++) {
      out[2 * i] = clamp(left[i] * kx, -1, 1);
      out[2 * i + 1] = clamp(right[i] * k, -1, 1);
    }
  },
};
