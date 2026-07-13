import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioGraph } from '../pipeline/AudioGraph';
import { startSystemCapture } from './SystemCaptureAdapter';

function setup(audioTrackCount = 1): {
  getDisplayMedia: ReturnType<typeof vi.fn>;
  graph: AudioGraph;
  sourceNode: MediaStreamAudioSourceNode;
  audioTrack: MediaStreamTrack;
  videoTrack: MediaStreamTrack;
  stream: MediaStream;
} {
  const audioTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const videoTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const audioTracks = audioTrackCount ? [audioTrack] : [];
  const stream = {
    getAudioTracks: () => audioTracks,
    getVideoTracks: () => [videoTrack],
    getTracks: () => [...audioTracks, videoTrack],
  } as unknown as MediaStream;
  const sourceNode = { disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
  const graph = {
    ctx: { createMediaStreamSource: vi.fn(() => sourceNode) },
    connectInput: vi.fn(),
    resume: vi.fn(async () => undefined),
  } as unknown as AudioGraph;
  const getDisplayMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });
  return { getDisplayMedia, graph, sourceNode, audioTrack, videoTrack, stream };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startSystemCapture', () => {
  it('drops video immediately and stops audio when the handle closes', async () => {
    const { graph, sourceNode, audioTrack, videoTrack } = setup();

    const handle = await startSystemCapture(graph);

    expect(videoTrack.stop).toHaveBeenCalledOnce();
    expect(graph.connectInput).toHaveBeenCalledWith(sourceNode);
    handle.stop();
    expect(sourceNode.disconnect).toHaveBeenCalledOnce();
    expect(audioTrack.stop).toHaveBeenCalledOnce();
  });

  it('stops every track when no audio was shared', async () => {
    const { graph, videoTrack } = setup(0);

    await expect(startSystemCapture(graph)).rejects.toThrow('No audio was shared');
    expect(videoTrack.stop).toHaveBeenCalledOnce();
  });

  it('stops the granted stream if graph setup fails', async () => {
    const { graph, audioTrack, videoTrack } = setup();
    vi.mocked(graph.connectInput).mockImplementation(() => {
      throw new Error('connect failed');
    });

    await expect(startSystemCapture(graph)).rejects.toThrow('connect failed');
    expect(videoTrack.stop).toHaveBeenCalledOnce();
    expect(audioTrack.stop).toHaveBeenCalledOnce();
  });
});
