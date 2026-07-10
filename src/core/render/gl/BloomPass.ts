import {
  createRenderTarget,
  deleteRenderTarget,
  clearTarget,
  type RenderTarget,
} from './glUtils';
import { FullscreenPass } from './FullscreenPass';

const BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uThreshold;
out vec4 frag;
void main() {
  vec3 c = texture(uTex, vUV).rgb;
  frag = vec4(max(c - vec3(uThreshold), vec3(0.0)), 1.0);
}`;

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uTexelX;
uniform float uTexelY;
out vec4 frag;
void main() {
  vec2 d = vec2(uTexelX, uTexelY);
  vec3 s = texture(uTex, vUV).rgb * 0.227027;
  s += texture(uTex, vUV + d * 1.0).rgb * 0.1945946;
  s += texture(uTex, vUV - d * 1.0).rgb * 0.1945946;
  s += texture(uTex, vUV + d * 2.0).rgb * 0.1216216;
  s += texture(uTex, vUV - d * 2.0).rgb * 0.1216216;
  s += texture(uTex, vUV + d * 3.0).rgb * 0.0540541;
  s += texture(uTex, vUV - d * 3.0).rgb * 0.0540541;
  s += texture(uTex, vUV + d * 4.0).rgb * 0.0162162;
  s += texture(uTex, vUV - d * 4.0).rgb * 0.0162162;
  frag = vec4(s, 1.0);
}`;

const THRESHOLD = 0.6;

/**
 * Bloom: bright-pass extract -> separable Gaussian blur at half resolution.
 * Cheap and the first thing to drop under load (PRD §14.1). `compute` returns a
 * texture to be additively composited by the renderer.
 */
export class BloomPass {
  private readonly bright: FullscreenPass;
  private readonly blur: FullscreenPass;
  private a: RenderTarget;
  private b: RenderTarget;
  private hw = 1;
  private hh = 1;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly float: boolean,
  ) {
    this.bright = new FullscreenPass(gl, BRIGHT_FRAG);
    this.blur = new FullscreenPass(gl, BLUR_FRAG);
    this.a = createRenderTarget(gl, 1, 1, float);
    this.b = createRenderTarget(gl, 1, 1, float);
  }

  resize(width: number, height: number): void {
    const hw = Math.max(1, width >> 1);
    const hh = Math.max(1, height >> 1);
    if (hw === this.hw && hh === this.hh) return;
    deleteRenderTarget(this.gl, this.a);
    deleteRenderTarget(this.gl, this.b);
    this.a = createRenderTarget(this.gl, hw, hh, this.float);
    this.b = createRenderTarget(this.gl, hw, hh, this.float);
    this.hw = hw;
    this.hh = hh;
    clearTarget(this.gl, this.a);
    clearTarget(this.gl, this.b);
  }

  /** Returns a blurred bright-pass texture derived from `srcTexture`. */
  compute(srcTexture: WebGLTexture): WebGLTexture {
    this.bright.run(this.a, { uTex: srcTexture }, { uThreshold: THRESHOLD });
    this.blur.run(this.b, { uTex: this.a.texture }, { uTexelX: 1 / this.hw, uTexelY: 0 });
    this.blur.run(this.a, { uTex: this.b.texture }, { uTexelX: 0, uTexelY: 1 / this.hh });
    return this.a.texture;
  }

  get texture(): WebGLTexture {
    return this.a.texture;
  }
}
