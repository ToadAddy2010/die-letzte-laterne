import * as THREE from '../../vendor/three.module.js';
import { RNG } from './util.js';

const TAU = Math.PI * 2;

/* ---------- Oberflächen: 16 prozedurale Materialien in einem Textur-Array ---------- */
export const LAY = { plain: 0, wood: 1, bark: 2, stone: 3, brick: 4, tile: 5, plaster: 6, cloth: 7, fur: 8, metal: 9, leaf: 10, rock: 11, grass: 12, dirt: 13, skin: 14, bone: 15 };
const LAY_N = 16, TS = 256, BOOST = 1.6;
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const frac = v => v - Math.floor(v);

function tileNoise(cx, cy, seed) {
  const r = RNG(seed), g = new Float32Array(cx * cy), o = new Float32Array(TS * TS);
  for (let i = 0; i < g.length; i++) g[i] = r();
  for (let y = 0, a = 0; y < TS; y++) {
    const fy = y / TS * cy, yi = fy | 0, y1 = (yi + 1) % cy; let ty = fy - yi; ty = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < TS; x++, a++) {
      const fx = x / TS * cx, xi = fx | 0, x1 = (xi + 1) % cx; let tx = fx - xi; tx = tx * tx * (3 - 2 * tx);
      const p = g[yi * cx + xi], q = g[yi * cx + x1], s = g[y1 * cx + xi], t = g[y1 * cx + x1];
      o[a] = (p + (q - p) * tx) * (1 - ty) + (s + (t - s) * tx) * ty;
    }
  }
  return o;
}
function tileFbm(c, oct, seed, ay = 1) {
  const o = new Float32Array(TS * TS); let amp = 1;
  for (let k = 0; k < oct; k++) {
    const cx = Math.min(TS, c << k), n = tileNoise(cx, Math.max(1, Math.min(TS, Math.round(cx * ay))), seed + k * 17);
    for (let i = 0; i < o.length; i++) o[i] += n[i] * amp;
    amp *= .5;
  }
  let lo = 9, hi = -9;
  for (const v of o) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < o.length; i++) o[i] = (o[i] - lo) / (hi - lo);
  return o;
}
function worley(n, seed) {
  const r = RNG(seed), pts = new Float32Array(n * n * 3), E = new Float32Array(TS * TS), T = new Float32Array(TS * TS);
  for (let i = 0; i < pts.length; i++) pts[i] = r();
  for (let y = 0, a = 0; y < TS; y++) for (let x = 0; x < TS; x++, a++) {
    const gx = x / TS * n, gy = y / TS * n, ix = gx | 0, iy = gy | 0;
    let b = 9, s = 9, t = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (((iy + dy + n) % n) * n + (ix + dx + n) % n) * 3, d = Math.hypot(gx - (ix + dx + pts[k]), gy - (iy + dy + pts[k + 1]));
      if (d < b) { s = b; b = d; t = pts[k + 2]; } else if (d < s) s = d;
    }
    E[a] = s - b; T[a] = t;
  }
  return { E, T };
}

