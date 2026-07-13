# VibratoFlow security hardening audit — 2026-07-13

Audit basis: repository commit `b6bf24020a8b9b8d548cff6c9b3bf4f2644218c9`, reviewed and patched on local branch `security/hardening-2026-07-13`.

This is a defensive source/configuration review of the supplied repository. It is not a claim that the application is secure under every browser, device, hosting, or dependency condition.

## 1. Repository intake

### Application and architecture

- **App type:** static, client-only TypeScript single-page web application with a web app manifest. It is PWA-installable in some browsers but does not register a service worker and does not promise offline startup.
- **Purpose:** local-first real-time audio visualizer for demo signal, microphone, user-selected local audio files, and browser-supported display/tab/window audio sharing.
- **Frontend framework:** no component framework. Direct DOM composition in `src/main.ts` and `src/app/ui/`.
- **Backend/API:** none found. No server handlers, serverless functions, API endpoints, webhooks, queues, cron jobs, or background services.
- **Languages/runtimes:** TypeScript/JavaScript in the browser; Node.js for build/test tooling. Audit environment: Node `v22.16.0`, npm `10.9.2`.
- **Package manager:** npm with `package-lock.json`.
- **Build/test tooling:** Vite `8.1.4`, TypeScript `5.9.3`, Vitest `4.1.10`, Playwright `1.61.1`.
- **Database/ORM:** none.
- **Authentication/authorization/roles/tenancy:** none. All application functionality is public and local to one browser context.
- **Payments, email, SMS, file storage, third-party APIs, analytics/tracking:** none found.
- **Persistence:** bounded visual/source preferences and custom presets in `localStorage`. No audio, MediaStream, browser permission, PCM, transcript, account, or remote identifier persistence was found.
- **File handling:** user-selected local audio through `File`, `decodeAudioData`, and a blob-backed media element fallback. Export produces a local PNG blob download.
- **Audio/runtime components:** Web Audio API, AudioWorklet, Web Worker, SharedArrayBuffer ring buffers, WebGL2.
- **Browser permissions:** `getUserMedia` for microphone and `getDisplayMedia` for shared audio, invoked only after user actions.
- **Deployment:** static Vercel deployment configured through `vercel.json`; Vite preview for local production-bundle checks.
- **CI/CD:** `.github/workflows/ci.yml` runs install, typecheck, unit tests, build verification, dependency audit, and Playwright suites.
- **Environment/secrets approach:** no environment-variable reads, `.env` files, credentials, private keys, or frontend API keys were found. Git-history credential-pattern scan returned zero candidate blobs.
- **Routes:** root document and static assets only. No protected, admin, API, or callback routes exist.
- **Service worker/cache:** no service worker found; no application-controlled HTTP cache of audio or authenticated content exists.
- **Production artifacts:** `build.sourcemap` is explicitly false. The build verifier rejects source maps, Vite development clients, React-refresh markers, development test hooks, and inline scripts.

### Attack surface

The material attack surface is limited to browser permission lifecycle, local audio/file parsing and resource use, DOM presentation of local names/settings, local persistence, worklet/worker boundaries, WebGL/audio availability, deployment headers, static artifact exposure, and the npm/CI build chain. Traditional login, session, API, database, payment, webhook, tenant-isolation, and admin-control checks are not applicable because those components do not exist.

### Assumptions and missing information

- The repository is owned by or authorized for the user to test.
- Vercel is the intended production host, but no live deployment URL was supplied; live headers and platform settings therefore remain unverified.
- Browser and operating-system permission behavior varies. Exact microphone/display-capture behavior requires real-device testing.
- The application intentionally keeps audio local and has no remote processing. This was confirmed from source/configuration, not from packet capture on every target device.
- Third-party browser extensions, a compromised browser, or a compromised hosting account are outside this patch scope.

## 2. Threat model

### Assets

- Transient microphone/shared-audio streams and locally decoded audio.
- User control over whether the application is listening.
- Local visual preferences and custom presets.
- Availability of the tab/device during file decode, rendering, and audio processing.
- Integrity of production bundles, CI output, and deployment headers.

