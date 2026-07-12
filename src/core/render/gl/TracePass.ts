import { createProgram, type RenderTarget } from './glUtils';
import type { RenderParams } from '../RenderParams';

const TRACE_VERT = `#version 300 es
layout(location=0) in vec2 aPos;   // XY position already in NDC [-1,1]
uniform vec2 uAspectScale;
out vec2 vPos;
void main() {
  vPos = aPos;
  gl_Position = vec4(aPos * uAspectScale, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

const TRACE_FRAG = `#version 300 es
precision highp float;
in vec2 vPos;
uniform vec3 uColor;
uniform float uIntensity;
uniform int uColorMode;
uniform float uFlowTime;
uniform vec4 uTraceBounds; // minX, minY, maxX, maxY in NDC
out vec4 frag;

vec3 norwegianColor(float t) {
  // Norwegian flag colors, lifted slightly for emissive rendering on black.
  const vec3 red = vec3(0.86, 0.025, 0.12);
  const vec3 white = vec3(1.0);
  const vec3 blue = vec3(0.0, 0.18, 0.72);
  float x = clamp(t, 0.0, 1.0);
  if (x < 0.5) return mix(red, white, smoothstep(0.0, 0.5, x));
  return mix(white, blue, smoothstep(0.5, 1.0, x));
}

vec3 norwegianFlagColor(float phase) {
  // Strong fabric-like flag colours arranged as one seamless horizontal cycle:
  // deep red -> red -> warm white -> navy -> royal blue -> white -> red.
  const vec3 deepRed = vec3(0.52, 0.045, 0.095);
  const vec3 red = vec3(0.90, 0.075, 0.14);
  const vec3 white = vec3(0.94, 0.90, 0.88);
  const vec3 navy = vec3(0.015, 0.15, 0.42);
  const vec3 blue = vec3(0.20, 0.36, 0.74);

  float p = fract(phase);
  if (p < 0.12) return mix(deepRed, red, smoothstep(0.0, 0.12, p));
  if (p < 0.27) return mix(red, white, smoothstep(0.12, 0.27, p));
  if (p < 0.38) return mix(white, navy, smoothstep(0.27, 0.38, p));
  if (p < 0.55) return mix(navy, blue, smoothstep(0.38, 0.55, p));
  if (p < 0.70) return mix(blue, white, smoothstep(0.55, 0.70, p));
  if (p < 0.84) return mix(white, red, smoothstep(0.70, 0.84, p));
  return mix(red, deepRed, smoothstep(0.84, 1.0, p));
}