function makeLayers() {
  const A = TS * TS, n1 = tileFbm(4, 5, 11), n2 = tileFbm(8, 4, 23), n3 = tileFbm(32, 3, 37), fine = tileNoise(128, 128, 51), rnd = RNG(99);
  const tones = Array.from({ length: 64 }, () => rnd()), data = new Uint8Array(A * LAY_N * 2), out = { l: 1, h: .5 };
  const put = (layer, fn) => {
    const L = new Float32Array(A), H = new Float32Array(A); let sum = 0;
    for (let y = 0, a = 0; y < TS; y++) for (let x = 0; x < TS; x++, a++) { fn(x, y, a, out); L[a] = Math.max(.02, out.l); H[a] = out.h; sum += L[a]; }
    const k = A / sum, base = layer * A * 2;
    for (let a = 0; a < A; a++) { data[base + a * 2] = Math.min(255, L[a] * k / BOOST * 255); data[base + a * 2 + 1] = Math.max(0, Math.min(255, H[a] * 255)); }
  };
  put(LAY.plain, (x, y, a, o) => { o.l = .92 + (n2[a] - .5) * .16 + (fine[a] - .5) * .06; o.h = n2[a] * .5 + fine[a] * .1; });
  put(LAY.wood, (x, y, a, o) => {
    const v = y / TS * 5, p = v | 0, f = v - p, e = Math.min(f, 1 - f), t = tones[p], g = Math.sin(f * 24 + n1[a] * 7 + t * 9);
    o.l = (.76 + t * .2 + g * .09 + (n3[a] - .5) * .2) * (e < .035 ? .42 : 1); o.h = e < .035 ? 0 : .62 + g * .14;
  });
  const fur = tileFbm(40, 3, 71, .14);
  put(LAY.bark, (x, y, a, o) => { const r = Math.abs(Math.sin((x / TS * 7 + n1[a] * 1.7) * Math.PI)), q = Math.pow(r, .7); o.l = .42 + q * .68 + (n3[a] - .5) * .28; o.h = q * .85 + fine[a] * .1; });
  const st = worley(5, 31);
  put(LAY.stone, (x, y, a, o) => { const e = st.E[a], j = sstep(.02, .11, e); o.l = (.68 + st.T[a] * .3 + (n2[a] - .5) * .3) * (.42 + j * .58); o.h = j * .75 + n3[a] * .25; });
  put(LAY.brick, (x, y, a, o) => {
    const rv = y / TS * 7, row = rv | 0, fy = rv - row, cv = frac(x / TS * 4 + (row % 2) * .5), col = Math.floor(x / TS * 4 + (row % 2) * .5) % 4;
    const m = Math.min(Math.min(fy, 1 - fy) * 1.4, Math.min(cv, 1 - cv) * .9), j = sstep(.03, .09, m);
    o.l = (.7 + tones[row * 4 + col] * .32 + (n3[a] - .5) * .22) * (.46 + j * .54); o.h = j * .8 + n3[a] * .2;
  });
  put(LAY.tile, (x, y, a, o) => {
    const rv = y / TS * 6; let row = rv | 0, f = rv - row, u = frac(x / TS * 5 + (row % 2) * .5);
    const arc = w => .17 * Math.pow(2 * Math.abs(w - .5), 2);
    if (f < arc(u)) { row = (row + 5) % 6; u = frac(x / TS * 5 + (row % 2) * .5); f += 1; }
    f -= arc(u);
    const col = Math.floor(x / TS * 5 + (row % 2) * .5) % 5, side = sstep(.015, .07, Math.min(u, 1 - u)), lip = sstep(0, .07, f);
    o.l = (.62 + tones[(row * 5 + col) % 64] * .34 + (1 - f) * .24 + (n3[a] - .5) * .16) * (.5 + .5 * side) * (.5 + .5 * lip); o.h = (1 - f * .8) * side * (.4 + lip * .6);
  });
  put(LAY.plaster, (x, y, a, o) => { o.l = .9 + (n1[a] - .5) * .24 + (fine[a] - .5) * .07 - sstep(.75, .95, n2[a]) * .08; o.h = n2[a] * .6 + fine[a] * .12; });
  put(LAY.cloth, (x, y, a, o) => { const w = Math.sin(x / TS * TAU * 32) * Math.sin(y / TS * TAU * 32); o.l = .95 + w * .022 + (n2[a] - .5) * .13 + (n3[a] - .5) * .05; o.h = .5 + w * .07 + n2[a] * .18; });
  put(LAY.fur, (x, y, a, o) => { o.l = .62 + fur[a] * .7 + (n2[a] - .5) * .12; o.h = fur[a]; });
  const brush = tileFbm(3, 3, 83, 20);
  put(LAY.metal, (x, y, a, o) => { o.l = .86 + (brush[a] - .5) * .3 + (n2[a] - .5) * .1 - sstep(.86, .93, n3[a]) * .1; o.h = brush[a] * .22; });
  const lf = worley(11, 41);
  put(LAY.leaf, (x, y, a, o) => { o.l = (.78 + lf.T[a] * .3 + (n3[a] - .5) * .3) * (.84 + sstep(.0, .1, lf.E[a]) * .16); o.h = lf.T[a] * .3 + n3[a] * .5; });
  const rk = tileFbm(5, 5, 53);
  put(LAY.rock, (x, y, a, o) => { const r = 1 - Math.abs(2 * rk[a] - 1), c = sstep(.9, .985, r); o.l = (.6 + n1[a] * .5 + (n3[a] - .5) * .28) * (1 - c * .55); o.h = n1[a] * .62 + n3[a] * .3 - c * .4; });
  const blades = new Float32Array(A);
  for (let i = 0; i < 3400; i++) {
    let px = rnd() * TS, py = rnd() * TS; const dx = (rnd() - .5) * .9, len = 5 + rnd() * 9, v = rnd() < .55 ? .55 : -.42;
    for (let s = 0; s < len; s++) { blades[((py | 0) & 255) * TS + ((px | 0) & 255)] += v * (1 - s / len * .6); px += dx; py += 1; }
  }
  put(LAY.grass, (x, y, a, o) => { o.l = .82 + blades[a] * .34 + (n3[a] - .5) * .34 + (n1[a] - .5) * .1; o.h = .45 + blades[a] * .5 + (fine[a] - .5) * .2; });
  const peb = worley(16, 61);
  put(LAY.dirt, (x, y, a, o) => { o.l = .8 + (n1[a] - .5) * .28 + (n3[a] - .5) * .2 + (fine[a] - .5) * .12 + (peb.T[a] - .5) * .05; o.h = n2[a] * .45 + n3[a] * .4 + fine[a] * .15; });
  put(LAY.skin, (x, y, a, o) => { o.l = .98 + (n2[a] - .5) * .05 + (fine[a] - .5) * .015; o.h = n2[a] * .18; });
  const streak = tileFbm(10, 3, 91, .2);
  put(LAY.bone, (x, y, a, o) => { o.l = .9 + (streak[a] - .5) * .16 + (n3[a] - .5) * .08; o.h = streak[a] * .3; });
  const t = new THREE.DataArrayTexture(data, TS, TS, LAY_N);
  t.format = THREE.RGFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function canvasTex(size, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cobble = canvasTex(256, (g, S) => {
  const r = RNG(31);
  g.fillStyle = '#2a2740'; g.fillRect(0, 0, S, S);
  const n = 6, cell = S / n;
  for (let y = -1; y <= n; y++) for (let x = -1; x <= n + 1; x++) {
    const ox = ((y + 2) % 2) * cell / 2, cx = x * cell + ox + (r() - .5) * 5, cy = y * cell + cell / 2 + (r() - .5) * 5, v = 145 + r() * 90 | 0, w = cell * (.4 + r() * .07), h = cell * (.36 + r() * .07), rot = (r() - .5) * .5;
    for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) {
      g.save(); g.translate(cx + dx, cy + dy); g.rotate(rot);
      const lg = g.createLinearGradient(0, -h, 0, h);
      lg.addColorStop(0, `rgb(${Math.min(255, v + 34)},${Math.min(255, v + 32)},${Math.min(255, v + 42)})`); lg.addColorStop(1, `rgb(${v - 42},${v - 44},${v - 30})`);
      g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, TAU); g.fill(); g.restore();
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

/* ---------- Echte Foto-Materialien (CC0, Poly Haven) ---------- */
const PBR_NAMES = ['wood', 'bark', 'stone', 'brick', 'tile', 'plaster', 'cloth', 'metal', 'leaf', 'rock', 'grass', 'dirt', 'sand', 'snow'], PBR_SIZE = 1024, ASSET_V = 1;
const emptyArray = () => { const t = new THREE.DataArrayTexture(new Uint8Array(PBR_NAMES.length * 4).fill(128), 1, 1, PBR_NAMES.length); t.needsUpdate = true; return t; };

/** Lädt alle Materialien. Klappt das nicht, bleiben die eingebauten Oberflächen aktiv. */
export async function loadPBR(progress) {
  const N = PBR_NAMES.length, S = PBR_SIZE, col = new Uint8Array(S * S * N * 4), nor = new Uint8Array(S * S * N * 4), cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const read = async name => {
    const r = await fetch(new URL(`../../assets/tex/${name}.webp?v=${ASSET_V}`, import.meta.url));
    if (!r.ok) throw new Error(`Material fehlt: ${name}`);
    const b = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    g.drawImage(b, 0, 0, S, S); b.close();
    return g.getImageData(0, 0, S, S).data;
  };
  const toLin = v => { const c = v / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  for (let i = 0; i < N; i++) {
    const c = await read(`${PBR_NAMES[i]}_c`); col.set(c, i * S * S * 4);
    let r = 0, gg = 0, b = 0, n = 0;
    for (let p = 0; p < c.length; p += 4 * 37) { r += toLin(c[p]); gg += toLin(c[p + 1]); b += toLin(c[p + 2]); n++; }
    // Das Foto liefert Struktur und Farbspiel, die Grundfarbe kommt weiter vom Modell.
    const lum = (r * .3 + gg * .55 + b * .15) / n;
    GFX.pm.value[i].set(r / n * .88 + lum * .12, gg / n * .88 + lum * .12, b / n * .88 + lum * .12);
    nor.set(await read(`${PBR_NAMES[i]}_n`), i * S * S * 4);
    progress?.((i + 1) / N);
  }
  const make = (data, srgb) => {
    const t = new THREE.DataArrayTexture(data, S, S, N);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
    return t;
  };
  GFX.pc.value = make(col, true); GFX.pn.value = make(nor, false); GFX.pbr.value = 1;
}

/** Gemeinsame Werte für alle Materialien. */
export const GFX = { time: { value: 0 }, rimColor: { value: new THREE.Color(0x7a88ff) }, rim: { value: .2 }, skyC: { value: new THREE.Color(0x8fa4b8) }, gndC: { value: new THREE.Color(0x2a2822) }, snap: { value: 0 }, lay: { value: makeLayers() }, pbr: { value: 0 }, pc: { value: emptyArray() }, pn: { value: emptyArray() }, pm: { value: PBR_NAMES.map(() => new THREE.Vector3(1, 1, 1)) } };

export function psx(m, { glow = true, terrain = false } = {}) {
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uTime: GFX.time, uRimC: GFX.rimColor, uRim: GFX.rim, uSkyC: GFX.skyC, uGndC: GFX.gndC, uSnap: GFX.snap, uLay: GFX.lay, uPC: GFX.pc, uPN: GFX.pn, uPBR: GFX.pbr, uPM: GFX.pm });
    let vs = 'uniform float uTime, uSnap;\n', fs = 'precision highp sampler2DArray;\nuniform sampler2DArray uLay; uniform vec3 uRimC, uSkyC, uGndC; uniform float uRim; vec2 gLay = vec2(.625, .5);\n' + "const int PMAP[16] = int[16](-1, 0, 1, 2, 3, 4, 5, 6, -1, -1, -1, 9, 10, 11, -1, -1);\nconst float PUV[14] = float[14](1., .9, .9, 1.2, 1.6, .8, 2.6, 1.2, 1.8, .6, 1., 1., 1., 1.);\nuniform sampler2DArray uPC, uPN; uniform float uPBR; uniform vec3 uPM[14];\nvec4 gPN = vec4(.5, .5, .8, 1.); float gReal = 0.;\n";
    let vBody = '#include <begin_vertex>\n';
    if (glow) {
      vs += 'attribute float aGlow; attribute float aMat; varying float vGlow; varying float vMat; varying vec2 vLUv;\n';
      fs += 'varying float vGlow; varying float vMat; varying vec2 vLUv;\n';
      vBody += `vGlow = aGlow; vMat = aMat; vLUv = uv;
        #ifdef USE_INSTANCING
          float wH = max(position.y, 0.), wA = wH * (.018 + .08 / (1. + wH * wH * .2));
          vec3 wP = instanceMatrix[3].xyz;
          transformed.x += (sin(uTime * 1.5 + wP.x * .31 + wP.z * .17) + .35 * sin(uTime * 3.7 + position.x * 2.2 + wP.z)) * wA;
          transformed.z += (cos(uTime * 1.15 + wP.z * .27 + wP.x * .11) + .35 * cos(uTime * 3.1 + position.z * 2.4 + wP.x)) * wA * .7;
        #endif\n`;
    }
    if (terrain) {
      vs += 'attribute float aRough; attribute vec2 aBio; varying float vRough; varying vec2 vBio; varying vec3 vWP; varying vec3 vWN;\n';
      fs += 'varying float vRough; varying vec2 vBio; varying vec3 vWP; varying vec3 vWN;\n';
      vBody += 'vRough = aRough; vBio = aBio; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);\n';
    }
    if (!terrain) fs += 'const vec3 vWN = vec3(0., 1., 0.);' + String.fromCharCode(10);
    s.vertexShader = vs + s.vertexShader.replace('#include <begin_vertex>', vBody).replace('#include <project_vertex>', `#include <project_vertex>
      if (uSnap > .5 && gl_Position.w > 0.) { vec2 sg = vec2(520., 292.); vec2 sq = gl_Position.xy / gl_Position.w; sq = floor(sq * sg + .5) / sg; gl_Position.xy = sq * gl_Position.w; }`);
    let f = fs + s.fragmentShader;
    if (terrain) {
      f = f.replace('#include <map_fragment>', "\n        vec2 uvW = vWP.xz * .2; float sl = 1. - clamp(vWN.y, 0., 1.);\n        float mA = texture(uLay, vec3(vWP.xz * .0123, 13.)).r * 1.6, mB = texture(uLay, vec3(vWP.xz * .0037 + .5, 11.)).r * 1.6;\n        if (uPBR > .5) {\n          vec2 uG = vWP.xz * .17, uD = vWP.xz * .135 + vec2(.37, .11), uR = vec2(vWP.x + vWP.y * .55, vWP.z - vWP.y * .45) * .065;\n          vec4 cG = texture(uPC, vec3(uG, 10.)), nG = texture(uPN, vec3(uG, 10.)), cD = texture(uPC, vec3(uD, 11.)), nD = texture(uPN, vec3(uD, 11.));\n          float pat = smoothstep(.66, 1.12, mA + (nG.b - .5) * .4) * (.35 + vRough * .65);\n          vec3 alb = mix(cG.rgb / uPM[10], cD.rgb / uPM[11], pat); vec4 nn = mix(nG, nD, pat);\n          if (vBio.x > .01) { vec2 uS = vWP.xz * .11; vec3 cS = texture(uPC, vec3(uS, 12.)).rgb / uPM[12]; vec4 nS = texture(uPN, vec3(uS, 12.)); float k = smoothstep(.1, .7, vBio.x); alb = mix(alb, cS, k); nn = mix(nn, nS, k); }\n          if (vBio.y > .01) { vec2 uS = vWP.xz * .12; vec3 cS = texture(uPC, vec3(uS, 13.)).rgb / uPM[13]; vec4 nS = texture(uPN, vec3(uS, 13.)); float k = smoothstep(.1, .7, vBio.y + (mA - .8) * .25); alb = mix(alb, cS, k); nn = mix(nn, nS, k); }\n          float wR = smoothstep(.13, .32, sl + (mA - .8) * .05);\n          if (wR > .001) { vec3 cR = texture(uPC, vec3(uR, 9.)).rgb / uPM[9]; vec4 nR = texture(uPN, vec3(uR, 9.)); alb = mix(alb, cR, wR); nn = mix(nn, nR, wR); }\n          gPN = nn; gReal = 2.;\n          diffuseColor.rgb *= clamp(alb, 0., 2.3) * (.86 + .28 * mB);\n        } else {\n          vec2 tG = texture(uLay, vec3(uvW, 12.)).rg, tD = texture(uLay, vec3(uvW * 1.37 + .31, 13.)).rg;\n          vec2 tR = texture(uLay, vec3(vec2(vWP.x + vWP.y * .55, vWP.z - vWP.y * .45) * .11, 11.)).rg;\n          float pat = smoothstep(.62, 1.1, mA + (tG.g - .5) * .55);\n          vec2 gnd = mix(tD, mix(tG, tD, pat * .72), vRough);\n          gLay = mix(gnd, tR, smoothstep(.1, .3, sl));\n          diffuseColor.rgb *= gLay.r * 1.6 * (.9 + .3 * mB);\n        }").replace('#include <color_fragment>', '#include <color_fragment>' + String.fromCharCode(10) + ' diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.3, .55, .15))), diffuseColor.rgb, .86);');
    } else if (glow) {
      f = f.replace('#include <map_fragment>', "\n        gLay = texture(uLay, vec3(vLUv, floor(vMat + .5))).rg;\n        { int pI = PMAP[int(floor(vMat + .5))];\n          if (uPBR > .5 && pI >= 0 && vGlow < .5) {\n            vec3 pUv = vec3(vLUv * PUV[pI], float(pI));\n            vec4 pC = texture(uPC, pUv); gPN = texture(uPN, pUv); gReal = 1.;\n            diffuseColor.rgb *= clamp(pC.rgb / uPM[pI], 0., 2.4);\n          } else diffuseColor.rgb *= mix(gLay.r * 1.6, 1., clamp(vGlow * 1.6, 0., 1.)); }");
    } else f = f.replace('#include <map_fragment>', '#include <map_fragment>' + String.fromCharCode(10) + ' gLay = vec2(.625, dot(diffuseColor.rgb, vec3(.33)));');
    f = f.replace('#include <normal_fragment_maps>', "#include <normal_fragment_maps>\n      if (gReal > 1.5) {\n        vec2 tN = (gPN.rg * 2. - 1.) * .95;\n        normal = normalize(mat3(viewMatrix) * normalize(vec3(vWN.x + tN.x, vWN.y, vWN.z + tN.y)));\n      }\n      __SOLID__\n      else { vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);\n        vec2 dH = vec2(dFdx(gLay.g), dFdy(gLay.g)) * .045;\n        vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1) * faceDirection;\n        vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);\n        normal = normalize(abs(det) * normal - grad); }".replace('__SOLID__', glow ? "else if (gReal > .5) {\n        vec3 tn = vec3((gPN.rg * 2. - 1.) * .9, 0.); tn.z = sqrt(max(1. - dot(tn.xy, tn.xy), .02));\n        vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition); vec2 s0 = dFdx(vLUv), s1 = dFdy(vLUv);\n        vec3 N = normal, qa = cross(q1, N), qb = cross(N, q0), T = qa * s0.x + qb * s1.x, B = qa * s0.y + qb * s1.y;\n        float dt = max(dot(T, T), dot(B, B)), sc = dt == 0. ? 0. : faceDirection / sqrt(dt);\n        normal = normalize(T * sc * tn.x + B * sc * tn.y + N * tn.z);\n      }" : ''));
    if (glow) f = f.replace('#include <opaque_fragment>', `
        vec3 litCap = diffuseColor.rgb * 1.3, litRoom = max(diffuseColor.rgb * .5, vec3(.001));
        outgoingLight = min(outgoingLight, litCap) + litRoom * (1. - exp(-max(outgoingLight - litCap, vec3(0.)) / litRoom));
        float mI = floor(vMat + .5), isM = mI == 9. ? 1. : 0.;
        float rgh = mI == 9. ? .36 : mI == 15. ? .48 : mI == 14. ? .54 : mI == 10. ? .6 : mI == 5. ? .52 : (mI == 11. || mI == 3.) ? .72 : .84;
        rgh = gReal > .5 ? clamp(mix(rgh, gPN.b, .78), .2, 1.) : clamp(rgh + (gLay.g - .5) * .2, .22, 1.);
        vec3 Vd = normalize(vViewPosition);
        #if NUM_DIR_LIGHTS > 0
          vec3 hV = normalize(directionalLights[0].direction + Vd);
          float nh = max(dot(normal, hV), 0.), a2 = rgh * rgh * rgh * rgh, dn = nh * nh * (a2 - 1.) + 1., D = a2 / (3.1416 * dn * dn + 1e-4), F0 = mix(.04, 1., isM), Fr = F0 + (1. - F0) * pow(1. - max(dot(Vd, hV), 0.), 5.);
          outgoingLight += reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(.03)) * mix(vec3(1.), diffuseColor.rgb * 1.8, isM) * min(D, 14.) * Fr * .55 * (1. - vGlow);
        #endif
        #if NUM_DIR_LIGHTS > 0
          if (mI == 10.) outgoingLight += diffuseColor.rgb * vec3(1.15, 1.25, .55) * directionalLights[0].color * pow(max(dot(-Vd, directionalLights[0].direction), 0.), 3.) * .55;
        #endif
        vec3 Rw = inverseTransformDirection(reflect(-Vd, normal), viewMatrix);
        vec3 envC = mix(uGndC, uSkyC, smoothstep(-.25, .55, Rw.y));
        float eF0 = mix(.04, .9, isM), fE = eF0 + (1. - eF0) * pow(1. - max(dot(normal, Vd), 0.), 5.);
        outgoingLight = outgoingLight * (1. - isM * .62) + envC * mix(vec3(1.), diffuseColor.rgb * 1.7, isM) * fE * (1. - rgh * .82) * (.5 + isM * .7) * (1. - vGlow);
        float rimK = pow(1. - clamp(dot(Vd, normal), 0., 1.), 4.);
        outgoingLight += (uRimC * diffuseColor.rgb * .8) * rimK * uRim;
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.45, vGlow);
        #include <opaque_fragment>`);
    if (terrain) f = f.replace('#include <opaque_fragment>', `
        vec3 tCap = diffuseColor.rgb * 1.02, tRoom = max(diffuseColor.rgb * .34, vec3(.001));
        outgoingLight = min(outgoingLight, tCap) + tRoom * (1. - exp(-max(outgoingLight - tCap, vec3(0.)) / tRoom));
        #include <opaque_fragment>`);
    s.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `ll4-${glow}-${terrain}`;
  return m;
}

/** Wirft nur Schatten und wird selbst nicht gezeichnet. */
export const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

export const MAT = {
  solid: psx(new THREE.MeshLambertMaterial({ vertexColors: true })),
  terrain: psx(new THREE.MeshLambertMaterial({ vertexColors: true }), { glow: false, terrain: true }),
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
        vec2 p = vW.xz * 1.7;
        float a = n(p * .13 + uTime * vec2(.09, .05)), b = n(p * .29 - uTime * vec2(.07, .11)), w = a * .6 + b * .4;
        vec3 N = normalize(vec3((a - .5) * .42, 1., (b - .5) * .42)), V = normalize(cameraPosition - vW);
        float fres = pow(1. - max(dot(N, V), 0.), 3.);
        vec3 c = mix(uDeep, uSky, .16 + fres * .84);
        c += smoothstep(.62, .76, w) * uSky * .16 + smoothstep(.76, .86, w) * vec3(.16);
        c += pow(max(dot(reflect(-uSun, N), V), 0.), 90.) * uGlint * 2.4;
        gl_FragColor = vec4(c, .84);
        #include <fog_fragment>
      }`,
  }),
  decal: new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
};
export { waterTex };

/* ---------- Formvorlagen ---------- */
const TPL = new Map();
function tpl(key, make) {
  let t = TPL.get(key);
  if (!t) { t = toTpl(make()); TPL.set(key, t); }
  return t;
}
function toTpl(g) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position, n = pa.count, pos = new Float32Array(pa.array), nor = new Float32Array(g.attributes.normal.array), uv = g.attributes.uv ? new Float32Array(g.attributes.uv.array) : new Float32Array(n * 2);
  const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i);
  let y0 = 1e9, y1 = -1e9;
  for (let i = 1; i < pos.length; i += 3) { if (pos[i] < y0) y0 = pos[i]; if (pos[i] > y1) y1 = pos[i]; }
  return { pos, nor, uv, idx, y0, y1 };
}
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function n3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let u = x - xi, v = y - yi, w = z - zi;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v), L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
/** Unregelmäßige Kugel für Felsen und Blattwerk, mit weichen Normalen. */
function lumpy(detail, amp, freq, seed) {
  const src = new THREE.IcosahedronGeometry(1, detail).attributes.position, map = new Map(), P = [], I = [];
  for (let i = 0; i < src.count; i++) {
    const x = src.getX(i), y = src.getY(i), z = src.getZ(i), key = `${Math.round(x * 2e3)},${Math.round(y * 2e3)},${Math.round(z * 2e3)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = P.length / 3; map.set(key, id);
      const a = n3(x * freq + seed, y * freq, z * freq), b = n3(x * freq * 2.3 - seed, y * freq * 2.3 + 4, z * freq * 2.3), c = Math.abs(n3(x * freq * 4.7, y * freq * 4.7 + seed, z * freq * 4.7) - .5);
      const q = 1 + ((a - .5) * 1.3 + (b - .5) * .55 - c * .3) * amp;
      P.push(x * q, y * q, z * q);
    }
    I.push(id);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const uv = new Float32Array(P.length / 3 * 2);
  for (let i = 0; i < P.length / 3; i++) { uv[i * 2] = P[i * 3] * .7 + P[i * 3 + 2] * .55; uv[i * 2 + 1] = P[i * 3 + 1] * .9 + P[i * 3 + 2] * .3; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* Abgeschrägter Quader: 24 Ecken, Flächen, Kanten und Eckdreiecke. */
const BOX_F = [], BOX_A = [];
(() => {
  const vid = (c, a) => c * 3 + a, at = v => { const c = v / 3 | 0, a = v % 3; return [0, 1, 2].map(i => ((c >> i) & 1 ? 1 : -1) * (i === a ? .5 : .3)); };
  const tri = (L, a, b, c) => {
    const p = at(a), q = at(b), r = at(c), u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], m = [p[0] + q[0] + r[0], p[1] + q[1] + r[1], p[2] + q[2] + r[2]];
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0) L.push(a, b, c); else L.push(a, c, b);
  };
  const quad = (L, a, b, c, d) => { tri(L, a, b, c); tri(L, a, c, d); };
  for (let a = 0; a < 3; a++) for (let s = 0; s < 2; s++) {
    const b = (a + 1) % 3, e = (a + 2) % 3, C = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([p, q]) => vid((s << a) | (p << b) | (q << e), a));
    quad(BOX_F, C[0], C[1], C[2], C[3]); quad(BOX_A, C[0], C[1], C[2], C[3]);
  }
  for (let e = 0; e < 3; e++) for (let sf = 0; sf < 2; sf++) for (let sg = 0; sg < 2; sg++) {
    const f = (e + 1) % 3, g = (e + 2) % 3, c1 = (sf << f) | (sg << g), c2 = c1 | (1 << e);
    quad(BOX_A, vid(c1, f), vid(c2, f), vid(c2, g), vid(c1, g));
  }
  for (let c = 0; c < 8; c++) tri(BOX_A, vid(c, 0), vid(c, 1), vid(c, 2));
})();

const PRISM_V = [[-.5, 0, .5], [.5, 0, .5], [0, 1, .5], [-.5, 0, -.5], [.5, 0, -.5], [0, 1, -.5]], PRISM_F = [0, 1, 2, 4, 3, 5, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2, 0, 3, 4, 0, 4, 1];

function guessMat(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx - mn;
  if (r > g && g > b && s > 26 && mx < 176) return LAY.wood;
  if (r > 176 && g > 110 && b < 110 && r - b > 90) return LAY.metal;
  if (s < 30) return mx > 186 ? LAY.plaster : LAY.stone;
  if (b >= r && s < 95 && mx < 205) return LAY.stone;
  return LAY.plaster;
}

function subRings(R, sub) {
  const A = R.map(r => [r[0], r[1], r[2] ?? r[1], r[3] || 0, r[4] || 0]);
  if (sub <= 1) return A;
  const out = [], cr = (a, b, c, d, t) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < A.length - 1; i++) {
    const p0 = A[Math.max(0, i - 1)], p1 = A[i], p2 = A[i + 1], p3 = A[Math.min(A.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, q = p1.map((_, f) => cr(p0[f], p1[f], p2[f], p3[f], t));
      q[0] = p1[0] + (p2[0] - p1[0]) * (t * .5 + (q[0] - p1[0]) / ((p2[0] - p1[0]) || 1) * .5); q[1] = Math.max(0, q[1]); q[2] = Math.max(0, q[2]);
      out.push(q);
    }
  }
  out.push(A[A.length - 1]);
  return out;
}
function subPath(pts, rad, sub) {
  const R = typeof rad === 'function' ? pts.map((_, i) => rad(i / Math.max(1, pts.length - 1))) : Array.isArray(rad) ? rad : pts.map(() => rad);
  const A = pts.map((p, i) => [p[0], p[1], p[2], R[i]]);
  if (sub <= 1 || A.length < 3) return A;
  const out = [], cr = (a, b, c, d, t) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < A.length - 1; i++) {
    const p0 = A[Math.max(0, i - 1)], p1 = A[i], p2 = A[i + 1], p3 = A[Math.min(A.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) { const q = p1.map((_, f) => cr(p0[f], p1[f], p2[f], p3[f], k / sub)); q[3] = Math.max(.001, q[3]); out.push(q); }
  }
  out.push(A[A.length - 1]);
  return out;
}

class Buf {
  constructor(v = 2048, i = 6144) { this.capV = v; this.capI = i; this.nv = 0; this.ni = 0; this.alloc(); }
  alloc() { this.pos = new Float32Array(this.capV * 3); this.nor = new Int16Array(this.capV * 3); this.col = new Uint16Array(this.capV * 3); this.uv = new Float32Array(this.capV * 2); this.gl = new Uint8Array(this.capV); this.mat = new Uint8Array(this.capV); this.idx = new Uint32Array(this.capI); }
  room(v, i) {
    if (this.nv + v > this.capV) {
      const o = this; this.capV = Math.max(this.capV * 2, this.nv + v);
      const { pos, nor, col, uv, gl, mat } = o;
      this.pos = new Float32Array(this.capV * 3); this.pos.set(pos.subarray(0, this.nv * 3));
      this.nor = new Int16Array(this.capV * 3); this.nor.set(nor.subarray(0, this.nv * 3));
      this.col = new Uint16Array(this.capV * 3); this.col.set(col.subarray(0, this.nv * 3));
      this.uv = new Float32Array(this.capV * 2); this.uv.set(uv.subarray(0, this.nv * 2));
      this.gl = new Uint8Array(this.capV); this.gl.set(gl.subarray(0, this.nv));
      this.mat = new Uint8Array(this.capV); this.mat.set(mat.subarray(0, this.nv));
    }
    if (this.ni + i > this.capI) { const old = this.idx; this.capI = Math.max(this.capI * 2, this.ni + i); this.idx = new Uint32Array(this.capI); this.idx.set(old.subarray(0, this.ni)); }
  }
  geometry() {
    const g = new THREE.BufferGeometry(), n = this.nv;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, n * 3), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, n * 3), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, n * 2), 2));
    g.setAttribute('aGlow', new THREE.BufferAttribute(this.gl.slice(0, n), 1, true));
    g.setAttribute('aMat', new THREE.BufferAttribute(this.mat.slice(0, n), 1, false));
    g.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.ni), 1));
    g.computeBoundingSphere();
    return g;
  }
}