### Trust boundaries and entry points

- Browser permission broker → `getUserMedia` / `getDisplayMedia`.
- User file picker → browser audio decoder/media element.
- Main thread → AudioWorklet, Web Worker, SharedArrayBuffer, and WebGL.
- Browser storage → settings/preset parsing.
- Static host → HTML, JavaScript, CSS, manifest, images, and security headers.
- npm registry/GitHub Actions → build and test toolchain.

### Likely attackers and abuse cases

- A malicious embedding page attempting clickjacking or permission-confusion.
- A compromised dependency or CI/build environment altering the deployed bundle.
- Untrusted or malformed local media causing decoder failure or excessive memory use.
- User action races causing a permission request or file operation to complete after Stop or another source was selected.
- A same-origin script injection, if introduced later, attempting access to active audio handles or local settings.

### Data sensitivity and exposure

Raw live audio is sensitive even though it is transient and local. Visual settings are low sensitivity. There is no server-side data store, account data, payment data, or tenant data. Client-side exposure is therefore more important than server-side access control for this project.

### Business logic and privacy risks

The principal business/privacy invariant is that the visible listening state must match the actual active source. A stale permission result must never reactivate capture after Stop or a source switch. The app must also avoid silently uploading, caching, or retaining audio. No money, quota, approval, rewards, or privileged workflow exists.

## 3. Findings table

| ID | Status | Severity | Finding and evidence | Affected files/regions | Exploitability | Fix status |
|---|---|---:|---|---|---|---|
| VF-SEC-01 | Confirmed | Medium | Overlapping asynchronous source starts were not serialized. A microphone/display/file request could resolve after Stop or another source selection and become active despite the newer UI state. The previous architecture document explicitly recorded the missing cancellation token. | `src/main.ts` source handlers; previous `docs/architecture.md` Source lifecycle | Requires the user to initiate a permission/file flow and then issue a competing action before it resolves. Privacy-impacting state mismatch rather than remote code execution. | Fixed with revision-based source ownership and stale-resource cleanup; unit tests pass. Browser E2E added but not executed in this environment. |
| VF-SEC-02 | Confirmed | Medium | If a MediaStream was granted but AudioGraph setup or connection failed, the stream was not guaranteed to be stopped. This could leave a permission-granted capture resource alive after an initialization error. | `src/core/capture/MicAdapter.ts`; `src/core/capture/SystemCaptureAdapter.ts` | Requires graph/setup failure after permission succeeds. Impact is unintended capture/resource retention within the tab. | Fixed with exception-safe disconnect/track cleanup; adapter tests pass. |
| VF-SEC-03 | Confirmed | High for build chain; not shipped runtime | The initial full npm audit reported five toolchain vulnerabilities, including high-severity Vite findings and a critical Vitest UI-server issue. CI ran only `--omit=dev`, even though this static app’s build/test toolchain is entirely in `devDependencies` and produces the deployable bundle. | `package.json`, `package-lock.json`, `.github/workflows/ci.yml` | Most direct exposure is a developer/CI or exposed tool server, not an end-user production route. Supply-chain/build compromise can still affect deployed artifacts. | Fixed by upgrading Vite/Vitest and making full audit a CI gate. Full and production-only audits report zero findings. |
| VF-SEC-04 | Confirmed | Medium | Production configuration originally provided only COOP/COEP. It lacked a CSP, explicit permission restrictions, referrer policy, MIME-sniffing protection, frame restrictions, same-origin resource policy, and HSTS. The inline theme bootstrap also prevented a strict script policy. | `index.html`, `public/theme-init.js`, `vercel.json`, `vite.config.ts`, `scripts/verify-security-config.mjs`, `scripts/verify-dist.mjs` | Defense-in-depth issue. Clickjacking, future injection, browser-feature misuse, or content-type mistakes would have had fewer containment controls. | Fixed in configuration and build checks. Local preview headers were verified. Live Vercel delivery and HSTS remain a deployment check. |
| VF-SEC-05 | Confirmed | Low | Every selected audio file was first read into an ArrayBuffer and decoded to PCM. Large files could create a predictable browser-tab memory spike before fallback. | `src/core/capture/FileAdapter.ts`; file handler in `src/main.ts` | User-triggered local availability issue; no remote upload endpoint exists. | Mitigated by routing files larger than 64 MiB directly to the browser media-element path; boundary tests pass. The threshold is an operational heuristic, not a hard file-size guarantee. |
| VF-SEC-06 | Confirmed positive control | Informational | No auth/API/database/upload server, remote endpoint, analytics script, secret, HTML injection sink, production source map, or service worker was found. Persisted settings are type/range/format sanitized; user-facing values are assigned with safe DOM text APIs. | Repository-wide static review; `src/app/SettingsStore.ts`; `src/core/grammar/CustomPresetStore.ts`; production `dist/` | Reduces attack surface but does not eliminate browser, dependency, or deployment risk. | No patch required. Regression checks added/recorded. |

