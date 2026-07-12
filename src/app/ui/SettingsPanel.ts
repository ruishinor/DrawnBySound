import type {
  AppearancePreference,
  InterfaceAccent,
  Settings,
  SettingsStore,
} from '../SettingsStore';
import { matchingPresetId, PRESETS } from '../../core/grammar/presets';
import { CustomPresetStore } from '../../core/grammar/CustomPresetStore';
import { PALETTE_IDS, paletteLabel } from '../../core/grammar/palettes';
import { MODES } from '../../core/render/modes';

function controlId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/(^-|-$)/gu, '');
  return `vf-${slug}`;
}

const CUSTOM_PRESET_DESCRIPTION =
  'Current controls do not exactly match a preset. Save them as a named preset or choose an existing preset.';
const SAVED_PRESET_DESCRIPTION =
  'Saved for this site address on this device. Editing a visual control creates unsaved Custom settings without changing the saved preset.';
const CUSTOM_PRESET_PREFIX = 'custom:';
const LAST_SELECTED_PRESET_STORAGE_KEY = 'vibratoflow.lastSelectedPreset.v1';

interface LastSelectedPreset {
  value: string;
  label: string;
}

interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

const MODE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'stereo-xy': 'Maps the left channel horizontally and the right channel vertically. Stereo width and panning change the figure.',
  'mono-phase-xy': 'Compares one mono signal with a short delay. Pitch and phase create loops and ribbons.',
  'band-xy': 'Maps low and high frequency bands against each other. The balance across the spectrum drives the movement.',
  'beat-lissajous': 'Uses beat timing to drive a rotating loop. Rhythmic material produces the clearest motion.',
  'hybrid-grammar': 'Combines stereo, frequency, and transient features. More reactive and complex than the other shapes.',
};

function modeDescription(id: string): string {
  return MODE_DESCRIPTIONS[id] ?? 'Changes how the incoming audio is translated into the visual shape.';
}

