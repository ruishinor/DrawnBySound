import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualFullscreenController } from './VisualFullscreenController';

class FakeClassList {
  private readonly values = new Set<string>();

  add(...tokens: string[]): void {
    tokens.forEach((token) => this.values.add(token));
  }

  remove(...tokens: string[]): void {
    tokens.forEach((token) => this.values.delete(token));
  }

  contains(token: string): boolean {
    return this.values.has(token);
  }
}

class FakeElement extends EventTarget {
  readonly dataset: Record<string, string> = {};
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  title = '';
  textContent = '';
  requestFullscreen?: () => Promise<void>;

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeDocument extends EventTarget {
  readonly body = new FakeElement();
  fullscreenElement: FakeElement | null = null;
  fullscreenEnabled = true;

  async exitFullscreen(): Promise<void> {
    this.fullscreenElement = null;
    this.dispatchEvent(new Event('fullscreenchange'));
  }
}

class FakeWindow {
  scrollX = 17;
  scrollY = 29;
  readonly scrollTo = vi.fn();

  setTimeout(handler: TimerHandler, timeout?: number): number {
    return globalThis.setTimeout(handler, timeout) as unknown as number;
  }

  clearTimeout(id: number): void {
    globalThis.clearTimeout(id);
  }
}

function keyEvent(key: string): Event {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  return event;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('VisualFullscreenController', () => {
  it('uses native fullscreen and returns to the inline presentation', async () => {
    const document = new FakeDocument();
    const window = new FakeWindow();
    const stage = new FakeElement();
    const button = new FakeElement();
    const status = new FakeElement();
    const onLayoutChange = vi.fn();

    stage.requestFullscreen = async () => {
      document.fullscreenElement = stage;
      document.dispatchEvent(new Event('fullscreenchange'));
    };

    const controller = new VisualFullscreenController(
      stage as unknown as HTMLElement,
      button as unknown as HTMLButtonElement,
      status as unknown as HTMLElement,
      onLayoutChange,
      document as unknown as Document,
      window as unknown as Window,
    );

    await controller.enter();
    expect(controller.currentMode).toBe('native-fullscreen');
    expect(button.getAttribute('aria-label')).toBe('Exit full screen');
    expect(status.textContent).toBe('Full screen view active.');

    await controller.exit();
    expect(controller.currentMode).toBe('inline');
    expect(button.getAttribute('aria-label')).toBe('Enter full screen');
    expect(onLayoutChange).toHaveBeenCalled();
  });

  it('falls back to expanded view, preserves scroll position, and exits with Escape', async () => {
    const document = new FakeDocument();
    const window = new FakeWindow();
    const stage = new FakeElement();
    const button = new FakeElement();
    const status = new FakeElement();

    stage.requestFullscreen = async () => {
      throw new Error('Fullscreen unavailable');
    };

    const controller = new VisualFullscreenController(
      stage as unknown as HTMLElement,
      button as unknown as HTMLButtonElement,
      status as unknown as HTMLElement,
      () => {},
      document as unknown as Document,
      window as unknown as Window,
    );

    await controller.enter();
    expect(controller.currentMode).toBe('expanded-view');
    expect(stage.classList.contains('stage--expanded')).toBe(true);
    expect(document.body.classList.contains('visual-expanded')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Exit expanded view');

    document.dispatchEvent(keyEvent('Escape'));
    expect(controller.currentMode).toBe('inline');
    expect(stage.classList.contains('stage--expanded')).toBe(false);
    expect(document.body.classList.contains('visual-expanded')).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledWith(17, 29);
  });

  it('fades the control after inactivity and restores it after activity', async () => {
    vi.useFakeTimers();
    const document = new FakeDocument();
    const window = new FakeWindow();
    const stage = new FakeElement();
    const button = new FakeElement();

    const controller = new VisualFullscreenController(
      stage as unknown as HTMLElement,
      button as unknown as HTMLButtonElement,
      null,
      () => {},
      document as unknown as Document,
      window as unknown as Window,
    );

    await controller.enter();
    vi.advanceTimersByTime(2800);
    expect(stage.dataset.controlsIdle).toBe('true');

    stage.dispatchEvent(new Event('pointerdown'));
    expect(stage.dataset.controlsIdle).toBeUndefined();
  });
});
