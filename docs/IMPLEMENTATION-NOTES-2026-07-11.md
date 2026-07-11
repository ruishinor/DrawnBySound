# VibratoFlow implementation notes — 2026-07-11

## Brand and audience calibration

1. Audience: people who want an immediate, low-friction visual response to music on a phone or desktop; casual listeners, musicians, creators, and projection users who value privacy and legibility over technical spectacle.
2. Not for: a DAW replacement, professional metering suite, game HUD, tactical interface, crypto/SaaS dashboard, or an "AI music" product.
3. Preserve: the VibratoFlow name, the live oscilloscope geometry, local processing, microphone/file/system-source choices, PNG export, and advanced visual controls.
4. Avoid: black-plus-neon as the full interface, purple/teal gradients, glassmorphism, pill-button rows, glowing borders, emoji controls, tiny low-contrast status text, dashboard cards, and decorative metrics.
5. Appropriate references: restrained music-player controls, physical audio equipment, editorial exhibition labels, gallery projection software, and warm neutral material palettes. References guide hierarchy and tactility, not imitation.
6. Emotional target: calm, immersive, deliberate, and trustworthy. The visual should feel like the instrument; the interface should recede.
7. Generic or wrong: a full-width toolbar, equal emphasis on every action, unexplained source capture, fake lyrics controls, or styling that could be dropped into any AI-generated dashboard.
8. Planned file changes:
   - `index.html`
   - `src/app/ui/app.css` (new)
   - `src/main.ts`
   - `src/app/SettingsStore.ts`
   - `src/app/SettingsStore.test.ts` (new)
   - `src/app/ui/SettingsPanel.ts`
   - `src/core/grammar/palettes.ts`
   - `src/core/grammar/mappings.ts`
   - `src/core/grammar/grammar.test.ts`
   - `vite.config.ts`
   - `playwright.config.ts`
   - `tests/e2e/smoke.spec.ts`
   - `tests/e2e-prod/audio-input.spec.ts`
   - `README.md`
   - `docs/AUDIT-AND-IMPLEMENTATION-2026-07-11.md` (new)
   - `docs/FEATURE-VIABILITY-2026-07-11.md` (new)

## Assumptions and trade-offs

- The web app remains framework-free and local-first. No UI library, analytics, account system, cloud transcription, or model runtime is added in this patch.
- The canvas remains dark because additive oscilloscope rendering requires contrast, but the surrounding product UI moves to warm neutral surfaces and a muted default trace color.
- Visual preferences persist. A browser cannot silently reopen a local file or re-grant microphone/display capture, so only the preferred source is remembered; reconnection still requires a user gesture.
- Other-app capture remains best-effort on the web. Full Android playback capture requires a native Android implementation and remains constrained by the source app's capture policy.
- Real-time lyric transcription is not shipped as a cosmetic toggle. It needs an explicit model-download/privacy/performance design and separate validation against singing, background music, mobile thermal load, and copyright handling.
- The reported HMR mismatch is resolved by making the development port explicit and strict at 5174, matching the observed browser URL. Production preview remains on 4173.