void main() {
  vec3 emission = uColor;
  if (uColorMode == 1) {
    // NorwegianFlow keeps the original rolling global phase: one flag-derived
    // color can dominate temporarily as the color wave moves through the trace.
    float horizontal = 0.25 * (vPos.x + 1.0);
    float radialRoll = 0.035 * sin(length(vPos) * 7.0 - uFlowTime * 0.55);
    float phase = horizontal + radialRoll - uFlowTime * 0.08;
    float band = 0.5 + 0.5 * sin(6.28318530718 * phase - 1.57079632679);
    emission = norwegianColor(band) * uIntensity;
  } else if (uColorMode == 2) {
    // NorwegianFlag normalizes the horizontal colour coordinate to the live
    // trace bounds, preserving a left-to-right flag sequence at every scale.
    vec2 minP = uTraceBounds.xy;
    vec2 span = max(uTraceBounds.zw - minP, vec2(0.0001));
    float localX = clamp((vPos.x - minP.x) / span.x, 0.0, 1.0);

    // Move only the repeating colour cycle from left to right. Geometry and
    // every existing rendering mode remain untouched.
    float phase = localX - uFlowTime * 0.055;
    emission = norwegianFlagColor(phase) * uIntensity;
  } else {
    // Existing palettes retain their exact uniform-color behavior.
    emission *= uIntensity;
  }

  // Additive emission; persistence + tone-map turn overlaps into glow.
  frag = vec4(emission, 1.0);
}`;


/**
 * Preserve the trace's intended proportions on wide stages. Portrait and
 * square stages keep the existing full-height behavior used on mobile.
 */
export function traceAspectScale(width: number, height: number): readonly [number, number] {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  if (safeWidth <= safeHeight) return [1, 1];

  // Preserve equal physical X/Y scale, then add a restrained landscape-only
  // occupancy lift. This avoids the previous wide-stage flattening without
  // leaving the corrected trace unnecessarily small in the centre.
  const aspect = safeWidth / safeHeight;
  const occupancy = Math.min(1.16, Math.sqrt(aspect));
  return [(safeHeight / safeWidth) * occupancy, occupancy];
}

/**
 * Draws the oscilloscope XY trace as an additive LINE_STRIP into a render
 * target. Interleaved (x,y) NDC positions are streamed each frame.
 */
export class TracePass {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vbo: WebGLBuffer;
  private capacityVerts: number;
  private readonly locColor: WebGLUniformLocation | null;
  private readonly locIntensity: WebGLUniformLocation | null;
  private readonly locColorMode: WebGLUniformLocation | null;
  private readonly locFlowTime: WebGLUniformLocation | null;
  private readonly locTraceBounds: WebGLUniformLocation | null;
  private readonly locAspectScale: WebGLUniformLocation | null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    initialCapacityVerts = 4096,
  ) {
    this.program = createProgram(gl, TRACE_VERT, TRACE_FRAG);
    this.capacityVerts = initialCapacityVerts;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    if (!vao || !vbo) throw new Error('Failed to create trace buffers.');
    this.vao = vao;
    this.vbo = vbo;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacityVerts * 2 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.locColor = gl.getUniformLocation(this.program, 'uColor');
    this.locIntensity = gl.getUniformLocation(this.program, 'uIntensity');
    this.locColorMode = gl.getUniformLocation(this.program, 'uColorMode');
    this.locFlowTime = gl.getUniformLocation(this.program, 'uFlowTime');
    this.locTraceBounds = gl.getUniformLocation(this.program, 'uTraceBounds');
    this.locAspectScale = gl.getUniformLocation(this.program, 'uAspectScale');
  }

  private ensureCapacity(verts: number): void {
    if (verts <= this.capacityVerts) return;
    const gl = this.gl;
    this.capacityVerts = verts;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacityVerts * 2 * 4, gl.DYNAMIC_DRAW);
  }

  /**
   * @param positions interleaved x,y NDC, length >= count*2
   * @param count     number of vertices to draw
   */
  draw(
    target: RenderTarget,
    positions: Float32Array,
    count: number,
    color: readonly [number, number, number],
    intensity: number,
    colorMode: RenderParams['colorMode'],
    colorFlowTime: number,
  ): void {
    if (count <= 0) return;
    const gl = this.gl;
    this.ensureCapacity(count);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive light accumulation (PRD §13.9)

    gl.useProgram(this.program);
    gl.uniform3f(this.locColor, color[0], color[1], color[2]);
    gl.uniform1f(this.locIntensity, intensity);
    const colorModeId =
      colorMode === 'norwegian-flow' ? 1 : colorMode === 'norwegian-flag' ? 2 : 0;
    gl.uniform1i(this.locColorMode, colorModeId);
    gl.uniform1f(this.locFlowTime, colorFlowTime);
    const [aspectX, aspectY] = traceAspectScale(target.width, target.height);
    gl.uniform2f(this.locAspectScale, aspectX, aspectY);

    let minX = positions[0];
    let minY = positions[1];
    let maxX = minX;
    let maxY = minY;
    for (let i = 1; i < count; i++) {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    gl.uniform4f(this.locTraceBounds, minX, minY, maxX, maxY);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions, 0, count * 2);
    gl.drawArrays(gl.LINE_STRIP, 0, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
  }
}