const M0 = new THREE.Matrix4(), M1 = new THREE.Matrix4(), NM = new THREE.Matrix3(), Q = new THREE.Quaternion(), E = new THREE.Euler(),
  P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), C2 = new THREE.Color();

/* Farbregie: Neon-Blau und Violett werden zu Schiefer, Pflaume und Moos. So bleibt die ganze Welt in einer Palette. */
const NAT = new Map(), HSL = { h: 0, s: 0, l: 0 }, T0 = new THREE.Color();
function natural(t, hex, o, world) {
  const leaf = o.mat === 'leaf', glow = !!o.glow, key = hex * 8 + (leaf ? 1 : 0) + (world ? 2 : 0) + (glow ? 4 : 0);
  let v = NAT.get(key);
  if (!v) {
    T0.set(hex).getHSL(HSL, THREE.SRGBColorSpace);
    let { h, s, l } = HSL; const deg = h * 360, k = world ? 1 : .62;
    if (glow) s *= .8;
    else if (deg > 190 && deg < 345) {
      if (leaf) { h = (92 + (deg - 230) * .2) / 360; s = Math.min(s, .6) * .56; l *= .7; }
      else { const to = deg < 255 ? 226 : 300; h = (deg + (to - deg) * .38 * k) / 360; s *= 1 - .36 * k; }
    } else if (deg >= 70) { h = (deg + (92 - deg) * .22 * k) / 360; s *= 1 - .16 * k; if (leaf) l *= .84; }
    else s *= 1 - .17 * k;
    T0.setHSL(h, s, l, THREE.SRGBColorSpace);
    v = [T0.r, T0.g, T0.b]; NAT.set(key, v);
  }
  t.setRGB(v[0], v[1], v[2]);
}

