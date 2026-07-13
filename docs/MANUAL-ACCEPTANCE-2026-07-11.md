# Drawn by Sound — manual acceptance checklist

Use this only after `npm ci`, typecheck, unit tests, build, production audit, and both Playwright suites pass. Record exact device, OS, browser, commit, and deployment URL.

## Test record

- Commit/tag:
- Deployment URL:
- Device model:
- OS/version:
- Browser/version:
- Headphones/Bluetooth device:
- Tester/date:

## A. First load and visual shell

- [ ] Page loads without console errors.
- [ ] No Vite HMR WebSocket warning appears on local development at port 5174.
- [ ] Demo is visibly selected and the stage reads “Demo / Generated signal.”
- [ ] The product shell is warm/neutral; darkness is contained to the visual stage.
- [ ] No control overlaps the canvas, header, control deck, or safe areas.
- [ ] No horizontal scrolling at 320, 360, 390, 768, and desktop widths.
- [ ] Portrait and landscape changes preserve usable controls and a visible stage.

## B. Accessibility and controls

- [ ] Keyboard focus is visible on every interactive control.
- [ ] Adjust opens the settings sheet and moves focus to Close.
- [ ] Escape closes the settings sheet and returns focus to Adjust.
- [ ] Every settings label activates/focuses the correct control.
- [ ] Browser accessibility/form audit reports no missing label and no missing id/name warnings.
- [ ] Reduced motion follows the OS on a fresh profile and remains user-overridable.
- [ ] Touch targets are usable without accidental neighbouring activation.

## C. Persistence

- [ ] Change shape, colour set, sensitivity, trail length, glow, and accessibility options.
- [ ] Reload; all changed values are restored.
- [ ] Select a custom colour and enable it; reload; the colour and toggle are restored.
- [ ] Choose Microphone, Other app, and Audio file in separate sessions; reload after each.
- [ ] The preferred source is remembered visually, but no permission prompt or file dialog appears automatically.
- [ ] Restore visual defaults; visual settings reset while the preferred source remains remembered.
- [ ] Clear site storage; the app returns to Warm amber and Demo defaults.

## D. Microphone

- [ ] Allow permission: status reaches listening and geometry responds.
- [ ] Deny permission: status explains the denial and returns to a safe source state.
- [ ] Block microphone at OS level: status distinguishes device/OS blocking where browser evidence permits.
- [ ] Remove/revoke the active track: status reports that capture ended and asks to reconnect.
- [ ] Stop listening: microphone track ends, analysis pauses, selected source clears, trace decays.
- [ ] Repeated start/stop cycles do not produce duplicate audio, stale status, or console errors.

## E. Audio files

- [ ] Choose WAV; filename appears, transport opens, playback is audible, and geometry responds.
- [ ] Choose representative MP3; the same checks pass.
- [ ] Pause, Play, Seek, and Stop behave correctly.
- [ ] Re-select the same file after Stop or an error; selection is accepted.
- [ ] Unsupported/corrupt file: explicit decode/playback error, no stuck transport, safe source state.
- [ ] Large file: note load time, peak memory symptoms, and whether the browser media fallback is used.
- [ ] No network request leaves the app origin during local-file use.

## F. Other app / shared audio

- [ ] The UI says “when supported” before capture begins.
- [ ] Cancel the browser chooser: status is recoverable and no source remains falsely active.
- [ ] Select a surface without audio: the app explains that no usable audio track was received.
- [ ] Select a supported tab/window/screen with audio: geometry responds and the source is visibly active.
- [ ] End sharing from the browser indicator: Drawn by Sound stops and asks to reconnect.
- [ ] Test Spotify, YouTube, browser media, Instagram/multi-view, and BlackPlayer only as named observations; record each pass/fail without generalising.
- [ ] On mobile browsers where capture is unavailable, Other app is disabled or fails honestly and recommends file/microphone.

## G. Visual settings

- [ ] Each named palette changes the trace without changing the selected shape.
- [ ] Custom colour updates the trace and persists.
- [ ] Selecting a preset or named palette exits custom-colour mode predictably.
- [ ] Trail length, soft glow, sensitivity, and input gain have visible but controlled effects.
- [ ] Low-power mode reduces load without breaking source/transport behavior.
- [ ] Diagnostics can be enabled/disabled and do not obstruct primary controls.

## H. Export

- [ ] Save frame downloads a valid PNG.
- [ ] Export does not pause, stop, or change the active session.
- [ ] Filename is timestamped and usable on Android, Windows, and iOS where supported.
- [ ] Exported frame contains the visual only as intended; UI controls are absent.

## I. Sustained mobile use

- [ ] Run Microphone for 30 minutes; record battery change, temperature, frame-rate degradation, and audio stability.
- [ ] Run MP3 playback for 30 minutes with headphones; record the same metrics.
- [ ] Background/foreground the browser; status and analysis recover or stop explicitly.
- [ ] Receive a phone call/audio interruption; the app does not claim it is still listening when the stream ended.
- [ ] Lock/unlock the phone; source state remains honest.
- [ ] Bluetooth connect/disconnect does not produce a frozen false-active state.

## J. Release decision

Release only when:

- [ ] Automated gates pass on the exact commit.
- [ ] Desktop and target Samsung acceptance pass.
- [ ] iOS behavior is either passed or explicitly documented as unsupported by feature.
- [ ] Other-app limitations are visible in product copy.
- [ ] No claim of canonical lyrics or universal app capture is present.
- [ ] Remaining defects have severity, reproduction steps, and an explicit release decision.


## Fullscreen and screen-awake acceptance

- Enter native fullscreen from the bottom-right visual control where supported; otherwise confirm the UI explicitly reports Expanded view.
- Exit with the same control and with Escape without stopping, restarting, or changing the active audio source.
- Confirm the 44 px control remains reachable inside phone safe areas and fades without disappearing completely.
- Enable Keep screen awake, leave the page visible beyond the normal display timeout, then disable it and confirm normal timeout behavior returns.
- Background and restore the page; confirm a selected wake-lock preference is reacquired only after the page is visible.
- On an unsupported browser, confirm the setting is disabled and the FAQ points to the phone display-timeout setting.
