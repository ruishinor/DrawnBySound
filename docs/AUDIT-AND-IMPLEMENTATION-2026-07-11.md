# VibratoFlow — adversarial audit and implementation report

Date: 2026-07-11
Scope: uploaded repository `VibratoFlow 26-07-11 0600 minus_node_modules.zip`, the two supplied desktop/mobile screenshots, and the implementation changes described below.

## 1. Internal plan before coding

### Audience

VibratoFlow is for casual listeners, musicians, creators, projection users, and people who want an immediate visual response to music without accounts or cloud processing. The primary interaction must work on a phone while listening, not only on a desktop development machine.

### Not the audience

It is not a DAW, a professional metering suite, a game HUD, a tactical display, an AI-control centre, a crypto/SaaS dashboard, or a generic visual-effects playground.

### Brand signals to preserve

- The VibratoFlow name.
- The live oscilloscope trace as the central product, not background decoration.
- Local audio processing and explicit source choice.
- Direct microphone, file, and supported shared-audio workflows.
- PNG frame export.
- Advanced controls for users who want them.

### Design defaults to reject

- Black-and-neon as the whole interface.
- Purple/teal gradients, glassmorphism, glowing card borders, and translucent dashboard panels.
- A single toolbar where every action has equal visual weight.
- Pill-heavy controls, emoji icons, unexplained technical labels, and tiny low-contrast status text.
- Decorative charts, metrics, badges, or “AI” language unrelated to the task.

### Appropriate references

Restrained music-player controls, physical audio equipment, editorial exhibition labels, gallery projection software, paper/ink material palettes, and interfaces where controls recede once playback begins.

### Intended emotional response

Calm, immersive, deliberate, and trustworthy. The visual should feel like the instrument. The product shell should feel stable and quiet rather than futuristic.

### What would make it generic or wrong

A UI that could be reused unchanged for a crypto wallet or AI dashboard; a fake lyrics switch with no reliable engine; hidden capture constraints; a mobile layout that forces scrolling around a full-screen visual; or persistence that silently promises reconnection the browser cannot grant.

### Files created or modified

- `index.html`
- `src/app/ui/app.css` — new
- `src/main.ts`
- `src/app/SettingsStore.ts`
- `src/app/SettingsStore.test.ts` — new
- `src/app/ui/SettingsPanel.ts`
- `src/core/grammar/palettes.ts`
- `src/core/grammar/mappings.ts`
- `src/core/grammar/presets.ts`
- `src/core/grammar/grammar.test.ts`
- `vite.config.ts`
- `playwright.config.ts`
- `playwright.prod.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e-prod/audio-input.spec.ts`
- `README.md`
- `docs/architecture.md`
- `docs/AUDIT-AND-IMPLEMENTATION-2026-07-11.md` — this report
- `docs/FEATURE-VIABILITY-2026-07-11.md` — new

## 2. Assumptions and trade-offs

1. The implementation remains framework-free TypeScript. Introducing React, Tailwind, a component library, or a design-system package would increase the regression and dependency surface without solving the primary problem.
2. The canvas remains dark because the additive oscilloscope renderer needs contrast. The surrounding product UI is changed to warm, neutral surfaces so the entire product no longer reads as dark-neon software.
3. User visual preferences and preferred source can persist. A browser cannot silently reopen a local file or renew microphone/display-capture consent, so protected sources are remembered but never auto-started.
4. “Other app” capture on the web remains best-effort. A web page cannot promise access to Spotify, YouTube, Instagram, BlackPlayer, or every OS mixer path.
5. A native Android capture layer is a viable separate product phase, not a surgical web patch.
6. Real-time lyrics are not added as an inert toggle. The feature needs a model/runtime decision, explicit download consent, mobile performance gates, and evidence against singing rather than only clean speech.
7. The reported Vite HMR issue is treated as a deterministic port mismatch. The development server is fixed to port 5174 with `strictPort: true`, matching the browser origin shown in the console.
8. Existing audio-pipeline hardening is preserved. This pass changes presentation, persistence boundaries, source-state handling, accessibility, and validation around those paths rather than replacing the DSP/rendering architecture.

