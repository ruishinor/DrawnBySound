import { RingBuffer } from '../pipeline/RingBuffer';
import { SpectralBus, SPEC } from '../pipeline/SpectralBus';
import { FeatureBus, FAST } from '../pipeline/FeatureBus';
import { ClassBus, CLASS } from '../pipeline/ClassBus';
import { SpectralAnalyzer, BAND_COUNT } from './spectral';
import { HeuristicClassifier } from '../classify/HeuristicClassifier';
import { CATEGORIES, type ClassifierInput } from '../classify/Classifier';

interface InitMessage {
  type: 'init';
  ringSAB: SharedArrayBuffer;
  capacity: number;
  specSAB: SharedArrayBuffer;
  fastSAB: SharedArrayBuffer;
  classSAB: SharedArrayBuffer;
  fftSize: number;
  sampleRate: number;
  hopMs: number;
  classifyEvery: number; // run the classifier every N spectral ticks
}
interface StopMessage {
  type: 'stop';
}
type WorkerMessage = InitMessage | StopMessage;

/**
 * Off-main-thread spectral feature extraction + broad classification (PRD
 * §15.4, §15.5). The classifier runs at a slower cadence than the spectral hop
 * and never touches the DOM, so rendering is never blocked. The classifier only
 * emits structured signals — it never draws.
 */
let ring: RingBuffer | null = null;
let specBus: SpectralBus | null = null;
let fastBus: FeatureBus | null = null;
let classBus: ClassBus | null = null;
let analyzer: SpectralAnalyzer | null = null;
const classifier = new HeuristicClassifier();
let left: Float32Array | null = null;
let right: Float32Array | null = null;
let mono: Float32Array | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let specCounter = 0;
let classCounter = 0;
let tick = 0;
let classifyEvery = 30;
const classInput: ClassifierInput = {
  bands: new Float32Array(BAND_COUNT),
  centroid: 0,
  flux: 0,
  onset: 0,
  stereoWidth: 0,
  rms: 0,
  zcr: 0,
};

function step(): void {
  if (!ring || !specBus || !fastBus || !classBus || !analyzer || !left || !right || !mono) return;
  const n = analyzer.fftSize;
  if (ring.availableFrames() < n) return;
  ring.readLatest([left, right, mono], n);
  const r = analyzer.process(mono, left, right, n);

  for (let b = 0; b < BAND_COUNT; b++) specBus.set(SPEC.BANDS + b, r.bands[b]);
  specBus.set(SPEC.CENTROID, r.centroid);
  specBus.set(SPEC.FLUX, r.flux);
  specBus.set(SPEC.ONSET, r.onset);
  specBus.set(SPEC.WIDTH, r.stereoWidth);
  specBus.set(SPEC.COUNTER, (specCounter = (specCounter + 1) >>> 0));

  // Classification runs slower than the spectral hop (PRD §14.2, §15.5).
  if (++tick % classifyEvery === 0) {
    classInput.bands.set(r.bands);
    classInput.centroid = r.centroid;
    classInput.flux = r.flux;
    classInput.onset = r.onset;
    classInput.stereoWidth = r.stereoWidth;
    classInput.rms = fastBus.get(FAST.RMS);
    classInput.zcr = fastBus.get(FAST.ZCR);
    const c = classifier.classify(classInput);
    for (let i = 0; i < CATEGORIES.length; i++) classBus.set(CLASS.SCORES + i, c.scores[i]);
    classBus.set(CLASS.VOICE, c.voicePresent);
    classBus.set(CLASS.CONFIDENCE, c.confidence);
    classBus.set(CLASS.DOMINANT, CATEGORIES.indexOf(c.dominant));
    classBus.set(CLASS.COUNTER, (classCounter = (classCounter + 1) >>> 0));
  }
}

self.onmessage = (e: MessageEvent): void => {
  const msg = e.data as WorkerMessage;
  if (msg.type === 'init') {
    ring = RingBuffer.attach(msg.ringSAB, msg.capacity, 3);
    specBus = SpectralBus.attach(msg.specSAB);
    fastBus = FeatureBus.attach(msg.fastSAB);
    classBus = ClassBus.attach(msg.classSAB);
    analyzer = new SpectralAnalyzer(msg.fftSize, msg.sampleRate);
    classifyEvery = Math.max(1, msg.classifyEvery);
    left = new Float32Array(msg.fftSize);
    right = new Float32Array(msg.fftSize);
    mono = new Float32Array(msg.fftSize);
    if (timer !== null) clearInterval(timer);
    timer = setInterval(step, msg.hopMs);
  } else if (msg.type === 'stop') {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
};
