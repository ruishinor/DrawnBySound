import type { SettingsStore, Settings } from '../SettingsStore';
import { PRESETS } from '../../core/grammar/presets';
import { PALETTE_IDS } from '../../core/grammar/palettes';
import { MODES } from '../../core/render/modes';

/**
 * Minimal settings UI (PRD §13.11, §19.1). Owns preset/mode/palette selectors,
 * sliders, and the accessibility toggles. Calls `onChange` after any change so
 * the render loop picks up the new settings (persisted via the store).
 */
export class SettingsPanel {
  private readonly el: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly store: SettingsStore,
    private readonly onChange: () => void,
  ) {
    this.el = container;
    this.render();
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
  }

  private set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.store.update({ [key]: value } as Partial<Settings>);
    this.onChange();
  }

  private select(
    label: string,
    options: { value: string; label: string }[],
    value: string,
    onSet: (v: string) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    lab.textContent = label;
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', label);
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
    sel.value = value;
    sel.addEventListener('change', () => onSet(sel.value));
    row.append(lab, sel);
    return row;
  }

  private range(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onSet: (v: number) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.setAttribute('aria-label', label);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => onSet(Number.parseFloat(input.value)));
    row.append(lab, input);
    return row;
  }

  private checkbox(label: string, value: boolean, onSet: (v: boolean) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('aria-label', label);
    input.checked = value;
    input.addEventListener('change', () => onSet(input.checked));
    row.append(lab, input);
    return row;
  }

  private render(): void {
    const s = this.store.get();
    this.el.replaceChildren();

    const title = document.createElement('h3');
    title.textContent = 'Visual settings';
    this.el.appendChild(title);

    this.el.appendChild(
      this.select(
        'Preset',
        PRESETS.map((p) => ({ value: p.id, label: p.label })),
        '',
        (id) => {
          const preset = PRESETS.find((p) => p.id === id);
          if (preset) {
            this.store.update(preset.settings);
            this.onChange();
            this.render(); // a preset changes many fields — re-sync controls
          }
        },
      ),
    );

    this.el.appendChild(
      this.select(
        'Mode',
        MODES.map((m) => ({ value: m.id, label: m.label })),
        s.mode,
        (v) => this.set('mode', v),
      ),
    );

    this.el.appendChild(
      this.select(
        'Palette',
        PALETTE_IDS.map((p) => ({ value: p, label: p })),
        s.palette,
        (v) => this.set('palette', v),
      ),
    );

    this.el.appendChild(this.range('Sensitivity', 0.2, 3, 0.1, s.sensitivity, (v) => this.set('sensitivity', v)));
    this.el.appendChild(this.range('Input gain', 0.1, 4, 0.1, s.inputGain, (v) => this.set('inputGain', v)));
    this.el.appendChild(this.range('Persistence', 0.5, 0.99, 0.01, s.persistence, (v) => this.set('persistence', v)));
    this.el.appendChild(this.range('Bloom', 0, 1.5, 0.05, s.bloom, (v) => this.set('bloom', v)));

    this.el.appendChild(this.checkbox('Low power', s.lowPower, (v) => this.set('lowPower', v)));
    this.el.appendChild(this.checkbox('Reduced motion', s.reducedMotion, (v) => this.set('reducedMotion', v)));
    this.el.appendChild(this.checkbox('Debug overlay', s.showDebug, (v) => this.set('showDebug', v)));

    const resetRow = document.createElement('div');
    resetRow.className = 'row full';
    const reset = document.createElement('button');
    reset.className = 'reset';
    reset.textContent = 'Reset to defaults';
    reset.addEventListener('click', () => {
      this.store.reset();
      this.onChange();
      this.render();
    });
    resetRow.appendChild(reset);
    this.el.appendChild(resetRow);
  }
}
