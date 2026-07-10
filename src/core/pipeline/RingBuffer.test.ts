import { describe, it, expect } from 'vitest';
import { RingBuffer } from './RingBuffer';

describe('RingBuffer', () => {
  it('reports available frames capped at capacity', () => {
    const rb = RingBuffer.create(8, 1);
    expect(rb.availableFrames()).toBe(0);
    rb.write([new Float32Array([1, 2, 3])], 3);
    expect(rb.availableFrames()).toBe(3);
    rb.write([new Float32Array([4, 5, 6, 7, 8, 9])], 6);
    expect(rb.writeFrame).toBe(9);
    expect(rb.availableFrames()).toBe(8); // capped
  });

  it('returns the most-recent window', () => {
    const rb = RingBuffer.create(8, 1);
    rb.write([new Float32Array([1, 2, 3, 4, 5])], 5);
    const out = [new Float32Array(3)];
    expect(rb.readLatest(out, 3)).toBe(true);
    expect(Array.from(out[0])).toEqual([3, 4, 5]);
  });

  it('wraps correctly across the capacity boundary', () => {
    const rb = RingBuffer.create(4, 1);
    rb.write([new Float32Array([1, 2, 3, 4])], 4); // fills
    rb.write([new Float32Array([5, 6])], 2); // overwrites slots 0,1 -> ring: 5,6,3,4
    const out = [new Float32Array(4)];
    rb.readLatest(out, 4);
    // most recent 4 frames are 3,4,5,6
    expect(Array.from(out[0])).toEqual([3, 4, 5, 6]);
  });

  it('zero-pads when fewer frames than requested exist', () => {
    const rb = RingBuffer.create(8, 1);
    rb.write([new Float32Array([9, 9])], 2);
    const out = [new Float32Array(4)];
    rb.readLatest(out, 4);
    expect(Array.from(out[0])).toEqual([0, 0, 9, 9]);
  });

  it('keeps channels independent', () => {
    const rb = RingBuffer.create(4, 2);
    rb.write([new Float32Array([1, 2]), new Float32Array([-1, -2])], 2);
    const out = [new Float32Array(2), new Float32Array(2)];
    rb.readLatest(out, 2);
    expect(Array.from(out[0])).toEqual([1, 2]);
    expect(Array.from(out[1])).toEqual([-1, -2]);
  });

  it('survives a round-trip through attach() on the same SAB', () => {
    const producer = RingBuffer.create(16, 1);
    const consumer = RingBuffer.attach(producer.sab, 16, 1);
    producer.write([new Float32Array([7, 8, 9])], 3);
    const out = [new Float32Array(3)];
    expect(consumer.readLatest(out, 3)).toBe(true);
    expect(Array.from(out[0])).toEqual([7, 8, 9]);
  });
});
