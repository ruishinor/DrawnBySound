import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke E2E for the VibratoFlow web MVP. Runs against the dev server (the
 * `window.__vibrato` automation hooks are dev-only). Fixtures come from
 * `node scripts/gen-test-assets.mjs`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const hooks = (page: Page) => page.waitForFunction(() => !!(window as any).__vibrato);

test('boots cross-origin isolated with a live sample source', async ({ page }) => {
  await page.goto('/');
  await hooks(page);

  await expect(page.locator('#status')).toContainText('VibratoFlow — sample signal');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  const probe = await page.evaluate(() => (window as any).__vibrato.probe());
  expect(probe.ok).toBe(true);
  expect(probe.max).toBeGreaterThan(0.5);
});

test('primary controls use the accepted labels and source order', async ({ page }) => {
  await page.goto('/');
  await hooks(page);

  await expect(page.locator('#export')).toHaveText('Save image');
  await expect(page.locator('#settings-btn')).toHaveText('Settings');
  await expect(page.locator('.source-button span')).toHaveText([
    'Microphone',
    'External app',
    'Audio file',
    'Demo',
  ]);
});

test('Norwegian palettes are selectable without changing the selected rendering mode', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  const mode = page.getByLabel('Shape');
  const palette = page.getByLabel('Colour set');
  const initialMode = await mode.inputValue();

  await palette.selectOption('norwegian-flow');
  await expect(palette.locator('option:checked')).toHaveText('Norwegian flow');
  await expect(mode).toHaveValue(initialMode);

  await palette.selectOption('norwegian-flag');
  await expect(palette.locator('option:checked')).toHaveText('Norwegian flag');
  await expect(mode).toHaveValue(initialMode);
  await expect
    .poll(() => page.evaluate(() => (window as any).__vibrato.averageLuminance()))
    .toBeGreaterThan(0);
});

test('file pipeline drives all five rendering modes', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.evaluate(() => (window as any).__vibrato.loadUrl('/test-assets/stereo-lissajous.wav'));
  for (const id of ['stereo-xy', 'mono-phase-xy', 'band-xy', 'beat-lissajous', 'hybrid-grammar']) {
    await page.evaluate((m) => (window as any).__vibrato.setModeById(m), id);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => (window as any).__vibrato.averageLuminance())).toBeGreaterThan(0);
  }
});

test('stop control halts listening and the trace decays', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.evaluate(() => (window as any).__vibrato.loadUrl('/test-assets/mono-sine.wav'));
  await page.waitForTimeout(400);
  await page.click('#stop');
  await expect(page.locator('#status')).toContainText('not listening');
  const l1 = await page.evaluate(() => (window as any).__vibrato.averageLuminance());
  await page.waitForTimeout(600);
  const l2 = await page.evaluate(() => (window as any).__vibrato.averageLuminance());
  expect(l2).toBeLessThan(l1);
});

test('still export produces a PNG without interrupting the session', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  const size = await page.evaluate(() => (window as any).__vibrato.exportPng());
  expect(size).toBeGreaterThan(1000);
});

test('local-first: no request ever leaves the origin', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://localhost:5174')) foreign.push(request.url());
  });
  await page.goto('/');
  await hooks(page);
  await page.evaluate(() => (window as any).__vibrato.loadUrl('/test-assets/stereo-lissajous.wav'));
  await page.waitForTimeout(800);
  expect(foreign).toEqual([]);
});

test('visual preferences persist across a reload without auto-starting protected sources', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');
  await page.getByLabel('Colour set').selectOption('mono');
  await page.getByLabel('Sensitivity').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '1.7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload();
  await hooks(page);
  await page.click('#settings-btn');
  await expect(page.getByLabel('Colour set')).toHaveValue('mono');
  await expect(page.getByLabel('Sensitivity')).toHaveValue('1.7');
});

test('interface theme and curated accent persist across reloads', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  await page.getByLabel('Interface theme').selectOption('dark');
  await page.getByLabel('Interface accent', { exact: true }).selectOption('plum');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'plum');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1b1d1f');

  await page.reload();
  await hooks(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'plum');
  await page.click('#settings-btn');
  await expect(page.getByLabel('Interface theme')).toHaveValue('dark');
  await expect(page.getByLabel('Interface accent', { exact: true })).toHaveValue('plum');

  await page.getByLabel('Interface theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#dfe1df');
});

