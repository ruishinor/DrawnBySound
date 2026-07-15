# Drawn by Sound

**Music, drawn live — a local-first oscilloscope visualizer for microphone, audio files, and supported shared audio.**

Drawn by Sound captures or imports audio, extracts acoustic features locally, and renders responsive XY/Lissajous-style geometry through WebGL2. It has no account system, no analytics, and no intentional raw-audio upload.


<!-- Large Hero Spot -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/0e0ad19e-b364-4368-9bdf-2a48d2d46f5d" width="100%" />
</p>

<table width="100%">
  <!-- Row 1: Variations -->
  <tr>
    <td width="33.3%"><img src="https://github.com/user-attachments/assets/2970d369-4901-4c49-9d01-d86c91046494" width="100%" /></td>
    <td width="33.3%"><img src="https://github.com/user-attachments/assets/e7998800-0cfc-43ce-afc3-2571196c04ef" width="100%" /></td>
    <td width="33.3%"><img src="https://github.com/user-attachments/assets/1309aa54-9497-4094-bfb3-268a0c6f2b78" width="100%" /></td>
  </tr>
  <!-- Row 2: Variations -->
  <tr>
    <td width="33.3%"><img src="https://github.com/user-attachments/assets/1424f4de-bd75-48d9-a8fd-d825965bd7d7" width="100%" /></td>
    <td width="33.3%"><img src="https://github.com/user-attachments/assets/00fbcd95-cd5e-4212-9512-515bbb8643f4" width="100%" /></td>
    <td width="33.3%"><img src="https://github.com/user-attachments/assets/202b2d04-a3e2-4e14-aa78-4bf57adb3b35" width="100%" /></td>
  </tr>
</table>


## Current release state

The audio/rendering core, fullscreen presentation, display wake-lock preference, and the 2026-07-11 UI/persistence pass are implemented. The repository is a **release candidate**, not an unconditional production sign-off. Typecheck, unit tests, production build, AudioWorklet/security-policy verification, and the full dependency audit pass. Browser E2E, live-deployment header checks, and exact-device acceptance remain required.

Implemented:

- Demo signal, microphone, audio-file playback, and best-effort Other app/shared-audio capture.
- Web Audio API + AudioWorklet preprocessing.
- SharedArrayBuffer ring buffers and off-main-thread feature extraction.
- WebGL2 trace, persistence, bloom, and PNG frame export.
- Responsive product shell with a warm neutral interface around the dark visual stage.
- Versioned local settings persistence with migration, validation, and tests.
- Remembered source preference without silently renewing permissions or reopening files.
- Named colour sets, calm presets, and a native custom-colour picker.
- Labelled form fields, selected-source semantics, live status, and keyboard-operable settings.
- Visual-only native fullscreen with a standard corner control, safe-area spacing, idle fade, keyboard support, and an honestly labelled expanded-view fallback.
- Optional screen wake lock while the page is visible, with automatic reacquisition and an FAQ fallback to device display-timeout settings.
- Strict Vite development port alignment to prevent the reported HMR 5174/5173 mismatch.

Not implemented or not promised:

- Universal capture of Spotify, YouTube, Instagram, BlackPlayer, or every device audio stream.
- Native Android AudioPlaybackCapture integration.
- Live lyrics/transcription.
- Service-worker-backed offline startup.
- Accounts, cloud rendering, playlists, social backend, or remote audio processing.

The detailed decisions and remaining risks are in:

- [Adversarial audit and implementation report](docs/AUDIT-AND-IMPLEMENTATION-2026-07-11.md)
- [Other-app audio and live-lyrics viability](docs/FEATURE-VIABILITY-2026-07-11.md)
- [Architecture](docs/architecture.md)
- [Manual acceptance checklist](docs/MANUAL-ACCEPTANCE-2026-07-11.md)
- [Earlier production-audio stabilization audit](docs/AUDIT-2026-07-11.md)
- [Security hardening audit](docs/SECURITY-AUDIT-2026-07-13.md)

## Source behavior