/**
 * Baukasten für alle Modelle. Mit { lod: true } entsteht zusätzlich eine einfache Version für die Ferne.
 * Kit.detail = 0 baut überall die einfache Form, für schwache Geräte.
 */
export class Kit {
  static detail = 1;
  constructor(seed = 1, { lod = false, auto = true } = {}) { this.h = new Buf(); this.l = lod ? new Buf(512, 1536) : null; this.r = RNG(seed); this.stack = []; this.base = new THREE.Matrix4(); this.auto = auto; }
  at(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0) {
    this.stack.push(this.base.clone());
    E.set(rx, ry, 0); Q.setFromEuler(E);
    this.base.multiply(M1.compose(P.set(x, y, z), Q, S.setScalar(s)));
    return this;
  }
  pop() { this.base.copy(this.stack.pop()); return this; }
  _mtx(x, y, z, sx, sy, sz, o) { E.set(o.rx || 0, o.ry || 0, o.rz || 0); Q.setFromEuler(E); M0.compose(P.set(x, y, z), Q, S.set(sx, sy, sz)).premultiply(this.base); NM.getNormalMatrix(M0); }
  _tint(col, o) { natural(C, col, o, this.auto); this.hasC2 = o.c2 !== undefined; if (this.hasC2) natural(C2, o.c2, o, this.auto); this.f = 1 + (this.r() - .5) * (o.j ?? .05) * 1.1; this.gv = o.glow || 0; }
  _mat(o, col) { if (o.mat !== undefined) return LAY[o.mat] ?? 0; if (o.glow) return 0; return this.auto ? guessMat(col) : 0; }
  _put(b, lx, ly, lz, nx, ny, nz, t, u, v, m) {
    const e = M0.elements, q = NM.elements, i = b.nv++;
    b.pos[i * 3] = e[0] * lx + e[4] * ly + e[8] * lz + e[12]; b.pos[i * 3 + 1] = e[1] * lx + e[5] * ly + e[9] * lz + e[13]; b.pos[i * 3 + 2] = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
    let wx = q[0] * nx + q[3] * ny + q[6] * nz, wy = q[1] * nx + q[4] * ny + q[7] * nz, wz = q[2] * nx + q[5] * ny + q[8] * nz;
    const l = Math.hypot(wx, wy, wz) || 1; wx /= l; wy /= l; wz /= l;
    b.nor[i * 3] = wx * 32767; b.nor[i * 3 + 1] = wy * 32767; b.nor[i * 3 + 2] = wz * 32767;
    let r = C.r, g = C.g, bl = C.b;
    if (this.hasC2) { r += (C2.r - r) * t; g += (C2.g - g) * t; bl += (C2.b - bl) * t; }
    const F = this.f * (this.gv > 0 ? 1 : .8 + .2 * Math.min(1, wy * .6 + .6)) * 65535;
    b.col[i * 3] = Math.min(65535, r * F); b.col[i * 3 + 1] = Math.min(65535, g * F); b.col[i * 3 + 2] = Math.min(65535, bl * F);
    b.uv[i * 2] = u; b.uv[i * 2 + 1] = v; b.gl[i] = this.gv * 255; b.mat[i] = m;
    return i;
  }
  _tpl(b, t, m, us, vs, uo, vo) {
    const n = t.pos.length / 3, v0 = b.nv, dy = (t.y1 - t.y0) || 1, p = t.pos, q = t.nor, w = t.uv;
    b.room(n, t.idx.length);
    const cap = this.capUV || 0;
    for (let i = 0; i < n; i++) { const flat = cap && Math.abs(q[i * 3 + 1]) > .98; this._put(b, p[i * 3], p[i * 3 + 1], p[i * 3 + 2], q[i * 3], q[i * 3 + 1], q[i * 3 + 2], (p[i * 3 + 1] - t.y0) / dy, flat ? p[i * 3] * cap + uo : w[i * 2] * us + uo, flat ? p[i * 3 + 2] * cap + vo : w[i * 2 + 1] * vs + vo, m); }
    for (let i = 0; i < t.idx.length; i++) b.idx[b.ni++] = t.idx[i] + v0;
  }
  _both(hi, lo, x, y, z, sx, sy, sz, col, o, us, vs) {
    this._mtx(x, y, z, sx, sy, sz, o); this._tint(col, o);
    const m = this._mat(o, col), uo = this.r() * 4, vo = this.r() * 4;
    if (!this.onlyLo) this._tpl(this.h, Kit.detail ? hi : lo, m, us, vs, uo, vo);
    if (this.l && !this.noLo) this._tpl(this.l, lo, m, us, vs, uo, vo);
    return this;
  }
  _box(b, w, h, d, r, m, uo, vo, s) {
    const I = r > 0 ? BOX_A : BOX_F, v0 = b.nv, L = [w, h, d], co = [0, 0, 0];
    b.room(24, I.length);
    for (let c = 0; c < 8; c++) for (let a = 0; a < 3; a++) {
      const sx = c & 1 ? 1 : -1, sy = c & 2 ? 1 : -1, sz = c & 4 ? 1 : -1;
      co[0] = sx * (w / 2 - (a === 0 ? 0 : r)); co[1] = sy * (h / 2 - (a === 1 ? 0 : r)); co[2] = sz * (d / 2 - (a === 2 ? 0 : r));
      const A = (a + 1) % 3, B = (a + 2) % 3, ua = L[A] >= L[B] ? A : B, va = ua === A ? B : A;
      this._put(b, co[0], co[1], co[2], a === 0 ? sx : 0, a === 1 ? sy : 0, a === 2 ? sz : 0, (co[1] + h / 2) / (h || 1), co[ua] * s + uo, co[va] * s + vo, m);
    }
    for (let i = 0; i < I.length; i++) b.idx[b.ni++] = I[i] + v0;
  }
  box(w, h, d, x, y, z, c, o = {}) {
    this._mtx(x, y, z, 1, 1, 1, o); this._tint(c, o);
    const m = this._mat(o, c), uo = this.r() * 4, vo = this.r() * 4, s = o.uv ?? .3, bev = Kit.detail && !o.sharp ? Math.min(o.bevel ?? .09, Math.min(w, h, d) * .24) : 0;
    this._box(this.h, w, h, d, bev, m, uo, vo, s);
    if (this.l && !this.noLo) this._box(this.l, w, h, d, 0, m, uo, vo, s);
    return this;
  }
  cyl(rt, rb, h, x, y, z, c, o = {}) {
    const n0 = o.seg || 8, m = Math.max(rt, rb) || 1, keep = o.hard || (n0 === 4 && o.ry !== undefined && m > .5), key = `${(rt / m).toFixed(2)}_${(rb / m).toFixed(2)}`;
    const nH = keep ? n0 : Math.min(40, Math.max(n0 * 2, m < .25 ? 10 : m < 1.5 ? 16 : 24)), nL = keep ? n0 : Math.max(5, n0);
    const make = n => () => { const g = new THREE.CylinderGeometry(rt / m, rb / m, 1, n, 1); return keep ? g.toNonIndexed() : g; };
    const hi = tpl(`cyl${key}_${nH}_${keep}`, make(nH)), lo = tpl(`cyl${key}_${nL}_${keep}`, make(nL));
    if (keep && !hi.flat) { for (const t of [hi, lo]) { flatten(t); t.flat = true; } }
    this.capUV = m * (o.uv ?? .3);
    this._both(hi, lo, x, y, z, m, h, m, c, o, TAU * m * (o.uv ?? .3), h * (o.uv ?? .3));
    this.capUV = 0;
    return this;
  }
  cone(r, h, x, y, z, c, o = {}) { return this.cyl(0, r, h, x, y, z, c, o); }
  ball(r, x, y, z, c, o = {}) {
    const n0 = o.seg || 8, nH = Math.max(n0 * 2, r < .2 ? 10 : r < 1.2 ? 18 : 28), nL = Math.max(5, n0);
    const hi = tpl(`ball${nH}`, () => new THREE.SphereGeometry(1, nH, Math.max(5, nH * .62 | 0))), lo = tpl(`ball${nL}`, () => new THREE.SphereGeometry(1, nL, Math.max(4, nL - 2)));
    return this._both(hi, lo, x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o, TAU * r * (o.uv ?? .3), Math.PI * r * (o.uv ?? .3));
  }
  dome(r, x, y, z, c, o = {}) {
    const n0 = o.seg || 10, nH = Math.max(n0 * 2, r < 1 ? 18 : 32), nL = Math.max(6, n0);
    const mk = n => () => new THREE.SphereGeometry(1, n, Math.max(4, n * .36 | 0), 0, TAU, 0, Math.PI / 2);
    return this._both(tpl(`dome${nH}`, mk(nH)), tpl(`dome${nL}`, mk(nL)), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o, TAU * r * (o.uv ?? .3), Math.PI * r * .5 * (o.uv ?? .3));
  }
  oct(r, x, y, z, c, o = {}) { const t = tpl('oct', () => new THREE.OctahedronGeometry(1)); return this._both(t, t, x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o, r, r); }
  /** Unregelmäßiger Fels. */
  ico(r, x, y, z, c, o = {}) {
    const v = this.r() * 4 | 0, big = r > 3, hi = tpl(`rock${v}_${big}`, () => lumpy(big ? 5 : 3, .62, 1.5, v * 7 + 1)), lo = tpl(`rockL${v}`, () => lumpy(1, .62, 1.5, v * 7 + 1));
    return this._both(hi, lo, x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, { mat: 'rock', ...o }, r * (o.uv ?? .4), r * (o.uv ?? .4));
  }
  /** Weiche, knubbelige Form für Blattwerk und organische Massen. */
  blob(r, x, y, z, c, o = {}) {
    const v = this.r() * 3 | 0, det = o.d ?? (r > 4 ? 5 : 3), hi = tpl(`blob${v}_${det}`, () => lumpy(det, .5, 1.9, v * 11 + 3)), lo = tpl(`blobL${v}`, () => lumpy(1, .4, 1.9, v * 11 + 3));
    return this._both(hi, lo, x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o, r * (o.uv ?? .4), r * (o.uv ?? .4));
  }
  torus(R, t, x, y, z, c, o = {}) {
    const n0 = o.seg || 14, arc = o.arc || TAU, k = (t / R).toFixed(2), a = arc.toFixed(2), nH = Math.min(64, Math.max(n0 * 2, 24)), nL = Math.max(8, n0);
    const mk = (u, w) => () => new THREE.TorusGeometry(1, t / R, u, w, arc);
    return this._both(tpl(`tor${k}_${a}_${nH}`, mk(10, nH)), tpl(`tor${k}_${a}_${nL}`, mk(5, nL)), x, y, z, R, R, R, c, o, arc * R * (o.uv ?? .3), TAU * t * (o.uv ?? .3));
  }
  /** Dachform: First entlang z. Die Giebel bekommen eigenes Material über o.gable und o.gc. */
  prism(w, h, d, x, y, z, c, o = {}) {
    this._mtx(x, y, z, 1, 1, 1, o); this._tint(c, o);
    const roofM = o.mat !== undefined ? LAY[o.mat] : LAY.tile, gableM = LAY[o.gable ?? 'plaster'], s = o.uv ?? .22, slope = Math.hypot(w / 2, h), uo = this.r() * 4;
    for (const b of this.l && !this.noLo ? [this.h, this.l] : [this.h]) {
      b.room(24, 24);
      for (let f = 0; f < 24; f += 3) {
        const A = PRISM_V[PRISM_F[f]], B = PRISM_V[PRISM_F[f + 1]], D = PRISM_V[PRISM_F[f + 2]], a = [A[0] * w, A[1] * h, A[2] * d], e = [B[0] * w, B[1] * h, B[2] * d], g = [D[0] * w, D[1] * h, D[2] * d];
        const ux = e[0] - a[0], uy = e[1] - a[1], uz = e[2] - a[2], vx = g[0] - a[0], vy = g[1] - a[1], vz = g[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const gable = Math.abs(nz) > .9, under = ny < -.9, mt = gable ? gableM : under ? LAY.wood : roofM;
        natural(C, gable && o.gc !== undefined ? o.gc : c, gable ? {} : o, this.auto);
        for (const q of [a, e, g]) {
          const i = this._put(b, q[0], q[1], q[2], nx, ny, nz, q[1] / (h || 1), (gable || under ? q[0] : q[2]) * s + uo, (under ? q[2] : gable ? q[1] : q[1] / (h || 1) * slope) * s, mt);
          b.idx[b.ni++] = i;
        }
      }
    }
    return this;
  }
  /** Runder Körper aus Ringen [y, rx, rz, cx, cz], von unten nach oben. */
  loft(rings, x, y, z, c, o = {}) {
    this._mtx(x, y, z, o.sx || 1, o.sy || 1, o.sz || 1, o); this._tint(c, o);
    const m = this._mat(o, c), uo = this.r() * 4, seg = o.seg ?? 16, sub = o.sub ?? 3;
    this._loft(this.h, subRings(rings, Kit.detail ? sub : 1), o, m, Kit.detail ? seg : Math.max(5, seg >> 1), uo);
    if (this.l && !this.noLo) this._loft(this.l, subRings(rings, 1), o, m, Math.max(5, seg >> 1), uo);
    return this;
  }
  _loft(b, R, o, m, seg, uo) {
    const n = R.length, w = seg + 1, v0 = b.nv, G = new Float32Array(n * seg * 3), s = o.uv ?? .3, fold = o.fold || 0, fN = o.foldN || 7, ph = o.foldP || 0, shape = o.shape;
    for (let i = 0, a = 0; i < n; i++) for (let j = 0; j < seg; j++, a += 3) {
      const an = j / seg * TAU, t = n > 1 ? i / (n - 1) : 0, q = (fold ? 1 + fold * (1 - t) * (Math.sin(an * fN + ph) * .75 + Math.sin(an * fN * 2.3 + ph * 1.7) * .3) : 1) * (shape ? shape(an, t) : 1);
      G[a] = R[i][3] + Math.cos(an) * R[i][1] * q; G[a + 1] = R[i][0]; G[a + 2] = R[i][4] + Math.sin(an) * R[i][2] * q;
    }
    const at = (i, j, k) => G[(i * seg + ((j + seg) % seg)) * 3 + k];
    let avg = 0; for (const r of R) avg += (r[1] + r[2]) * .5; avg /= n;
    const hard = o.flat, total = hard ? (n - 1) * seg * 4 + 2 * (seg + 1) : n * w + 2 * (seg + 1);
    b.room(total, (n - 1) * seg * 6 + seg * 6);
    if (hard) {
      let vv = 0;
      for (let i = 0; i < n - 1; i++) {
        const dv = Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]);
        for (let j = 0; j < seg; j++) {
          const a = [at(i, j, 0), at(i, j, 1), at(i, j, 2)], e = [at(i + 1, j, 0), at(i + 1, j, 1), at(i + 1, j, 2)], f = [at(i, j + 1, 0), at(i, j + 1, 1), at(i, j + 1, 2)], g = [at(i + 1, j + 1, 0), at(i + 1, j + 1, 1), at(i + 1, j + 1, 2)];
          const ux = e[0] - a[0], uy = e[1] - a[1], uz = e[2] - a[2]; let vx = f[0] - a[0], vy = f[1] - a[1], vz = f[2] - a[2];
          if (Math.hypot(vx, vy, vz) < 1e-5) { vx = g[0] - e[0]; vy = g[1] - e[1]; vz = g[2] - e[2]; }
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
          const t0 = i / (n - 1), t1 = (i + 1) / (n - 1), base = b.nv;
          this._put(b, a[0], a[1], a[2], nx, ny, nz, t0, j * .3 + uo, vv * s, m); this._put(b, e[0], e[1], e[2], nx, ny, nz, t1, j * .3 + uo, (vv + dv) * s, m);
          this._put(b, f[0], f[1], f[2], nx, ny, nz, t0, (j + 1) * .3 + uo, vv * s, m); this._put(b, g[0], g[1], g[2], nx, ny, nz, t1, (j + 1) * .3 + uo, (vv + dv) * s, m);
          b.idx[b.ni++] = base; b.idx[b.ni++] = base + 1; b.idx[b.ni++] = base + 2; b.idx[b.ni++] = base + 2; b.idx[b.ni++] = base + 1; b.idx[b.ni++] = base + 3;
        }
        vv += dv;
      }
    } else {
      let vv = 0;
      for (let i = 0; i < n; i++) {
        if (i) vv += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]);
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        for (let j = 0; j <= seg; j++) {
          const dux = at(i, j + 1, 0) - at(i, j - 1, 0), duy = at(i, j + 1, 1) - at(i, j - 1, 1), duz = at(i, j + 1, 2) - at(i, j - 1, 2), dvx = at(i1, j, 0) - at(i0, j, 0), dvy = at(i1, j, 1) - at(i0, j, 1), dvz = at(i1, j, 2) - at(i0, j, 2);
          let nx = dvy * duz - dvz * duy, ny = dvz * dux - dvx * duz, nz = dvx * duy - dvy * dux, l = Math.hypot(nx, ny, nz);
          if (l < 1e-7) { nx = 0; ny = i < n / 2 ? -1 : 1; nz = 0; l = 1; }
          this._put(b, at(i, j, 0), at(i, j, 1), at(i, j, 2), nx / l, ny / l, nz / l, n > 1 ? i / (n - 1) : 0, j / seg * TAU * avg * s + uo, vv * s, m);
        }
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
        const a = v0 + i * w + j, c = a + 1, e = a + w, f = e + 1;
        b.idx[b.ni++] = a; b.idx[b.ni++] = e; b.idx[b.ni++] = c; b.idx[b.ni++] = c; b.idx[b.ni++] = e; b.idx[b.ni++] = f;
      }
    }
    for (const [ri, ny, tv] of [[0, -1, 0], [n - 1, 1, 1]]) {
      if (R[ri][1] < .003 && R[ri][2] < .003) continue;
      const c = this._put(b, R[ri][3], R[ri][0], R[ri][4], 0, ny, 0, tv, uo, 0, m), base = b.nv;
      for (let j = 0; j <= seg; j++) { const x = at(ri, j, 0), z = at(ri, j, 2); this._put(b, x, R[ri][0], z, 0, ny, 0, tv, (x - R[ri][3]) * s + uo, (z - R[ri][4]) * s, m); }
      for (let j = 0; j < seg; j++) { if (ny > 0) { b.idx[b.ni++] = c; b.idx[b.ni++] = base + j + 1; b.idx[b.ni++] = base + j; } else { b.idx[b.ni++] = c; b.idx[b.ni++] = base + j; b.idx[b.ni++] = base + j + 1; } }
    }
  }
  /** Röhre entlang einer weichen Kurve. rad: Zahl, Liste oder Funktion von 0 bis 1. */
  tube(pts, rad, c, o = {}) {
    M0.copy(this.base); NM.getNormalMatrix(M0); this._tint(c, o);
    const m = this._mat(o, c), uo = this.r() * 4, seg = o.seg ?? 7, sub = o.sub ?? 4;
    this._tube(this.h, subPath(pts, rad, Kit.detail ? sub : 2), m, Kit.detail ? seg : Math.max(3, seg >> 1), uo, o.uv ?? .4);
    if (this.l && !this.noLo) this._tube(this.l, subPath(pts, rad, Math.min(2, sub)), m, Math.max(3, seg >> 1), uo, o.uv ?? .4);
    return this;
  }
  _tube(b, A, m, seg, uo, s) {
    const n = A.length, w = seg + 1, v0 = b.nv; b.room(n * w + 2, (n - 1) * seg * 6 + seg * 6);
    const T = [0, 1, 0]; let N = null, vv = 0;
    for (let i = 0; i < n; i++) {
      const p = A[Math.max(0, i - 1)], q = A[Math.min(n - 1, i + 1)]; let tx = q[0] - p[0], ty = q[1] - p[1], tz = q[2] - p[2]; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      if (!N) { N = Math.abs(ty) < .9 ? [-tz, 0, tx] : [1, 0, 0]; const k = Math.hypot(N[0], N[1], N[2]) || 1; N = [N[0] / k, N[1] / k, N[2] / k]; }
      const dot = N[0] * tx + N[1] * ty + N[2] * tz; let nx = N[0] - dot * tx, ny = N[1] - dot * ty, nz = N[2] - dot * tz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl; N = [nx, ny, nz];
      const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx, r = A[i][3];
      if (i) vv += Math.hypot(A[i][0] - A[i - 1][0], A[i][1] - A[i - 1][1], A[i][2] - A[i - 1][2]);
      T[0] = tx; T[1] = ty; T[2] = tz;
      for (let j = 0; j <= seg; j++) {
        const an = j / seg * TAU, ca = Math.cos(an), sa = Math.sin(an), dx = ca * nx + sa * bx, dy = ca * ny + sa * by, dz = ca * nz + sa * bz;
        this._put(b, A[i][0] + dx * r, A[i][1] + dy * r, A[i][2] + dz * r, dx, dy, dz, i / (n - 1), j / seg * TAU * r * s + uo, vv * s, m);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = v0 + i * w + j, c = a + 1, e = a + w, f = e + 1; b.idx[b.ni++] = a; b.idx[b.ni++] = e; b.idx[b.ni++] = c; b.idx[b.ni++] = c; b.idx[b.ni++] = e; b.idx[b.ni++] = f; }
    const tip = (i, sign) => { const q = A[i], k = this._put(b, q[0], q[1], q[2], T[0] * sign, T[1] * sign, T[2] * sign, i / (n - 1), uo, 0, m), r0 = v0 + i * w; for (let j = 0; j < seg; j++) { if (sign > 0) { b.idx[b.ni++] = k; b.idx[b.ni++] = r0 + j + 1; b.idx[b.ni++] = r0 + j; } else { b.idx[b.ni++] = k; b.idx[b.ni++] = r0 + j; b.idx[b.ni++] = r0 + j + 1; } } };
    tip(n - 1, 1);
    const p0 = A[0], p1 = A[1]; const l0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) || 1; T[0] = (p1[0] - p0[0]) / l0; T[1] = (p1[1] - p0[1]) / l0; T[2] = (p1[2] - p0[2]) / l0;
    tip(0, -1);
  }
  /** Zweiseitige Fläche aus einem Punktegitter, für Umhänge, Flügel, Ohren und Banner. */
  sheet(rows, c, o = {}) {
    M0.copy(this.base); NM.getNormalMatrix(M0); this._tint(c, o);
    const m = this._mat(o, c), uo = this.r() * 4;
    this._sheet(this.h, rows, m, uo, o.uv ?? .5);
    if (this.l && !this.noLo) { const step = Math.max(1, Math.floor(rows.length / 3)), R = rows.filter((_, i) => i % step === 0 || i === rows.length - 1); this._sheet(this.l, R, m, uo, o.uv ?? .5); }
    return this;
  }
  _sheet(b, rows, m, uo, s) {
    const n = rows.length, w = rows[0].length, v0 = b.nv; b.room(n * w * 2, (n - 1) * (w - 1) * 12);
    for (const side of [1, -1]) {
      for (let i = 0; i < n; i++) for (let j = 0; j < w; j++) {
        const a = rows[Math.max(0, i - 1)][j], e = rows[Math.min(n - 1, i + 1)][j], f = rows[i][Math.max(0, j - 1)], g = rows[i][Math.min(w - 1, j + 1)], p = rows[i][j];
        const ux = e[0] - a[0], uy = e[1] - a[1], uz = e[2] - a[2], vx = g[0] - f[0], vy = g[1] - f[1], vz = g[2] - f[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        this._put(b, p[0], p[1], p[2], nx * side, ny * side, nz * side, i / (n - 1), j * s * .5 + uo, i * s * .5, m);
      }
    }
    for (let side = 0; side < 2; side++) {
      const base = v0 + side * n * w;
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < w - 1; j++) {
        const a = base + i * w + j, c = a + 1, e = a + w, f = e + 1;
        if (side) { b.idx[b.ni++] = a; b.idx[b.ni++] = c; b.idx[b.ni++] = e; b.idx[b.ni++] = c; b.idx[b.ni++] = f; b.idx[b.ni++] = e; }
        else { b.idx[b.ni++] = a; b.idx[b.ni++] = e; b.idx[b.ni++] = c; b.idx[b.ni++] = c; b.idx[b.ni++] = e; b.idx[b.ni++] = f; }
      }
    }
  }
  /** Einzelne Blätter auf einer Krone. Ihre Normalen zeigen nach außen, dadurch wirkt die Krone voll. Nur in der Nahversion. */
  leaves(cx, cy, cz, R, n, c, c2, o = {}) {
    if (!Kit.detail) return this;
    M0.copy(this.base); NM.getNormalMatrix(M0); this.f = 1; this.gv = 0; this.hasC2 = true; natural(C, c, { mat: 'leaf' }, this.auto); natural(C2, c2, { mat: 'leaf' }, this.auto);
    const b = this.h, r = this.r, sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1, size = o.size ?? R * .2, m = LAY.leaf, wide = o.slim ? .2 : .55;
    b.room(n * 8, n * 12);
    for (let k = 0; k < n; k++) {
      const yy = r() * 2 - 1, an = r() * TAU, rr = Math.sqrt(1 - yy * yy), dx = Math.cos(an) * rr, dz = Math.sin(an) * rr, q = R * (.82 + r() * .2), px = cx + dx * q * sx, py = cy + yy * q * sy, pz = cz + dz * q * sz;
      const tn = r() * TAU, ax = Math.cos(tn), az = Math.sin(tn), ux = ay0(dx, yy, dz, ax, az, 0), uy = ay0(dx, yy, dz, ax, az, 1), uz = ay0(dx, yy, dz, ax, az, 2), vx = yy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - yy * ux;
      const s = size * (.7 + r() * .6), t = Math.min(1, Math.max(0, yy * .55 + .5 + (r() - .5) * .3)), uo = r() * 4, vo = r() * 4;
      for (const side of [0, 1]) {
        const base = b.nv, lean = .35;
        const put = (a, e, w) => this._put(b, px + ux * a * s + vx * e * s + dx * w * s, py + uy * a * s + vy * e * s + yy * w * s, pz + uz * a * s + vz * e * s + dz * w * s, dx + ux * a * .4, yy + uy * a * .4, dz + uz * a * .4, t, uo + a * .3, vo + e * .3, m);
        put(-1, 0, -lean); put(0, -wide, 0); put(1, 0, lean); put(0, wide, 0);
        if (side) { b.idx[b.ni++] = base; b.idx[b.ni++] = base + 1; b.idx[b.ni++] = base + 2; b.idx[b.ni++] = base; b.idx[b.ni++] = base + 2; b.idx[b.ni++] = base + 3; }
        else { b.idx[b.ni++] = base; b.idx[b.ni++] = base + 2; b.idx[b.ni++] = base + 1; b.idx[b.ni++] = base; b.idx[b.ni++] = base + 3; b.idx[b.ni++] = base + 2; }
      }
    }
    return this;
  }
  build() { const g = this.h.geometry(); this.h = new Buf(); return g; }
  /** Nah- und Fernversion zusammen. */
  buildLOD() { const hi = this.h.geometry(), lo = this.l ? this.l.geometry() : hi; this.h = new Buf(); if (this.l) this.l = new Buf(512, 1536); return { hi, lo }; }
  mesh(mat = MAT.solid) { return new THREE.Mesh(this.build(), mat); }
}
const ay0 = (dx, dy, dz, ax, az, k) => {
  const d = ax * dx + az * dz, x = ax - d * dx, y = -d * dy, z = az - d * dz, l = Math.hypot(x, y, z) || 1;
  return (k === 0 ? x : k === 1 ? y : z) / l;
};
function flatten(t) {
  for (let i = 0; i < t.idx.length; i += 3) {
    const a = t.idx[i] * 3, b = t.idx[i + 1] * 3, c = t.idx[i + 2] * 3, p = t.pos;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const q of [a, b, c]) { t.nor[q] = nx; t.nor[q + 1] = ny; t.nor[q + 2] = nz; }
  }
}

