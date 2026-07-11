/** User preferences. Persisted locally; no account or remote sync. */
export type SourcePreference = 'demo' | 'mic' | 'system' | 'file';
export type AppearancePreference = 'system' | 'light' | 'dark';

export interface Settings {
  inputGain: number; // manual amplitude applied to samples
  sensitivity: number; // feature-response multiplier
  persistence: number; // decay [0..0.99]
  bloom: number; // bloom strength [0..1.5]
  baseScale: number;
  baseIntensity: number;
  bassDrive: number; // bass -> scale amount
  onsetDrive: number; // onset -> burst amount
  mode: string; // XY mode id
  palette: string; // palette id
  customColor: string; // #rrggbb
  useCustomColor: boolean;
  preferredSource: SourcePreference; // remembered, never auto-started
  appearance: AppearancePreference; // system, light, or dark interface
  lowPower: boolean;
  reducedMotion: boolean;
  showDebug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  inputGain: 1,
  sensitivity: 1,
  persistence: 0.9,
  bloom: 0.28,
  baseScale: 0.9,
  baseIntensity: 0.95,
  bassDrive: 0.6,
  onsetDrive: 0.8,
  mode: 'stereo-xy',
  palette: 'mono',
  customColor: '#7a9cff',
  useCustomColor: false,
  preferredSource: 'demo',
  appearance: 'system',
  lowPower: false,
  reducedMotion: false,
  showDebug: false,
};

export const SETTINGS_STORAGE_KEY = 'vibratoflow.settings.v3';
const PREVIOUS_KEY = 'vibratoflow.settings.v2';
const LEGACY_KEY = 'vibratoflow.settings.v1';
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const SOURCE_VALUES = new Set<SourcePreference>(['demo', 'mic', 'system', 'file']);
const APPEARANCE_VALUES = new Set<AppearancePreference>(['system', 'light', 'dark']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : undefined;
}

function usesRetiredThemeDefaults(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expected: Readonly<Record<string, unknown>> = {
    inputGain: 1,
    sensitivity: 1,
    persistence: 0.9,
    bloom: 0.28,
    baseScale: 0.9,
    baseIntensity: 0.95,
    bassDrive: 0.6,
    onsetDrive: 0.8,
    mode: 'stereo-xy',
    palette: 'warm-amber',
    customColor: '#c98a55',
    useCustomColor: false,
  };
  return Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
}

/** Ignore malformed or out-of-range persisted values instead of trusting localStorage blindly. */
export function sanitizeSettings(value: unknown): Partial<Settings> {
  if (!isRecord(value)) return {};
  const result: Partial<Settings> = {};

  const numeric: ReadonlyArray<[keyof Settings, number, number]> = [
    ['inputGain', 0.1, 4],
    ['sensitivity', 0.2, 3],
    ['persistence', 0.5, 0.99],
    ['bloom', 0, 1.5],
    ['baseScale', 0.3, 2],
    ['baseIntensity', 0, 4],
    ['bassDrive', 0, 2],
    ['onsetDrive', 0, 2],
  ];
  for (const [key, min, max] of numeric) {
    const next = finiteNumber(value[key], min, max);
    if (next !== undefined) (result as Record<string, unknown>)[key] = next;
  }

  for (const key of ['mode', 'palette'] as const) {
    if (typeof value[key] === 'string' && value[key].length <= 80) result[key] = value[key];
  }
  if (typeof value.customColor === 'string' && HEX_COLOR.test(value.customColor)) {
    result.customColor = value.customColor.toLowerCase();
  }
  if (typeof value.preferredSource === 'string' && SOURCE_VALUES.has(value.preferredSource as SourcePreference)) {
    result.preferredSource = value.preferredSource as SourcePreference;
  }
  if (typeof value.appearance === 'string' && APPEARANCE_VALUES.has(value.appearance as AppearancePreference)) {
    result.appearance = value.appearance as AppearancePreference;
  }
  for (const key of ['useCustomColor', 'lowPower', 'reducedMotion', 'showDebug'] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  return result;
}

export class SettingsStore {
  private settings: Settings;
  private readonly restored: boolean;

  constructor(initial?: Partial<Settings>) {
    // Honor the OS accessibility signal by default; an explicit stored/user
    // choice always overrides it.
    const prefersReduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loaded = this.load();
    this.restored = Object.keys(loaded).length > 0;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(prefersReduced ? { reducedMotion: true } : {}),
      ...loaded,
      ...sanitizeSettings(initial),
    };
  }

  get(): Readonly<Settings> {
    return this.settings;
  }

  wasRestored(): boolean {
    return this.restored;
  }

  update(patch: Partial<Settings>): Readonly<Settings> {
    this.settings = { ...this.settings, ...sanitizeSettings(patch) };
    this.save();
    return this.settings;
  }

  /** Reset visual tuning while preserving interface and source preferences. */
  reset(): Readonly<Settings> {
    const { preferredSource, appearance } = this.settings;
    this.settings = { ...DEFAULT_SETTINGS, preferredSource, appearance };
    this.save();
    return this.settings;
  }

  private load(): Partial<Settings> {
    try {
      const current = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
      if (current) return sanitizeSettings(JSON.parse(current));

      const previous = globalThis.localStorage?.getItem(PREVIOUS_KEY);
      if (previous) {
        const parsed = JSON.parse(previous) as unknown;
        const migrated = sanitizeSettings(parsed);
        if (usesRetiredThemeDefaults(parsed)) {
          migrated.palette = DEFAULT_SETTINGS.palette;
          migrated.customColor = DEFAULT_SETTINGS.customColor;
        }
        globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...migrated }));
        return migrated;
      }

      const legacy = globalThis.localStorage?.getItem(LEGACY_KEY);
      if (!legacy) return {};
      const migrated = sanitizeSettings(JSON.parse(legacy));
      globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...migrated }));
      return migrated;
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* Storage unavailable — settings remain in memory for this session. */
    }
  }
}