- **Demo:** starts immediately and needs no permission.
- **Microphone:** requires a direct user action and browser/OS permission.
- **External app:** requests browser display/tab/window capture with audio. It is normally unavailable in mobile browsers and still depends on the operating system, selected surface, and source app.
- **Audio file:** uses local file selection. Drawn by Sound cannot silently reopen the file after a reload.

Drawn by Sound remembers the preferred source and visual settings. Protected sources are deliberately not auto-started on reopen.

## Development prerequisites

- Node.js 22 LTS or a repository-approved equivalent.
- npm.
- A Chromium browser installed through Playwright for E2E testing.
- A host that can set COOP/COEP headers for the SharedArrayBuffer pipeline.

## Dependency-ordered local validation

PowerShell, from the repository root:

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "STOP: npm ci failed." }

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "STOP: typecheck failed." }

npm test
if ($LASTEXITCODE -ne 0) { throw "STOP: unit tests failed." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "STOP: production build or worklet verification failed." }

npm run audit
if ($LASTEXITCODE -ne 0) { throw "STOP: full dependency audit failed." }
```

Install Playwright Chromium once, then run browser gates:

```powershell
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "STOP: Playwright Chromium installation failed." }

npm run test:e2e
if ($LASTEXITCODE -ne 0) { throw "STOP: development E2E failed." }

npm run test:e2e:prod
if ($LASTEXITCODE -ne 0) { throw "STOP: production-preview E2E failed." }
```

Only after those gates pass, start manual review:

```powershell
npm run dev
```

Expected URL: `http://localhost:5174/`.

The dev server uses `strictPort: true`. If 5174 is occupied, it exits instead of silently moving to 5173 and breaking HMR through a mismatched browser/proxy origin.

## Deployment

The real-time pipeline requires cross-origin isolation because it uses `SharedArrayBuffer`. The production host must send these headers on every relevant response:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite development applies the isolation headers; production preview adds the browser security policy used by Vercel. `vercel.json` also defines CSP, Permissions-Policy, Referrer-Policy, HSTS, MIME-sniffing protection, clickjacking protection, and same-origin resource policy. `scripts/verify-security-config.mjs` rejects missing or weakened required controls during the build. The manifest link uses `crossorigin="use-credentials"` so Vercel-authenticated previews can fetch it with the deployment cookie. Vercel Toolbar injects cross-origin preview resources that do not opt into this policy; disable the Toolbar for this project or preview environment rather than weakening cross-origin isolation. Without cross-origin isolation, Drawn by Sound degrades to preview-only with an explicit status.

The production AudioWorklet is emitted as a separate JavaScript chunk and checked by `scripts/verify-dist.mjs`. That verifier also rejects source maps, development hooks, Vite development clients, and inline scripts. File playback uses `decodeAudioData()` for ordinary files, routes files larger than 64 MiB directly to the local media-element path, and uses the same path as a codec fallback.

## Manual acceptance minimum

Before release, record exact browser, OS, and device versions for:

1. Demo render and responsive layout.
2. Microphone allow, deny, OS-blocked, track-ended, Stop, real non-zero signal, and simultaneous screen-recorder contention states.
3. WAV and representative MP3 playback, seek, pause, resume, and Stop.
4. External app capture where the browser offers an audio track, plus unsupported-mobile, no-audio, and user-cancel cases.
5. Persistence of visual settings, custom colour, reduced motion, screen-awake preference, and preferred source.
6. Native fullscreen where supported, expanded-view fallback, Escape exit, safe areas, no control overlap, and no audio interruption.
7. Screen wake lock enable/disable, background/foreground reacquisition, unsupported-browser explanation, and battery impact.
8. Portrait/landscape, safe areas, no horizontal overflow, and settings keyboard behavior.
9. 15–30 minute thermal/performance observation on the target phone.

## Test status for this deliverable

- Typecheck: pass.
- Unit tests: pass — 102 tests across 21 files after wake-lock lifecycle hardening.
- Production build, AudioWorklet verifier, artifact checks, and security-config verifier: pass.
- Full and production-only dependency audits: pass — zero findings.
- Playwright E2E includes a production microphone test backed by a deterministic fake audio file; exact-device microphone and screen-recorder contention remain manual release gates.
