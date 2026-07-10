import type { AudioGraph } from '../pipeline/AudioGraph';

export interface MicHandle {
  stream: MediaStream;
  stop(): void;
}

/**
 * Microphone capture (PRD §13.2). Disables the browser's own AGC/NS/echo so our
 * AGC controls level. Requests permission only when invoked (PRD §14.4). Throws
 * on denial / no device so the caller can show a fallback (PRD §14.3).
 */
export async function startMic(graph: AudioGraph): Promise<MicHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture is not supported in this browser.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  });
  await graph.resume();
  const src = graph.ctx.createMediaStreamSource(stream);
  graph.connectInput(src);
  return {
    stream,
    stop() {
      src.disconnect();
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
