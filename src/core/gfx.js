import * as THREE from '../../vendor/three.module.js';
import { RNG } from './util.js';

function canvasTex(size, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const detail = canvasTex(64, (g, S) => {
  const r = RNG(77);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = 196 + r() * 59 | 0;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 110; i++) {
    const v = r() < .55 ? 150 + r() * 34 | 0 : 255;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * S | 0, r() * S | 0, 1 + r() * 3 | 0, 1 + r() * 2 | 0);
  }
});

const cobble = canvasTex(64, (g, S) => {
  const r = RNG(31);
  g.fillStyle = '#34304f'; g.fillRect(0, 0, S, S);
  const n = 5, cell = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n + 1; x++) {
    const ox = (y % 2) * cell / 2, cx = x * cell + ox, cy = y * cell + cell / 2;
    const v = 150 + r() * 95 | 0, w = cell * .43, h = cell * .38;
    for (const dx of [0, -S]) {
      g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 12)})`;
      g.fillRect(cx + dx - w, cy - h + 1, w * 2, h * 2 - 2);
      g.fillRect(cx + dx - w + 1, cy - h, w * 2 - 2, h * 2);
      g.fillStyle = 'rgba(255,240,205,.45)';
      g.fillRect(cx + dx - w + 2, cy - h + 1, w, 1);
    }
  }
});

const waterTex = canvasTex(64, (g, S) => {
  const r = RNG(5);
  g.fillStyle = '#2a4bb4'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = ['#3b63d6', '#1f3a96', '#6d92f2', '#27409f'][r() * 4 | 0];
    g.fillRect(r() * S | 0, r() * S | 0, 3 + r() * 10 | 0, 1);
  }
}, 80, 80);

/** Gemeinsame Werte für alle Materialien: Zeit für den Wind und das Himmelslicht an den Kanten. */
export const GFX = { time: { value: 0 }, rimColor: { value: new THREE.Color(0x7a88ff) }, rim: { value: .5 } };

export function psx(m, { glow = true, snap = true, macro = false } = {}) {
  m.onBeforeCompile = s => {
    s.uniforms.uTime = GFX.time; s.uniforms.uRimC = GFX.rimColor; s.uniforms.uRim = GFX.rim;
    if (macro) s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= .74 + .46 * texture2D(map, vMapUv * .137).r * texture2D(map, vMapUv * .031).r;');
    if (glow) {
      s.vertexShader = 'attribute float aGlow; varying float vGlow; uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlow = aGlow;
        #ifdef USE_INSTANCING
          float wH = max(position.y, 0.), wA = wH * (.024 + .1 / (1. + wH * wH * .2));
          vec3 wP = instanceMatrix[3].xyz;
          transformed.x += sin(uTime * 1.5 + wP.x * .31 + wP.z * .17) * wA;
          transformed.z += cos(uTime * 1.15 + wP.z * .27 + wP.x * .11) * wA * .7;
        #endif`);
      s.fragmentShader = 'varying float vGlow; uniform vec3 uRimC; uniform float uRim;\n' + s.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 litCap = diffuseColor.rgb * 1.15, litRoom = max(diffuseColor.rgb * .42, vec3(.001));
        outgoingLight = min(outgoingLight, litCap) + litRoom * (1. - exp(-max(outgoingLight - litCap, vec3(0.)) / litRoom));
        float rimK = pow(1. - clamp(dot(normalize(vViewPosition), normal), 0., 1.), 3.2);
        outgoingLight += (uRimC * diffuseColor.rgb * 1.5 + uRimC * .05) * rimK * uRim;
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.5, vGlow);
        #include <opaque_fragment>`);
    }
    if (snap) {
      s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        if (gl_Position.w > 0.) { vec2 sg = vec2(520., 292.); vec2 sq = gl_Position.xy / gl_Position.w; sq = floor(sq * sg + .5) / sg; gl_Position.xy = sq * gl_Position.w; }`);
    }
  };
  m.customProgramCacheKey = () => `psx2-${glow}-${snap}-${macro}`;
  return m;
}

export const MAT = {
  solid: psx(new THREE.MeshLambertMaterial({ vertexColors: true, map: detail })),
  terrain: psx(new THREE.MeshLambertMaterial({ vertexColors: true, map: detail, flatShading: true }), { glow: false, macro: true }),
  road: psx(new THREE.MeshLambertMaterial({ vertexColors: true, map: cobble, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), { glow: false }),
  flash: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  water: new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: GFX.time, uSky: { value: new THREE.Color(0x5a78bc) }, uDeep: { value: new THREE.Color(0x0c2f86) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uGlint: { value: new THREE.Color(0xffe0a8) } },
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSky, uDeep, uSun, uGlint; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
      void main() {
        vec2 p = floor(vW.xz * 1.7) / 1.7;
        float a = n(p * .13 + uTime * vec2(.09, .05)), b = n(p * .29 - uTime * vec2(.07, .11)), w = a * .6 + b * .4;
        vec3 N = normalize(vec3((a - .5) * .42, 1., (b - .5) * .42)), V = normalize(cameraPosition - vW);
        float fres = pow(1. - max(dot(N, V), 0.), 3.);
        vec3 c = mix(uDeep, uSky, .16 + fres * .84);
        c += step(.69, w) * uSky * .16 + step(.8, w) * vec3(.16);
        c += pow(max(dot(reflect(-uSun, N), V), 0.), 90.) * uGlint * 2.4;
        gl_FragColor = vec4(c, .84);
        #include <fog_fragment>
      }`,
  }),
  decal: new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
};
export { waterTex };

