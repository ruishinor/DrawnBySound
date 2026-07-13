import { describe, expect, it } from 'vitest';
import { MAX_BUFFER_DECODE_BYTES, shouldUseMediaElement } from './FileAdapter';

describe('file decode routing', () => {
  it('keeps ordinary files on the decoded-buffer path', () => {
    expect(shouldUseMediaElement({ size: MAX_BUFFER_DECODE_BYTES })).toBe(false);
  });

  it('routes larger files to the media-element path', () => {
    expect(shouldUseMediaElement({ size: MAX_BUFFER_DECODE_BYTES + 1 })).toBe(true);
  });
});
