/**
 * RBJ biquad band-pass filter applied over a buffer with zero initial state.
 * Used by Band XY to derive two band-limited time-domain signals (PRD §18.1).
 */
export function bandpass(
  input: Float32Array,
  output: Float32Array,
  n: number,
  sampleRate: number,
  centerHz: number,
  q: number,
): void {
  const w0 = (2 * Math.PI * centerHz) / sampleRate;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * cosw) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i++) {
    const x = input[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; // b1 = 0
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[i] = y;
  }
}
