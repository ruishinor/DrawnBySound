import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke E2E for the VibratoFlow web MVP. Runs against the dev server (the
 * `window.__vibrato` automation hooks are dev-only). Fixtures come from
 * `node scripts/gen-test-assets.mjs`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const hooks = (page: Page) => page.waitForFunction(() => !!(window as any).__vibrato);

test('boots cross-origin isolated with a live demo visual', async ({ page }) => {
  await page.goto('/');
  await hooks(page);

  await expect(page.locator('#status')).toContainText('VibratoFlow — demo signal');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__vibrato.averageLuminance(),
        ),
      { timeout: 10_000 },
    )
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
    if (!r.url().startsWith('http://localhost:5173')) foreign.push(r.url());
  });
  await page.goto('/');
  await hooks(page);
  await page.evaluate(() => (window as any).__vibrato.loadUrl('/test-assets/stereo-lissajous.wav'));
  await page.waitForTimeout(800);
  expect(foreign).toEqual([]);
});
