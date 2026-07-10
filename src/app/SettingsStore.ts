/** User-tunable settings (PRD §13.11). Persisted locally; no account (§15.8). */
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
  lowPower: boolean;
  reducedMotion: boolean;
  showDebug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  inputGain: 1,
  sensitivity: 1,
  persistence: 0.9,
  bloom: 0.5,
  baseScale: 0.9,
  baseIntensity: 1,
  bassDrive: 0.6,
  onsetDrive: 0.8,
  mode: 'stereo-xy',
  palette: 'classic-green',
  lowPower: false,
  reducedMotion: false,
  showDebug: false,
};

const KEY = 'vibratoflow.settings.v1';

export class SettingsStore {
  private settings: Settings;

  constructor(initial?: Partial<Settings>) {
    // Honor the OS accessibility signal by default (PRD §14.5); an explicit
    // stored/user choice always overrides it.
    const prefersReduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(prefersReduced ? { reducedMotion: true } : {}),
      ...this.load(),
      ...initial,
    };
  }

  get(): Readonly<Settings> {
    return this.settings;
  }

  update(patch: Partial<Settings>): Readonly<Settings> {
    this.settings = { ...this.settings, ...patch };
    this.save();
    return this.settings;
  }

  reset(): Readonly<Settings> {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return this.settings;
  }

  private load(): Partial<Settings> {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* storage unavailable — settings remain in-memory */
    }
  }
}
