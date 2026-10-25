import { artBox, type Fibre, fibreVertices } from "@/lib/footer-art/fibres";

// Comet period per fibre is 6–10 s; time is wrapped on the CPU so float precision holds.
const period = 60;

const vertexSource = `#version 300 es
in vec2 aPos;
in float aProgress;
in float aSeed;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uCanvas;
out float vProgress;
out float vSeed;
void main() {
  vec2 px = aPos * uScale + uOffset;
  gl_Position = vec4(px / uCanvas * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
  vProgress = aProgress;
  vSeed = aSeed;
}`;

// Faint fibre plus a comet whose bright head travels toward the mark with a soft tail.
const fragmentSource = `#version 300 es
precision mediump float;
in float vProgress;
in float vSeed;
uniform float uTime;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  float speed = 0.10 + 0.07 * vSeed;
  float head = fract(uTime * speed + vSeed * 13.7);
  float behind = head - vProgress;
  float tail = behind >= 0.0 ? exp(-behind * 14.0) : 0.0;
  float base = 0.16 + 0.14 * vSeed;
  float fadeIn = smoothstep(0.0, 0.25, vProgress);
  float alpha = min(1.0, (base + tail * 0.9) * fadeIn);
  outColor = vec4(uColor * alpha, alpha);
}`;

export type Rgb = [number, number, number];

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

// Cover the canvas like background-size: cover, centred on the art box.
export function coverTransform(width: number, height: number) {
  const scale = Math.max(width / artBox.width, height / artBox.height);

  return {
    scale,
    x: (width - artBox.width * scale) / 2,
    y: (height - artBox.height * scale) / 2,
  };
}

export function gpuScene(gl: WebGL2RenderingContext, fibres: Fibre[], color: Rgb) {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!vs || !fs || !program) return null;

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const data = fibreVertices(fibres);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  for (const [name, size, offset] of [
    ["aPos", 2, 0],
    ["aProgress", 1, 8],
    ["aSeed", 1, 12],
  ] as const) {
    const location = gl.getAttribLocation(program, name);

    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 16, offset);
  }

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const count = data.length / 4;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return (seconds: number) => {
    const { width, height } = gl.canvas;
    const cover = coverTransform(width, height);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(uniform("uScale"), cover.scale, cover.scale);
    gl.uniform2f(uniform("uOffset"), cover.x, cover.y);
    gl.uniform2f(uniform("uCanvas"), width, height);
    gl.uniform1f(uniform("uTime"), seconds % period);
    gl.uniform3f(uniform("uColor"), ...color);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.LINES, 0, count);
  };
}

// Without WebGL2: the faint fibres once, on a 2D canvas.
export function paintStill(ctx: CanvasRenderingContext2D, fibres: Fibre[], color: Rgb) {
  const { width, height } = ctx.canvas;
  const cover = coverTransform(width, height);
  const [r, g, b] = color.map((c) => Math.round(c * 255));

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = Math.max(1, cover.scale * 0.8);

  for (const { points, seed } of fibres) {
    ctx.strokeStyle = `rgb(${r} ${g} ${b} / ${0.12 + 0.1 * seed})`;
    ctx.beginPath();

    for (let s = 0; s < points.length / 2; s++) {
      const x = (points[s * 2] ?? 0) * cover.scale + cover.x;
      const y = (points[s * 2 + 1] ?? 0) * cover.scale + cover.y;

      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }
}
