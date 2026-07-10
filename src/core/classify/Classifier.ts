import type { Category } from '../features/FeatureFrame';

/** The broad categories the classifier scores (PRD §13.6). */
export const CATEGORIES: readonly Category[] = [
  'percussion',
  'bass',
  'strings',
  'keys',
  'guitar',
  'synth',
  'brass_wind',
  'voice',
  'ambient',
  'unknown',
];

/** Features the classifier consumes (already normalized/smoothed). */
export interface ClassifierInput {
  bands: Float32Array; // 7 bands
  centroid: number;
  flux: number;
  onset: number;
  stereoWidth: number;
  rms: number;
  zcr: number;
}

export interface ClassResult {
  scores: Float32Array; // probabilities aligned to CATEGORIES, sum ~1
  dominant: Category;
  confidence: number; // probability of the dominant category
  voicePresent: number; // [0,1], presence only (no transcription)
}

export interface Classifier {
  classify(input: ClassifierInput): ClassResult;
}