## 3. Adversarial retrospective

### Project Lead perspective

The product had reached a technically capable state without a coherent definition of the release experience. The repository had substantial DSP, WebGL, worker, and production-bundle work, but the visible product still looked like a developer harness. The screenshots showed a product-development imbalance: the difficult audio/rendering work was treated as the product, while source selection, status, mobile ergonomics, and visual identity were treated as incidental controls.

The previous status language also overstated completion. “MVP complete” is not a defensible release claim while browser E2E, real-device acceptance, source-policy limitations, and mobile audio constraints remain unresolved. The correct state is a release candidate with validated unit/build gates and outstanding environment/device gates.

Primary management failure: no explicit experience acceptance criteria existed for hierarchy, mobile reachability, capture explanation, persistence boundaries, or brand distinctiveness.

### Design Thinking Coach perspective

The old interface reflected the implementation model rather than the listener’s task. “System audio” is an API concept; the user’s intent is “listen to another app.” “PNG” is a format; the user’s intent is “save this frame.” “Settings” exposed an undifferentiated list of controls; the user’s intent is to shape the visual, tune responsiveness, or reduce load.

The app also had a misleading persistence gap. Visual settings were already stored in `localStorage`, so the code was not literally stateless. However, the user’s dominant state—what they listen to—always returned to demo, and there was no visible confirmation that settings were restored. Persistence had no migration, sanitization, or unit tests. The user’s complaint was therefore valid at the experience level even though a partial storage mechanism existed.

Primary discovery failure: the product had not distinguished “remember my preference” from “automatically reconnect protected media.” Those are different technical and consent models.

### UX Designer perspective

Confirmed screenshot and source-level weaknesses:

- Every source/action occupied the same top toolbar, producing no task hierarchy.
- The native file control exposed browser-default styling and a truncated filename inside the main control row.
- The full interface used black, navy, teal, glow, and small rounded controls—the most common generated “audio visualizer” styling.
- The stage had no clear boundary from the product shell on desktop; on mobile, controls wrapped above a constrained visual and created the appearance of a browser game.
- Source state was communicated mainly through status copy at the bottom, not through the selected source control.
- Disabled source explanations depended on `title`, which is weak on touch.
- The settings panel was a floating dark card with labels that looked associated visually but were not programmatically bound to controls.
- Ten form fields lacked associated labels, and three lacked `id`/`name` attributes, matching the browser warnings supplied by the user.
- Icon-only or symbolic controls (`■`, `⤓`, `⚙`, `▶`) reduced clarity without providing a distinct visual language.
- Mobile touch targets and overflow were reactive CSS patches rather than a composed mobile layout.

Primary UX failure: the interface competed with the visual instead of framing it.

### Senior Analyst perspective

The core architecture is materially stronger than the original UI suggested. It has a separated audio worklet, lock-free shared buffers, off-main-thread feature extraction, deterministic visual grammar, WebGL passes, and local-only runtime behavior. Replacing the stack would be wasteful.

The main technical debt is concentrated in orchestration and release evidence:

- `src/main.ts` is a 22 KB composition root combining source lifecycle, UI binding, render-loop state, capability handling, transport, diagnostics, and test hooks.
- Source-start operations are asynchronous but not serialized or cancelable. Rapid source switching can race.
- The settings store previously trusted arbitrary persisted JSON and had no schema migration test.
- Source preference and active source were conflated by omission; only current in-memory source existed.
- Browser display capture is capability- and source-dependent, so a button alone cannot represent support.
- SharedArrayBuffer requires cross-origin isolation; demo-only degradation remains an intentional architectural boundary.
- The E2E suite is essential but could not be executed in the present managed environment. A passing build is not equivalent to browser acceptance.
- The development toolchain has known audit findings. Production has no runtime dependency findings, but the dev server must not be exposed to untrusted networks until the toolchain upgrade is isolated and validated.

