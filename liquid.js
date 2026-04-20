const Liquid = (() => {
  let gl;
  let canvas;
  let program;
  let vao;
  let texture;

  let uTime;
  let uResolution;
  let uObstacleCenter;
  let uObstacleSize;
  let uObstacleRadius;
  let uObstacleInfluence;
  let uGradient;
  let uImage;
  let uImageLoaded;

  let imageLoaded = false;

  const obstacleImage = new Image();
  obstacleImage.src = "openmusic_icon.webp";

  const state = {
    width: 0,
    height: 0,
    obstacle: null,
    gradient: null
  };

  function init(targetCanvas, context) {
    canvas = targetCanvas;
    gl = context;

    if (!gl) {
      throw new Error("WebGL2 is not available.");
    }

    state.width = canvas.width;
    state.height = canvas.height;

    state.obstacle = {
      x: state.width * 0.5,
      y: state.height * 0.5,
      size: Math.round(state.width * 0.1),
      radius: Math.round(state.width * 0.04),
      influence: Math.round(state.width * 0.32)
    };

    state.gradient = getGradientFromCSS();

    program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);

    uTime = gl.getUniformLocation(program, "uTime");
    uResolution = gl.getUniformLocation(program, "uResolution");
    uObstacleCenter = gl.getUniformLocation(program, "uObstacleCenter");
    uObstacleSize = gl.getUniformLocation(program, "uObstacleSize");
    uObstacleRadius = gl.getUniformLocation(program, "uObstacleRadius");
    uObstacleInfluence = gl.getUniformLocation(program, "uObstacleInfluence");
    uGradient = gl.getUniformLocation(program, "uGradient");
    uImage = gl.getUniformLocation(program, "uImage");
    uImageLoaded = gl.getUniformLocation(program, "uImageLoaded");

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
      ]),
      gl.STATIC_DRAW
    );

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Temporary 1x1 black pixel until the image is loaded.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    obstacleImage.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        obstacleImage
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      imageLoaded = true;
    };

    gl.useProgram(program);
    gl.uniform1i(uImage, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, state.width, state.height);
  }

  function step(timeMs) {
    if (!gl) return;

    // Re-read CSS vars in case you edited them live.
    state.gradient = getGradientFromCSS();

    gl.viewport(0, 0, state.width, state.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1f(uTime, timeMs * 0.0005);
    gl.uniform2f(uResolution, state.width, state.height);

    gl.uniform2f(
      uObstacleCenter,
      state.obstacle.x,
      state.obstacle.y
    );

    gl.uniform1f(uObstacleSize, state.obstacle.size);
    gl.uniform1f(uObstacleRadius, state.obstacle.radius);
    gl.uniform1f(uObstacleInfluence, state.obstacle.influence);

    gl.uniform3fv(uGradient, flattenGradient(state.gradient));
    gl.uniform1i(uImageLoaded, imageLoaded ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function getGradientFromCSS() {
    const styles = getComputedStyle(document.documentElement);
    return ["--c1", "--c2", "--c3", "--c4"].map((name) => {
      const raw = styles.getPropertyValue(name).trim();
      return hexToRgb(raw).map((v) => v / 255);
    });
  }

  function flattenGradient(colors) {
    const out = new Float32Array(12);
    for (let i = 0; i < 4; i++) {
      out[i * 3 + 0] = colors[i][0];
      out[i * 3 + 1] = colors[i][1];
      out[i * 3 + 2] = colors[i][2];
    }
    return out;
  }

  function hexToRgb(hex) {
    hex = String(hex).trim().replace("#", "");
    if (hex.length === 3) {
      hex = hex.split("").map((ch) => ch + ch).join("");
    }
    const num = parseInt(hex, 16);
    return [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255
    ];
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Shader compile error:\n" + info);
    }

    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("Program link error:\n" + info);
    }

    return program;
  }

  const VERTEX_SHADER_SOURCE = `#version 300 es
    in vec2 aPosition;
    out vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER_SOURCE = `#version 300 es
    precision highp float;

    in vec2 vUv;
    out vec4 outColor;

    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uObstacleCenter;
    uniform float uObstacleSize;
    uniform float uObstacleRadius;
    uniform float uObstacleInfluence;
    uniform vec3 uGradient[4];
    uniform sampler2D uImage;
    uniform int uImageLoaded;

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

    vec3 gradientSample(float h) {
      vec3 c0 = rgbToOklch(uGradient[0]);
      vec3 c1 = rgbToOklch(uGradient[1]);
      vec3 c2 = rgbToOklch(uGradient[2]);
      vec3 c3 = rgbToOklch(uGradient[3]);

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

    float heightField(vec2 p, float t) {
      float dist = sdRoundedRect(
        p,
        uObstacleCenter,
        vec2(uObstacleSize),
        uObstacleRadius
      );

      float normDist = max(dist, 0.0) / uObstacleInfluence;
      float avoid = exp(-normDist * normDist * 4.5);

      vec2 ax = p;

      if (avoid > 0.0005) {
        float e = 1.0;

        float gx =
          sdRoundedRect(p + vec2(e, 0.0), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius) -
          sdRoundedRect(p - vec2(e, 0.0), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius);

        float gy =
          sdRoundedRect(p + vec2(0.0, e), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius) -
          sdRoundedRect(p - vec2(0.0, e), uObstacleCenter, vec2(uObstacleSize), uObstacleRadius);

        vec2 n = normalize(vec2(gx, gy) + 1e-6);
        vec2 tangent = vec2(-n.y, n.x);

        float edgeBoost = 1.0 + exp(-max(dist, 0.0) * 0.08) * 0.8;
        float push = avoid * uObstacleInfluence * 0.9 * edgeBoost;
        float swirl = sin(t * 0.9) * avoid * 22.0;

        ax += n * push + tangent * swirl;
      }

      vec2 np = ax / uResolution - 0.5;
      float radial = length(np);

      float v1 = sin(np.x * 6.0 + t * 0.9);
      float v2 = sin(np.y * 7.0 - t * 1.1);
      float v3 = sin(np.x * 4.0 + np.y * 5.0 + t * 0.7);
      float v4 = sin(radial * 12.0 - t * 1.4);
      float v5 = sin(np.x * 10.0 - np.y * 8.0 + t * 0.5);

      float warpX = np.x + 0.12 * v2 + 0.08 * v4;
      float warpY = np.y + 0.12 * v1 - 0.08 * v3;

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

      float dist = sdRoundedRect(
        frag,
        uObstacleCenter,
        vec2(uObstacleSize),
        uObstacleRadius
      );

      if (dist < 0.0 && uImageLoaded == 1) {
        vec2 minCorner = uObstacleCenter - vec2(uObstacleSize * 0.5);
        vec2 uv = (frag - minCorner) / uObstacleSize;
        vec3 img = texture(uImage, uv).rgb;

        // subtle outline
        float border = smoothstep(2.0, 0.0, abs(dist));
        img = mix(img, vec3(1.0), border * 0.18);

        outColor = vec4(img, 1.0);
        return;
      }

      float h = heightField(frag, uTime);
      h = smooth01(h);
      vec3 color = gradientSample(h);

      outColor = vec4(color, 1.0);
    }
  `;

  return {
    init,
    step
  };
})();