No suspected critical user-data, money, admin, tenant-isolation, authentication, authorization, SQL/NoSQL/command injection, SSRF, webhook, or server-side file-upload issue remains open because the corresponding server-side components are absent.

## 4. Patches made

### Source and permission lifecycle

- Added `src/app/SourceSessionCoordinator.ts` to issue monotonic source revisions and reject/stop stale resources.
- Updated `src/main.ts` so Demo, Stop, microphone, shared audio, file input, oscillator tests, and development loading all invalidate earlier source requests before stopping current resources.
- Added a shared `graphPromise` in `src/main.ts` to prevent duplicate concurrent `AudioGraph.create()` work.
- Updated player activation to stop a player that becomes stale while `play()` is pending.
- Updated `src/core/capture/MicAdapter.ts` and `src/core/capture/SystemCaptureAdapter.ts` with exception-safe node disconnect and track stop logic.

### File availability hardening

- Added `MAX_BUFFER_DECODE_BYTES` and `shouldUseMediaElement()` in `src/core/capture/FileAdapter.ts`.
- Updated the file path in `src/main.ts` so files over 64 MiB bypass the full-buffer decode path and remain local through `MediaFilePlayer`.

### Browser and deployment controls

- Moved the early appearance bootstrap from inline HTML to `public/theme-init.js` while retaining strict validation of stored theme values.
- Added CSP, COOP, COEP, CORP, Permissions-Policy, Referrer-Policy, HSTS, `nosniff`, `DENY` framing, and cross-domain-policy restrictions in `vercel.json`.
- Added production-like preview headers and explicit `build.sourcemap: false` in `vite.config.ts`.
- Added `scripts/verify-security-config.mjs` to fail the build if required Vercel controls are absent or if script CSP is weakened.
- Expanded `scripts/verify-dist.mjs` to reject source maps, development hooks/clients, source-map markers, and inline scripts.

### Supply chain and CI

- Upgraded `vite` to `8.1.4` and `vitest` to `4.1.10`; lockfile regenerated.
- Added `npm run audit` for the complete dependency tree.
- Changed `.github/workflows/ci.yml` to run the full audit instead of production-only audit.
- Extended `npm run build` to include security configuration verification.

### Documentation

- Added `.claude/` to `.gitignore` so local assistant permission settings are not accidentally committed.
- Updated `README.md` validation, deployment, and release-state claims.
- Updated `docs/architecture.md` to reflect serialized source ownership and current residual risks.
- Added this dated report.

## 5. Tests and verification

### Tests added or modified

- `src/app/SourceSessionCoordinator.test.ts`: current-resource adoption and stale-resource cleanup.
- `src/core/capture/MicAdapter.test.ts`: stream cleanup after setup failure.
- `src/core/capture/SystemCaptureAdapter.test.ts`: video disposal, stop behavior, no-audio cleanup, setup-failure cleanup.
- `src/core/capture/FileAdapter.test.ts`: 64 MiB routing boundary.
- `tests/e2e/smoke.spec.ts`: pending external-capture request must not become active after Stop.
- `tests/e2e-prod/audio-input.spec.ts`: production-preview security header assertions.

