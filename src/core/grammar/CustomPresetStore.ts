import type { Settings } from '../../app/SettingsStore';
import {
  PRESETS,
  sanitizeVisualPresetSettings,
  snapshotVisualSettings,
  visualSettingsEqual,
  type VisualPresetSettings,
} from './presets';

export const CUSTOM_PRESETS_STORAGE_KEY = 'vibratoflow.customPresets.v1';
const MAX_NAME_LENGTH = 40;
const ID_PATTERN = /^[a-z0-9-]{1,100}$/iu;

export interface CustomPreset {
  id: string;
  name: string;
  settings: VisualPresetSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function sanitizePreset(value: unknown): CustomPreset | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return null;
  if (typeof value.name !== 'string') return null;
  const name = normalizeName(value.name);
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  const settings = sanitizeVisualPresetSettings(value.settings);
  if (!settings) return null;
  return { id: value.id, name, settings };
}

function clonePreset(preset: Readonly<CustomPreset>): CustomPreset {
  return { ...preset, settings: { ...preset.settings } };
}

function createId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Local-only named visual snapshots. Saved definitions are never mutated by later edits. */
export class CustomPresetStore {
  private presets: CustomPreset[];

  constructor() {
    this.presets = this.load();
  }

  getAll(): readonly CustomPreset[] {
    return this.presets.map(clonePreset);
  }

  findById(id: string): CustomPreset | null {
    const preset = this.presets.find((candidate) => candidate.id === id);
    return preset ? clonePreset(preset) : null;
  }

  matching(settings: Readonly<Settings>): CustomPreset | null {
    const preset = this.presets.find((candidate) => visualSettingsEqual(settings, candidate.settings));
    return preset ? clonePreset(preset) : null;
  }

  save(nameInput: string, settings: Readonly<Settings>): CustomPreset {
    const name = normalizeName(nameInput);
    if (!name) throw new Error('Enter a preset name.');
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`Preset names must be ${MAX_NAME_LENGTH} characters or fewer.`);
    }
    const foldedName = name.toLocaleLowerCase();
    if (PRESETS.some((preset) => preset.label.toLocaleLowerCase() === foldedName)) {
      throw new Error('A built-in preset already uses that name.');
    }
    if (this.presets.some((preset) => preset.name.toLocaleLowerCase() === foldedName)) {
      throw new Error('A saved preset already uses that name.');
    }

    const snapshot = snapshotVisualSettings(settings);
    const builtIn = PRESETS.find((preset) => visualSettingsEqual(snapshot, preset.settings));
    if (builtIn) {
      throw new Error(`Current settings already match “${builtIn.label}”. Change a visual setting before saving.`);
    }
    const existing = this.presets.find((preset) => visualSettingsEqual(snapshot, preset.settings));
    if (existing) throw new Error(`These settings are already saved as “${existing.name}”.`);

    const preset: CustomPreset = { id: createId(), name, settings: snapshot };
    const previous = this.presets;
    this.presets = [...this.presets, preset];
    if (!this.persist()) {
      this.presets = previous;
      throw new Error('The preset could not be saved on this device.');
    }
    return clonePreset(preset);
  }

  delete(id: string): boolean {
    const next = this.presets.filter((preset) => preset.id !== id);
    if (next.length === this.presets.length) return false;
    const previous = this.presets;
    this.presets = next;
    if (!this.persist()) {
      this.presets = previous;
      throw new Error('The preset could not be deleted from this device.');
    }
    return true;
  }

  private load(): CustomPreset[] {
    try {
      const stored = globalThis.localStorage?.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return [];

      const names = new Set<string>();
      const ids = new Set<string>();
      const result: CustomPreset[] = [];
      for (const value of parsed) {
        const preset = sanitizePreset(value);
        if (!preset) continue;
        const foldedName = preset.name.toLocaleLowerCase();
        if (names.has(foldedName) || ids.has(preset.id)) continue;
        if (PRESETS.some((builtIn) => visualSettingsEqual(preset.settings, builtIn.settings))) continue;
        if (result.some((existing) => visualSettingsEqual(existing.settings, preset.settings))) continue;
        names.add(foldedName);
        ids.add(preset.id);
        result.push(preset);
      }
      return result;
    } catch {
      return [];
    }
  }

  private persist(): boolean {
    try {
      if (!globalThis.localStorage) return false;
      globalThis.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(this.presets));
      return true;
    } catch {
      return false;
    }
  }
}
