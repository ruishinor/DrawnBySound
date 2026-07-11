import type { AudioGraph } from '../pipeline/AudioGraph';
import type { MicHandle } from './MicAdapter';

/**
 * Best-effort external-app audio capture (PRD §13.4). On the web this is
 * getDisplayMedia with audio — browser- and OS-dependent, and the source must
 * opt in ("Share audio" in the picker). No DRM circumvention. Throws a clear,
 * actionable error so the caller can fall back to mic/file.
 */
export async function startSystemCapture(graph: AudioGraph): Promise<MicHandle> {
  const md = navigator.mediaDevices;
  if (!md?.getDisplayMedia) {
    throw new Error('External app audio capture is not supported in this browser.');
  }
  // Video must be requested for most browsers to offer system/tab audio.
  const stream = await md.getDisplayMedia({ audio: true, video: true });
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    for (const t of stream.getTracks()) t.stop();
    throw new Error('No audio was shared. Pick a tab or window and enable "Share audio".');
  }
  // We only need audio — drop the video track immediately.
  for (const t of stream.getVideoTracks()) t.stop();

  await graph.resume();
  const src = graph.ctx.createMediaStreamSource(stream);
  graph.connectInput(src);
  return {
    stream,
    stop() {
      src.disconnect();
      for (const t of stream.getTracks()) t.stop();
    },
  };
}
