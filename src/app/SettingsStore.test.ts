import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  sanitizeSettings,
} from './SettingsStore';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('SettingsStore persistence', () => {
  it('uses restrained defaults and persists user changes locally', () => {
    const first = new SettingsStore();
    expect(first.get().palette).toBe('mono');
    expect(first.get().appearance).toBe('system');
    expect(first.wasRestored()).toBe(false);

    first.update({ palette: 'ice', sensitivity: 1.7, customColor: '#336699', appearance: 'dark' });
    const second = new SettingsStore();

    expect(second.wasRestored()).toBe(true);
    expect(second.get()).toMatchObject({
      palette: 'ice',
      sensitivity: 1.7,
      customColor: '#336699',
      appearance: 'dark',
    });
  });

  it('migrates the retired theme defaults without changing other persisted preferences', () => {
    localStorage.setItem(
      'vibratoflow.settings.v2',
      JSON.stringify({
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
        preferredSource: 'mic',
      }),
    );

    const settings = new SettingsStore().get();
    expect(settings.palette).toBe(DEFAULT_SETTINGS.palette);
    expect(settings.customColor).toBe(DEFAULT_SETTINGS.customColor);
    expect(settings.preferredSource).toBe('mic');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();
  });

  it('preserves a deliberate previous-version palette choice', () => {
    localStorage.setItem(
      'vibratoflow.settings.v2',
      JSON.stringify({
        inputGain: 1,
        sensitivity: 1.2,
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
      }),
    );

    expect(new SettingsStore().get().palette).toBe('warm-amber');
  });

  it('preserves the preferred source when visual settings are reset', () => {
    const store = new SettingsStore();
    store.update({ preferredSource: 'mic', appearance: 'dark', palette: 'neon', bloom: 1.4 });
    store.reset();

    expect(store.get().preferredSource).toBe('mic');
    expect(store.get().appearance).toBe('dark');
    expect(store.get().palette).toBe(DEFAULT_SETTINGS.palette);
    expect(store.get().bloom).toBe(DEFAULT_SETTINGS.bloom);
  });

  it('ignores malformed values and clamps numeric storage values', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        sensitivity: 999,
        bloom: -2,
        customColor: 'javascript:alert(1)',
        preferredSource: 'camera',
        appearance: 'sepia',
        lowPower: 'yes',
      }),
    );

    const settings = new SettingsStore().get();
    expect(settings.sensitivity).toBe(3);
    expect(settings.bloom).toBe(0);
    expect(settings.customColor).toBe(DEFAULT_SETTINGS.customColor);
    expect(settings.preferredSource).toBe(DEFAULT_SETTINGS.preferredSource);
    expect(settings.appearance).toBe(DEFAULT_SETTINGS.appearance);
    expect(settings.lowPower).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('accepts supported values only', () => {
    expect(
      sanitizeSettings({
        customColor: '#Aa00fF',
        preferredSource: 'system',
        reducedMotion: true,
        appearance: 'light',
        mode: 'stereo-xy',
      }),
    ).toEqual({
      customColor: '#aa00ff',
      preferredSource: 'system',
      reducedMotion: true,
      appearance: 'light',
      mode: 'stereo-xy',
    });
  });
});
