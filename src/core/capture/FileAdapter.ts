/** Decode an imported audio file to PCM (PRD §13.3). */
export async function decodeAudioFile(ctx: BaseAudioContext, file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  return ctx.decodeAudioData(data);
}
