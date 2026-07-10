import {
  createProgram,
  createFullscreenTriangle,
  FULLSCREEN_VERT,
  type FullscreenTriangle,
  type RenderTarget,
} from './glUtils';

/**
 * Runs a fragment shader over a fullscreen triangle. Used for the persistence
 * decay-copy and the final present/tone-map (and bloom passes from M4).
 */
export class FullscreenPass {
  private readonly program: WebGLProgram;
  private readonly quad: FullscreenTriangle;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    fragmentSource: string,
  ) {
    this.program = createProgram(gl, FULLSCREEN_VERT, fragmentSource);
    this.quad = createFullscreenTriangle(gl);
  }

  private loc(name: string): WebGLUniformLocation | null {
    let l = this.locations.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name);
      this.locations.set(name, l);
    }
    return l;
  }

  /**
   * @param target  Destination render target, or null for the default framebuffer (screen).
   * @param samplers sampler2D uniform name -> texture (bound in insertion order).
   * @param floats   float uniform name -> value.
   */
  run(
    target: RenderTarget | null,
    samplers: Record<string, WebGLTexture>,
    floats: Record<string, number> = {},
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    const w = target ? target.width : gl.drawingBufferWidth;
    const h = target ? target.height : gl.drawingBufferHeight;
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);

    let unit = 0;
    for (const name of Object.keys(samplers)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, samplers[name]);
      gl.uniform1i(this.loc(name), unit);
      unit++;
    }
    for (const name of Object.keys(floats)) {
      gl.uniform1f(this.loc(name), floats[name]);
    }
    this.quad.draw();
  }
}