const templates = new Map();
function tpl(key, make) {
  let t = templates.get(key);
  if (!t) {
    const g = make(); const ng = g.index ? g.toNonIndexed() : g;
    ng.computeBoundingBox();
    t = { pos: ng.attributes.position.array, y0: ng.boundingBox.min.y, y1: ng.boundingBox.max.y };
    templates.set(key, t);
  }
  return t;
}
function prismGeo() {
  const v = [[-.5, 0, .5], [.5, 0, .5], [0, 1, .5], [-.5, 0, -.5], [.5, 0, -.5], [0, 1, -.5]];
  const f = [0, 1, 2, 4, 3, 5, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2, 0, 3, 4, 0, 4, 1];
  const p = new Float32Array(f.length * 3);
  f.forEach((id, i) => p.set(v[id], i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return g;
}

const M0 = new THREE.Matrix4(), M1 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(),
  P = new THREE.Vector3(), S = new THREE.Vector3(), V = new THREE.Vector3(), C = new THREE.Color(), C2 = new THREE.Color();

export class Kit {
  constructor(seed = 1) { this.p = []; this.c = []; this.g = []; this.r = RNG(seed); this.stack = []; this.base = new THREE.Matrix4(); }
  at(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0) {
    this.stack.push(this.base.clone());
    E.set(rx, ry, 0); Q.setFromEuler(E);
    this.base.multiply(M1.compose(P.set(x, y, z), Q, S.setScalar(s)));
    return this;
  }
  pop() { this.base.copy(this.stack.pop()); return this; }
  add(t, x, y, z, sx, sy, sz, col, o = {}) {
    E.set(o.rx || 0, o.ry || 0, o.rz || 0); Q.setFromEuler(E);
    M0.compose(P.set(x, y, z), Q, S.set(sx, sy, sz)).premultiply(this.base);
    C.set(col); if (o.c2 !== undefined) C2.set(o.c2);
    const a = t.pos, j = o.j ?? .07, glow = o.glow || 0;
    let f = 1;
    for (let i = 0; i < a.length; i += 3) {
      if (i % 9 === 0) f = 1 + (this.r() - .5) * j * 2;
      V.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(M0);
      this.p.push(V.x, V.y, V.z);
      let r = C.r, g = C.g, b = C.b;
      if (o.c2 !== undefined) {
        const k = (a[i + 1] - t.y0) / ((t.y1 - t.y0) || 1);
        r += (C2.r - r) * k; g += (C2.g - g) * k; b += (C2.b - b) * k;
      }
      this.c.push(r * f, g * f, b * f);
      this.g.push(glow);
    }
    return this;
  }
  box(w, h, d, x, y, z, c, o) { return this.add(tpl('box', () => new THREE.BoxGeometry(1, 1, 1)), x, y, z, w, h, d, c, o); }
  cyl(rt, rb, h, x, y, z, c, o = {}) {
    const n = o.seg || 8, m = Math.max(rt, rb) || 1;
    const key = `cyl${(rt / m).toFixed(2)}_${(rb / m).toFixed(2)}_${n}`;
    return this.add(tpl(key, () => new THREE.CylinderGeometry(rt / m, rb / m, 1, n, 1)), x, y, z, m, h, m, c, o);
  }
  cone(r, h, x, y, z, c, o = {}) { return this.cyl(0, r, h, x, y, z, c, o); }
  ball(r, x, y, z, c, o = {}) {
    const n = o.seg || 8, key = `ball${n}`;
    return this.add(tpl(key, () => new THREE.SphereGeometry(1, n, Math.max(4, n - 2))), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o);
  }
  dome(r, x, y, z, c, o = {}) {
    const n = o.seg || 10, key = `dome${n}`;
    return this.add(tpl(key, () => new THREE.SphereGeometry(1, n, 5, 0, Math.PI * 2, 0, Math.PI / 2)), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o);
  }
  oct(r, x, y, z, c, o = {}) { return this.add(tpl('oct', () => new THREE.OctahedronGeometry(1)), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o); }
  ico(r, x, y, z, c, o = {}) { return this.add(tpl('ico', () => new THREE.IcosahedronGeometry(1, 0)), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o); }
  blob(r, x, y, z, c, o = {}) { return this.add(tpl('blob', () => new THREE.IcosahedronGeometry(1, 1)), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o); }
  torus(R, t, x, y, z, c, o = {}) {
    const key = `tor${(t / R).toFixed(2)}_${o.arc || 'f'}`;
    return this.add(tpl(key, () => new THREE.TorusGeometry(1, t / R, 5, o.seg || 14, o.arc || Math.PI * 2)), x, y, z, R, R, R, c, o);
  }
  prism(w, h, d, x, y, z, c, o) { return this.add(tpl('prism', prismGeo), x, y, z, w, h, d, c, o); }
  build() {
    const n = this.p.length / 3, pos = new Float32Array(this.p), col = new Float32Array(this.c), glow = new Float32Array(this.g);
    const nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i += 3) {
      const a = i * 3, ux = pos[a + 3] - pos[a], uy = pos[a + 4] - pos[a + 1], uz = pos[a + 5] - pos[a + 2],
        vx = pos[a + 6] - pos[a], vy = pos[a + 7] - pos[a + 1], vz = pos[a + 8] - pos[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) {
        const b = (i + k) * 3;
        nor[b] = nx; nor[b + 1] = ny; nor[b + 2] = nz;
        if (Math.abs(ny) > .72) { uv[(i + k) * 2] = pos[b] * .3; uv[(i + k) * 2 + 1] = pos[b + 2] * .3; }
        else { uv[(i + k) * 2] = (pos[b] + pos[b + 2]) * .3; uv[(i + k) * 2 + 1] = pos[b + 1] * .3; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    g.computeBoundingSphere();
    this.p = []; this.c = []; this.g = [];
    return g;
  }
  mesh(mat = MAT.solid) { return new THREE.Mesh(this.build(), mat); }
}

const postFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tex;
uniform vec2 res;
uniform float hurt, fade, flash, time, warm, levels, shaft;
uniform vec2 sunPos;
uniform vec3 shaftC;
float bayer(vec2 p){
  ivec2 i = ivec2(mod(p, 4.));
  int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  return float(m[i.y * 4 + i.x]) / 16. - .47;
}
void main(){
  vec2 px = 1. / res;
  vec3 c = texture2D(tex, vUv).rgb;
  vec3 n = texture2D(tex, vUv + vec2(px.x,0.)).rgb + texture2D(tex, vUv - vec2(px.x,0.)).rgb
         + texture2D(tex, vUv + vec2(0.,px.y)).rgb + texture2D(tex, vUv - vec2(0.,px.y)).rgb;
  c = max(c + (c * 4. - n) * .13, 0.);
  vec3 glow = vec3(0.);
  for (float a = 0.; a < 6.28; a += .785) {
    vec2 d = vec2(cos(a), sin(a)) * px;
    glow += max(texture2D(tex, vUv + d * 2.5).rgb - .74, 0.) + max(texture2D(tex, vUv + d * 6.).rgb - .74, 0.) * .75 + max(texture2D(tex, vUv + d * 12.).rgb - .8, 0.) * .5;
  }
  c += glow * .085;
  if (shaft > .01) {
    vec2 st = (sunPos - vUv) / 16., u = vUv + st * fract(sin(dot(gl_FragCoord.xy, vec2(12.9, 78.2))) * 437.5);
    float dec = 1., rays = 0.;
    for (int i = 0; i < 16; i++) { u += st; vec3 t = texture2D(tex, u).rgb; rays += max(dot(t, vec3(.33)) - .62, 0.) * dec; dec *= .91; }
    c += shaftC * rays * shaft * .085;
  }
  c = c / (1. + c * .12);
  c = pow(c, vec3(1. / 2.2));
  float l = dot(c, vec3(.299,.587,.114));
  c = mix(vec3(l), c, 1.3);
  c = clamp((c - .5) * 1.14 + .5, 0., 1.);
  c += mix(vec3(-.012, -.004, .034), vec3(.032, .012, -.022), smoothstep(.12, .82, l));
  c.r += warm * .035; c.b -= warm * .025;
  vec2 q = vUv - .5;
  float v = smoothstep(.86, .3, length(q * vec2(1.05, 1.)));
  c *= mix(.6, 1., v);
  c = mix(c, vec3(.75,.04,.05), hurt * (1. - v) * .9);
  c = floor(c * levels + bayer(gl_FragCoord.xy) + .5) / levels;
  c = mix(c, vec3(1.,.95,.84), flash);
  c *= 1. - fade;
  gl_FragColor = vec4(c, 1.);
}`;

export class Retro {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.r.toneMapping = THREE.NoToneMapping;
    this.r.setPixelRatio(1);
    // Manche Handys können nicht in Half-Float-Texturen rendern.
    const hdr = this.r.extensions.has('EXT_color_buffer_float') || this.r.extensions.has('EXT_color_buffer_half_float');
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.u = {
      tex: { value: this.rt.texture }, res: { value: new THREE.Vector2(4, 4) }, hurt: { value: 0 }, fade: { value: 0 },
      flash: { value: 0 }, time: { value: 0 }, warm: { value: 0 }, levels: { value: 56 }, shaft: { value: 0 }, sunPos: { value: new THREE.Vector2(.5, .8) }, shaftC: { value: new THREE.Color(0xffd8a0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, depthTest: false, depthWrite: false, fragmentShader: postFrag,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    q.frustumCulled = false;
    this.ps = new THREE.Scene(); this.ps.add(q);
    this.pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.lines = 540;
  }
  resize(camera) {
    const w = innerWidth, h = innerHeight, ih = Math.min(this.lines, h), iw = Math.max(2, Math.round(ih * w / h));
    this.r.setSize(iw, ih, false);
    this.rt.setSize(iw, ih);
    this.u.res.value.set(iw, ih);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  render(scene, camera) {
    this.r.setRenderTarget(this.rt);
    this.r.render(scene, camera);
    this.r.setRenderTarget(null);
    this.r.render(this.ps, this.pc);
  }
}