Primary engineering bottleneck: source lifecycle and capability truthfulness, not DSP performance or a framework migration.

## 4. Findings and disposition

### P0 — UI did not communicate the product or primary task

**Evidence:** supplied screenshots and the inline CSS/DOM structure in the uploaded `index.html`.

**Implemented:** rebuilt the shell around a contained visual stage, clear source deck, separate session status, readable transport, restrained utility actions, and an off-canvas settings sheet. The canvas remains the largest element while the UI gains a warm neutral material palette and clear hierarchy.

### P0 — form semantics produced browser warnings

**Evidence:** generated `select`, `range`, and `checkbox` controls had no `id`/`name`, and labels lacked `for` bindings.

**Implemented:** every generated form control receives a unique `id` and `name`; every visible label binds through `htmlFor`; range outputs are linked; file and seek inputs have explicit names and labels.

### P0 — user state did not match the persistence expectation

**Evidence:** visual settings were persisted in v1, but source choice always reset to demo; malformed stored data was trusted; persistence had no tests.

**Implemented:** versioned v2 settings, v1 migration, validation/clamping, custom colour persistence, preferred-source persistence, restored-state reporting, and unit tests. Protected media is deliberately not auto-started.

### P0 — “system audio” implied more capability than the web can guarantee

**Evidence:** a single API-facing label did not explain browser, OS, surface, and source-app restrictions.

**Implemented:** relabelled the action “Other app,” added visible “when supported” and capability text, preserved explicit user consent, watched capture-track termination, and returned cleanly to a safe source state.

### P1 — visual defaults were generic dark/neon

**Implemented:** new defaults use warm amber, lower bloom, calmer presets, muted palette names, and a warm product shell. Legacy palettes remain for users who prefer them. No renderer rewrite was required.

### P1 — no custom colour picker

**Implemented:** native colour picker plus a separate “Use custom colour” toggle. Selecting a preset or named palette returns to managed palette mode. Custom colour is integrated into render mappings and persisted.

### P1 — source controls lacked selected/preferred state

**Implemented:** active source uses `aria-pressed`; remembered source receives a distinct preferred state; stage labels and status update together. On reopen, a protected preferred source is shown as remembered but inactive with a reconnection message.

### P1 — capture end and failure paths could leave ambiguous state

**Implemented:** audio-track `ended` events stop source state, pause analysis, clear transport where relevant, and explain that the user must reconnect. Engine, permission, decode, playback, and shared-audio failures retain their distinct handling.

### P1 — Vite HMR connected across mismatched ports

**Implemented:** Vite development server fixed to `5174` with `strictPort: true`; Playwright development base URL aligned. This prevents Vite from silently shifting to 5173 while the browser/proxy remains on 5174.

### P1 — browser acceptance coverage did not include the new UX contract

**Implemented:** E2E assertions added for source state, persistent settings, form label/name coverage, file trigger behavior, and mobile horizontal-overflow protection. Production audio-input tests were updated to use the custom file trigger.

### P2 — lyrics feature has no proven product/technical contract

**Disposition:** not shipped. A defensible staged design is documented in `FEATURE-VIABILITY-2026-07-11.md`.

### P2 — orchestration remains concentrated in `main.ts`

**Disposition:** deferred. Splitting it during a visual/persistence pass would enlarge the regression surface. The next architecture phase should extract a source-session coordinator only after the current interaction contract passes real-device tests.

## 5. Highest-priority modular roadmap

### Phase 0 — preserve and prove the baseline

[Capture the uploaded tree and exclude generated dependencies] → verify: the original archive remains unchanged and the working tree contains no committed `node_modules`.

[Run typecheck, unit tests, production build, worklet verification, and production audit before redesign] → verify: failures are recorded as baseline defects rather than attributed to the UI pass.

[Keep the existing DSP, worker, WebGL, export, and capture adapters] → verify: no audio algorithm or shader module is replaced without a failing requirement.

### Phase 1 — establish the product shell