test('settings explain controls and keep the active preset visible', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  const preset = page.getByLabel('Preset');
  await expect(preset.locator('option:checked')).toHaveText('Custom settings');
  await expect(page.locator('#vf-input-gain-description')).toContainText('Playback volume is unchanged');
  await expect(page.locator('#vf-custom-colour-description')).toContainText('visual trace only');
  await expect(page.locator('#vf-shape-description')).toContainText('left channel horizontally');
  await expect(page.locator('#vf-use-less-power-description')).toContainText('lower resolution');
  await expect(page.locator('#vf-reduce-motion-description')).toContainText('sudden bursts');
  await expect(page.locator('#vf-show-diagnostics-description')).toContainText('frame rate');

  await preset.focus();
  await preset.press('ArrowDown');
  await expect(preset).toHaveValue('warm-room');
  await expect(preset).toBeFocused();
  await preset.press('ArrowDown');
  await expect(preset).toHaveValue('mineral-lines');
  await expect(preset).toBeFocused();

  await preset.selectOption('deep-bass-field');
  await expect(page.getByLabel('Preset')).toHaveValue('deep-bass-field');
  await expect(page.getByLabel('Preset').locator('option:checked')).toHaveText('Deep Bass Field');
  await expect(page.locator('#vf-preset-description')).toContainText('low frequencies');

  await page.reload();
  await hooks(page);
  await page.click('#settings-btn');
  await expect(page.getByLabel('Preset')).toHaveValue('deep-bass-field');

  await page.getByLabel('Soft glow').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0.1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByLabel('Preset')).toHaveValue('');
  await expect(page.getByLabel('Preset').locator('option:checked')).toHaveText('Custom settings');
});

test('custom presets preserve the edited snapshot without mutating the saved definition', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  const preset = page.getByLabel('Preset');
  await preset.selectOption('deep-bass-field');
  await expect(page.getByLabel('Shape')).toHaveValue('stereo-xy');
  await expect(page.getByLabel('Colour set')).toHaveValue('ice');
  await expect(page.getByLabel('Trail length')).toHaveValue('0.96');
  await expect(page.getByLabel('Sensitivity')).toHaveValue('1');

  await page.getByLabel('Soft glow').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0.1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(preset.locator('option:checked')).toHaveText('Custom settings');
  await expect(page.locator('#vf-last-selected-preset')).toContainText('Deep Bass Field');
  await expect(page.getByLabel('Shape')).toHaveValue('stereo-xy');
  await expect(page.getByLabel('Colour set')).toHaveValue('ice');
  await expect(page.getByLabel('Trail length')).toHaveValue('0.96');
  await expect(page.getByLabel('Sensitivity')).toHaveValue('1');

  page.once('dialog', (dialog) => void dialog.accept('Night bass'));
  await page.getByRole('button', { name: 'Save current preset' }).click();
  await expect(preset.locator('option:checked')).toHaveText('Night bass');
  await expect(page.locator('#vf-preset-description')).toContainText('without changing the saved preset');
  await expect(page.locator('#vf-saved-presets')).toContainText('Night bass');
  await expect(page.getByRole('button', { name: 'Load saved preset Night bass' })).toBeVisible();

  await page.reload();
  await hooks(page);
  await page.click('#settings-btn');
  await expect(page.getByLabel('Preset').locator('option:checked')).toHaveText('Night bass');
  await expect(page.getByRole('button', { name: 'Load saved preset Night bass' })).toBeVisible();

  await page.getByLabel('Trail length').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0.7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByLabel('Preset').locator('option:checked')).toHaveText('Custom settings');
  await expect(page.locator('#vf-last-selected-preset')).toContainText('Night bass');
  await expect(page.getByLabel('Soft glow')).toHaveValue('0.1');

  await page.getByRole('button', { name: 'Load saved preset Night bass' }).click();
  await expect(page.getByLabel('Trail length')).toHaveValue('0.96');
  await expect(page.getByLabel('Soft glow')).toHaveValue('0.1');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Delete saved preset' }).click();
  await expect(page.getByLabel('Preset').locator('option:checked')).toHaveText('Custom settings');
  await expect(page.getByLabel('Preset').locator('option', { hasText: 'Night bass' })).toHaveCount(0);
});