/* ---------- Bildaufbereitung ---------- */
const fsq = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const downFrag = /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 px; uniform float thr;
void main(){
  vec3 c = texture2D(t, vUv).rgb * 4.;
  c += texture2D(t, vUv + px * vec2(-1., -1.)).rgb + texture2D(t, vUv + px * vec2(1., -1.)).rgb + texture2D(t, vUv + px * vec2(-1., 1.)).rgb + texture2D(t, vUv + px * vec2(1., 1.)).rgb;
  c /= 8.;
  if (thr > 0.) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(thr, thr + .7, l); }
  gl_FragColor = vec4(min(c, vec3(5.)), 1.);
}`;
const upFrag = /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 px;
void main(){
  vec3 c = texture2D(t, vUv + px * vec2(-1., 0.)).rgb + texture2D(t, vUv + px * vec2(1., 0.)).rgb + texture2D(t, vUv + px * vec2(0., -1.)).rgb + texture2D(t, vUv + px * vec2(0., 1.)).rgb;
  c += (texture2D(t, vUv + px * vec2(-.5, -.5)).rgb + texture2D(t, vUv + px * vec2(.5, -.5)).rgb + texture2D(t, vUv + px * vec2(-.5, .5)).rgb + texture2D(t, vUv + px * vec2(.5, .5)).rgb) * 2.;
  gl_FragColor = vec4(c / 12. * .85, 1.);
}`;
/* Umgebungsschatten: dunkelt Ecken, Spalten und Kontaktstellen ab. */
const aoFrag = /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D dT; uniform mat4 ip; uniform float pY, asp;
vec3 vp(vec2 u){ float z = texture2D(dT, u).x; vec4 c = ip * vec4(u * 2. - 1., z * 2. - 1., 1.); return c.xyz / c.w; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
void main(){
  float z0 = texture2D(dT, vUv).x;
  if (z0 >= .99999) { gl_FragColor = vec4(1., 1., 0., 1.); return; }
  vec3 P = vp(vUv), N = normalize(cross(dFdx(P), dFdy(P)));
  float Rw = 1.75, rad = min(Rw * pY * .5 / max(-P.z, .6), .11), a0 = ign(gl_FragCoord.xy) * 6.2832, occ = 0.;
  for (int i = 0; i < 6; i++) {
    float t = (float(i) + .5) / 6., a = a0 + float(i) * 2.39996;
    vec3 v = vp(vUv + vec2(cos(a) / asp, sin(a)) * sqrt(t) * rad) - P;
    float l2 = dot(v, v), nv = dot(N, v) / sqrt(l2 + 1e-4);
    occ += max(nv - .08, 0.) * (1. - smoothstep(.2, 1., l2 / (Rw * Rw)));
  }
  float fade = 1. - smoothstep(70., 150., -P.z);
  gl_FragColor = vec4(1. - clamp(occ / 6. * 2.7, 0., .82) * fade, clamp(-P.z / 220., 0., 1.), 0., 1.);
}`;
const aoBlurFrag = /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 px;
void main(){
  vec2 c = texture2D(t, vUv).rg; float s = c.r * 2., w = 2.;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(1.2, .5) : i == 1 ? vec2(-.5, 1.2) : i == 2 ? vec2(-1.2, -.5) : vec2(.5, -1.2);
    vec2 q = texture2D(t, vUv + o * px).rg;
    float k = exp(-abs(q.g - c.g) * 260.);
    s += q.r * k; w += k;
  }
  gl_FragColor = vec4(s / w, c.g, 0., 1.);
}`;
const postFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tex, bloom, aoT, dT;
uniform vec2 res, sunPos;
uniform float hurt, fade, flash, time, warm, levels, shaft, retro, hazeK, useAO;
uniform vec3 shaftC, hazeC, sunC, sunW, camW;
uniform mat4 ipM, cwM;
float bayer(vec2 p){
  ivec2 i = ivec2(mod(p, 4.));
  int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  return float(m[i.y * 4 + i.x]) / 16. - .47;
}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
vec3 film(vec3 x){ return clamp(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main(){
  vec2 px = 1. / res;
  vec3 c = texture2D(tex, vUv).rgb;
  vec3 n = texture2D(tex, vUv + vec2(px.x,0.)).rgb + texture2D(tex, vUv - vec2(px.x,0.)).rgb
         + texture2D(tex, vUv + vec2(0.,px.y)).rgb + texture2D(tex, vUv - vec2(0.,px.y)).rgb;
  c = max(c + (c * 4. - n) * (retro > .5 ? .13 : .05), 0.);
  if (useAO > .5) c *= texture2D(aoT, vUv).r;
  float z = texture2D(dT, vUv).x;
  if (hazeK > .00001 && z < .99999) {
    vec4 vp = ipM * vec4(vUv * 2. - 1., z * 2. - 1., 1.); vp /= vp.w;
    vec3 wp = (cwM * vec4(vp.xyz, 1.)).xyz, rd = wp - camW; float dist = length(rd); rd /= dist;
    float hgt = max(min(wp.y, camW.y) - 4., 0.), f = (1. - exp(-dist * hazeK * exp(-hgt * .016))) * (1. - smoothstep(1180., 1340., dist));
    float mu = max(dot(rd, sunW), 0.);
    c = mix(c, hazeC + sunC * (pow(mu, 4.) * .34 + pow(mu, 28.) * .7), f);
  }
  c += texture2D(bloom, vUv).rgb * .27;
  if (shaft > .01) {
    vec2 st = (sunPos - vUv) / 14., u = vUv + st * ign(gl_FragCoord.xy);
    float dec = 1.; vec3 rays = vec3(0.);
    for (int i = 0; i < 14; i++) { u += st; rays += texture2D(bloom, u).rgb * dec; dec *= .9; }
    c += shaftC * dot(rays, vec3(.33)) * shaft * .075;
  }
  c = film(c * .92);
  c = pow(c, vec3(1. / 2.2));
  float l = dot(c, vec3(.299,.587,.114));
  c = mix(vec3(l), c, 1.04);
  c = clamp(c + (c - .5) * (1. - abs(2. * c - 1.)) * .16, 0., 1.);
  c += mix(vec3(-.012, -.002, .018), vec3(.018, .008, -.014), smoothstep(.1, .8, l));
  c.r += warm * .012; c.b -= warm * .01;
  vec2 q = vUv - .5;
  float v = smoothstep(.98, .36, length(q * vec2(1.05, 1.)));
  c *= mix(.8, 1., v);
  c = mix(c, vec3(.62,.05,.05), hurt * (1. - v) * .9);
  if (retro > .5) c = floor(c * levels + bayer(gl_FragCoord.xy) + .5) / levels;
  else c += (ign(gl_FragCoord.xy + time) - .5) * .012;
  c = mix(c, vec3(1.,.95,.84), flash);
  c *= 1. - fade;
  gl_FragColor = vec4(c, 1.);
}`;

export class Retro {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, stencil: false });
    this.r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.r.toneMapping = THREE.NoToneMapping;
    this.r.setPixelRatio(1);
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFShadowMap;
    // Manche Handys können nicht in Half-Float-Texturen rendern.
    const hdr = this.r.extensions.has('EXT_color_buffer_float') || this.r.extensions.has('EXT_color_buffer_half_float');
    const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, low = { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const depth = new THREE.DepthTexture(4, 4); depth.type = THREE.UnsignedIntType; depth.minFilter = depth.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type, depthBuffer: true, depthTexture: depth, samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.bl = [new THREE.WebGLRenderTarget(4, 4, low), new THREE.WebGLRenderTarget(4, 4, low), new THREE.WebGLRenderTarget(4, 4, low)];
    const aoOpt = { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.aoA = new THREE.WebGLRenderTarget(4, 4, aoOpt); this.aoB = new THREE.WebGLRenderTarget(4, 4, aoOpt);
    this.u = {
      tex: { value: this.rt.texture }, bloom: { value: this.bl[0].texture }, aoT: { value: this.aoB.texture }, dT: { value: depth }, res: { value: new THREE.Vector2(4, 4) }, hurt: { value: 0 }, fade: { value: 0 },
      flash: { value: 0 }, time: { value: 0 }, warm: { value: 0 }, levels: { value: 56 }, shaft: { value: 0 }, retro: { value: 0 }, useAO: { value: 1 }, hazeK: { value: 0 }, sunPos: { value: new THREE.Vector2(.5, .8) }, shaftC: { value: new THREE.Color(0xffd8a0) },
      hazeC: { value: new THREE.Color(0x8fa0a8) }, sunC: { value: new THREE.Color(0xffe0b8) }, sunW: { value: new THREE.Vector3(0, 1, 0) }, camW: { value: new THREE.Vector3() }, ipM: { value: new THREE.Matrix4() }, cwM: { value: new THREE.Matrix4() },
    };
    const pass = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, fragmentShader, vertexShader: fsq, ...extra });
    this.mat = pass(postFrag, this.u);
    this.dn = pass(downFrag, { t: { value: null }, px: { value: new THREE.Vector2() }, thr: { value: 0 } });
    this.up = pass(upFrag, { t: { value: null }, px: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.aoM = pass(aoFrag, { dT: { value: depth }, ip: { value: new THREE.Matrix4() }, pY: { value: 1 }, asp: { value: 1 } });
    this.aoBlur = pass(aoBlurFrag, { t: { value: this.aoA.texture }, px: { value: new THREE.Vector2() } });
    this.q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.q.frustumCulled = false;
    this.ps = new THREE.Scene(); this.ps.add(this.q);
    this.pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.lines = 1080; this.dyn = 1; this.acc = 0; this.cnt = 0; this.hold = 0; this.isRetro = false; this.ao = true;
  }
  /** Modern: glatt und scharf. Retro: Pixel, wackelnde Ecken und wenige Farben. */
  setStyle(retro) {
    this.isRetro = !!retro; this.u.retro.value = retro ? 1 : 0; GFX.snap.value = retro ? 1 : 0;
    this.canvas.style.imageRendering = retro ? 'pixelated' : 'auto';
    const f = retro ? THREE.NearestFilter : THREE.LinearFilter;
    this.rt.texture.minFilter = this.rt.texture.magFilter = f; this.rt.texture.needsUpdate = true;
    this.dyn = 1;
  }
  resize(camera) {
    this.cam = camera;
    const w = innerWidth, h = innerHeight, dpr = this.isRetro ? 1 : Math.min(devicePixelRatio || 1, 2), full = Math.round(h * dpr), ih = Math.min(this.isRetro ? Math.min(this.lines, 540) : this.lines, full), iw = Math.max(2, Math.round(ih * w / h));
    this.r.setSize(iw, ih, false);
    const rh = Math.max(180, Math.round(ih * this.dyn)), rw = Math.max(2, Math.round(rh * w / h));
    this.rt.setSize(rw, rh);
    this.bl.forEach((t, i) => t.setSize(Math.max(2, rw >> (2 + i)), Math.max(2, rh >> (2 + i))));
    this.aoA.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1)); this.aoB.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));
    this.u.res.value.set(rw, rh);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  /** Hält das Spiel flüssig: Bei zu langen Bildern sinkt die Renderauflösung, sonst steigt sie langsam wieder. */
  adapt(ms) {
    if (this.isRetro || ms > 200 || document.hidden) return;
    this.acc += ms; this.cnt++; this.hold = Math.max(0, this.hold - ms);
    if (this.acc < 1000) return;
    const avg = this.acc / this.cnt; this.acc = 0; this.cnt = 0;
    let next = this.dyn;
    this.slow = avg > 34 && this.dyn <= .5 ? (this.slow || 0) + 1 : 0;
    if (this.slow >= 3) { this.slow = 0; this.onSlow?.(); }
    if (avg > 25) { next = Math.max(.5, this.dyn - .12); this.hold = 9000; }
    else if (avg < 18.5 && !this.hold) next = Math.min(1, this.dyn + .06);
    if (Math.abs(next - this.dyn) > .001) { this.dyn = next; this.resize(this.cam); }
  }
  _pass(mat, target) { this.q.material = mat; this.r.setRenderTarget(target); this.r.render(this.ps, this.pc); }
  render(scene, camera) {
    const r = this.r, u = this.u;
    r.autoClear = true;
    // Schatten werden jedes zweite Bild erneuert, das spart spürbar Rechenzeit.
    this.tick = (this.tick || 0) + 1; r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = this.tick % 2 === 0 || this.tick < 4;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.autoClear = false;
    const useAO = this.ao && !this.isRetro;
    u.useAO.value = useAO ? 1 : 0; u.ipM.value = camera.projectionMatrixInverse; u.cwM.value = camera.matrixWorld; camera.getWorldPosition(u.camW.value);
    if (useAO) {
      const A = this.aoM.uniforms; A.ip.value = camera.projectionMatrixInverse; A.pY.value = camera.projectionMatrix.elements[5]; A.asp.value = this.rt.width / this.rt.height;
      this._pass(this.aoM, this.aoA);
      this.aoBlur.uniforms.px.value.set(1 / this.aoA.width, 1 / this.aoA.height);
      this._pass(this.aoBlur, this.aoB);
    }
    const D = this.dn.uniforms, U = this.up.uniforms, B = this.bl;
    D.t.value = this.rt.texture; D.thr.value = 1.05; D.px.value.set(2 / this.rt.width, 2 / this.rt.height); this._pass(this.dn, B[0]);
    D.thr.value = 0;
    for (let i = 1; i < B.length; i++) { D.t.value = B[i - 1].texture; D.px.value.set(1 / B[i - 1].width, 1 / B[i - 1].height); this._pass(this.dn, B[i]); }
    for (let i = B.length - 1; i > 0; i--) { U.t.value = B[i].texture; U.px.value.set(1 / B[i].width, 1 / B[i].height); this._pass(this.up, B[i - 1]); }
    this._pass(this.mat, null);
    r.autoClear = true;
  }
}
