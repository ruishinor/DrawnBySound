import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioGraph } from '../pipeline/AudioGraph';
import { startMic } from './MicAdapter';

function fixture(getUserMedia: ReturnType<typeof vi.fn>): {
  graph: AudioGraph;
  sourceNode: MediaStreamAudioSourceNode;
  track: MediaStreamTrack;
  stream: MediaStream;
} {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const sourceNode = { disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
  const graph = {
    ctx: { createMediaStreamSource: vi.fn(() => sourceNode) },
    connectInput: vi.fn(),
    resume: vi.fn(async () => undefined),
  } as unknown as AudioGraph;

  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  return { graph, sourceNode, track, stream };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startMic', () => {
  it('requests unprocessed audio and cleans up the stream', async () => {
    const getUserMedia = vi.fn();
    const { graph, sourceNode, track, stream } = fixture(getUserMedia);
    getUserMedia.mockResolvedValue(stream);

    const handle = await startMic(graph);

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    expect(graph.connectInput).toHaveBeenCalledWith(sourceNode);

    handle.stop();
    expect(sourceNode.disconnect).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('retries with default audio only after an overconstrained failure', async () => {
    const getUserMedia = vi.fn();
    const { graph, stream } = fixture(getUserMedia);
    getUserMedia
      .mockRejectedValueOnce(new DOMException('', 'OverconstrainedError'))
      .mockResolvedValueOnce(stream);

    await startMic(graph);

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true, video: false });
  });

  it('does not retry permission denial', async () => {
    const getUserMedia = vi.fn();
    const { graph } = fixture(getUserMedia);
    getUserMedia.mockRejectedValue(new DOMException('', 'NotAllowedError'));

    await expect(startMic(graph)).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('stops the granted stream if graph setup fails', async () => {
    const getUserMedia = vi.fn();
    const { graph, track, stream } = fixture(getUserMedia);
    getUserMedia.mockResolvedValue(stream);
    vi.mocked(graph.connectInput).mockImplementation(() => {
      throw new Error('connect failed');
    });

    await expect(startMic(graph)).rejects.toThrow('connect failed');
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
