import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke E2E for the VibratoFlow web MVP. Runs against the dev server (the
 * `window.__vibrato` automation hooks are dev-only). Fixtures come from
 * `node scripts/gen-test-assets.mjs`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const hooks = (page: Page) => page.waitForFunction(() => !!(window as any).__vibrato);

test('boots cross-origin isolated with a live demo source', async ({ page }) => {
  await page.goto('/');
  await hooks(page);

  await expect(page.locator('#status')).toContainText('VibratoFlow — demo signal');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  const probe = await page.evaluate(() => (window as any).__vibrato.probe());
  expect(probe.ok).toBe(true);
  expect(probe.max).toBeGreaterThan(0.5);
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
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:5174')) foreign.push(r.url());
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


test('interface theme persists across reloads', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');

  const appearance = page.getByLabel('Interface theme');
  await appearance.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111317');

  await page.reload();
  await hooks(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.click('#settings-btn');
  await expect(page.getByLabel('Interface theme')).toHaveValue('dark');

  await page.getByLabel('Interface theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f4f6');
});

test('settings form controls have associated labels and stable names', async ({ page }) => {
  await page.goto('/');
  await hooks(page);
  await page.click('#settings-btn');
  const controls = page.locator('#panel input, #panel select');
  const count = await controls.count();
  expect(count).toBeGreaterThan(5);
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index);
    const id = await control.getAttribute('id');
    const name = await control.getAttribute('name');
    expect(id).toBeTruthy();
    expect(name).toBeTruthy();
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
  }
});

test('mobile layout stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await hooks(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('#control-deck')).toBeVisible();
});
