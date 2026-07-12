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
  await expect(page.getByRole('button', { name: 'Restore defaults' })).toBeVisible();
  await expect(page.locator('.panel-header')).toBeVisible();
});

test('restore defaults requires confirmation', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  const sensitivity = page.getByLabel('Sensitivity');
  await sensitivity.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '1.7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const reset = page.getByRole('button', { name: 'Restore defaults' });
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
