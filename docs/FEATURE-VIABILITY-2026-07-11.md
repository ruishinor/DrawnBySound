# VibratoFlow — other-app audio and live lyrics viability

Date: 2026-07-11

## Decision summary

- **Desktop web other-app audio:** keep the current explicit “Other app” capture as best-effort. It can work when the browser exposes an audio track for a selected tab/window/screen, but it is not a universal system mixer.
- **Mobile web other-app audio:** do not promise Spotify, BlackPlayer, YouTube, Instagram Reels, or general device playback. Browser/OS support is too inconsistent and often unavailable.
- **Native Android playback capture:** viable as a separate Android adapter/app phase on Android 10+, with mandatory user approval and source-app policy restrictions. It still cannot promise every app.
- **Samsung per-app audio controls:** useful to a user’s routing experience, but they do not create a standard browser capture API. Treat them as device behavior, not an integration surface.
- **Live lyrics:** technically viable as an optional, local, experimental subsystem, but not yet defensible as a release feature. Singing recognition, model size, latency, memory, battery, and thermal load require measurement.
- **Implementation in this pass:** explanatory web UI, source preference, and robust state handling only. No fake lyrics toggle and no native bridge stub.

## 1. Other-app audio

### 1.1 Current web path

The existing adapter uses `navigator.mediaDevices.getDisplayMedia()` and requests audio while the user chooses a share surface. This is the correct minimal web mechanism because it preserves browser-controlled consent and produces a `MediaStream` compatible with the existing `AudioGraph`.

The important limitation is conceptual: this is screen/tab/window sharing with an optional audio track, not guaranteed access to the operating system’s complete playback mix. Whether audio is offered depends on browser, operating system, selected surface, and the media source. The UI therefore uses “Other app — when supported,” not “Spotify” or “all system audio.”

### 1.2 Headphones and the microphone path

A microphone cannot hear headphone output acoustically. Headphones reduce environmental noise for the listener but do not route the digital playback stream into `getUserMedia()`. Therefore “use headphones outside” does not solve app-to-app capture.

The valid routes are:

1. browser-provided display/tab audio capture;
2. file import;
3. acoustic microphone capture from a speaker;
4. a native OS-specific playback-capture implementation.

### 1.3 Desktop web viability

**Viable with limits.** The current Other app action should remain. Acceptance should test exact browser/OS combinations and the exact source-selection UI. The app must verify that the returned stream contains an audio track and fail visibly when it does not.

Required behavior:

[Request capture only from a direct user action] → verify: no prompt appears on page load or restore.

[Require an actual audio track] → verify: a video-only stream is rejected with guidance to choose a share target that includes audio.

[Observe track termination] → verify: browser “Stop sharing” ends the VibratoFlow session and updates status.

[Keep local playback independent] → verify: capture does not intentionally mute the user’s selected source unless the browser/constraint does so.

[Do not persist capture permission] → verify: every new session requires browser consent.

### 1.4 Mobile web viability

**Not a dependable product promise.** Mobile browsers frequently lack a usable system/tab-audio option for `getDisplayMedia()`, and multi-window does not by itself grant a web page access to another app’s audio stream. Samsung’s audio-routing or isolation settings may change what the user hears, but VibratoFlow cannot depend on those private device controls from ordinary browser JavaScript.

Recommended product behavior:

- Keep Other app visible only when the browser exposes the relevant API and the real-time pipeline is available.
- Label it as conditional before the user taps it.
- After failure, recommend Audio file or Microphone rather than implying the user configured the phone incorrectly.
- Do not add app-specific buttons for Spotify/YouTube/Instagram unless there is a verified integration contract.

### 1.5 Native Android viability

**Technically viable as a separate adapter.** Android’s AudioPlaybackCapture API is the appropriate route for Android 10+ native code. The capture app needs audio permission, a user-approved MediaProjection session, and the playing/capturing apps must be in the same user profile. The source app can also restrict whether its playback is capturable.

