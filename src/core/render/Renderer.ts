import {
  createRenderTarget,
  deleteRenderTarget,
  clearTarget,
  supportsFloatColorBuffer,
  type RenderTarget,
} from './gl/glUtils';
import { FullscreenPass } from './gl/FullscreenPass';
import { TracePass } from './gl/TracePass';
import { BloomPass } from './gl/BloomPass';
import type { RenderParams } from './RenderParams';

const DECAY_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uDecay;
out vec4 frag;
void main() {
  frag = texture(uTex, vUV) * uDecay;   // faded history (PRD §13.9)
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
out vec4 frag;
void main() {
  vec3 c = texture(uScene, vUV).rgb + texture(uBloom, vUV).rgb * uBloomStrength;
  c = c / (c + vec3(1.0));               // Reinhard tone-map -> soft glow
  frag = vec4(c, 1.0);
}`;

/**
 * XY trace -> temporal persistence (ping-pong) -> bloom -> tone-mapped
 * composite. Internal accumulators scale with RenderParams.resolutionScale for
 * low-power mode; bloom is skipped when strength is 0 (PRD §13.9, §14.1).
 */
export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly float: boolean;
  private readonly trace: TracePass;
  private readonly decayPass: FullscreenPass;
  private readonly composite: FullscreenPass;
  private readonly bloom: BloomPass;
  private prev: RenderTarget;
  private cur: RenderTarget;
  private readonly blackTex: WebGLTexture;
  private canvasW = 1;
  private canvasH = 1;
  private scale = 1;
  private lastBloom = 0;
  private captureTarget: RenderTarget | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.float = supportsFloatColorBuffer(gl);
    this.trace = new TracePass(gl);
    this.decayPass = new FullscreenPass(gl, DECAY_FRAG);
    this.composite = new FullscreenPass(gl, COMPOSITE_FRAG);
    this.bloom = new BloomPass(gl, this.float);
    this.prev = createRenderTarget(gl, 1, 1, this.float);
    this.cur = createRenderTarget(gl, 1, 1, this.float);

    const black = gl.createTexture();
    if (!black) throw new Error('Failed to create black texture.');
    gl.bindTexture(gl.TEXTURE_2D, black);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.blackTex = black;
  }

  get hdr(): boolean {
    return this.float;
  }

  resize(width: number, height: number): void {
    this.canvasW = Math.max(1, width);
    this.canvasH = Math.max(1, height);
    this.rebuildTargets();
  }

  private rebuildTargets(): void {
    const gl = this.gl;
    const w = Math.max(1, Math.round(this.canvasW * this.scale));
    const h = Math.max(1, Math.round(this.canvasH * this.scale));
    if (w === this.cur.width && h === this.cur.height) return;
    deleteRenderTarget(gl, this.prev);
    deleteRenderTarget(gl, this.cur);
    this.prev = createRenderTarget(gl, w, h, this.float);
    this.cur = createRenderTarget(gl, w, h, this.float);
    clearTarget(gl, this.prev);
    clearTarget(gl, this.cur);
    this.bloom.resize(w, h);
  }

  renderFrame(positions: Float32Array, count: number, params: RenderParams): void {
    if (params.resolutionScale !== this.scale) {
      this.scale = params.resolutionScale;
      this.rebuildTargets();
    }

    // 1) cur = prev * decay
    this.decayPass.run(this.cur, { uTex: this.prev.texture }, { uDecay: params.decay });
    // 2) additive trace on top
    this.trace.draw(this.cur, positions, count, params.color, 1);
    // 3) bloom (skipped when disabled)
    const bloomTex = params.bloom > 0 ? this.bloom.compute(this.cur.texture) : this.blackTex;
    // 4) tone-mapped composite to screen
    this.composite.run(
      null,
      { uScene: this.cur.texture, uBloom: bloomTex },
      { uBloomStrength: params.bloom },
    );
    // 5) swap
    const t = this.prev;
    this.prev = this.cur;
    this.cur = t;
    this.lastBloom = params.bloom;
  }

  /**
   * Capture the current visual as a PNG blob (PRD §13.12). Re-composites the
   * retained accumulator into a readable RGBA8 target, reads it back, flips Y,
   * and encodes — without disturbing the live session.
   */
  async capturePNG(): Promise<Blob> {
    const gl = this.gl;
    const w = this.canvasW;
    const h = this.canvasH;
    if (!this.captureTarget || this.captureTarget.width !== w || this.captureTarget.height !== h) {
      if (this.captureTarget) deleteRenderTarget(gl, this.captureTarget);
      this.captureTarget = createRenderTarget(gl, w, h, false);
    }
    const bloomTex = this.lastBloom > 0 ? this.bloom.compute(this.prev.texture) : this.blackTex;
    this.composite.run(
      this.captureTarget,
      { uScene: this.prev.texture, uBloom: bloomTex },
      { uBloomStrength: this.lastBloom },
    );

    const pixels = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.captureTarget.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const flipped = new Uint8ClampedArray(w * h * 4);
    const stride = w * 4;
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * stride;
      flipped.set(pixels.subarray(src, src + stride), y * stride);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) throw new Error('2D context unavailable for export.');
    ctx2d.putImageData(new ImageData(flipped, w, h), 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
    });
  }

  /** Average luminance of the last accumulator (offscreen, retained). */
  readbackAverageLuminance(): number {
    const gl = this.gl;
    const t = this.prev;
    const { width: w, height: h } = t;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    let sum = 0;
    const n = w * h;
    if (this.float) {
      const buf = new Float32Array(n * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, buf);
      for (let i = 0; i < n; i++) sum += (buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2]) / 3;
    } else {
      const buf = new Uint8Array(n * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      for (let i = 0; i < n; i++)
        sum += (buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2]) / (3 * 255);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return n > 0 ? sum / n : 0;
  }
}
