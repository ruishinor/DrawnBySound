import { describe, expect, it } from 'vitest';
import {
  describeAudioEngineFailure,
  describeDecodeFailure,
  describeMicrophoneFailure,
  describePlaybackFailure,
} from './AudioErrors';

describe('audio failure copy', () => {
  it('distinguishes permission, missing-device, and busy microphone errors', () => {
    expect(describeMicrophoneFailure(new DOMException('', 'NotAllowedError'))).toContain('permission');
    expect(describeMicrophoneFailure(new DOMException('', 'NotFoundError'))).toContain('No microphone');
    expect(describeMicrophoneFailure(new DOMException('', 'NotReadableError'))).toContain('busy');
  });

  it('preserves useful engine and decode details', () => {
    expect(describeAudioEngineFailure(new Error('worklet failed'))).toContain('worklet failed');
    expect(describeDecodeFailure('track.mp3', new Error('unsupported codec'))).toContain('unsupported codec');
  });

  it('turns autoplay rejection into an actionable instruction', () => {
    expect(describePlaybackFailure(new DOMException('', 'NotAllowedError'))).toContain('Tap Play');
  });
});
