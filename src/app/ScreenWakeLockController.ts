export type ScreenWakeLockState =
  | 'unsupported'
  | 'inactive'
  | 'requesting'
  | 'active'
  | 'released'
  | 'error';

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

type WakeLockNavigator = Navigator & { wakeLock?: WakeLockLike };

export interface ScreenWakeLockStateChange {
  state: ScreenWakeLockState;
  error?: unknown;
}

/**
 * Keeps the display awake only when the user has opted in and the page is
 * visible. Pending requests are revision-guarded so disabling the preference
 * cannot leave a late wake lock active.
 */
export class ScreenWakeLockController {
  private desired = false;
  private sentinel: WakeLockSentinelLike | null = null;
  private revision = 0;
  private pendingRequest: Promise<boolean> | null = null;
  private destroyed = false;

  private readonly onVisibilityChange = (): void => {
    if (this.destroyed || !this.desired) return;
    if (this.document.visibilityState !== 'visible') {
      this.suspend();
      return;
    }
    void this.setEnabled(true);
  };

  private readonly onPageHide = (): void => {
    if (!this.destroyed) this.suspend();
  };

  private readonly onPageShow = (): void => {
    if (this.destroyed || !this.desired || this.document.visibilityState !== 'visible') return;
    void this.setEnabled(true);
  };

  constructor(
    private readonly onStateChange: (change: ScreenWakeLockStateChange) => void = () => {},
    private readonly document: Document = globalThis.document,
    private readonly navigator: WakeLockNavigator = globalThis.navigator as WakeLockNavigator,
    private readonly pageTarget: EventTarget = globalThis,
  ) {
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.pageTarget.addEventListener('pagehide', this.onPageHide);
    this.pageTarget.addEventListener('pageshow', this.onPageShow);
    this.emit(this.supported ? 'inactive' : 'unsupported');
  }

  get supported(): boolean {
    return typeof this.navigator.wakeLock?.request === 'function';
  }

  get active(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }

  async setEnabled(enabled: boolean): Promise<boolean> {
    if (this.destroyed) return false;

    if (!enabled) {
      this.desired = false;
      this.revision += 1;
      this.pendingRequest = null;
      await this.releaseCurrent();
      this.emit(this.supported ? 'inactive' : 'unsupported');
      return false;
    }

    this.desired = true;

    if (!this.supported) {
      this.emit('unsupported');
      return false;
    }

    if (this.document.visibilityState !== 'visible') {
      this.emit('inactive');
      return false;
    }

    if (this.active) {
      this.emit('active');
      return true;
    }

    if (this.pendingRequest) return this.pendingRequest;

    const revision = ++this.revision;
    this.emit('requesting');

    const request = this.requestWakeLock(revision);
    this.pendingRequest = request;
    try {
      return await request;
    } finally {
      if (this.pendingRequest === request) this.pendingRequest = null;
    }
  }

  private async requestWakeLock(revision: number): Promise<boolean> {
    try {
      const sentinel = await this.navigator.wakeLock!.request('screen');
      if (
        this.destroyed ||
        revision !== this.revision ||
        !this.desired ||
        this.document.visibilityState !== 'visible'
      ) {
        await sentinel.release().catch(() => {});
        return false;
      }

      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        this.emit(this.desired ? 'released' : 'inactive');
      });
      this.emit('active');
      return true;
    } catch (error) {
      if (revision === this.revision && this.desired) this.emit('error', error);
      return false;
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.desired = false;
    this.revision += 1;
    this.pendingRequest = null;
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.pageTarget.removeEventListener('pagehide', this.onPageHide);
    this.pageTarget.removeEventListener('pageshow', this.onPageShow);
    await this.releaseCurrent();
  }

  private emit(state: ScreenWakeLockState, error?: unknown): void {
    this.onStateChange({ state, error });
  }

  private suspend(): void {
    this.revision += 1;
    this.pendingRequest = null;
    void this.releaseCurrent();
    this.emit(this.supported ? 'inactive' : 'unsupported');
  }

  private async releaseCurrent(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (!sentinel || sentinel.released) return;
    await sentinel.release().catch(() => {});
  }
}
