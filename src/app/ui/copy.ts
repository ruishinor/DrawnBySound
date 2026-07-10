import { APP_NAME } from '../config';

/**
 * Honest, plain-language UI copy (PRD §9, §19.4). Never over-promise capture.
 */
export const COPY = {
  capabilityNote:
    'Available listening modes depend on your device and OS. Microphone and file modes ' +
    'are broadly available. Capturing audio from other apps is supported only where the OS ' +
    'and source app allow it.',
  micDenied: 'Microphone unavailable or permission denied. Try a file, or use the demo signal.',
  decodeFailed: (name: string) =>
    `Couldn't decode "${name}". Try WAV, MP3, or M4A. Using the demo signal for now.`,
  audioUnavailable: 'Audio engine could not start on this device. Using the demo signal.',
  webgl2Missing: `WebGL2 is unavailable in this browser. ${APP_NAME} requires WebGL2.`,
  systemCaptureLimited:
    'System/other-app audio capture is browser- and OS-dependent and may be blocked by the ' +
    'source app. If it fails, switch to microphone or file mode.',
  voiceDetected: 'Voice detected. Lyrics are not analyzed.',
} as const;
