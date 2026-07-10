import { createProgram, type RenderTarget } from './glUtils';

const TRACE_VERT = `#version 300 es
layout(location=0) in vec2 aPos;   // XY position already in NDC [-1,1]
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

const TRACE_FRAG = `#version 300 es
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
out vec4 frag;
void main() {
  // Additive emission; persistence + tone-map turn overlaps into glow.
  frag = vec4(uColor * uIntensity, 1.0);
}`;

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

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions, 0, count * 2);
    gl.drawArrays(gl.LINE_STRIP, 0, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
  }
}
