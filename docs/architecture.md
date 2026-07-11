# VibratoFlow — Architecture

Local-first, real-time music-interpretation oscilloscope visualizer (web MVP).
Finalized name **VibratoFlow** (PRD working title was "OscilloFlow").

## Pipeline (PRD §15.1)

```
Input adapter (mic / decoded file / browser-media file fallback / system / oscillator-test)
  → AudioWorklet  preprocessor.worklet.ts   [audio thread, no allocation]
      DC removal · AGC + soft limiter · clip flag · fast features (RMS/peak/ZCR/env)
  → RingBuffer (SharedArrayBuffer, lock-free SPSC; ch: L, R, mono)
  → features.worker.ts                      [worker thread]
      Hann → FFT → band energies · centroid · flux · onset · stereo width  (~90 Hz)
      HeuristicClassifier (broad timbre + vocal presence, throttled ~300 ms, EMA + hysteresis)
  → FeatureFrame (assembled on main thread from FeatureBus / SpectralBus / ClassBus SABs)
  → VisualGrammar  grammar/mappings.ts      [pure, deterministic, classifier-optional]
  → Renderer (WebGL2): TracePass → PersistencePass (ping-pong) → BloomPass → Composite/tone-map
  → StillExport (PNG readback, session-preserving)
```

## Invariants

- **The renderer never depends on the classifier or worker** — raw features always suffice; the
  classifier only emits structured, smoothed signals (PRD §15.5, §22).
- **No allocation in the audio callback**; the worklet does fixed-size math + ring writes (§14.1).
- **Analysis runs iff a graph-backed source is active and the tab is visible** — the worker is
  paused on Stop / demo / hidden tab, and re-initialized (fresh adaptive-normalizer state) on
  every source start (§14.6, §15.4).
- **Local-first**: zero production dependencies; no network egress at runtime (§14.4).

## Deployment requirement — cross-origin isolation

The real-time pipeline uses `SharedArrayBuffer`, which browsers only enable when the page is
cross-origin isolated. **The host must send:**

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The dev/preview servers set these (see `crossOriginIsolation()` in `vite.config.ts`) and Vercel
uses `vercel.json`. The AudioWorklet is emitted through Vite `?worker&url` as a separate
executable JavaScript chunk and checked by `scripts/verify-dist.mjs`. Without them the app
degrades honestly to demo-only with an explanatory status (`realtimeSupported()` in
`src/core/capture/Capabilities.ts`). A postMessage fallback pipeline is deliberately deferred —
see "Accepted trade-offs".

## Accepted trade-offs

- `BandXY` / `HybridGrammar` use module-scope scratch buffers: allocation-free by design; safe
  because exactly one render loop runs per page. Not re-entrant — do not call from workers.
- The demo signal bypasses the analysis graph and fakes gentle features (`applyDemoFrame`).
- `main.ts` is a large single composition root. A structural refactor is backlog: it is
  fully behind the gate tests and pre-1.0 churn risk outweighs value.
- SAB fallback (postMessage transport) deferred until a target host cannot set COOP/COEP.
- File import uses decoded-buffer playback first and a same-origin blob/media-element fallback
  when the browser rejects the file in `decodeAudioData()`.

## Module map

`src/core/` is DOM-free and portable (Rust/C++ port seam): `capture/` (adapters + capabilities),
`preprocess/` (worklet + AGC), `pipeline/` (ring, buses, AudioGraph, FilePlayer), `features/`
(FFT, spectral, FeatureFrame, worker), `classify/` (heuristic classifier, vocal presence),
`grammar/` (mappings, presets, palettes), `render/` (passes + modes), `export/`, `diagnostics/`.
`src/app/` holds UI: settings store/panel, debug overlay, honest copy strings.
