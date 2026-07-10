import { clamp } from '../util/math';
import { CATEGORIES, type Classifier, type ClassifierInput, type ClassResult } from './Classifier';
import { voiceProbability } from './VocalPresence';
import type { Category } from '../features/FeatureFrame';

const N = CATEGORIES.length;
const IDX: Record<Category, number> = Object.fromEntries(CATEGORIES.map((c, i) => [c, i])) as Record<
  Category,
  number
>;

/**
 * Rule-based broad timbre classifier (PRD §13.6) — no ML dependency for the MVP.
 * Emits smoothed, hysteretic probabilities so single-frame changes never flip
 * the dominant category abruptly. An on-device model can later replace this
 * behind the same `Classifier` interface.
 */
export class HeuristicClassifier implements Classifier {
  private readonly ema = new Float32Array(N);
  private readonly raw = new Float32Array(N);
  private readonly result: ClassResult = {
    scores: new Float32Array(N),
    dominant: 'unknown',
    confidence: 0,
    voicePresent: 0,
  };
  private dominantIdx = N - 1; // 'unknown'

  constructor(
    private readonly alpha = 0.3,
    private readonly hysteresisMargin = 0.06,
  ) {}

  classify(input: ClassifierInput): ClassResult {
    const b = input.bands;
    const sub = b[0];
    const bass = b[1];
    const lowMid = b[2];
    const mid = b[3];
    const highMid = b[4];
    const treble = b[5];
    const air = b[6];
    const bright = input.centroid;
    const sustained = 1 - clamp(input.onset, 0, 1);
    const voice = voiceProbability(input);

    const r = this.raw;
    r[IDX.percussion] = clamp(input.onset * 1.6 + input.flux * 0.8 - 0.2, 0, 2);
    r[IDX.bass] = clamp(sub + bass - 0.6 * bright, 0, 2);
    r[IDX.strings] = clamp(sustained * (lowMid + mid) - 0.3, 0, 2);
    r[IDX.keys] = clamp(input.onset * 0.6 + mid + highMid * 0.5, 0, 2);
    r[IDX.guitar] = clamp(input.onset * 0.7 + lowMid + highMid * 0.4, 0, 2);
    r[IDX.synth] = clamp(input.stereoWidth + highMid + treble + bright * 0.5, 0, 2);
    r[IDX.brass_wind] = clamp(sustained * (mid + highMid) + bright * 0.4 - 0.2, 0, 2);
    r[IDX.voice] = clamp(voice * 1.4, 0, 2);
    r[IDX.ambient] = clamp((input.rms < 0.04 ? 1 : 0) + (air + sustained * 0.2) - 0.1, 0, 2);
    r[IDX.unknown] = 0.15; // baseline so low-energy material stays low-confidence

    // Normalize to a probability distribution, then smooth.
    let sum = 0;
    for (let i = 0; i < N; i++) sum += r[i];
    if (sum < 1e-6) {
      this.ema[IDX.unknown] += (1 - this.ema[IDX.unknown]) * this.alpha;
    } else {
      for (let i = 0; i < N; i++) {
        const p = r[i] / sum;
        this.ema[i] += (p - this.ema[i]) * this.alpha;
      }
    }

    // Hysteresis: only switch dominant if a challenger clears the margin.
    let best = 0;
    for (let i = 1; i < N; i++) if (this.ema[i] > this.ema[best]) best = i;
    if (best !== this.dominantIdx && this.ema[best] > this.ema[this.dominantIdx] + this.hysteresisMargin) {
      this.dominantIdx = best;
    }

    this.result.scores.set(this.ema);
    this.result.dominant = CATEGORIES[this.dominantIdx];
    this.result.confidence = this.ema[this.dominantIdx];
    this.result.voicePresent = voice;
    return this.result;
  }
}