[Move all inline presentation out of `index.html` into `src/app/ui/app.css`] → verify: `index.html` contains no `<style>` block or inline `style=` attributes.

[Make the visualization a bounded stage and move controls into a dedicated control deck] → verify: desktop and mobile layouts retain a visible canvas, source controls, status, and Stop action without overlapping.

[Replace API/format/symbol labels with user-intent labels] → verify: the primary actions read Demo, Microphone, Other app, Audio file, Save frame, Adjust, and Stop listening.

[Add selected-source and stage context] → verify: exactly one active source button has `aria-pressed="true"`, or none after Stop; the stage label matches the current state.

### Phase 2 — fix semantics and accessibility

[Give every form field a stable unique `id` and `name`] → verify: browser form-field audits return zero missing-id/name warnings.

[Bind every visible label to its field] → verify: every generated `label[for]` resolves to an existing control and the browser audit returns zero missing-label warnings.

[Make the settings sheet keyboard-operable] → verify: Adjust opens it, focus moves to Close, Escape closes it, and focus returns to Adjust.

[Expose live status and disabled explanations in visible text] → verify: permission/capability changes are announced through `role=status`; touch users do not need hover/title text to understand an unavailable mode.

[Respect reduced-motion and low-power preferences] → verify: stored/OS reduced-motion settings continue to affect render behavior and are editable in the sheet.

### Phase 3 — make persistence honest and resilient

[Version the persisted settings schema] → verify: v1 data migrates to `vibratoflow.settings.v2` without discarding valid values.

[Sanitize all loaded and updated values] → verify: malformed JSON is ignored; non-finite/out-of-range numeric values are rejected or clamped; invalid source and colour values fall back safely.

[Persist visual choices and preferred source] → verify: reload restores mode, palette/custom colour, tuning, accessibility flags, and the last source preference.

[Do not auto-start permissioned or file sources] → verify: reload after microphone, Other app, or file use produces no permission prompt and no attempt to reopen a file; the UI asks the user to reconnect.

[Preserve preferred source when visual defaults are reset] → verify: “Restore visual defaults” resets appearance/response settings but does not erase the listener’s source preference.

### Phase 4 — reduce the generic visual language

[Set a warm neutral product shell and restrained typography] → verify: body/background/control surfaces no longer use the previous black/navy/teal theme.

[Keep darkness only where the oscilloscope requires it] → verify: the visual stage remains high-contrast while headers, controls, settings, and status use neutral light surfaces.

[Add calm default palettes and presets without deleting legacy options] → verify: Warm amber is the first-run default; existing palette IDs remain selectable.

[Integrate a custom colour picker through the grammar layer] → verify: a valid hex colour reaches `toRenderParams()` and updates the trace; disabling custom colour restores the selected palette.

[Reduce bloom default] → verify: first-run visuals remain legible and luminous without the previous neon halo dominating the trace.

### Phase 5 — stabilize source lifecycle and capability truthfulness

[Rename “System audio” to “Other app” without widening the API promise] → verify: help/status copy states that support depends on browser, OS, selected surface, and source app.

[Remember preference separately from active capture] → verify: preferred-state styling never claims the app is listening.

[Watch capture tracks for external termination] → verify: ending screen sharing or microphone capture stops analysis and updates the UI to “ended / reconnect.”

[Return every source failure to a safe state] → verify: no failed start leaves a live track, player, worker analysis session, or falsely selected source.

[Defer native Android playback capture to a separate adapter/release] → verify: the web build contains no Android bridge stub or misleading Spotify-specific promise.

### Phase 6 — correct development and release gates

[Pin the Vite development port to 5174 and reject fallback ports] → verify: `npm run dev` either serves on 5174 or exits; it never starts on 5173 while the browser points to 5174.

[Align Playwright development configuration with the fixed origin] → verify: the configured `baseURL` and `webServer.url` are both `http://127.0.0.1:5174`.

[Run unit, type, build, static worklet, and production-audit gates] → verify: all commands return exit code 0.

