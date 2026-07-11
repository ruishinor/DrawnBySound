function detail(error: unknown): string {
  if (error instanceof DOMException) {
    return error.message ? `${error.name}: ${error.message}` : error.name;
  }
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/** Plain-language microphone failure copy keyed to standard getUserMedia errors. */
export function describeMicrophoneFailure(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission was denied or blocked. Enable microphone access for this site and browser.';
    case 'NotFoundError':
      return 'No microphone was found on this device.';
    case 'NotReadableError':
      return 'The microphone is busy or blocked by the operating system. Close other recording apps and retry.';
    case 'OverconstrainedError':
      return 'This microphone does not support the requested capture settings.';
    case 'AbortError':
      return 'Microphone startup was interrupted. Retry the microphone.';
    default:
      return `Microphone could not start: ${detail(error)}`;
  }
}

export function describeAudioEngineFailure(error: unknown): string {
  return `Audio engine could not start: ${detail(error)} Reload the page or try another current browser.`;
}

export function describeDecodeFailure(name: string, error: unknown): string {
  return (
    `Couldn't open "${name}": ${detail(error)} ` +
    'The browser may not support this file encoding. Try WAV or a differently encoded MP3/M4A.'
  );
}

export function describePlaybackFailure(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'Playback is ready. Tap Play to start audio.';
  return `Playback could not start: ${detail(error)}`;
}
