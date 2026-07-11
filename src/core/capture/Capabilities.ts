import { COPY } from '../../app/ui/copy';

/** A listening mode and whether this device/OS/browser supports it (PRD §11). */
export interface ModeCapability {
  id: 'mic' | 'file' | 'player' | 'system';
  label: string;
  available: boolean;
  note: string;
}

/**
 * The real-time pipeline (worklet -> SAB ring -> worker) requires
 * cross-origin isolation. Hosts must send COOP/COEP headers (see README
 * "Deployment"); without them only the demo signal is available (PRD §14.3).
 */
export function realtimeSupported(): boolean {
  return (
    typeof SharedArrayBuffer !== 'undefined' &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true
  );
}

/**
 * Capability model (PRD §11, §13.1): report honestly which modes are available.
 * Never present an unsupported mode as if it were available.
 */
export function detectCapabilities(): ModeCapability[] {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const hasMic = !!md?.getUserMedia;
  const hasDisplay = !!md?.getDisplayMedia;
  return [
    {
      id: 'mic',
      label: 'Microphone',
      available: hasMic,
      note: hasMic ? 'Cross-platform live listening.' : 'Microphone not available in this browser.',
    },
    { id: 'file', label: 'Open file', available: true, note: 'Reliable, high fidelity.' },
    { id: 'player', label: 'Play in app', available: true, note: 'Synchronized playback.' },
    {
      id: 'system',
      label: 'External app',
      available: hasDisplay,
      note: hasDisplay ? COPY.systemCaptureLimited : 'External app audio capture is unavailable in this browser. Use Microphone or Audio file.',
    },
  ];
}