[Run development and production Playwright suites in an unrestricted environment] → verify: no page errors, source-state assertions pass, file WAV/MP3 playback advances, fake microphone starts, and mobile viewport has no horizontal overflow.

[Complete Android and iOS manual acceptance before release] → verify: exact device/browser versions and results are recorded; unsupported paths are documented rather than inferred.

### Phase 7 — evaluate lyrics as a real subsystem

[Define the feature as local live transcription, not exact licensed lyric retrieval] → verify: requirements distinguish speech recognition from fetching canonical song lyrics.

[Benchmark singing with accompaniment before choosing a model] → verify: a representative Norwegian/English corpus has word error rate, latency, memory, battery, and thermal results.

[Gate model download and execution by device capability and explicit consent] → verify: no model is fetched on first load and low-capability devices do not silently stall the visualizer.

[Implement transcription in a worker with a bounded audio queue] → verify: rendering remains at target frame rate and audio callback allocations remain unchanged.

[Render one or three rolling lines with confidence-aware transitions] → verify: stale partial text is replaced predictably, final segments remain readable, and lyrics can be fully disabled.

[Ship only after privacy, copyright, accessibility, and real-device acceptance] → verify: all handling is documented and the feature has a separate release flag rather than a placeholder toggle.

## 6. Implementation completed

### Product shell and responsive UX

- Replaced the single floating toolbar with a three-part layout: top utility bar, live visual stage, and source/session control deck.
- Added a physical/editorial visual language using warm paper, ink, muted copper, clear borders, and minimal shadow.
- Retained a dark visualization stage for technical contrast rather than extending darkness to the full interface.
- Replaced browser-default file presentation with a controlled “Audio file” action and separate filename state.
- Added visible source title/kicker in the stage.
- Added mobile layout rules for two-column source controls, bottom-sheet settings, safe areas, compact transport, and no horizontal scroll.

### Persistence

- Added schema v2 and legacy migration.
- Added strict sanitization and bounds.
- Added custom colour and source preference fields.
- Added restoration feedback and preferred-source indicators.
- Preserved the required security boundary: permissioned media and local files never auto-start after reload.

### Colour system

- Added Warm amber, Mineral blue, Soft white, and Dusty rose.
- Lowered first-run bloom.
- Added calm presets while preserving the prior technical/neon presets.
- Added a native colour picker and render-grammar integration.

### Accessibility and form correctness

- Bound all labels and controls.
- Added names to all fields.
- Added explicit live-region status.
- Added selected-state semantics.
- Added keyboard-close/focus restoration for settings.
- Removed symbolic-only labels from primary actions.

### Source-state handling

- Added preferred versus active source distinction.
- Added capture-track end handling.
- Added safe-state presentation after failures.
- Added visible capability explanation for Other app.

### Development configuration

- Fixed Vite to port 5174 with strict fallback prevention.
- Aligned Playwright development URL.
- Added optional explicit system-Chromium path for constrained environments.

## 7. Integrated validation and results

Executed in the implementation environment after the code changes:

- `npm ci` → pass.
- `npm run typecheck` → pass.
- `npm test` → pass: 14 files, 72 tests.
- `npm run build` → pass: TypeScript, Vite production bundle, and AudioWorklet bundle verifier.
- `npm run audit:production` → pass: zero production dependency vulnerabilities.
- Static generated form checks and source inspection → pass for explicit index fields and generated-control implementation.

Not completed in this environment:

- Playwright Chromium download failed because the environment could not resolve the Playwright CDN.
- System Chromium was blocked from local URLs by administrator policy, so it was not a valid substitute.
- Therefore development and production E2E tests are implemented but **not claimed as passing**.
- No real Android/iOS device was connected here. Native/browser capture behavior and mobile thermal performance remain manual acceptance requirements.

## 8. Adversarial review after implementation

### Confirmed corrections

