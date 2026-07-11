/** Common transport contract for decoded-buffer and browser-native file playback. */
export interface TransportPlayer {
  readonly duration: number;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  stop(): void;
}
