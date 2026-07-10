// Ambient declarations for the AudioWorkletGlobalScope (not in TS DOM lib).
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: unknown) => AudioWorkletProcessor,
): void;

declare const sampleRate: number;
declare const currentTime: number;
declare const currentFrame: number;
