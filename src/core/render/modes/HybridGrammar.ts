import { clamp, lerp } from '../../util/math';
import { StereoXY } from './StereoXY';
import { BeatLissajous } from './BeatLissajous';
import type { XYMode } from './types';

const MAX = 8192;
const a = new Float32Array(MAX * 2);
const b = new Float32Array(MAX * 2);

/**
 * Hybrid Instrument Grammar (PRD §18.1, §13.7): blends the signal-driven Stereo
 * XY with the parametric Beat Lissajous. The blend weight is feature-derived for
 * now (onset + stereo width); the M6 classifier will drive it by category.
 */
export const HybridGrammar: XYMode = {
  id: 'hybrid-grammar',
  label: 'Hybrid Grammar',
  build(out, ctx) {
    const n = Math.min(ctx.count, MAX);
    StereoXY.build(a, ctx);
    BeatLissajous.build(b, ctx);
    // Blend toward the parametric figure for percussion/synth, toward the raw
    // signal for strings/bass. Falls back to features when no classifier (§18.3).
    let w = 0.4 * ctx.frame.onset + 0.6 * ctx.frame.stereoWidth;
    const cls = ctx.frame.classes;
    if (cls) w += (cls.percussion + cls.synth) - (cls.strings + cls.bass);
    w = clamp(w, 0, 1);
    for (let i = 0; i < n; i++) {
      out[2 * i] = lerp(a[2 * i], b[2 * i], w);
      out[2 * i + 1] = lerp(a[2 * i + 1], b[2 * i + 1], w);
    }
  },
};
