# VibratoFlow — architecture

VibratoFlow is a framework-free, local-first, real-time music visualizer. The 2026-07-11 design pass changes the product shell, settings boundary, and source-state presentation without replacing the DSP or rendering pipeline.

## Runtime pipeline

```text
Input adapter
  demo / microphone / decoded file / media-element file fallback / shared display audio
  → AudioGraph
  → AudioWorklet: preprocessor.worklet.ts
      DC removal · AGC · soft limiter · clip state · fast features
  → SharedArrayBuffer RingBuffer
  → features.worker.ts
      FFT · bands · centroid · flux · onset · stereo width
      broad timbre and vocal-presence classification
  → FeatureFrame
  → visual grammar: mappings.ts
  → WebGL2 renderer
      TracePass → PersistencePass → BloomPass → Composite
  → optional PNG still export
```

## UI and state composition

```text
index.html
  semantic product shell and fixed control targets
  → src/app/ui/app.css
      responsive layout, visual language, focus/touch states
  → src/main.ts
      composition root and source-session orchestration
      → SettingsStore
          versioned/sanitized local preferences
      → SettingsPanel
          generated labelled controls
      → capture adapters / transport / renderer / diagnostics
```

`src/main.ts` remains intentionally large for this release candidate. The next defensible extraction is a source-session coordinator, but only after browser and device acceptance establishes the required behavior. A broad component/framework migration is not justified.

## Settings boundary

`SettingsStore` persists visual preferences and `preferredSource` to `localStorage` under `vibratoflow.settings.v2`.

The store:

- migrates valid v1 settings;
- rejects malformed structures;
- clamps numeric values to supported bounds;
- validates custom hex colour and source enum values;
- preserves preferred source when visual defaults are restored;
- does not persist active media handles, file objects, browser permissions, PCM, or transcript data.

Preferred source is not active source. Microphone, shared display audio, and local files require a new user gesture after reload.

## Source lifecycle

One active presentation source exists at a time:

- Demo uses `SyntheticSource` and no audio graph.
- Microphone and shared audio produce a `MediaStream` connected to `AudioGraph`.
- Decoded files use `FilePlayer`.
- Browser-media fallback uses `MediaFilePlayer` and a local blob URL.
- Stop selects an explicit silence source and pauses analysis.

Capture tracks are observed for external termination. The current code does not yet serialize overlapping asynchronous source starts. Add a session token or cancellation coordinator only if E2E/manual testing reproduces a race.

## Rendering invariants

- The audio callback performs fixed-size work and avoids allocation.
- Rendering does not depend on classifier availability.
- The classifier supplies optional structured influence, not the primary visual signal.
- Demo mode can run when real-time SharedArrayBuffer capability is unavailable.
- The dark canvas is an instrument surface; the surrounding UI is deliberately neutral.
- Custom colour enters through visual grammar rather than creating a second rendering path.

## Deployment requirement

The real-time pipeline uses `SharedArrayBuffer`, which requires cross-origin isolation. The host must send:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The development server is fixed to port 5174 with `strictPort: true`. Preview uses 4173. The AudioWorklet is emitted through Vite’s worker URL path and verified after every production build.

Without COOP/COEP, capability handling disables live sources and exposes demo-only status rather than attempting a degraded real-time transport.

## Other-app capture boundary

The web adapter uses display/tab/window capture with optional audio. It is not a universal system-audio mixer and cannot promise access to any named third-party app. A native Android AudioPlaybackCapture adapter would be a separate platform layer and must preserve the same local sample/feature contract.

## Transcription seam — not implemented

A future local transcription subsystem must remain separate from the fast spectral worker:

```text
post-AGC mono audio
  → bounded 16 kHz queue
  → transcription worker/runtime
  → typed partial/final transcript bus
  → optional one/three-line presenter
```

No ASR model, transcript persistence, or lyrics UI is included in this release candidate. See `FEATURE-VIABILITY-2026-07-11.md`.

## Accepted trade-offs and residual risks

- No postMessage fallback for browsers without SharedArrayBuffer.
- No service worker; local processing does not guarantee offline startup.
- No source-start cancellation token yet.
- No dedicated AudioWorklet crash health channel.
- No focus trap inside the settings sheet, although open/close/focus restoration is implemented.
- Development dependency audit findings require an isolated breaking toolchain upgrade; production dependency audit is clean.
- Automated browser and exact-device acceptance remain release gates.
