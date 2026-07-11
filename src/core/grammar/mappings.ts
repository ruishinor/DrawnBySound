import { clamp, smoothstep } from '../util/math';
import { paletteColor } from './palettes';
import type { Settings } from '../../app/SettingsStore';
import type { FeatureFrame, Category } from '../features/FeatureFrame';
import type { RenderParams } from '../render/RenderParams';

// Band indices into FeatureFrame.bands (see spectral.ts BAND_EDGES_HZ).
const BASS = 1; // 60–150 Hz
const LOW_MID = 2; // 150–400 Hz

// A category only influences the visuals once it's confident enough; below this
// the renderer falls back to raw feature-driven visualization (PRD §13.6).
const CONFIDENCE_GATE = 0.25;

function dominantCategory(classes: Record<Category, number>): { name: Category; conf: number } {
  let name: Category = 'unknown';
  let conf = 0;
  for (const k in classes) {
    const v = classes[k as Category];
    if (v > conf) {
      conf = v;
      name = k as Category;
    }
  }
  return { name, conf };
}

/**
 * Deterministic visual grammar (PRD §13.7, §18.2): pure function of features +
 * settings -> render parameters. Works with all-zero features and with no
 * classifier (graceful fallback). Reduced-motion suppresses transient
 * bursts/bloom pumping so the output never strobes (PRD §14.5).
 */
export function toRenderParams(frame: FeatureFrame, s: Settings, timeSec = 0): RenderParams {
  const reduced = s.reducedMotion;
  const rms = clamp(frame.rms * s.sensitivity, 0, 1);
  const bass = clamp((frame.bands[BASS] + frame.bands[LOW_MID]) * 0.5, 0, 1);

  let burst = reduced ? 0 : smoothstep(0.3, 1, frame.onset) * s.onsetDrive;
  let scale = s.baseScale * (0.7 + s.bassDrive * bass);
  let decay = reduced ? Math.max(s.persistence, 0.92) : s.persistence;
  let bloom = s.lowPower ? 0 : s.bloom * (reduced ? 1 : 1 + 0.8 * burst);

  // Category influence (PRD §13.6, §18.3) — gated by confidence, blended (the
  // classifier itself is smoothed/hysteretic), and optional.
  if (frame.classes) {
    const { name, conf } = dominantCategory(frame.classes);
    if (conf > CONFIDENCE_GATE) {
      const k = conf;
      if (name === 'bass') scale *= 1 + 0.25 * k;
      else if (name === 'percussion') {
        burst *= 1 + 0.5 * k;
        bloom *= 1 + 0.3 * k;
      } else if (name === 'strings') decay = Math.min(0.985, decay + 0.04 * k);
      else if (name === 'ambient') decay = Math.min(0.985, decay + 0.03 * k);
      else if (name === 'synth') bloom *= 1 + 0.4 * k;
    }
  }

  let intensity = clamp(s.baseIntensity * (0.35 + 0.9 * rms) + 0.5 * burst, 0, 4);

  // Voice presence -> softer envelope abstraction, never transcription (§18.2).
  const voice = frame.voicePresent ?? 0;
  if (voice > 0 && !reduced) {
    intensity *= 1 - 0.2 * voice;
    burst *= 1 - 0.3 * voice;
  }

  const color = paletteColor(s.palette, frame.centroid, intensity);
  const colorMode =
    s.palette === 'norwegian-flow'
      ? 'norwegian-flow'
      : s.palette === 'norwegian-flag'
        ? 'norwegian-flag'
        : 'solid';
  // Reduced-motion freezes only the palette animation. Geometry and all other
  // palette behavior keep following their existing paths.
  const colorFlowTime = colorMode !== 'solid' && !reduced ? timeSec : 0;
  const spread = 0.5 + 0.5 * frame.stereoWidth;
  const resolutionScale = s.lowPower ? 0.6 : 1;

  return {
    scale,
    intensity,
    decay,
    bloom,
    color,
    colorMode,
    colorFlowTime,
    burst,
    spread,
    resolutionScale,
  };
}
