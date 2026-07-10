import { clamp } from '../../util/math';
import { bandpass } from './biquad';
import type { XYMode } from './types';

const MAX = 8192;
const mono = new Float32Array(MAX);
const low = new Float32Array(MAX);
const high = new Float32Array(MAX);

/**
 * Band XY (PRD §18.1): x = low-mid band signal, y = high-mid band signal.
 * The mono signal is band-pass filtered into two bands in the time domain, so
 * the figure reflects how energy moves between low and high frequencies.
 */
export const BandXY: XYMode = {
  id: 'band-xy',
  label: 'Band XY',
  build(out, ctx) {
    const { left, right, count, sampleRate } = ctx;
    const n = Math.min(count, MAX);
    for (let i = 0; i < n; i++) mono[i] = 0.5 * (left[i] + right[i]);
    bandpass(mono, low, n, sampleRate, 300, 0.7);
    bandpass(mono, high, n, sampleRate, 2200, 0.7);
    const k = ctx.gain * ctx.scale * 4; // band-pass attenuates; restore visible amplitude
    for (let i = 0; i < n; i++) {
      out[2 * i] = clamp(low[i] * k, -1, 1);
      out[2 * i + 1] = clamp(high[i] * k, -1, 1);
    }
  },
};
