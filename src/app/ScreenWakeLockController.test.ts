import { describe, expect, it, vi } from 'vitest';
import { ScreenWakeLockController, type ScreenWakeLockStateChange } from './ScreenWakeLockController';

class FakeSentinel extends EventTarget {
  released = false;
  releaseCalls = 0;

  async release(): Promise<void> {
    if (this.released) return;
    this.releaseCalls += 1;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

function fakeDocument(visibilityState: DocumentVisibilityState = 'visible'): Document {
  const target = new EventTarget();
  Object.defineProperty(target, 'visibilityState', {
    configurable: true,
    writable: true,
    value: visibilityState,
  });
  return target as Document;
}

function setVisibility(document: Document, visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    writable: true,
    value: visibilityState,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('ScreenWakeLockController', () => {
  it('requests and releases a supported screen wake lock', async () => {
    const document = fakeDocument();
    const pageTarget = new EventTarget();
    const sentinel = new FakeSentinel();
    const request = vi.fn(async () => sentinel);
    const states: ScreenWakeLockStateChange[] = [];
    const controller = new ScreenWakeLockController(
      (change) => states.push(change),
      document,
      { wakeLock: { request } } as never,
      pageTarget,
    );

    await expect(controller.setEnabled(true)).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
    expect(controller.active).toBe(true);
    expect(states.at(-1)?.state).toBe('active');

    await controller.setEnabled(false);
    expect(sentinel.releaseCalls).toBe(1);
    expect(controller.active).toBe(false);
    expect(states.at(-1)?.state).toBe('inactive');
  });

  it('releases a request that resolves after the preference was disabled', async () => {
    const document = fakeDocument();
    const pageTarget = new EventTarget();
    const sentinel = new FakeSentinel();
    let resolveRequest!: (value: FakeSentinel) => void;
    const requestPromise = new Promise<FakeSentinel>((resolve) => {
      resolveRequest = resolve;
    });
    const controller = new ScreenWakeLockController(
      () => {},
      document,
      { wakeLock: { request: () => requestPromise } } as never,
      pageTarget,
    );

    const pending = controller.setEnabled(true);
    await controller.setEnabled(false);
    resolveRequest(sentinel);

    await expect(pending).resolves.toBe(false);
    expect(sentinel.releaseCalls).toBe(1);
    expect(controller.active).toBe(false);
  });

  it('releases the current lock while hidden and reacquires when visible', async () => {
    const document = fakeDocument();
    const pageTarget = new EventTarget();
    const sentinels = [new FakeSentinel(), new FakeSentinel()];
    const request = vi.fn(async () => sentinels[request.mock.calls.length - 1]);
    const controller = new ScreenWakeLockController(
      () => {},
      document,
      { wakeLock: { request } } as never,
      pageTarget,
    );

    await controller.setEnabled(true);
    setVisibility(document, 'hidden');
    await vi.waitFor(() => expect(sentinels[0].releaseCalls).toBe(1));
    expect(controller.active).toBe(false);

    setVisibility(document, 'visible');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(controller.active).toBe(true);
  });

  it('releases a late request that resolves after the page was hidden', async () => {
    const document = fakeDocument();
    const pageTarget = new EventTarget();
    const sentinel = new FakeSentinel();
    let resolveRequest!: (value: FakeSentinel) => void;
    const requestPromise = new Promise<FakeSentinel>((resolve) => {
      resolveRequest = resolve;
    });
    const controller = new ScreenWakeLockController(
      () => {},
      document,
      { wakeLock: { request: () => requestPromise } } as never,
      pageTarget,
    );

    const pending = controller.setEnabled(true);
    setVisibility(document, 'hidden');
    resolveRequest(sentinel);

    await expect(pending).resolves.toBe(false);
    expect(sentinel.releaseCalls).toBe(1);
    expect(controller.active).toBe(false);
  });

  it('reacquires on pageshow when a persisted page returns visible', async () => {
    const document = fakeDocument();
    const pageTarget = new EventTarget();
    const sentinels = [new FakeSentinel(), new FakeSentinel()];
    const request = vi.fn(async () => sentinels[request.mock.calls.length - 1]);
    const controller = new ScreenWakeLockController(
      () => {},
      document,
      { wakeLock: { request } } as never,
      pageTarget,
    );

    await controller.setEnabled(true);
    pageTarget.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(sentinels[0].releaseCalls).toBe(1));
    pageTarget.dispatchEvent(new Event('pageshow'));

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(controller.active).toBe(true);
  });

  it('reports unsupported without requesting anything', async () => {
    const states: ScreenWakeLockStateChange[] = [];
    const controller = new ScreenWakeLockController(
      (change) => states.push(change),
      fakeDocument(),
      {} as Navigator,
      new EventTarget(),
    );

    await expect(controller.setEnabled(true)).resolves.toBe(false);
    expect(controller.supported).toBe(false);
    expect(states.at(-1)?.state).toBe('unsupported');
  });
});
