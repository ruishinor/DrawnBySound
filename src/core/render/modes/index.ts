import type { XYMode } from './types';
import { StereoXY } from './StereoXY';
import { MonoPhaseXY } from './MonoPhaseXY';
import { BandXY } from './BandXY';
import { BeatLissajous } from './BeatLissajous';
import { HybridGrammar } from './HybridGrammar';

/** The five oscilloscope rendering modes (PRD §13.8). */
export const MODES: readonly XYMode[] = [
  StereoXY,
  MonoPhaseXY,
  BandXY,
  BeatLissajous,
  HybridGrammar,
];

export const MODE_BY_ID: ReadonlyMap<string, XYMode> = new Map(MODES.map((m) => [m.id, m]));

export type { XYMode, ModeContext } from './types';
export { StereoXY, MonoPhaseXY, BandXY, BeatLissajous, HybridGrammar };
