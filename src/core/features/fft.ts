/** In-place iterative radix-2 Cooley–Tukey FFT (length must be a power of two). */
export function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new Error(`FFT length must be a power of two, got ${n}`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k;
        const b = a + (len >> 1);
        const tr = re[b] * cwr - im[b] * cwi;
        const ti = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = ncwr;
      }
    }
  }
}

/**
 * Magnitude spectrum of a real signal. `re`/`im` are reused scratch buffers of
 * length fftSize; `out` receives bins 0..fftSize/2. No allocation.
 */
export function realMagnitude(
  frame: Float32Array,
  re: Float32Array,
  im: Float32Array,
  out: Float32Array,
): void {
  const n = re.length;
  for (let i = 0; i < n; i++) {
    re[i] = i < frame.length ? frame[i] : 0;
    im[i] = 0;
  }
  fftRadix2(re, im);
  const half = n >> 1;
  for (let k = 0; k <= half; k++) {
    out[k] = Math.hypot(re[k], im[k]);
  }
}
