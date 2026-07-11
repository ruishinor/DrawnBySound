import { describe, it, expect } from 'vitest';
import { detectCapabilities, realtimeSupported } from './Capabilities';

describe('realtimeSupported', () => {
  it('is false when the page is not cross-origin isolated (node env)', () => {
    // Node has SharedArrayBuffer but no crossOriginIsolated flag.
    expect(realtimeSupported()).toBe(false);
  });
});

describe('detectCapabilities', () => {
  it('always reports file and in-app player as available', () => {
    const caps = detectCapabilities();
    const file = caps.find((c) => c.id === 'file');
    const player = caps.find((c) => c.id === 'player');
    expect(file?.available).toBe(true);
    expect(player?.available).toBe(true);
  });

  it('includes all four modes with honest notes', () => {
    const caps = detectCapabilities();
    expect(caps.map((c) => c.id).sort()).toEqual(['file', 'mic', 'player', 'system']);
    for (const c of caps) expect(c.note.length).toBeGreaterThan(0);
  });

  it('does not mark mic/system available when the APIs are absent (node env)', () => {
    // In the test (node) environment there is no navigator.mediaDevices.
    const caps = detectCapabilities();
    const sys = caps.find((c) => c.id === 'system');
    expect(sys?.available).toBe(false);
    expect(sys?.label).toBe('External app');
    expect(sys?.note).toContain('unavailable');
  });
});
