class LiquidBand {
  constructor(canvas, colors, mode = 'obstacle') {
    this.canvas = canvas;
    this.colors = colors.map(this.hexToRgb01);
    this.mode = mode;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    });

    this.timeScale = 0.00038;
    this.dprCap = 1.5;

    if (!this.gl) return;

    this.program = this.createProgram(this.vertexSource(), this.fragmentSource());
    this.uTime = this.gl.getUniformLocation(this.program, 'uTime');
    this.uResolution = this.gl.getUniformLocation(this.program, 'uResolution');
    this.uPalette = this.gl.getUniformLocation(this.program, 'uPalette');
    this.uObstacleCenter = this.gl.getUniformLocation(this.program, 'uObstacleCenter');
    this.uObstacleSize = this.gl.getUniformLocation(this.program, 'uObstacleSize');
    this.uObstacleRadius = this.gl.getUniformLocation(this.program, 'uObstacleRadius');
    this.uObstacleInfluence = this.gl.getUniformLocation(this.program, 'uObstacleInfluence');
    this.uUseObstacle = this.gl.getUniformLocation(this.program, 'uUseObstacle');

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    const quad = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, quad);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1
      ]),
      this.gl.STATIC_DRAW
    );

    const aPosition = this.gl.getAttribLocation(this.program, 'aPosition');
    this.gl.enableVertexAttribArray(aPosition);
    this.gl.vertexAttribPointer(aPosition, 2, this.gl.FLOAT, false, 0, 0);

    this.resize();
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.gl.viewport(0, 0, w, h);
  }

  render(timeMs) {
    if (!this.gl) return;

    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const minDim = Math.min(w, h);

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const obstacleSize = h * 0.20; // icon height
    const obstacleRadius = obstacleSize * 0.20;
    const obstacleInfluence = obstacleSize * 1.7;

    gl.uniform1f(this.uTime, timeMs * this.timeScale);
    gl.uniform2f(this.uResolution, w, h);
    gl.uniform2f(this.uObstacleCenter, w * 0.5, h * 0.4);
    gl.uniform1f(this.uObstacleSize, obstacleSize);
    gl.uniform1f(this.uObstacleRadius, obstacleRadius);
    gl.uniform1f(this.uObstacleInfluence, obstacleInfluence);
    gl.uniform1i(this.uUseObstacle, this.mode === 'obstacle' ? 1 : 0);
    gl.uniform3fv(this.uPalette, new Float32Array(this.colors.flat()));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  hexToRgb01(hex) {
    const h = hex.trim().replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255
    ];
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) || 'Shader compile error');
    }
    return shader;
  }

  createProgram(vsSource, fsSource) {
    const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(this.gl.getProgramInfoLog(program) || 'Program link error');
    }

    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);
    return program;
  }

  vertexSource() {
    return `#version 300 es
      in vec2 aPosition;
      out vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;
  }

  fragmentSource() {
    return `#version 300 es
      precision highp float;

      in vec2 vUv;
      out vec4 outColor;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uPalette[4];
      uniform vec2 uObstacleCenter;
      uniform float uObstacleSize;
      uniform float uObstacleRadius;
      uniform float uObstacleInfluence;
      uniform int uUseObstacle;

      float clamp01(float x) {
        return clamp(x, 0.0, 1.0);
      }

      float smooth01(float x) {
        x = clamp01(x);
        return x * x * (3.0 - 2.0 * x);
      }

      float sdRoundedRect(vec2 p, vec2 center, vec2 size, float radius) {
        vec2 d = abs(p - center) - (size * 0.5 - radius);
        vec2 q = max(d, 0.0);
        return length(q) + min(max(d.x, d.y), 0.0) - radius;
      }

      vec3 srgbToLinear(vec3 c) {
        vec3 cutoff = step(vec3(0.04045), c);
        vec3 lower = c / 12.92;
        vec3 higher = pow((c + 0.055) / 1.055, vec3(2.4));
        return mix(lower, higher, cutoff);
      }

      vec3 linearToSrgb(vec3 c) {
        c = max(c, vec3(0.0));
        vec3 cutoff = step(vec3(0.0031308), c);
        vec3 lower = 12.92 * c;
        vec3 higher = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
        return clamp(mix(lower, higher, cutoff), 0.0, 1.0);
      }

      vec3 rgbToOklab(vec3 rgb) {
        vec3 lrgb = srgbToLinear(rgb);

        float l = 0.4122214708 * lrgb.r + 0.5363325363 * lrgb.g + 0.0514459929 * lrgb.b;
        float m = 0.2119034982 * lrgb.r + 0.6806995451 * lrgb.g + 0.1073969566 * lrgb.b;
        float s = 0.0883024619 * lrgb.r + 0.2817188376 * lrgb.g + 0.6299787005 * lrgb.b;

        float l_ = pow(max(l, 0.0), 1.0 / 3.0);
        float m_ = pow(max(m, 0.0), 1.0 / 3.0);
        float s_ = pow(max(s, 0.0), 1.0 / 3.0);

        return vec3(
          0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
          1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
          0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        );
      }

      vec3 oklabToRgb(vec3 lab) {
        float L = lab.x;
        float a = lab.y;
        float b = lab.z;

        float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        float s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        float l = l_ * l_ * l_;
        float m = m_ * m_ * m_;
        float s = s_ * s_ * s_;

        vec3 linear = vec3(
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
         -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
         -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        );

        return linearToSrgb(linear);
      }

      vec3 rgbToOklch(vec3 rgb) {
        vec3 lab = rgbToOklab(rgb);
        float C = length(lab.yz);
        float H = atan(lab.z, lab.y);
        if (H < 0.0) H += 6.28318530718;
        return vec3(lab.x, C, H);
      }

      vec3 oklchToRgb(vec3 lch) {
        float a = lch.y * cos(lch.z);
        float b = lch.y * sin(lch.z);
        return oklabToRgb(vec3(lch.x, a, b));
      }

      float lerpAngle(float a0, float a1, float t) {
        float d = mod(a1 - a0, 6.28318530718);
        if (d > 3.14159265359) d -= 6.28318530718;
        if (d < -3.14159265359) d += 6.28318530718;
        return a0 + d * t;
      }

      vec3 paletteSample(float h) {
        vec3 c0 = rgbToOklch(uPalette[0]);
        vec3 c1 = rgbToOklch(uPalette[1]);
        vec3 c2 = rgbToOklch(uPalette[2]);
        vec3 c3 = rgbToOklch(uPalette[3]);

        h = clamp01(h);

        vec3 a;
        vec3 b;
        float t;

        if (h < 0.3333333) {
          t = h / 0.3333333;
          a = c0;
          b = c1;
        } else if (h < 0.6666666) {
          t = (h - 0.3333333) / 0.3333333;
          a = c1;
          b = c2;
        } else {
          t = (h - 0.6666666) / 0.3333334;
          a = c2;
          b = c3;
        }

        t = smooth01(t);

        float L = mix(a.x, b.x, t);
        float C = mix(a.y, b.y, t);
        float H = lerpAngle(a.z, b.z, t);

        return oklchToRgb(vec3(L, C, H));
      }

      vec2 applyObstacle(vec2 frag, float t) {
        if (uUseObstacle == 0) return frag;

        float dist = sdRoundedRect(
          frag,
          uObstacleCenter,
          vec2(uObstacleSize),
          uObstacleRadius
        );

        float normDist = max(dist, 0.0) / uObstacleInfluence;
        float avoid = exp(-normDist * normDist * 4.5);

        vec2 warpedFrag = frag;

        if (avoid > 0.0005) {
          float e = 1.0;

          float gx =
            sdRoundedRect(frag + vec2(e, 0.0), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius) -
            sdRoundedRect(frag - vec2(e, 0.0), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius);

          float gy =
            sdRoundedRect(frag + vec2(0.0, e), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius) -
            sdRoundedRect(frag - vec2(0.0, e), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius);

          vec2 n = normalize(vec2(gx, gy) + 1e-6);
          vec2 tangent = vec2(-n.y, n.x);

          float edgeBoost = 1.0 + exp(-max(dist, 0.0) * 0.08) * 0.8;
          float push = avoid * uObstacleInfluence * 0.9 * edgeBoost;
          float swirl = sin(t * 0.9) * avoid * 22.0;

          warpedFrag += n * push + tangent * swirl;
        }

        return warpedFrag;
      }

      float fluidHeight(vec2 frag, float t) {
        vec2 warpedFrag = applyObstacle(frag, t);
        vec2 p = warpedFrag / uResolution - 0.5;
        float radial = length(p);

        float v1 = sin(p.x * 6.0 + t * 0.9);
        float v2 = sin(p.y * 7.0 - t * 1.1);
        float v3 = sin(p.x * 4.0 + p.y * 5.0 + t * 0.7);
        float v4 = sin(radial * 12.0 - t * 1.4);
        float v5 = sin(p.x * 10.0 - p.y * 8.0 + t * 0.5);

        float warpX = p.x + 0.12 * v2 + 0.08 * v4;
        float warpY = p.y + 0.12 * v1 - 0.08 * v3;

        float w1 = sin(warpX * 9.0 + t * 1.2);
        float w2 = sin(warpY * 9.0 - t * 1.0);
        float w3 = sin(warpX * 6.0 + warpY * 6.0 + t * 0.8);
        float w4 = sin(warpX * 14.0 - warpY * 10.0 - t * 0.6);

        float sum =
          0.22 * v1 +
          0.18 * v2 +
          0.20 * v3 +
          0.12 * v4 +
          0.10 * v5 +
          0.08 * w1 +
          0.05 * w2 +
          0.03 * w3 +
          0.02 * w4;

        return clamp01(sum * 0.5 + 0.5);
      }

      void main() {
        vec2 frag = vUv * uResolution;
        float h = smooth01(fluidHeight(frag, uTime));
        vec3 color = paletteSample(h);
        outColor = vec4(color, 1.0);
      }
    `;
  }
}

(function () {
  const canvases = document.querySelectorAll('[data-liquid]');
  if (!canvases.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instances = [];

  canvases.forEach(canvas => {
    const colors = (canvas.dataset.colors || '').split(',').map(s => s.trim()).filter(Boolean);
    const mode = canvas.dataset.mode || 'obstacle';
    const instance = new LiquidBand(canvas, colors, mode);
    if (instance.gl) instances.push(instance);
  });

  function resizeAll() {
    instances.forEach(instance => instance.resize());
  }

  window.addEventListener('resize', resizeAll, {
    passive: true
  });

  if (reduceMotion) {
    instances.forEach(instance => instance.render(0));
    return;
  }

  function frame(time) {
    for (const instance of instances) {
      instance.render(time * 2);
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();