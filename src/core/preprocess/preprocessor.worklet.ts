import { RingBuffer } from '../pipeline/RingBuffer';
import { FeatureBus, FAST } from '../pipeline/FeatureBus';
import { Agc, softLimit } from './agc';

interface PreprocessorOptions {
  processorOptions: {
    ringSAB: SharedArrayBuffer;
    capacity: number;
    featureSAB: SharedArrayBuffer;
  };
}

const QUANTUM = 128;
const DC_R = 0.995; // one-pole high-pass coefficient (~20 Hz at 48k)

/**
 * Real-time preprocessing on the audio thread (PRD §15.3): DC removal, AGC +
 * soft limiter, fast frame features, and lock-free ring writes. No allocation
 * in process() — all scratch buffers/state are pre-allocated (PRD §14.1).
 */
class PreprocessorProcessor extends AudioWorkletProcessor {
  private readonly ring: RingBuffer;
  private readonly bus: FeatureBus;
  private readonly agc = new Agc();

  private readonly hpL = new Float32Array(QUANTUM);
  private readonly hpR = new Float32Array(QUANTUM);
  private readonly hpM = new Float32Array(QUANTUM);
  private readonly outL = new Float32Array(QUANTUM);
  private readonly outR = new Float32Array(QUANTUM);
  private readonly outM = new Float32Array(QUANTUM);
  private readonly chans: Float32Array[] = [this.outL, this.outR, this.outM];

  private pInL = 0;
  private pOutL = 0;
  private pInR = 0;
  private pOutR = 0;
  private prevSign = 1;
  private env = 0;
  private counter = 0;

  constructor(options?: unknown) {
    super(options);
    const o = (options as PreprocessorOptions).processorOptions;
    this.ring = RingBuffer.attach(o.ringSAB, o.capacity, 3);
    this.bus = FeatureBus.attach(o.featureSAB);
  }

  private publishSilence(): void {
    this.bus.set(FAST.RMS, 0);
    this.bus.set(FAST.PEAK, 0);
    this.bus.set(FAST.CLIP, 0);
    this.bus.set(FAST.ENVELOPE, 0);
    this.bus.set(FAST.COUNTER, (this.counter = (this.counter + 1) >>> 0));
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (output) for (let c = 0; c < output.length; c++) output[c].fill(0); // silent (no feedback)

    const input = inputs[0];
    if (!input || input.length === 0 || input[0].length === 0) {
      this.publishSilence();
      return true;
    }

    const L = input[0];
    const R = input[1] ?? input[0];
    const n = Math.min(L.length, QUANTUM);

    // DC removal (one-pole HPF) per channel -> mono.
    for (let i = 0; i < n; i++) {
      const xl = L[i];
      const yl = xl - this.pInL + DC_R * this.pOutL;
      this.pInL = xl;
      this.pOutL = yl;
      this.hpL[i] = yl;

      const xr = R[i];
      const yr = xr - this.pInR + DC_R * this.pOutR;
      this.pInR = xr;
      this.pOutR = yr;
      this.hpR[i] = yr;

      this.hpM[i] = 0.5 * (yl + yr);
    }

    const res = this.agc.update(this.hpM, n);
    const g = res.gain;

    let zc = 0;
    let prevSign = this.prevSign;
    for (let i = 0; i < n; i++) {
      this.outL[i] = softLimit(this.hpL[i] * g);
      this.outR[i] = softLimit(this.hpR[i] * g);
      const mm = softLimit(this.hpM[i] * g);
      this.outM[i] = mm;
      const s = mm >= 0 ? 1 : -1;
      if (s !== prevSign) {
        zc++;
        prevSign = s;
      }
    }
    this.prevSign = prevSign;

    this.ring.write(this.chans, n);

    this.env += (res.rms * g - this.env) * 0.1;
    // Post-AGC loudness: what the listener hears and the grammar should see.
    // (Pre-gain RMS made visual intensity depend on source level, defeating AGC.)
    this.bus.set(FAST.RMS, Math.min(res.rms * g, 1));
    this.bus.set(FAST.PEAK, res.peak);
    this.bus.set(FAST.CLIP, res.clipped ? 1 : 0);
    this.bus.set(FAST.ZCR, zc / n);
    this.bus.set(FAST.ENVELOPE, this.env);
    this.bus.set(FAST.GAIN, g);
    this.bus.set(FAST.COUNTER, (this.counter = (this.counter + 1) >>> 0));
    return true;
  }
}

registerProcessor('vibrato-preprocessor', PreprocessorProcessor);
