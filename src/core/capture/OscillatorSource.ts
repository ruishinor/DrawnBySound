import type { AudioGraph } from '../pipeline/AudioGraph';

export interface OscillatorHandle {
  stop(): void;
}

/**
 * Feeds a deterministic stereo tone pair into the worklet graph. Used to verify
 * the real-time pipeline (worklet -> ring -> AGC -> LiveSource) without needing
 * microphone permission / a physical device in automated tests.
 */
export function startOscillator(graph: AudioGraph, freqL = 220, freqR = 330): OscillatorHandle {
  const ctx = graph.ctx;
  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator();
  const oscR = ctx.createOscillator();
  oscL.frequency.value = freqL;
  oscR.frequency.value = freqR;
  const gainL = ctx.createGain();
  const gainR = ctx.createGain();
  gainL.gain.value = 0.6;
  gainR.gain.value = 0.6;
  oscL.connect(gainL).connect(merger, 0, 0);
  oscR.connect(gainR).connect(merger, 0, 1);
  graph.connectInput(merger);
  oscL.start();
  oscR.start();
  void graph.resume();
  return {
    stop() {
      oscL.stop();
      oscR.stop();
      merger.disconnect();
    },
  };
}
