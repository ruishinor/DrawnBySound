import path from 'node:path';
import { expect, test } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4175';

for (const fixture of ['mono-sine.wav', 'mono-sine.mp3']) {
  test(`production bundle loads the AudioWorklet and opens ${fixture}`, async ({ page }) => {
    const pageErrors: string[] = [];
    const foreignRequests: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
      const url = request.url();
      if (/^https?:/u.test(url) && !url.startsWith(ORIGIN)) foreignRequests.push(url);
    });

    await page.goto('/');
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#file-trigger').click();
    const chooser = await chooserPromise;
    await chooser.setFiles(path.resolve('test-assets', fixture));
    await expect(page.locator('#status')).toContainText(fixture, { timeout: 15_000 });
    await expect(page.locator('#transport')).toBeVisible();

    if ((await page.locator('#playpause').textContent()) === 'Play') {
      await page.locator('#playpause').click();
    }
    await expect
      .poll(async () => Number.parseFloat(await page.locator('#seek').inputValue()))
      .toBeGreaterThan(0.05);

    expect(foreignRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

test('production bundle starts the microphone path', async ({ context, page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await context.grantPermissions(['microphone'], { origin: ORIGIN });

  await page.goto('/');
  await expect(page.locator('#mic')).toBeEnabled();
  await page.locator('#mic').click();
  await expect(page.locator('#status')).toContainText('listening', { timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});