- The UI no longer has a full-screen neon dashboard shell.
- The supplied form warnings have direct code-level fixes.
- Settings have a tested migration and sanitization boundary.
- Preferred source survives reload without bypassing browser consent.
- A custom colour reaches the existing render grammar with no renderer duplication.
- HMR no longer depends on Vite choosing the same fallback port as the browser/proxy.

### Residual risks

1. **No browser E2E pass in this environment.** CSS layout and interaction tests must run locally/CI before merge.
2. **No focus trap inside the settings dialog.** Focus enters and exits correctly, but Tab can reach the page behind the sheet. Add a lightweight focus trap only if accessibility testing confirms it is needed; do not import a UI framework for this.
3. **Source-switch race remains.** Rapidly selecting microphone, Other app, and file can interleave asynchronous starts. The next surgical change should add a monotonically increasing session token or `AbortController`-based coordinator.
4. **`main.ts` remains large.** Extract only source-session orchestration after acceptance; broad refactoring now would obscure regressions.
5. **No general mobile other-app capture.** The button is honest, but the capability is still fundamentally limited in the web platform.
6. **No lyrics implementation.** This is intentional. Shipping a toggle before model/device evidence would be deceptive and would jeopardize rendering performance.
7. **Local-first does not equal offline-installed.** There is no service worker. The app processes audio locally but does not yet guarantee offline startup after installation.
8. **Development audit findings remain.** A forced dependency upgrade was rejected because it would be a separate breaking toolchain change.

### Corrective follow-up order

[Run Playwright locally with installed Chromium] → verify: all development and production E2E tests pass before any architectural refactor.

[Perform manual mobile acceptance on the exact affected Samsung device] → verify: microphone, file, playback, Stop, persistence, settings, colour, orientation, and safe-area behavior pass.

[Add source-session cancellation if rapid switching reproduces a race] → verify: only the most recently requested source can become active.

[Then isolate any failing UI or lifecycle behavior] → verify: fixes remain surgical and do not modify DSP/rendering modules without evidence.

## 9. Dependency-ordered PowerShell acceptance

Run from the repository root. Do not start the dev server before installing dependencies and browsers.

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "STOP: npm ci failed." }

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "STOP: typecheck failed." }

npm test
if ($LASTEXITCODE -ne 0) { throw "STOP: unit tests failed." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "STOP: production build or worklet verification failed." }

npm run audit:production
if ($LASTEXITCODE -ne 0) { throw "STOP: production dependency audit failed." }
```

Install the Playwright browser once, then run browser gates:

```powershell
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "STOP: Playwright Chromium installation failed." }

npm run test:e2e
if ($LASTEXITCODE -ne 0) { throw "STOP: development E2E failed." }

npm run test:e2e:prod
if ($LASTEXITCODE -ne 0) { throw "STOP: production-preview E2E failed." }
```

Only after those gates pass, launch the manual review server:

```powershell
npm run dev
```

Expected origin: `http://localhost:5174/`. If 5174 is occupied, Vite must stop rather than move to 5173. Close the conflicting process or deliberately change the port and both Playwright configurations together.

Manual browser-console checks:

```powershell
# In a second PowerShell window while npm run dev is active:
curl.exe -sSI http://localhost:5174/ |
    Select-String -Pattern "HTTP/|cross-origin-opener-policy|cross-origin-embedder-policy"
```

Expected: HTTP 200, `Cross-Origin-Opener-Policy: same-origin`, and `Cross-Origin-Embedder-Policy: require-corp`.

Production bundle checks:

```powershell
Get-ChildItem .\dist\assets\preprocessor.worklet-*.js
Select-String -Path .\dist\assets\*.js -Pattern 'data:video/mp2t'
```

Expected: one emitted worklet JavaScript file; no `data:video/mp2t` matches.

## 10. Release decision

The implementation is suitable for a release-candidate branch, not an unconditional production sign-off. Unit, type, build, worklet, and production dependency gates pass. Browser E2E and real-device acceptance are still mandatory. “Other app” remains a best-effort web capability, native Android playback capture is a separate phase, and lyrics remains an evidence-gated subsystem rather than a cosmetic feature.
