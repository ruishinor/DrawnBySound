import { RingBuffer } from './RingBuffer';
import { FeatureBus, FAST } from './FeatureBus';
import { SpectralBus } from './SpectralBus';
import { ClassBus } from './ClassBus';
import { BAND_COUNT } from '../features/spectral';
import { CATEGORIES } from '../classify/Classifier';
import type { FeatureFrame, Category } from '../features/FeatureFrame';

const RING_CAPACITY = 1 << 15; // ~0.68 s at 48 kHz
const RING_CHANNELS = 3; // L, R, mono
const FFT_SIZE = 2048;
const HOP_MS = 11; // ~90 Hz spectral updates — fast vs the classifier, light vs render
const CLASSIFY_EVERY = 27; // ~300 ms classifier cadence (PRD §14.2: 250 ms–2 s)

/**
 * Owns the real-time audio graph: AudioContext, the preprocessor AudioWorklet,
 * and the shared ring buffer + feature bus it writes to. Input nodes (mic,
 * oscillator, …) connect via `connectInput`. The worklet outputs silence and is
 * connected to the destination only to keep the graph pulling (no feedback).
 */
export class AudioGraph {
  readonly ctx: AudioContext;
  readonly node: AudioWorkletNode;
  readonly ring: RingBuffer;
  readonly bus: FeatureBus;
  readonly specBus: SpectralBus;
  readonly classBus: ClassBus;
  private readonly worker: Worker;
  private readonly initMsg: Record<string, unknown>;
  private readonly classScratch = new Float32Array(CATEGORIES.length);

  private constructor(
    ctx: AudioContext,
    node: AudioWorkletNode,
    ring: RingBuffer,
    bus: FeatureBus,
    specBus: SpectralBus,
    classBus: ClassBus,
    worker: Worker,
    initMsg: Record<string, unknown>,
  ) {
    this.ctx = ctx;
    this.node = node;
    this.ring = ring;
    this.bus = bus;
    this.specBus = specBus;
    this.classBus = classBus;
    this.worker = worker;
    this.initMsg = initMsg;
  }

  static async create(): Promise<AudioGraph> {
    const ctx = new AudioContext();
    await ctx.audioWorklet.addModule(
      new URL('../preprocess/preprocessor.worklet.ts', import.meta.url),
    );
    const ring = RingBuffer.create(RING_CAPACITY, RING_CHANNELS);
    const bus = FeatureBus.create();
    const specBus = SpectralBus.create();
    const classBus = ClassBus.create();
    const node = new AudioWorkletNode(ctx, 'vibrato-preprocessor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { ringSAB: ring.sab, capacity: RING_CAPACITY, featureSAB: bus.sab },
    });
    node.connect(ctx.destination); // silent output keeps process() pulling

    const worker = new Worker(new URL('../features/features.worker.ts', import.meta.url), {
      type: 'module',
    });
    const initMsg = {
      type: 'init',
      ringSAB: ring.sab,
      capacity: RING_CAPACITY,
      specSAB: specBus.sab,
      fastSAB: bus.sab,
      classSAB: classBus.sab,
      fftSize: FFT_SIZE,
      sampleRate: ctx.sampleRate,
      hopMs: HOP_MS,
      classifyEvery: CLASSIFY_EVERY,
    };
    worker.postMessage(initMsg);

    return new AudioGraph(ctx, node, ring, bus, specBus, classBus, worker, initMsg);
  }

  connectInput(source: AudioNode): void {
    source.connect(this.node);
  }

  /** Halt off-thread analysis (hidden tab — PRD §14.6). Audio is unaffected. */
  pauseAnalysis(): void {
    this.worker.postMessage({ type: 'stop' });
  }

  /**
   * (Re)start analysis with fresh smoothing/normalizer state. Also used on
   * source switches so adaptive ranges don't leak between sources (§15.4).
   */
  resumeAnalysis(): void {
    this.worker.postMessage(this.initMsg);
  }

  /** Assemble the latest FeatureFrame from the fast + spectral buses (no alloc). */
  readFeatures(frame: FeatureFrame): void {
    frame.rms = this.bus.get(FAST.RMS);
    frame.peak = this.bus.get(FAST.PEAK);
    frame.clip = this.bus.get(FAST.CLIP) >= 0.5;
    frame.zcr = this.bus.get(FAST.ZCR);
    frame.envelope = this.bus.get(FAST.ENVELOPE);
    frame.gain = this.bus.get(FAST.GAIN);
    for (let b = 0; b < BAND_COUNT; b++) frame.bands[b] = this.specBus.get(b);
    frame.centroid = this.specBus.centroid;
    frame.flux = this.specBus.flux;
    frame.onset = this.specBus.onset;
    frame.stereoWidth = this.specBus.stereoWidth;
    frame.tLastUpdate = this.specBus.counter;

    // Classification (PRD §13.6) — optional; the renderer works without it.
    if (!frame.classes) {
      frame.classes = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    }
    this.classBus.readScores(this.classScratch);
    for (let i = 0; i < CATEGORIES.length; i++) frame.classes[CATEGORIES[i]] = this.classScratch[i];
    frame.voicePresent = this.classBus.voicePresent;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  async close(): Promise<void> {
    try {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.node.disconnect();
      await this.ctx.close();
    } catch {
      /* already closed */
    }
  }
}