### Commands run and results

| Command/check | Result |
|---|---|
| `npm run typecheck` | Pass. |
| `npm test` | Pass: 19 test files, 91 tests. |
| `npm run build` | Pass with Vite `8.1.4`; AudioWorklet, no-source-map/no-dev-hook/no-inline-script, and Vercel security-config verifiers pass. |
| `npm run audit` | Pass: zero vulnerabilities. |
| `npm run audit:production` | Pass: zero vulnerabilities. |
| Local `vite preview` plus `curl -I` | Pass for CSP, COOP, COEP, CORP, Permissions-Policy, Referrer-Policy, `nosniff`, frame denial, and cross-domain-policy restriction on HTML and `theme-init.js`. HSTS intentionally not claimed from local HTTP. |
| Repository sink/network scan with `rg` | No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, XHR, WebSocket, EventSource, or production remote endpoint found. The only `fetch` is inside the development-only `window.__vibrato` hook and the build verifier rejects that marker in `dist`. |
| Production artifact scan | No `.map`, source-map marker, Vite client, React-refresh marker, development hook, or remote URL except the SVG namespace. |
| Current tree/history credential-pattern scan | Zero credential-pattern Git blobs; no `.env`, key, certificate bundle, or named secret file found. |
| `git diff --check` | Pass. |
| Semgrep/gitleaks/trufflehog/osv-scanner availability | Not installed in the audit environment; no unsupported success claim made. |
| Playwright E2E execution | Not completed. Playwright Chromium download failed with DNS `EAI_AGAIN`; the system Chromium is enterprise-policy restricted and blocks local URLs/capture. Tests were added but must run elsewhere. |

## 6. Residual risks

- Browser E2E and exact-device microphone/display/file tests are not verified on this machine.
- Live Vercel behavior, including HSTS and whether every asset receives the intended headers, is not verified until a deployment URL is checked.
- CSP permits `'unsafe-inline'` for styles because bounded runtime appearance/rendering controls set inline style properties. Script execution does not permit inline code or `unsafe-eval`. Removing inline-style permission requires a separate UI/CSS refactor and should not be mixed into this patch.
- GitHub Actions use maintained major-version tags (`actions/checkout@v4`, `actions/setup-node@v4`) rather than immutable commit SHAs. This is a supply-chain residual; pinning requires a separately verified update process.
- The 64 MiB decode-routing threshold reduces predictable peak memory but cannot guarantee safety across all codecs, durations, browsers, or low-memory devices.
- SharedArrayBuffer depends on correct cross-origin isolation and can conflict with injected cross-origin preview tooling. Do not weaken COOP/COEP to accommodate optional toolbars.
- There is no dedicated AudioWorklet crash/health channel. This is primarily availability/diagnostic risk.
- No service worker means offline startup is not provided. This avoids service-worker cache risks but is a product limitation.
- Browser extensions, compromised hosting credentials, registry compromise outside the lockfile, and operating-system audio privacy failures remain outside source-level verification.

## 7. Manual follow-up actions

1. On an unrestricted development machine, run `npm ci`, install the repository-pinned Playwright browser, then run both E2E suites. Do not release if the pending-capture Stop test fails.
2. Test microphone allow, deny, OS-blocked, permission-prompt-then-Stop, permission-prompt-then-source-switch, track-ended, and repeated start/stop on each supported browser/device.
3. Test shared audio with a real audio track, no-audio selection, user cancellation, prompt-then-Stop, source switch, and browser/OS unsupported states.
4. Test representative WAV, MP3, M4A, malformed, long-duration, and over-64-MiB files on target low-memory devices. Confirm no file or audio leaves the device through browser developer-network tools.
5. Deploy to a protected preview and verify headers on `/`, `theme-init.js`, the main JS/CSS chunks, worklet, worker, manifest, and icons. Verify `window.crossOriginIsolated === true` before testing live sources.
6. Review the production domain and all subdomains before adding `includeSubDomains` or HSTS preload. The current finite one-year HSTS policy deliberately avoids an unverified preload commitment.
7. Consider pinning GitHub Actions to reviewed immutable SHAs and adding a scheduled full dependency/security-tool scan in a separate maintenance change.
8. Run a dedicated local scanner such as gitleaks and Semgrep in CI or on a trusted workstation; review findings rather than blindly failing on untriaged rules.

