import { clamp } from '../../util/math';
import type { XYMode } from './types';

/**
 * Beat-Locked Lissajous (PRD §18.1): a parametric figure whose amplitude tracks
 * energy and whose modulation pulses on transients. Phase advances on a wall
 * clock (beat phase wires in with the M-later tempo features).
 */
export const BeatLissajous: XYMode = {
  id: 'beat-lissajous',
  label: 'Beat Lissajous',
  build(out, ctx) {
    const { count, frame, timeSec } = ctx;
    const amp = 0.3 + 0.7 * clamp(frame.rms, 0, 1);
    const mod = 1 + 0.6 * clamp(frame.onset, 0, 1);
    const k = ctx.scale * amp * mod;
    const a = 3;
    const b = 2;
    const phase = timeSec * 0.8;
    const twoPi = Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const th = (twoPi * i) / count;
      out[2 * i] = clamp(Math.sin(a * th + phase) * k, -1, 1);
      out[2 * i + 1] = clamp(Math.sin(b * th) * k, -1, 1);
    }
  },
};
