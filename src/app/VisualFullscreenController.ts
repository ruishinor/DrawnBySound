export type VisualViewMode = 'native-fullscreen' | 'expanded-view' | 'inline';

/**
 * Presents the visual stage in native fullscreen where available and falls
 * back to a viewport-filling expanded view when the browser refuses or lacks
 * the Fullscreen API. Audio and renderer state are untouched.
 */
export class VisualFullscreenController {
  private mode: VisualViewMode = 'inline';
  private idleTimer: number | null = null;
  private scrollX = 0;
  private scrollY = 0;
  private destroyed = false;

  private readonly onFullscreenChange = (): void => {
    if (this.destroyed) return;
    if (this.document.fullscreenElement === this.stage) {
      this.setMode('native-fullscreen');
    } else if (this.mode === 'native-fullscreen') {
      this.setMode('inline');
    }
  };

  private readonly onFullscreenError = (): void => {
    if (!this.destroyed && this.mode === 'inline') this.enterExpandedView();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.showControlsTemporarily();
    if (event.key === 'Escape' && this.mode === 'expanded-view') {
      event.preventDefault();
      this.exitExpandedView();
    }
  };

  private readonly onActivity = (): void => {
    this.showControlsTemporarily();
  };

  private readonly onButtonClick = (): void => {
    void this.toggle();
  };

  constructor(
    private readonly stage: HTMLElement,
    private readonly button: HTMLButtonElement,
    private readonly status: HTMLElement | null,
    private readonly onLayoutChange: () => void,
    private readonly document: Document = globalThis.document,
    private readonly window: Window = globalThis.window,
  ) {
    this.button.addEventListener('click', this.onButtonClick);
    this.document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.document.addEventListener('fullscreenerror', this.onFullscreenError);
    this.document.addEventListener('keydown', this.onKeyDown);
    for (const event of ['pointermove', 'pointerdown', 'touchstart', 'focusin'] as const) {
      this.stage.addEventListener(event, this.onActivity, { passive: true });
    }
    this.updatePresentation();
  }

  get currentMode(): VisualViewMode {
    return this.mode;
  }

  async toggle(): Promise<void> {
    if (this.mode !== 'inline') {
      await this.exit();
      return;
    }
    await this.enter();
  }

  async enter(): Promise<void> {
    if (this.destroyed || this.mode !== 'inline') return;

    const request = this.stage.requestFullscreen;
    if (typeof request === 'function' && this.document.fullscreenEnabled !== false) {
      try {
        await request.call(this.stage);
        if (this.document.fullscreenElement === this.stage) {
          this.setMode('native-fullscreen');
          return;
        }
      } catch {
        // Fall through to the honest viewport-filling fallback.
      }
    }

    this.enterExpandedView();
  }

  async exit(): Promise<void> {
    if (this.mode === 'native-fullscreen') {
      if (this.document.fullscreenElement && typeof this.document.exitFullscreen === 'function') {
        try {
          await this.document.exitFullscreen();
          if (!this.document.fullscreenElement && this.mode === 'native-fullscreen') {
            this.setMode('inline');
          }
        } catch {
          this.setMode('inline');
        }
      } else {
        this.setMode('inline');
      }
      return;
    }

    if (this.mode === 'expanded-view') this.exitExpandedView();
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearIdleTimer();
    this.button.removeEventListener('click', this.onButtonClick);
    this.document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.document.removeEventListener('fullscreenerror', this.onFullscreenError);
    this.document.removeEventListener('keydown', this.onKeyDown);
    for (const event of ['pointermove', 'pointerdown', 'touchstart', 'focusin'] as const) {
      this.stage.removeEventListener(event, this.onActivity);
    }
    await this.exit();
  }

  private enterExpandedView(): void {
    if (this.mode !== 'inline') return;
    this.scrollX = this.window.scrollX;
    this.scrollY = this.window.scrollY;
    this.document.body.classList.add('visual-expanded');
    this.stage.classList.add('stage--expanded');
    this.setMode('expanded-view');
  }

  private exitExpandedView(): void {
    if (this.mode !== 'expanded-view') return;
    this.document.body.classList.remove('visual-expanded');
    this.stage.classList.remove('stage--expanded');
    this.setMode('inline');
    this.window.scrollTo(this.scrollX, this.scrollY);
  }

  private setMode(mode: VisualViewMode): void {
    this.mode = mode;
    this.stage.dataset.viewMode = mode;
    this.updatePresentation();
    this.onLayoutChange();
    if (mode === 'inline') {
      this.clearIdleTimer();
      delete this.stage.dataset.controlsIdle;
    } else {
      this.showControlsTemporarily();
    }
  }

  private updatePresentation(): void {
    const active = this.mode !== 'inline';
    const label =
      this.mode === 'expanded-view'
        ? 'Exit expanded view'
        : active
          ? 'Exit full screen'
          : 'Enter full screen';
    this.button.setAttribute('aria-label', label);
    this.button.setAttribute('aria-pressed', String(active));
    this.button.title = label;

    if (!this.status) return;
    this.status.textContent =
      this.mode === 'native-fullscreen'
        ? 'Full screen view active.'
        : this.mode === 'expanded-view'
          ? 'Expanded view active. Browser controls may remain visible.'
          : 'Visual returned to the page.';
  }

  private showControlsTemporarily(): void {
    if (this.mode === 'inline') return;
    delete this.stage.dataset.controlsIdle;
    this.clearIdleTimer();
    this.idleTimer = this.window.setTimeout(() => {
      this.stage.dataset.controlsIdle = 'true';
      this.idleTimer = null;
    }, 2800);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer === null) return;
    this.window.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
