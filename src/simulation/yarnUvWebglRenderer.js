import {
  getReadyYarnTextureImage,
  getYarnPbrMapSource,
  getYarnTextureSourceKey,
} from "./yarnTextureBrush.js";

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;
uniform vec2 u_resolution;
varying vec2 v_uv;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  v_uv = a_uv;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_baseColorMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_roughnessMap;
uniform sampler2D u_heightMap;
uniform sampler2D u_ambientOcclusionMap;
uniform sampler2D u_metallicMap;
uniform vec4 u_tint;
uniform float u_textureStrength;
uniform float u_fuzzStrength;
uniform bool u_hasBaseColorMap;
uniform bool u_hasNormalMap;
uniform bool u_hasRoughnessMap;
uniform bool u_hasHeightMap;
uniform bool u_hasAmbientOcclusionMap;
uniform bool u_hasMetallicMap;

varying vec2 v_uv;

void main() {
  vec4 base = u_tint;
  if (u_hasBaseColorMap) {
    base = mix(u_tint, texture2D(u_baseColorMap, v_uv), u_textureStrength);
  }

  float relief = 0.0;
  if (u_hasHeightMap) {
    relief += texture2D(u_heightMap, v_uv).r - 0.5;
  }
  if (u_hasNormalMap) {
    relief += texture2D(u_normalMap, v_uv).g - 0.5;
  }

  float roughness = u_hasRoughnessMap ? texture2D(u_roughnessMap, v_uv).r : 0.55;
  float ao = u_hasAmbientOcclusionMap ? texture2D(u_ambientOcclusionMap, v_uv).r : 1.0;
  float metallic = u_hasMetallicMap ? texture2D(u_metallicMap, v_uv).r : 0.0;
  float edge = smoothstep(0.0, 0.22, v_uv.y) * smoothstep(1.0, 0.78, v_uv.y);
  float highlight = max(0.0, relief * (1.0 - roughness));
  float alpha = base.a * mix(edge, 1.0, 1.0 - u_fuzzStrength * 0.35);

  // Only color the existing highlight; no new lighting/BRDF model. Black
  // nonmetallic maps preserve the previous formula exactly.
  vec3 highlightColor = mix(vec3(1.0), base.rgb, metallic);
  gl_FragColor = vec4((base.rgb + highlightColor * highlight * 0.22) * ao, alpha);
}
`;

const rendererCache = new WeakMap();
const TEXTURE_CACHE_LIMIT = 24;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unable to compile shader.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unable to link program.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function parseColor(color) {
  const source = String(color || "");
  const rgba = source.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgba) {
    return [
      Number(rgba[1]) / 255,
      Number(rgba[2]) / 255,
      Number(rgba[3]) / 255,
      rgba[4] === undefined ? 1 : Number(rgba[4]),
    ];
  }

  const hex = source.match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
      1,
    ];
  }

  return [0.75, 0.75, 0.75, 1];
}

export function materialMaps(material) {
  const texture = material?.texture || {};
  const pbr = texture.enabled === false ? {} : texture.pbr || {};
  return {
    baseColor:
      getYarnPbrMapSource(pbr.baseColor) ||
      (texture.enabled === false ? "" : texture.processedDataUrl || ""),
    normal: getYarnPbrMapSource(pbr.normal),
    roughness: getYarnPbrMapSource(pbr.roughness),
    height: getYarnPbrMapSource(pbr.height),
    ambientOcclusion: getYarnPbrMapSource(pbr.ambientOcclusion),
    metallic: getYarnPbrMapSource(pbr.metallic),
  };
}

export class YarnUvWebglRenderer {
  constructor(gl, targetContext = null) {
    this.gl = gl;
    this.targetContext = targetContext;
    this.program = createProgram(gl);
    this.textureCache = new Map();
    this.fallbackTexture = this.createSolidTexture([255, 255, 255, 255]);
    this.locations = {
      position: gl.getAttribLocation(this.program, "a_position"),
      uv: gl.getAttribLocation(this.program, "a_uv"),
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      baseColorMap: gl.getUniformLocation(this.program, "u_baseColorMap"),
      normalMap: gl.getUniformLocation(this.program, "u_normalMap"),
      roughnessMap: gl.getUniformLocation(this.program, "u_roughnessMap"),
      heightMap: gl.getUniformLocation(this.program, "u_heightMap"),
      metallicMap: gl.getUniformLocation(this.program, "u_metallicMap"),
      hasMetallicMap: gl.getUniformLocation(this.program, "u_hasMetallicMap"),
      ambientOcclusionMap: gl.getUniformLocation(
        this.program,
        "u_ambientOcclusionMap"
      ),
      tint: gl.getUniformLocation(this.program, "u_tint"),
      textureStrength: gl.getUniformLocation(
        this.program,
        "u_textureStrength"
      ),
      fuzzStrength: gl.getUniformLocation(this.program, "u_fuzzStrength"),
      hasBaseColorMap: gl.getUniformLocation(
        this.program,
        "u_hasBaseColorMap"
      ),
      hasNormalMap: gl.getUniformLocation(this.program, "u_hasNormalMap"),
      hasRoughnessMap: gl.getUniformLocation(
        this.program,
        "u_hasRoughnessMap"
      ),
      hasHeightMap: gl.getUniformLocation(this.program, "u_hasHeightMap"),
      hasAmbientOcclusionMap: gl.getUniformLocation(
        this.program,
        "u_hasAmbientOcclusionMap"
      ),
    };

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  createSolidTexture(pixel) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(pixel)
    );
    return texture;
  }

  evictOldestTexture() {
    const oldestKey = this.textureCache.keys().next().value;
    if (oldestKey === undefined) return;
    const record = this.textureCache.get(oldestKey);
    this.gl.deleteTexture(record.texture);
    this.textureCache.delete(oldestKey);
  }

  retainTextures(sources) {
    const retained = new Set(sources.map(getYarnTextureSourceKey));
    this.activeTextureKeys = retained;
    for (const [key, record] of this.textureCache) {
      if (retained.has(key)) continue;
      this.gl.deleteTexture(record.texture);
      this.textureCache.delete(key);
    }
  }

  textureFromDataUrl(source) {
    const key = getYarnTextureSourceKey(source);
    if (!key) return null;

    const cached = this.textureCache.get(key);
    if (cached) {
      this.textureCache.delete(key);
      this.textureCache.set(key, cached);
      return cached.texture;
    }

    const image = getReadyYarnTextureImage(source);
    if (!image) return null;

    // WebGL1 repeating textures require power-of-two dimensions. Keep the
    // source key and existing UVs; resample only the GPU upload when needed.
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    let uploadImage = image;
    if (width > 0 && height > 0 &&
      ((width & (width - 1)) !== 0 || (height & (height - 1)) !== 0)) {
      uploadImage = document.createElement("canvas");
      uploadImage.width = 2 ** Math.ceil(Math.log2(width));
      uploadImage.height = 2 ** Math.ceil(Math.log2(height));
      uploadImage.getContext("2d").drawImage(image, 0, 0, uploadImage.width, uploadImage.height);
    }

    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      uploadImage
    );
    this.textureCache.set(key, { texture });
    while (this.textureCache.size > Math.max(TEXTURE_CACHE_LIMIT, this.activeTextureKeys?.size || 0)) {
      this.evictOldestTexture();
    }
    return texture;
  }

  clear(width, height) {
    const gl = this.gl;
    gl.canvas.width = width;
    gl.canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  bindArrayBuffer(location, data, size) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return buffer;
  }

  bindTexture(unit, location, texture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture || this.fallbackTexture);
    gl.uniform1i(location, unit);
  }

  drawStrip(strip, material = {}) {
    if (!strip?.indices?.length) return false;

    const gl = this.gl;
    gl.useProgram(this.program);

    const positionBuffer = this.bindArrayBuffer(
      this.locations.position,
      strip.positions,
      2
    );
    const uvBuffer = this.bindArrayBuffer(this.locations.uv, strip.uvs, 2);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, strip.indices, gl.STATIC_DRAW);

    gl.uniform2f(
      this.locations.resolution,
      gl.canvas.width || 1,
      gl.canvas.height || 1
    );
    gl.uniform4fv(
      this.locations.tint,
      parseColor(material.sequenceMaskColor || material.color)
    );
    gl.uniform1f(
      this.locations.textureStrength,
      Number(material.texture?.textureStrength) || 0.75
    );
    gl.uniform1f(
      this.locations.fuzzStrength,
      Number(material.texture?.fuzzStrength) || 0
    );

    const maps = materialMaps(material);
    const textures = {
      baseColor: this.textureFromDataUrl(maps.baseColor),
      normal: this.textureFromDataUrl(maps.normal),
      roughness: this.textureFromDataUrl(maps.roughness),
      height: this.textureFromDataUrl(maps.height),
      ambientOcclusion: this.textureFromDataUrl(maps.ambientOcclusion),
      metallic: this.textureFromDataUrl(maps.metallic),
    };

    this.bindTexture(0, this.locations.baseColorMap, textures.baseColor);
    this.bindTexture(1, this.locations.normalMap, textures.normal);
    this.bindTexture(2, this.locations.roughnessMap, textures.roughness);
    this.bindTexture(3, this.locations.heightMap, textures.height);
    this.bindTexture(5, this.locations.metallicMap, textures.metallic);
    gl.uniform1i(this.locations.hasMetallicMap, textures.metallic ? 1 : 0);
    this.bindTexture(
      4,
      this.locations.ambientOcclusionMap,
      textures.ambientOcclusion
    );

    gl.uniform1i(this.locations.hasBaseColorMap, textures.baseColor ? 1 : 0);
    gl.uniform1i(this.locations.hasNormalMap, textures.normal ? 1 : 0);
    gl.uniform1i(this.locations.hasRoughnessMap, textures.roughness ? 1 : 0);
    gl.uniform1i(this.locations.hasHeightMap, textures.height ? 1 : 0);
    gl.uniform1i(
      this.locations.hasAmbientOcclusionMap,
      textures.ambientOcclusion ? 1 : 0
    );

    gl.drawElements(gl.TRIANGLES, strip.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(uvBuffer);
    gl.deleteBuffer(indexBuffer);
    return true;
  }

  flush() {
    if (!this.targetContext) return;
    this.targetContext.drawImage(this.gl.canvas, 0, 0);
  }

  dispose() {
    const gl = this.gl;
    this.textureCache.forEach((record) => gl.deleteTexture(record.texture));
    this.textureCache.clear();
    gl.deleteTexture(this.fallbackTexture);
    gl.deleteProgram(this.program);
  }
}

export function retainWebglYarnTextures(canvas, sources) {
  rendererCache.get(canvas)?.retainTextures(sources);
}

export function getWebglYarnRenderer(canvas) {
  if (!canvas || typeof document === "undefined") return null;
  const cached = rendererCache.get(canvas);
  if (cached) return cached;

  const targetContext = canvas.getContext?.("2d");
  const webglCanvas = document.createElement("canvas");
  const gl = webglCanvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  if (!gl || !targetContext) return null;

  try {
    const renderer = new YarnUvWebglRenderer(gl, targetContext);
    rendererCache.set(canvas, renderer);
    return renderer;
  } catch (error) {
    console.warn("WebGL yarn texture renderer unavailable.", error);
    return null;
  }
}
