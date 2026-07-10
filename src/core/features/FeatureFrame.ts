import { BAND_COUNT } from './spectral';

/** Broad timbre categories (populated by the M6 classifier; optional until then). */
export type Category =
  | 'percussion'
  | 'bass'
  | 'strings'
  | 'keys'
  | 'guitar'
  | 'synth'
  | 'brass_wind'
  | 'voice'
  | 'ambient'
  | 'unknown';

/**
 * The stable seam between analysis and visuals (PRD §15.4). Every field is
 * normalized + smoothed and safe to read even when stale. Fast fields come from
 * the AudioWorklet; spectral fields from the features Worker; musical/classes
 * fields are optional (added in later milestones).
 */
export interface FeatureFrame {
  // fast (AudioWorklet)
  rms: number;
  peak: number;
  clip: boolean;
  zcr: number;
  envelope: number;
  gain: number;
  // spectral (features Worker)
  bands: Float32Array;
  centroid: number;
  flux: number;
  onset: number;
  stereoWidth: number;
  // musical (M-later, optional)
  tempo?: number;
  beatPhase?: number;
  chroma?: Float32Array;
  pitchConf?: number;
  // classification (M6, optional)
  classes?: Record<Category, number>;
  voicePresent?: number;
  // freshness guard
  tLastUpdate: number;
}

export function createFeatureFrame(): FeatureFrame {
  return {
    rms: 0,
    peak: 0,
    clip: false,
    zcr: 0,
    envelope: 0,
    gain: 1,
    bands: new Float32Array(BAND_COUNT),
    centroid: 0,
    flux: 0,
    onset: 0,
    stereoWidth: 0,
    tLastUpdate: 0,
  };
}