A defensible Android phase would be:

[Create a native proof of concept using AudioPlaybackCapture] → verify: capture reaches the same frame/bus contract as the web `AudioGraph` without copying rendering logic.

[Request MediaProjection and audio permission visibly] → verify: no capture occurs without both user approvals.

[Detect source-policy refusal] → verify: unsupported or silent sources produce a specific state rather than a frozen visual.

[Test representative apps and usage types] → verify: Spotify, YouTube, BlackPlayer, browser media, and a local test app are recorded as pass/fail by device/OS version; no universal claim is made.

[Decide packaging] → verify: the product chooses either a native Android app, Trusted Web Activity plus native bridge, or a hybrid shell based on measured complexity—not because PWA alone appears convenient.

[Maintain local-only handling] → verify: captured PCM remains on-device and no analytics/logging contains audio.

Trade-off: this materially increases release, permission, store-review, device-testing, and lifecycle complexity. It should not be merged into the web MVP as a conditional code path.

### 1.6 iOS/iPadOS position

No general iOS other-app playback capture path has been implemented or verified for this project. Treat iOS Other app audio as unsupported until an Apple-documented capability and a working device proof exist. File and microphone remain the defensible inputs.

## 2. Live lyrics / transcription

### 2.1 Define the feature correctly

There are two different products often called “lyrics”:

1. **Canonical lyrics retrieval:** fetch the official/published text for an identified song. This requires song identification, a licensed lyrics provider or rights strategy, networking, and synchronization metadata. It conflicts with the present local-only/no-account scope.
2. **Live transcription:** infer words from the incoming audio stream. This can run locally, but the output is probabilistic and especially difficult for singing mixed with instruments.

The user request maps most closely to local live transcription. The UI must call it “Live transcription” or “Heard words,” not imply authoritative lyrics.

### 2.2 Why a toggle was not added now

A toggle without a loaded model, capability gate, and validated audio queue would be deceptive. It could also create a severe mobile performance regression by competing with WebGL rendering, feature extraction, decoding, and audio worklets.

The feature needs these decisions first:

- local model/runtime;
- model size and download consent;
- storage/cache policy;
- language selection or detection;
- streaming/chunking strategy;
- latency target;
- singing benchmark;
- device memory/WebGPU/WASM gate;
- privacy and deletion behavior;
- fallback/disabled state;
- exact text transition behavior.

### 2.3 Open-source options assessed

#### Browser Whisper / Transformers.js approaches

Projects such as Whisper Web demonstrate local browser inference using worker-based JavaScript runtimes, with experimental WebGPU acceleration. This is the closest architectural fit to VibratoFlow because it can remain local and can be isolated in a worker. The risks are model download size, first-run delay, memory use, compatibility, and pseudo-streaming rather than native token streaming.

Use only as an experimental branch after measuring:

- model load/download duration;
- cached and uncached startup;
- real-time factor on target Samsung/desktop devices;
- simultaneous WebGL frame rate;
- peak memory;
- battery and temperature over 15–30 minutes;
- English and Norwegian singing accuracy.

#### whisper.cpp / WASM

`whisper.cpp` is mature for local inference and has real-time examples, but browser integration still requires a worker/WASM packaging layer, model delivery, audio resampling, and bounded chunk handling. It is viable but not inherently simpler than a browser-native Transformers.js path.

#### Whisper-Streaming / SimulStreaming class

Whisper was not designed as a real-time streaming model. Whisper-Streaming demonstrates an adaptation with self-adjusting latency, but its reported multi-second latency and service-oriented Python architecture make it a reference for segmentation/stability, not a drop-in browser component. The repository itself indicates that newer SimulStreaming work supersedes it.

#### WhisperFlow / WhisprFlow / Wispr Flow naming

Names in this area are easy to conflate. Dictation products and Python desktop tools branded with similar names are not automatically suitable for an in-browser song-transcription pipeline. Selection must be based on runtime, license, model delivery, streaming behavior, and target-device evidence rather than product-name similarity.

