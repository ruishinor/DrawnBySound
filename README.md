# VibratoFlow

**Real-time oscilloscope art that listens to music, detects its musical character, and turns it
into living geometry on your device.**

VibratoFlow (finalized name; the source PRD used the working title *OscilloFlow*) is a
**local-first, real-time music-interpretation oscilloscope visualizer**. It captures live or
imported audio, extracts musical/acoustic features locally, and renders high-fidelity
oscilloscope-style visuals (XY traces, Lissajous figures, phosphor persistence, glow, bloom) that
react to the music in real time.

- **Local-first** — raw audio never leaves the device by default. No accounts, no cloud, no lyrics.
- **Honest capability model** — available listening modes depend on your device and OS.
- **Web prototype first** — TypeScript + Web Audio API/AudioWorklet + WebGL2 (PRD §16.2, Phase 0),
  with a DOM-free `core/` engine kept portable for later native adapters.

## Status

The planned web-MVP milestones are implemented. Release-candidate acceptance remains pending
production-browser and real-device validation:

- **M0 — Scaffold & CI** ✅
- **M1 — Phase 0 spike: offline file visualizer** ✅ (Stereo XY + Mono Phase XY, persistence/glow)
- **M2 — Real-time core + AGC** ✅ (AudioWorklet, lock-free ring buffer, mic)
- **M3 — Feature extraction** ✅ (FFT worker: bands, centroid, flux, onset, stereo width)
- **M4 — Visual grammar + 5 modes + presets + settings** ✅ (bloom, 8 presets, persisted settings)
- **M5 — Transport + still export + diagnostics + failure states** ✅
- **M6 — Interpretation layer** ✅ (broad timbre classifier + vocal presence, off-thread)
- **M7 — System capture (best-effort) + MVP acceptance** ✅

**Post-MVP stabilization pass (release-candidate hardening):** cross-origin-isolation detection
with honest demo-only degradation, explicit ■ Stop control, `prefers-reduced-motion` default,
analysis paused on hidden tab / stop, post-AGC RMS (consistent intensity across sources),
stereo-width→spread wired into geometry (PRD §18.2), a11y labels, committed Playwright E2E +
GitHub Actions CI, dev-only automation hooks (stripped from production builds).

67 unit tests; typecheck, production build, worklet verification, and production-dependency audit
are green. Browser E2E and real-device acceptance remain required before release. No raw audio is
intentionally transmitted by the application. Architecture:
[docs/architecture.md](docs/architecture.md).

## Develop

```bash
npm install
npm run dev            # localhost:5173 with COOP/COEP headers
npm test               # unit tests (Vitest)
npm run build          # typecheck + build + worklet verification
npm run test:e2e       # development-server Playwright suite
npm run test:e2e:prod  # production-preview WAV/MP3/mic gate
npm run audit:production
```

## Deployment

The real-time pipeline requires **cross-origin isolation** (`SharedArrayBuffer`). The host MUST
send these headers on every response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without them the app degrades honestly to demo-only with an explanatory status. The worklet is
emitted as a separate production JavaScript chunk and verified after every build. Imported files
use `decodeAudioData()` first, then a local browser-media fallback for codec variants rejected by
the decoder. `dist/` is fully static with **zero production dependencies**. npm-audit findings in
the development toolchain do not ship with the application.

## Manual ops runbook (PowerShell)

```powershell
git init; git add -A; git commit -m "VibratoFlow web MVP + stabilization"   # activates CI on push
npx playwright install chromium                                             # one-time (~130 MB)
npm run test:e2e                                                            # development smoke specs
npm run test:e2e:prod                                                       # built WAV/MP3/mic gate
npm run audit:production                                                    # shipped dependency gate
npm audit                                                                    # dev-chain only; review before major-bumping vite/vitest
```

## Scope

Bounded strictly to the PRD MVP. **Out of scope:** accounts, cloud/remote rendering, lyric
transcription/interpretation, song identification, social/sharing backend, playlists, streaming
integrations, stem separation, exact instrument ID, AI chat, prompt-to-video, marketplace, video
editor (MVP export is still-image PNG only), and multi-device sync.

## Audit

The 2026-07-11 adversarial audit, implementation rationale, deferred risks, and
dependency-ordered validation roadmap are in
[docs/AUDIT-2026-07-11.md](docs/AUDIT-2026-07-11.md).