test('settings desktop layout matches the wide grouped target without dropping controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.getByLabel('Preset')).toBeVisible();
  await expect(page.getByLabel('Colour set')).toBeVisible();
  await expect(page.getByLabel('Shape')).toBeVisible();
  await expect(page.getByLabel('Custom colour', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Use custom colour')).toBeVisible();
  await expect(page.getByLabel('Interface theme')).toBeVisible();
  await expect(page.getByLabel('Interface accent', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Custom interface accent', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Use custom interface accent')).toBeVisible();

  const headings = await page.locator('#panel > .settings-section > h3').allTextContents();
  expect(headings).toEqual(['Interface', 'Response', 'Device and accessibility', 'FAQ']);

  const faqHeading = page.locator('.settings-section--faq > h3');
  await expect(faqHeading).toBeVisible();

  const visualStyles = await page.evaluate(() => {
    const reset = document.querySelector<HTMLElement>('.panel-reset');
    const faq = document.querySelector<HTMLElement>('.settings-section--faq > h3');
    if (!reset || !faq) throw new Error('Missing reset button or FAQ heading');
    const resetStyle = getComputedStyle(reset);
    const faqStyle = getComputedStyle(faq);
    return {
      resetBackground: resetStyle.backgroundColor,
      resetColor: resetStyle.color,
      faqFontSize: Number.parseFloat(faqStyle.fontSize),
      faqFontWeight: Number.parseInt(faqStyle.fontWeight, 10),
    };
  });

  expect(visualStyles.resetBackground).toBe('rgb(77, 33, 35)');
  expect(visualStyles.resetColor).toBe('rgb(255, 255, 255)');
  expect(visualStyles.faqFontSize).toBeGreaterThanOrEqual(14);
  expect(visualStyles.faqFontWeight).toBeGreaterThanOrEqual(700);

  const layout = await page.evaluate(() => {
    const rect = (selector: string, closest?: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      const target = closest ? element?.closest<HTMLElement>(closest) : element;
      if (!target) throw new Error(`Missing layout target: ${selector}`);
      const box = target.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
    };

    return {
      panel: rect('#panel'),
      preset: rect('#vf-preset', '.setting-row'),
      colour: rect('#vf-colour-set', '.setting-row'),
      shape: rect('#vf-shape', '.setting-row'),
      customColour: rect('#vf-custom-colour', '.setting-row'),
      theme: rect('#vf-interface-theme', '.setting-row'),
      presetActions: rect('.preset-actions'),
      customAccent: rect('#vf-custom-interface-accent', '.setting-row'),
      interfaceAccent: rect('#vf-interface-accent', '.setting-row'),
      reset: rect('.panel-reset'),
      faq: rect('.help-details'),
    };
  });

  expect(layout.panel.width).toBeGreaterThanOrEqual(1080);
  expect(Math.abs(layout.preset.top - layout.colour.top)).toBeLessThanOrEqual(4);
  expect(layout.preset.left).toBeLessThan(layout.colour.left);
  expect(Math.abs(layout.shape.top - layout.customColour.top)).toBeLessThanOrEqual(4);
  expect(layout.shape.left).toBeLessThan(layout.customColour.left);
  expect(Math.abs(layout.theme.top - layout.presetActions.top)).toBeLessThanOrEqual(4);
  expect(layout.theme.left).toBeLessThan(layout.presetActions.left);
  expect(Math.abs(layout.customAccent.top - layout.interfaceAccent.top)).toBeLessThanOrEqual(4);
  expect(layout.customAccent.left).toBeLessThan(layout.interfaceAccent.left);
  expect(layout.reset.left).toBeGreaterThan(layout.panel.left + layout.panel.width / 2);
  expect(layout.reset.bottom).toBeLessThan(layout.faq.top);
});

test('settings modal owns mobile scrolling and leaves no exposed top strip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  await expect(page.locator('body')).toHaveClass(/settings-open/u);
  const geometry = await page.locator('#panel').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      top: rect.top,
      bottomGap: innerHeight - rect.bottom,
      height: rect.height,
      scrollHeight: panel.scrollHeight,
      clientHeight: panel.clientHeight,
    };
  });
  expect(geometry.top).toBeLessThanOrEqual(8);
  expect(geometry.bottomGap).toBeLessThanOrEqual(8);
  expect(geometry.height).toBeGreaterThan(680);
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);

  await page.locator('#panel').evaluate((panel) => {
    panel.scrollTop = panel.scrollHeight;
  });
  await expect(page.getByRole('button', { name: 'Restore all visual defaults' })).toBeVisible();
  await expect(page.locator('.panel-header')).toBeVisible();
});

test('restore visual defaults requires confirmation', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  const sensitivity = page.getByLabel('Sensitivity');
  await sensitivity.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '1.7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const reset = page.getByRole('button', { name: 'Restore all visual defaults' });
  page.once('dialog', (dialog) => void dialog.dismiss());
  await reset.click();
  await expect(sensitivity).toHaveValue('1.7');

  page.once('dialog', (dialog) => void dialog.accept());
  await reset.click();
  await expect(page.getByLabel('Sensitivity')).toHaveValue('1');
});

test('external app cancellation is handled without a console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await hooks(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: async () => {
        throw new DOMException('Permission denied by user', 'NotAllowedError');
      },
    });
  });

  await page.click('#system');
  await expect(page.locator('#status')).toContainText('external app sharing cancelled');
  expect(errors.filter((message) => message.includes('External app capture failed'))).toEqual([]);
});

test('unsupported mobile external capture stays visible with an honest explanation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: undefined,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await hooks(page);

  await expect(page.locator('#system')).toBeDisabled();
  await expect(page.locator('#system span')).toHaveText('External app');
  await expect(page.locator('#system small')).toHaveText('Desktop browser only');
});

test('settings form controls have associated labels and stable names', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');
  const controls = page.locator('#panel input, #panel select');
  const count = await controls.count();
  expect(count).toBeGreaterThan(8);
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index);
    const id = await control.getAttribute('id');
    const name = await control.getAttribute('name');
    expect(id).toBeTruthy();
    expect(name).toBeTruthy();
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
  }
});

test('mobile layout keeps the stage and source navigation inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await hooks(page);
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    verticalOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    sourceBottom: document.querySelector('.source-controls')?.getBoundingClientRect().bottom ?? 0,
    viewportHeight: innerHeight,
  }));
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(metrics.verticalOverflow).toBeLessThanOrEqual(0);
  expect(metrics.sourceBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('.source-controls')).toBeVisible();
});