/** Accessible, dependency-free settings modal backed by the persistent store. */
export class SettingsPanel {
  private readonly el: HTMLElement;
  private readonly customPresets = new CustomPresetStore();
  private lastSelectedPreset = this.loadLastSelectedPreset();
  private lastFocus: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    private readonly store: SettingsStore,
    private readonly onChange: () => void,
    private readonly onVisibilityChange: (open: boolean) => void = () => {},
  ) {
    this.el = container;
    this.render();
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.el.hidden) this.close();
    });
  }

  isOpen(): boolean {
    return !this.el.hidden;
  }

  toggle(trigger?: HTMLElement): void {
    if (this.el.hidden) this.open(trigger);
    else this.close();
  }

  open(trigger?: HTMLElement): void {
    this.lastFocus = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    document.body.classList.add('settings-open');
    document.getElementById('app-shell')?.setAttribute('inert', '');
    this.el.hidden = false;
    this.el.scrollTop = 0;
    this.onVisibilityChange(true);
    requestAnimationFrame(() => this.el.querySelector<HTMLElement>('.panel-close')?.focus());
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    document.getElementById('app-shell')?.removeAttribute('inert');
    document.body.classList.remove('settings-open');
    this.onVisibilityChange(false);
    this.lastFocus?.focus();
  }

  private set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.store.update({ [key]: value } as Partial<Settings>);
    this.onChange();
  }

  private section(title: string): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  private settingCopy(
    label: string,
    id: string,
    description?: string,
  ): { wrapper: HTMLElement; description?: HTMLParagraphElement } {
    const wrapper = document.createElement('div');
    wrapper.className = 'setting-copy';
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = label;
    wrapper.appendChild(lab);
    if (!description) return { wrapper };

    const paragraph = document.createElement('p');
    paragraph.className = 'setting-description';
    paragraph.id = `${id}-description`;
    paragraph.textContent = description;
    wrapper.appendChild(paragraph);
    return { wrapper, description: paragraph };
  }

  private presetValue(settings: Readonly<Settings> = this.store.get()): string {
    const custom = this.customPresets.matching(settings);
    if (custom) return `${CUSTOM_PRESET_PREFIX}${custom.id}`;
    return matchingPresetId(settings) ?? '';
  }

  private presetDescription(value: string): string {
    if (value.startsWith(CUSTOM_PRESET_PREFIX)) return SAVED_PRESET_DESCRIPTION;
    return PRESETS.find((preset) => preset.id === value)?.description ?? CUSTOM_PRESET_DESCRIPTION;
  }

  private presetLabel(value: string): string | null {
    if (value.startsWith(CUSTOM_PRESET_PREFIX)) {
      return this.customPresets.findById(value.slice(CUSTOM_PRESET_PREFIX.length))?.name ?? null;
    }
    return PRESETS.find((preset) => preset.id === value)?.label ?? null;
  }

  private loadLastSelectedPreset(): LastSelectedPreset | null {
    try {
      const stored = globalThis.localStorage?.getItem(LAST_SELECTED_PRESET_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      const record = parsed as Record<string, unknown>;
      if (typeof record.value !== 'string' || record.value.length > 140) return null;
      if (typeof record.label !== 'string') return null;
      const label = record.label.trim();
      if (!label || label.length > 80) return null;
      return { value: record.value, label };
    } catch {
      return null;
    }
  }

  private rememberLastSelectedPreset(value: string, label = this.presetLabel(value)): void {
    if (!label) return;
    this.lastSelectedPreset = { value, label };
    try {
      globalThis.localStorage?.setItem(
        LAST_SELECTED_PRESET_STORAGE_KEY,
        JSON.stringify(this.lastSelectedPreset),
      );
    } catch {
      /* Keep the session value when local storage is unavailable. */
    }
  }

  private rememberCurrentPreset(): void {
    const current = this.presetValue();
    if (current) this.rememberLastSelectedPreset(current);
  }

  private clearLastSelectedPreset(value?: string): void {
    if (value && this.lastSelectedPreset?.value !== value) return;
    this.lastSelectedPreset = null;
    try {
      globalThis.localStorage?.removeItem(LAST_SELECTED_PRESET_STORAGE_KEY);
    } catch {
      /* The in-memory value is already cleared. */
    }
  }

  private applyPreset(value: string): void {
    const custom = value.startsWith(CUSTOM_PRESET_PREFIX)
      ? this.customPresets.findById(value.slice(CUSTOM_PRESET_PREFIX.length))
      : null;
    const settingsPatch = custom?.settings ?? PRESETS.find((candidate) => candidate.id === value)?.settings;
    if (!settingsPatch) return;

    this.rememberLastSelectedPreset(value, custom?.name);
    const scrollTop = this.el.scrollTop;
    this.store.update(settingsPatch);
    this.onChange();
    this.render();
    this.el.scrollTop = scrollTop;
    requestAnimationFrame(() => {
      this.el.querySelector<HTMLSelectElement>(`#${controlId('Preset')}`)?.focus();
    });
  }

  private presetSupport(value: string): HTMLElement {
    const support = document.createElement('div');
    support.className = 'preset-support';

    if (value === '' && this.lastSelectedPreset) {
      const lastSelected = document.createElement('p');
      lastSelected.id = 'vf-last-selected-preset';
      lastSelected.className = 'preset-last-selected';
      lastSelected.append('Last selected preset: ');
      const name = document.createElement('strong');
      name.textContent = this.lastSelectedPreset.label;
      lastSelected.appendChild(name);
      support.appendChild(lastSelected);
    }

    const saved = this.customPresets.getAll();
    const savedArea = document.createElement('div');
    savedArea.id = 'vf-saved-presets';
    savedArea.className = 'saved-presets';

    const header = document.createElement('div');
    header.className = 'saved-presets-header';
    const heading = document.createElement('strong');
    heading.textContent = 'Saved presets';
    const scope = document.createElement('span');
    scope.textContent = 'This site address only';
    header.append(heading, scope);
    savedArea.appendChild(header);

    if (saved.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'saved-presets-empty';
      empty.textContent = 'None saved here yet. Localhost, previews, and production keep separate lists.';
      savedArea.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'saved-preset-list';
      for (const preset of saved) {
        const presetValue = `${CUSTOM_PRESET_PREFIX}${preset.id}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'saved-preset-button';
        button.textContent = preset.name;
        button.setAttribute('aria-label', `Load saved preset ${preset.name}`);
        button.setAttribute('aria-pressed', String(value === presetValue));
        if (value === presetValue) button.classList.add('is-active');
        button.addEventListener('click', () => this.applyPreset(presetValue));
        list.appendChild(button);
      }
      savedArea.appendChild(list);
    }

    support.appendChild(savedArea);
    return support;
  }

  private syncPresetActions(value: string): void {
    const save = this.el.querySelector<HTMLButtonElement>('#vf-save-current-preset');
    const remove = this.el.querySelector<HTMLButtonElement>('#vf-delete-saved-preset');
    if (save) {
      save.disabled = value !== '';
      save.title = save.disabled
        ? 'Change a visual setting first; named presets are already saved.'
        : 'Save the current visual settings under a custom name.';
    }
    if (remove) remove.disabled = !value.startsWith(CUSTOM_PRESET_PREFIX);
  }

  private syncPresetSelection(): void {
    const select = this.el.querySelector<HTMLSelectElement>(`#${controlId('Preset')}`);
    if (!select) return;
    const value = this.presetValue();
    select.value = value;
    const descriptionId = select.getAttribute('aria-describedby');
    const description = descriptionId ? this.el.querySelector<HTMLElement>(`#${descriptionId}`) : null;
    if (description) description.textContent = this.presetDescription(value);
    this.syncPresetActions(value);
    const support = this.el.querySelector<HTMLElement>('.preset-support');
    if (support) support.replaceWith(this.presetSupport(value));
  }

  private presetActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'preset-actions';

    const save = document.createElement('button');
    save.id = 'vf-save-current-preset';
    save.type = 'button';
    save.textContent = 'Save current preset';
    save.disabled = this.presetValue() !== '';
    save.title = save.disabled
      ? 'Change a visual setting first; named presets are already saved.'
      : 'Save the current visual settings under a custom name.';
    save.addEventListener('click', () => {
      const name = globalThis.prompt('Name this preset (1–40 characters):');
      if (name === null) return;
      try {
        const preset = this.customPresets.save(name, this.store.get());
        this.rememberLastSelectedPreset(`${CUSTOM_PRESET_PREFIX}${preset.id}`, preset.name);
        const scrollTop = this.el.scrollTop;
        this.render();
        this.el.scrollTop = scrollTop;
        requestAnimationFrame(() => {
          this.el.querySelector<HTMLSelectElement>(`#${controlId('Preset')}`)?.focus();
        });
      } catch (error) {
        globalThis.alert(error instanceof Error ? error.message : 'The preset could not be saved.');
      }
    });

    const remove = document.createElement('button');
    remove.id = 'vf-delete-saved-preset';
    remove.className = 'preset-delete';
    remove.type = 'button';
    remove.textContent = 'Delete saved preset';
    remove.disabled = !this.presetValue().startsWith(CUSTOM_PRESET_PREFIX);
    remove.addEventListener('click', () => {
      const value = this.presetValue();
      if (!value.startsWith(CUSTOM_PRESET_PREFIX)) return;
      const preset = this.customPresets.findById(value.slice(CUSTOM_PRESET_PREFIX.length));
      if (!preset) return;
      if (!globalThis.confirm(`Delete the saved preset “${preset.name}”?`)) return;
      try {
        this.customPresets.delete(preset.id);
        this.clearLastSelectedPreset(value);
        const scrollTop = this.el.scrollTop;
        this.render();
        this.el.scrollTop = scrollTop;
        requestAnimationFrame(() => {
          this.el.querySelector<HTMLSelectElement>(`#${controlId('Preset')}`)?.focus();
        });
      } catch (error) {
        globalThis.alert(error instanceof Error ? error.message : 'The preset could not be deleted.');
      }
    });

    actions.append(save, remove);
    return actions;
  }

  private select(
    label: string,
    options: SelectOption[],
    value: string,
    onSet: (value: string) => void,
    description?: string | ((value: string) => string),
    afterControl?: HTMLElement,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const id = controlId(label);
    const resolveDescription = (next: string): string | undefined =>
      typeof description === 'function' ? description(next) : description;
    const copy = this.settingCopy(label, id, resolveDescription(value));
    const select = document.createElement('select');
    select.id = id;
    select.name = id;
    if (copy.description) select.setAttribute('aria-describedby', copy.description.id);
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      if (!option.group) {
        select.appendChild(element);
        continue;
      }
      let group = groups.get(option.group);
      if (!group) {
        group = document.createElement('optgroup');
        group.label = option.group;
        groups.set(option.group, group);
        select.appendChild(group);
      }
      group.appendChild(element);
    }
    select.value = value;
    select.addEventListener('change', () => {
      if (copy.description) copy.description.textContent = resolveDescription(select.value) ?? '';
      onSet(select.value);
    });
    if (afterControl) {
      const stack = document.createElement('div');
      stack.className = 'select-stack';
      stack.append(select, afterControl);
      row.append(copy.wrapper, stack);
    } else {
      row.append(copy.wrapper, select);
    }
    return row;
  }

  private range(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onSet: (value: number) => void,
    description?: string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const id = controlId(label);
    const outputId = `${id}-value`;
    const copy = this.settingCopy(label, id, description);

    const wrap = document.createElement('div');
    wrap.className = 'range-wrap';
    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute('aria-describedby',
      [outputId, copy.description?.id].filter(Boolean).join(' '),
    );
    const output = document.createElement('output');
    output.id = outputId;
    output.setAttribute('for', id);
    output.value = value.toFixed(step < 0.1 ? 2 : 1);
    input.addEventListener('input', () => {
      const next = Number.parseFloat(input.value);
      output.value = next.toFixed(step < 0.1 ? 2 : 1);
      onSet(next);
    });
    wrap.append(input, output);
    row.append(copy.wrapper, wrap);
    return row;
  }

  private checkbox(
    label: string,
    value: boolean,
    onSet: (value: boolean) => void,
    description?: string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'toggle-row';
    const id = controlId(label);
    const copy = this.settingCopy(label, id, description);
    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'checkbox';
    input.checked = value;
    if (copy.description) input.setAttribute('aria-describedby', copy.description.id);
    input.addEventListener('change', () => onSet(input.checked));
    row.append(copy.wrapper, input);
    return row;
  }

  private colorPickerWithToggle(
    label: string,
    value: string,
    enabled: boolean,
    onColorSet: (value: string) => void,
    toggleLabel: string,
    onToggle: (value: boolean) => void,
    description?: string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row setting-row--color-toggle';

    const id = controlId(label);
    const toggleId = controlId(toggleLabel);
    const copy = this.settingCopy(label, id, description);

    const controls = document.createElement('div');
    controls.className = 'color-toggle-control';

    const colorControl = document.createElement('div');
    colorControl.className = 'color-control';

    const text = document.createElement('span');
    text.className = 'color-value';
    text.textContent = value;

    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'color';
    input.value = value;
    if (copy.description) input.setAttribute('aria-describedby', copy.description.id);
    input.addEventListener('input', () => {
      text.textContent = input.value;
      onColorSet(input.value);
    });
    colorControl.append(text, input);

    const toggleControl = document.createElement('div');
    toggleControl.className = 'inline-toggle';

    const toggleCopy = document.createElement('label');
    toggleCopy.htmlFor = toggleId;
    toggleCopy.textContent = toggleLabel;

    const toggle = document.createElement('input');
    toggle.id = toggleId;
    toggle.name = toggleId;
    toggle.type = 'checkbox';
    toggle.checked = enabled;
    if (copy.description) toggle.setAttribute('aria-describedby', copy.description.id);
    toggle.addEventListener('change', () => onToggle(toggle.checked));

    toggleControl.append(toggleCopy, toggle);
    controls.append(colorControl, toggleControl);
    row.append(copy.wrapper, controls);
    return row;
  }

  private help(): HTMLElement {
    const details = document.createElement('details');
    details.className = 'help-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Help and limitations';
    details.appendChild(summary);

    const items: ReadonlyArray<readonly [string, string]> = [
      [
        'How does microphone mode work?',
        'It listens through the microphone selected by your browser. Headphones do not route another app directly into the microphone.',
      ],
      [
        'Why is External app unavailable on my phone?',
        'Android and iOS browsers do not expose other-app audio capture to ordinary web pages. Chrome-family browsers on Android therefore show this source as desktop-only. Use Microphone or Audio file instead.',
      ],
      [
        'Why does External app sometimes have no sound?',
        'The browser, operating system, selected share surface, and source app must all allow audio sharing.',
      ],
      [
        'Does audio leave this device?',
        'No. Analysis and visual rendering run locally in the browser.',
      ],
      [
        'What is remembered?',
        'Visual preferences, interface choices, and your preferred source are stored locally. Protected sources and files are never restarted automatically.',
      ],
    ];

    const content = document.createElement('div');
    content.className = 'help-content';
    for (const [question, answer] of items) {
      const item = document.createElement('div');
      const heading = document.createElement('h4');
      heading.textContent = question;
      const paragraph = document.createElement('p');
      paragraph.textContent = answer;
      item.append(heading, paragraph);
      content.appendChild(item);
    }
    details.appendChild(content);
    return details;
  }

  private render(): void {
    const settings = this.store.get();
    this.el.replaceChildren();

    const header = document.createElement('header');
    header.className = 'panel-header';
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'settings-title';
    title.textContent = 'Visual settings';
    const description = document.createElement('p');
    description.textContent = 'Changes are stored on this device. No account or upload is used.';
    copy.append(title, description);
    const close = document.createElement('button');
    close.className = 'panel-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close settings');
    close.textContent = 'Close';
    close.addEventListener('click', () => this.close());
    header.append(copy, close);
    this.el.appendChild(header);

    const interfaceSection = this.section('Interface');
    interfaceSection.classList.add('settings-section--appearance');

    const customPresets = this.customPresets.getAll();
    interfaceSection.appendChild(
      this.select(
        'Preset',
        [
          { value: '', label: 'Custom settings' },
          ...PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.label,
            group: 'Built-in presets',
          })),
          ...customPresets.map((preset) => ({
            value: `${CUSTOM_PRESET_PREFIX}${preset.id}`,
            label: preset.name,
            group: 'My presets',
          })),
        ],
        this.presetValue(settings),
        (value) => this.applyPreset(value),
        (value) => this.presetDescription(value),
        this.presetSupport(this.presetValue(settings)),
      ),
    );
    interfaceSection.appendChild(
      this.select(
        'Colour set',
        PALETTE_IDS.map((palette) => ({ value: palette, label: paletteLabel(palette) })),
        settings.palette,
        (value) => {
          this.rememberCurrentPreset();
          this.store.update({ palette: value, useCustomColor: false });
          const toggle = this.el.querySelector<HTMLInputElement>(`#${controlId('Use custom colour')}`);
          if (toggle) toggle.checked = false;
          this.onChange();
          this.syncPresetSelection();
        },
        'Sets the visual trace palette. Choosing a set turns off Custom colour.',
      ),
    );
    interfaceSection.appendChild(
      this.select(
        'Shape',
        MODES.map((mode) => ({ value: mode.id, label: mode.label })),
        settings.mode,
        (value) => {
          this.rememberCurrentPreset();
          this.set('mode', value);
          this.syncPresetSelection();
        },
        modeDescription,
      ),
    );
    interfaceSection.appendChild(
      this.colorPickerWithToggle(
        'Custom colour',
        settings.customColor,
        settings.useCustomColor,
        (value) => {
          this.rememberCurrentPreset();
          this.store.update({ customColor: value, useCustomColor: true });
          const toggle = this.el.querySelector<HTMLInputElement>(`#${controlId('Use custom colour')}`);
          if (toggle) toggle.checked = true;
          this.onChange();
          this.syncPresetSelection();
        },
        'Use custom colour',
        (value) => {
          this.rememberCurrentPreset();
          this.set('useCustomColor', value);
          this.syncPresetSelection();
        },
        'Changes the visual trace only, not the interface. Choosing a colour turns this on automatically.',
      ),
    );
    interfaceSection.appendChild(
      this.select(
        'Interface theme',
        [
          { value: 'system', label: 'Use device setting' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
        settings.appearance,
        (value) => this.set('appearance', value as AppearancePreference),
      ),
    );
    interfaceSection.appendChild(this.presetActions());
    interfaceSection.appendChild(
      this.colorPickerWithToggle(
        'Custom interface accent',
        settings.customInterfaceAccent,
        settings.useCustomInterfaceAccent,
        (value) => {
          this.store.update({ customInterfaceAccent: value, useCustomInterfaceAccent: true });
          const toggle = this.el.querySelector<HTMLInputElement>(`#${controlId('Use custom interface accent')}`);
          if (toggle) toggle.checked = true;
          this.onChange();
        },
        'Use custom interface accent',
        (value) => this.set('useCustomInterfaceAccent', value),
        'Affects interface controls only. It does not change the visual trace.',
      ),
    );
    interfaceSection.appendChild(
      this.select(
        'Interface accent',
        [
          { value: 'graphite', label: 'Graphite' },
          { value: 'moss', label: 'Moss' },
          { value: 'plum', label: 'Plum' },
          { value: 'clay', label: 'Clay' },
          { value: 'slate', label: 'Slate' },
        ],
        settings.interfaceAccent,
        (value) => this.set('interfaceAccent', value as InterfaceAccent),
        'Changes buttons, selected states, and focus indicators. Visual trace colours are set separately.',
      ),
    );
    this.el.appendChild(interfaceSection);

    const response = this.section('Response');
    response.appendChild(
      this.range(
        'Sensitivity',
        0.2,
        3,
        0.1,
        settings.sensitivity,
        (value) => {
          this.rememberCurrentPreset();
          this.set('sensitivity', value);
          this.syncPresetSelection();
        },
        'Controls how strongly detected musical changes affect movement. Higher values react to smaller changes; audio volume is unchanged.',
      ),
    );
    response.appendChild(
      this.range(
        'Input gain',
        0.1,
        4,
        0.1,
        settings.inputGain,
        (value) => this.set('inputGain', value),
        'Multiplies the incoming signal before drawing it. Raise quiet sources; lower it if the trace fills the frame or clipping appears. Playback volume is unchanged.',
      ),
    );
    response.appendChild(
      this.range(
        'Trail length',
        0.5,
        0.99,
        0.01,
        settings.persistence,
        (value) => {
          this.rememberCurrentPreset();
          this.set('persistence', value);
          this.syncPresetSelection();
        },
        'Controls how slowly earlier lines fade. Higher values create longer, smoother trails; lower values look cleaner and faster.',
      ),
    );
    response.appendChild(
      this.range(
        'Soft glow',
        0,
        1.5,
        0.05,
        settings.bloom,
        (value) => {
          this.rememberCurrentPreset();
          this.set('bloom', value);
          this.syncPresetSelection();
        },
        'Adds light around the trace. Higher values look brighter and softer but can hide fine detail.',
      ),
    );
    this.el.appendChild(response);

    const accessibility = this.section('Device and accessibility');
    accessibility.classList.add('settings-section--device');
    accessibility.appendChild(
      this.checkbox(
        'Use less power',
        settings.lowPower,
        (value) => this.set('lowPower', value),
        'Renders at lower resolution and turns off glow to reduce graphics work. The trace may look softer.',
      ),
    );
    accessibility.appendChild(
      this.checkbox(
        'Reduce motion',
        settings.reducedMotion,
        (value) => this.set('reducedMotion', value),
        'Suppresses sudden bursts and animated colour flow while keeping the trace responsive to audio.',
      ),
    );
    accessibility.appendChild(
      this.checkbox(
        'Show diagnostics',
        settings.showDebug,
        (value) => this.set('showDebug', value),
        'Shows a technical overlay with frame rate, signal level, gain, clipping, frequency, and classifier data.',
      ),
    );
    this.el.appendChild(accessibility);

    const actions = document.createElement('section');
    actions.className = 'settings-actions';
    const reset = document.createElement('button');
    reset.className = 'panel-reset';
    reset.type = 'button';
    reset.textContent = 'Restore all visual defaults';
    reset.addEventListener('click', () => {
      const confirmed = globalThis.confirm(
        'Restore all visual settings to their defaults? Interface, source, and saved presets will be kept.',
      );
      if (!confirmed) return;
      this.store.reset();
      this.onChange();
      this.render();
    });
    actions.appendChild(reset);
    this.el.appendChild(actions);

    const helpSection = this.section('FAQ');
    helpSection.classList.add('settings-section--faq');
    helpSection.appendChild(this.help());
    this.el.appendChild(helpSection);
  }
}