### 2.4 Recommended architecture

Keep transcription outside the existing fast feature pipeline:

```
AudioWorklet / post-AGC mono stream
  → bounded downsample queue (16 kHz mono)
  → transcription worker
      VAD / chunk assembly
      local ASR runtime
      partial/final segment stabilizer
  → typed TranscriptionBus
  → three-line lyric presenter below the stage
```

Do not route transcription through the spectral feature worker. ASR has a different cadence, memory profile, failure model, and lifecycle.

Required interfaces:

```ts
interface TranscriptSegment {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
  confidence?: number;
  final: boolean;
}

interface TranscriptionController {
  start(options: TranscriptionOptions): Promise<void>;
  push(samples16kMono: Float32Array, startSec: number): void;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

The concrete runtime stays behind `TranscriptionController`; the UI and audio graph must not depend directly on a specific model library.

### 2.5 UX contract for one or three lines

Recommended default: three-line rolling view below the visual on desktop and a compact one-line view on small phones, with a user option for Off / 1 line / 3 lines only after the engine is available.

Rules:

- Partial text occupies the newest line and is visually distinct but still legible.
- Finalized text transitions upward; it is not rewritten after finalization unless the engine emits an explicit correction event.
- Empty/low-confidence periods show no invented words.
- A status state distinguishes downloading model, loading, listening, delayed, unavailable, and stopped.
- Reduced-motion mode uses immediate text replacement rather than sliding/fading animation.
- Exported PNG excludes transcription by default unless the user explicitly enables text inclusion.
- No transcript is persisted by default. Optional session export would require a separate explicit action.

### 2.6 Benchmark and release gates

#### Phase L0 — feasibility spike

[Select two local runtimes and the smallest multilingual model each supports] → verify: licenses, model provenance, browser packaging, and redistribution terms are recorded.

[Build a worker-only transcription spike using prerecorded fixtures] → verify: no model code enters the AudioWorklet or render loop.

[Measure clean speech first] → verify: end-to-end latency, real-time factor, memory, and frame-rate impact are captured on desktop and target Samsung phone.

#### Phase L1 — singing reality test

[Create a legally usable evaluation set] → verify: at least English and Norwegian solo vocal, vocal-plus-accompaniment, live room, and compressed streaming-like samples are included.

[Measure rather than demo-select] → verify: word error rate and segment latency are reported for each condition.

[Reject unusable combinations] → verify: the product does not ship a model that appears impressive on speech but fails ordinary songs.

#### Phase L2 — product integration

[Add explicit model-download consent] → verify: first load remains lightweight and no model downloads until the user enables transcription.

[Cache the model locally with versioning and a clear-delete control] → verify: update, corruption, quota failure, and deletion paths are tested.

[Add bounded audio backpressure] → verify: slow inference drops/merges old chunks rather than growing memory without limit.

[Protect visualization performance] → verify: target frame rate and audio stability remain within the project’s thresholds during 30-minute use.

[Add Off / 1 line / 3 lines only when the controller is ready] → verify: the toggle cannot enter a false “on” state.

#### Phase L3 — release acceptance

[Test permissions, backgrounding, orientation, headphones, Bluetooth, thermal throttling, and interrupted audio] → verify: every interruption returns to an explicit recoverable state.

[Review privacy and copyright language] → verify: UI states that text is machine transcription, local by default, and not authoritative published lyrics.

[Ship behind an experimental flag first] → verify: disabling the flag removes model download and transcription UI from the production path.

## 3. Recommended next product sequence

1. Merge and device-test the current UI/persistence pass.
2. Add source-session cancellation if real testing reproduces switching races.
3. Decide whether reliable Android other-app audio justifies a native Android product branch.
4. Run a narrow local-transcription benchmark before creating lyrics UI.
5. Only then select a runtime and implement the transcript presenter.

This order prevents two expensive features—native capture and local ASR—from being embedded in an unproven interaction shell.
