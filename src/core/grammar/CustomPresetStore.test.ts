import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../app/SettingsStore';
import {
  CUSTOM_PRESETS_STORAGE_KEY,
  CustomPresetStore,
} from './CustomPresetStore';
import { PRESETS } from './presets';

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

describe('CustomPresetStore', () => {
  it('saves an immutable visual snapshot and restores it from local storage', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      mode: 'band-xy',
      palette: 'norwegian-flag',
      persistence: 0.94,
      bloom: 0.45,
      sensitivity: 1.4,
    };
    const first = new CustomPresetStore();
    const saved = first.save('  Nordic pulse  ', settings);

    settings.persistence = 0.6;
    expect(saved.name).toBe('Nordic pulse');
    expect(saved.settings.persistence).toBe(0.94);

    const restored = new CustomPresetStore().getAll();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      id: saved.id,
      name: 'Nordic pulse',
      settings: {
        mode: 'band-xy',
        palette: 'norwegian-flag',
        persistence: 0.94,
        bloom: 0.45,
        sensitivity: 1.4,
      },
    });
  });

  it('migrates presets from the previous product-name storage key', () => {
    const settings = { ...DEFAULT_SETTINGS, persistence: 0.94 };
    localStorage.setItem(
      'vibratoflow.customPresets.v1',
      JSON.stringify([{ id: 'legacy-preset', name: 'Legacy preset', settings }]),
    );

    const restored = new CustomPresetStore().getAll();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: 'legacy-preset', name: 'Legacy preset' });
    expect(localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY)).not.toBeNull();
  });

  it('rejects duplicate names, duplicate snapshots, and unchanged built-in presets', () => {
    const store = new CustomPresetStore();
    const custom = { ...DEFAULT_SETTINGS, persistence: 0.94 };
    store.save('Long trail', custom);

    expect(() => store.save(' long TRAIL ', { ...custom, bloom: 0.7 })).toThrow(
      'already uses that name',
    );
    expect(() => store.save('Same values', custom)).toThrow('already saved as');
    expect(() => store.save('Warm room', { ...custom, bloom: 0.8 })).toThrow(
      'built-in preset already uses that name',
    );

    const builtIn = PRESETS[0];
    expect(() => store.save('Built-in copy', { ...DEFAULT_SETTINGS, ...builtIn.settings })).toThrow(
      'already match',
    );
  });

  it('deletes a saved preset without changing the caller settings', () => {
    const settings = { ...DEFAULT_SETTINGS, bloom: 0.5 };
    const store = new CustomPresetStore();
    const saved = store.save('Glow', settings);

    expect(store.delete(saved.id)).toBe(true);
    expect(store.delete(saved.id)).toBe(false);
    expect(settings.bloom).toBe(0.5);
    expect(new CustomPresetStore().getAll()).toEqual([]);
  });

  it('ignores malformed persisted records', () => {
    localStorage.setItem(
      CUSTOM_PRESETS_STORAGE_KEY,
      JSON.stringify([
        null,
        { id: 'bad id', name: 'Broken', settings: {} },
        { id: 'valid-id', name: '', settings: DEFAULT_SETTINGS },
      ]),
    );

    expect(new CustomPresetStore().getAll()).toEqual([]);
  });
});
