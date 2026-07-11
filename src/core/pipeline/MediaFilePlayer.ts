import { clamp } from '../util/math';
import type { AudioGraph } from './AudioGraph';
import type { TransportPlayer } from './TransportPlayer';

/**
 * Browser-native fallback for files that decodeAudioData rejects. This keeps
 * playback and analysis local while letting the media element use the browser's
 * normal codec pipeline (useful for some mobile MP3/M4A variants).
 */
export class MediaFilePlayer implements TransportPlayer {
  private disposed = false;

  private constructor(
    private readonly graph: AudioGraph,
    private readonly audio: HTMLAudioElement,
    private readonly node: MediaElementAudioSourceNode,
    private readonly objectUrl: string,
  ) {}

  static async create(graph: AudioGraph, file: File): Promise<MediaFilePlayer> {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', '');

    let node: MediaElementAudioSourceNode | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = globalThis.setTimeout(() => {
          cleanup();
          reject(new Error('browser media metadata timed out'));
        }, 15_000);
        const cleanup = (): void => {
          globalThis.clearTimeout(timeout);
          audio.removeEventListener('loadedmetadata', onReady);
          audio.removeEventListener('error', onError);
        };
        const onReady = (): void => {
          cleanup();
          resolve();
        };
        const onError = (): void => {
          cleanup();
          const code = audio.error?.code;
          reject(new Error(code ? `browser media error ${code}` : 'browser media element rejected the file'));
        };
        audio.addEventListener('loadedmetadata', onReady, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.src = objectUrl;
        audio.load();
      });

      node = graph.ctx.createMediaElementSource(audio);
      node.connect(graph.node);
      node.connect(graph.ctx.destination);
      return new MediaFilePlayer(graph, audio, node, objectUrl);
    } catch (error) {
      node?.disconnect();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  get duration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  get isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  async play(): Promise<void> {
    if (this.disposed) return;
    await this.graph.resume();
    await this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    this.audio.currentTime = clamp(seconds, 0, this.duration);
  }

  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.pause();
    this.node.disconnect();
    this.audio.removeAttribute('src');
    this.audio.load();
    URL.revokeObjectURL(this.objectUrl);
  }
}