## 8. Production deployment checklist

Execute in dependency order:

1. Confirm the intended branch and review `git diff`; ensure no local `.env`, credentials, test captures, `.claude/`, `node_modules/`, `dist/`, or test-result directories are staged.
2. Run `npm ci` from the committed lockfile.
3. Run `npm run audit`; stop on any high/critical or unexplained finding.
4. Run `npm run typecheck`.
5. Run `npm test` and confirm all 91 or later expected tests pass.
6. Run `npm run build`; confirm both artifact and security-config verifiers pass.
7. Install Playwright Chromium and run `npm run test:e2e`.
8. Run `npm run test:e2e:prod` against the production preview bundle.
9. Complete the manual microphone/shared-audio/file/device matrix and record browser, OS, and hardware versions.
10. Deploy to a Vercel preview with the Toolbar disabled if it breaks cross-origin isolation.
11. Verify HTTPS, CSP, COOP, COEP, CORP, Permissions-Policy, Referrer-Policy, HSTS, `nosniff`, and frame denial on the live preview responses.
12. Verify no `.map`, development hook, Vite client, internal test asset, directory listing, or unexpected third-party request is exposed.
13. Promote the exact reviewed preview commit to production.
14. Repeat live header, `crossOriginIsolated`, permission-state, Stop, and representative file checks after promotion.

## 9. Security regression checklist

For every future source, UI, dependency, or deployment change:

- Every asynchronous source start must obtain a source-session revision and stop any resource that resolves stale.
- Every MediaStream, audio node, blob URL, file player, oscillator, worker, and worklet path must clean up on success-stop, cancellation, replacement, and exception.
- Stop must invalidate pending permission/file operations before changing the visible state.
- Never auto-start microphone/shared audio or silently reopen a file from persisted preference.
- Treat filenames, preset names, persisted settings, and error text as untrusted; keep using schema validation and text APIs rather than HTML insertion.
- Do not add remote endpoints, analytics, fonts, frames, media hosts, or workers without updating the threat model and the narrow CSP.
- Do not place secrets or private API keys in Vite/client variables, source, manifest, static assets, logs, tests, or Git history.
- Keep production source maps, development hooks, inline scripts, and dev clients rejected by the build verifier.
- Run the full dependency audit, not only `--omit=dev`, because build tools create the deployed artifact.
- Review lockfile and lifecycle scripts for every dependency change.
- Keep Vercel and preview header checks synchronized; verify live delivery after deployment.
- Re-run permission-race E2E tests and exact-device tests after changes to source orchestration.
- Reassess service-worker cache risks before adding offline support.
- Reassess auth, authorization, API, logging, retention, upload, and GDPR controls if any backend, account, telemetry, or remote processing is introduced.

## 10. Final executive summary

Five actionable issues were confirmed: stale asynchronous source activation, incomplete stream cleanup on setup failure, vulnerable/under-audited build dependencies, incomplete browser security headers with an inline bootstrap, and avoidable large-file decode memory pressure. Targeted patches and regression tests were added without introducing a backend or changing the local-first data model.

Typecheck, 91 unit tests, production build verification, local preview header verification, full dependency audit, production-only dependency audit, artifact scans, and credential-pattern scans pass in the audit environment. Browser E2E, live Vercel response verification, and exact-device permission/audio acceptance remain required. The repository is materially hardened relative to the supplied baseline, but this report does not characterize it as fully secure or production-approved until those remaining gates are completed.
