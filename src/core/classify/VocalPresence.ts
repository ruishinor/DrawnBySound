import { clamp } from '../util/math';
import type { ClassifierInput } from './Classifier';

/**
 * Vocal *presence* heuristic (PRD §13.6, §17): voices concentrate energy in the
 * mid / high-mid bands (~400–2500 Hz) with moderate flux and aren't strongly
 * percussive. Returns a probability in [0,1]. Detects presence only — never
 * transcribes or interprets lyrics.
 */
export function voiceProbability(input: ClassifierInput): number {
  const b = input.bands;
  let total = 0;
  for (let i = 0; i < b.length; i++) total += b[i];
  if (total < 1e-4) return 0;
  const midRatio = (b[3] + b[4]) / (total + 1e-6); // mid + high-mid
  return clamp(midRatio * 1.6 - input.onset * 0.5, 0, 1);
}
