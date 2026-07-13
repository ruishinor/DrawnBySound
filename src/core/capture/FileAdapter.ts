/**
 * Decoding creates both the original ArrayBuffer and decoded PCM in memory.
 * Larger local files use the browser media-element path instead to avoid a
 * predictable tab-memory spike before playback can begin.
 */
export const MAX_BUFFER_DECODE_BYTES = 64 * 1024 * 1024;

export function shouldUseMediaElement(file: Pick<File, 'size'>): boolean {
  return file.size > MAX_BUFFER_DECODE_BYTES;
}

/** Decode an imported audio file to PCM (PRD §13.3). */
export async function decodeAudioFile(ctx: BaseAudioContext, file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  return ctx.decodeAudioData(data);
}
