import type {
  AppearancePreference,
  InterfaceAccent,
  Settings,
  SettingsStore,
} from '../SettingsStore';
import { PRESETS } from '../../core/grammar/presets';
import { PALETTE_IDS, paletteLabel } from '../../core/grammar/palettes';
import { MODES } from '../../core/render/modes';

function controlId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/(^-|-$)/gu, '');
  return `vf-${slug}`;
}

/** Accessible, dependency-free settings modal backed by the persistent store. */
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

  private colorPicker(
    label: string,
    value: string,
    onSet: (value: string) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const id = controlId(label);
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = label;
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
    input.addEventListener('input', () => {
      text.textContent = input.value;
      onSet(input.value);
    });
    control.append(input, text);
    row.append(lab, control);
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
        'Mobile browsers generally do not expose display or app-audio capture. Use Microphone or Audio file on those devices.',
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
      ),
    );
    interfaceSection.appendChild(
      this.colorPicker('Custom interface accent', settings.customInterfaceAccent, (value) => {
        this.store.update({ customInterfaceAccent: value, useCustomInterfaceAccent: true });
        const toggle = this.el.querySelector<HTMLInputElement>(`#${controlId('Use custom interface accent')}`);
        if (toggle) toggle.checked = true;
        this.onChange();
      }),
    );
    interfaceSection.appendChild(
      this.checkbox('Use custom interface accent', settings.useCustomInterfaceAccent, (value) =>
        this.set('useCustomInterfaceAccent', value),
      ),
    );
    this.el.appendChild(interfaceSection);

    const visual = this.section('Visual');
    visual.appendChild(
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
    visual.appendChild(
      this.select(
        'Shape',
        MODES.map((mode) => ({ value: mode.id, label: mode.label })),
        settings.mode,
        (value) => this.set('mode', value),
      ),
    );
    visual.appendChild(
      this.select(
        'Colour set',
        PALETTE_IDS.map((palette) => ({ value: palette, label: paletteLabel(palette) })),
        settings.palette,
        (value) => {
          this.store.update({ palette: value, useCustomColor: false });
          const toggle = this.el.querySelector<HTMLInputElement>(`#${controlId('Use custom colour')}`);
          if (toggle) toggle.checked = false;
          this.onChange();
        },
      ),
    );
    visual.appendChild(
      this.colorPicker('Custom colour', settings.customColor, (value) => {
        this.store.update({ customColor: value, useCustomColor: true });
        const toggle = this.el.querySelector<HTMLInputElement>(`#${controlId('Use custom colour')}`);
        if (toggle) toggle.checked = true;
        this.onChange();
      }),
    );
    visual.appendChild(
      this.checkbox('Use custom colour', settings.useCustomColor, (value) => this.set('useCustomColor', value)),
    );
    this.el.appendChild(visual);

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

    const helpSection = this.section('FAQ');
    helpSection.appendChild(this.help());
    this.el.appendChild(helpSection);

    const actions = document.createElement('section');
    actions.className = 'settings-actions';
    const reset = document.createElement('button');
    reset.className = 'panel-reset';
    reset.type = 'button';
    reset.textContent = 'Restore defaults';
    reset.addEventListener('click', () => {
      const confirmed = globalThis.confirm('Restore visual settings to their defaults? Interface and source preferences will be kept.');
      if (!confirmed) return;
      this.store.reset();
      this.onChange();
      this.render();
    });
    actions.appendChild(reset);
    this.el.appendChild(actions);
  }
}
