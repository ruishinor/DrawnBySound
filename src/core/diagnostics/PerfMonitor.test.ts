import { describe, it, expect } from 'vitest';
import { PerfMonitor } from './PerfMonitor';

describe('PerfMonitor', () => {
  it('converges to ~60 fps for 16.67 ms frames', () => {
    const pm = new PerfMonitor(0.2);
    let fps = 60;
    for (let i = 0; i < 200; i++) fps = pm.update(1000 / 60);
    expect(fps).toBeCloseTo(60, 0);
  });

  it('converges to ~30 fps for 33.3 ms frames', () => {
    const pm = new PerfMonitor(0.2);
    let fps = 60;
    for (let i = 0; i < 300; i++) fps = pm.update(1000 / 30);
    expect(fps).toBeGreaterThan(28);
    expect(fps).toBeLessThan(32);
  });
});
