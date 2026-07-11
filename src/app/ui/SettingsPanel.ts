import type { AppearancePreference, SettingsStore, Settings } from '../SettingsStore';
import { PRESETS } from '../../core/grammar/presets';
import { PALETTE_IDS, paletteLabel } from '../../core/grammar/palettes';
import { MODES } from '../../core/render/modes';

function controlId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/(^-|-$)/gu, '');
  return `vf-${slug}`;
}

/** Accessible, dependency-free settings sheet backed by the persistent store. */
export class SettingsPanel {
  private readonly el: HTMLElement;
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
    this.el.hidden = false;
    this.onVisibilityChange(true);
    requestAnimationFrame(() => this.el.querySelector<HTMLElement>('.panel-close')?.focus());
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
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

  private select(
    label: string,
    options: { value: string; label: string }[],
    value: string,
    onSet: (value: string) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const id = controlId(label);
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = label;
    const select = document.createElement('select');
    select.id = id;
    select.name = id;
    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    }
    select.value = value;
    select.addEventListener('change', () => onSet(select.value));
    row.append(lab, select);
    return row;
  }

  private range(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onSet: (value: number) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const id = controlId(label);
    const outputId = `${id}-value`;
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = label;

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
    input.setAttribute('aria-describedby', outputId);
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
    row.append(lab, wrap);
    return row;
  }

  private checkbox(label: string, value: boolean, onSet: (value: boolean) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'toggle-row';
    const id = controlId(label);
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = label;
    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => onSet(input.checked));
    row.append(lab, input);
    return row;
  }

  private colorPicker(value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const id = controlId('Custom colour');
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = 'Custom colour';
    const control = document.createElement('div');
    control.className = 'color-control';
    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'color';
    input.value = value;
    const text = document.createElement('span');
    text.className = 'color-value';
    text.textContent = value;
    input.addEventListener('change', () => {
      text.textContent = input.value;
      this.store.update({ customColor: input.value, useCustomColor: true });
      this.onChange();
      this.render();
    });
    control.append(input, text);
    row.append(lab, control);
    return row;
  }

  private render(): void {
    const settings = this.store.get();
    this.el.replaceChildren();

    const header = document.createElement('header');
    header.className = 'panel-header';
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'settings-title';
    title.textContent = 'Adjust the visual';
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

    const appearance = this.section('Appearance');
    appearance.appendChild(
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
    appearance.appendChild(
      this.select(
        'Preset',
        [{ value: '', label: 'Choose a preset' }, ...PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))],
        '',
        (id) => {
          const preset = PRESETS.find((candidate) => candidate.id === id);
          if (!preset) return;
          this.store.update({ ...preset.settings, useCustomColor: false });
          this.onChange();
          this.render();
        },
      ),
    );
    appearance.appendChild(
      this.select(
        'Shape',
        MODES.map((mode) => ({ value: mode.id, label: mode.label })),
        settings.mode,
        (value) => this.set('mode', value),
      ),
    );
    appearance.appendChild(
      this.select(
        'Colour set',
        PALETTE_IDS.map((palette) => ({ value: palette, label: paletteLabel(palette) })),
        settings.palette,
        (value) => {
          this.store.update({ palette: value, useCustomColor: false });
          this.onChange();
          this.render();
        },
      ),
    );
    appearance.appendChild(this.colorPicker(settings.customColor));
    appearance.appendChild(
      this.checkbox('Use custom colour', settings.useCustomColor, (value) => this.set('useCustomColor', value)),
    );
    this.el.appendChild(appearance);

    const response = this.section('Response');
    response.appendChild(this.range('Sensitivity', 0.2, 3, 0.1, settings.sensitivity, (value) => this.set('sensitivity', value)));
    response.appendChild(this.range('Input gain', 0.1, 4, 0.1, settings.inputGain, (value) => this.set('inputGain', value)));
    response.appendChild(this.range('Trail length', 0.5, 0.99, 0.01, settings.persistence, (value) => this.set('persistence', value)));
    response.appendChild(this.range('Soft glow', 0, 1.5, 0.05, settings.bloom, (value) => this.set('bloom', value)));
    this.el.appendChild(response);

    const accessibility = this.section('Device and accessibility');
    accessibility.appendChild(this.checkbox('Use less power', settings.lowPower, (value) => this.set('lowPower', value)));
    accessibility.appendChild(this.checkbox('Reduce motion', settings.reducedMotion, (value) => this.set('reducedMotion', value)));
    accessibility.appendChild(this.checkbox('Show diagnostics', settings.showDebug, (value) => this.set('showDebug', value)));
    this.el.appendChild(accessibility);

    const resetSection = this.section('Reset');
    const reset = document.createElement('button');
    reset.className = 'panel-reset';
    reset.type = 'button';
    reset.textContent = 'Restore visual defaults';
    reset.addEventListener('click', () => {
      this.store.reset();
      this.onChange();
      this.render();
    });
    resetSection.appendChild(reset);
    this.el.appendChild(resetSection);
  }
}
