import * as THREE from '../../vendor/three.module.js';
import { clamp, lerp, smooth, fbm, ridged, vnoise, nextFrame } from '../core/util.js';
import { MAT, waterTex } from '../core/gfx.js';
import { WORLD, REGIONS, POIS, POI, ROADS } from '../data/world.js';

export const CELL = 4, N = WORLD / CELL, N1 = N + 1, HALF = WORLD / 2, CHUNK = 80, CHUNK_CELLS = CHUNK / CELL, CHUNKS = WORLD / CHUNK;
export const H = new Float32Array(N1 * N1), REG = new Uint8Array(N1 * N1), COL = new Uint8Array(N1 * N1 * 3), BLOCK = new Uint8Array(N1 * N1), ROAD = new Uint8Array(N1 * N1);
const id = (i, j) => j * N1 + i;
const nR = REGIONS.length, wts = new Float64Array(nR);
const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const pal = REGIONS.map(r => ({ low: rgb(r.low), high: rgb(r.high), alt: rgb(r.alt), rock: rgb(r.rock) }));
const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);

// Niederfrequente Felder werden grob berechnet und interpoliert. Das spart beim Laden viel Zeit.
const CM = N / 4, CM1 = CM + 1, COARSE = new Float32Array(CM1 * CM1 * 5);
function buildCoarse() {
  for (let j = 0; j < CM1; j++) for (let i = 0; i < CM1; i++) {
    const x = i * CELL * 4 - HALF, z = j * CELL * 4 - HALF, a = (j * CM1 + i) * 5;
    COARSE[a] = (fbm(x * .004 + 11, z * .004 + 5, 3) - .5) * 190;
    COARSE[a + 1] = (fbm(x * .004 - 8, z * .004 + 21, 3) - .5) * 190;
    COARSE[a + 2] = fbm(x * .018 + 3, z * .018 - 9, 3);
    COARSE[a + 3] = fbm(x * .006 - 4, z * .006 + 8, 2);
    COARSE[a + 4] = fbm(x * .0011 + 7, z * .0011 - 3, 3) - .5;
  }
}
const cv = new Float32Array(5);
function coarseAt(i, j) {
  const fx = Math.min(CM - .001, i / 4), fz = Math.min(CM - .001, j / 4), xi = fx | 0, zi = fz | 0, tx = fx - xi, tz = fz - zi;
  const a = (zi * CM1 + xi) * 5, b = a + 5, c = a + CM1 * 5, d = c + 5;
  for (let k = 0; k < 5; k++) cv[k] = (COARSE[a + k] * (1 - tx) + COARSE[b + k] * tx) * (1 - tz) + (COARSE[c + k] * (1 - tx) + COARSE[d + k] * tx) * tz;
}
function regionWeights(x, z) {
  const wx = x + cv[0], wz = z + cv[1];
  let sum = 0, best = 0, bv = -1;
  for (let r = 0; r < nR; r++) {
    const c = REGIONS[r].c, dx = wx - c[0], dz = wz - c[1], d = (dx * dx + dz * dz) / 1e4 + .4, w = 1 / (d * d * d);
    wts[r] = w; sum += w;
    if (w > bv) { bv = w; best = r; }
  }
  for (let r = 0; r < nR; r++) wts[r] /= sum;
  return best;
}

function sample(i, j) {
  coarseAt(i, j);
  const x = i * CELL - HALF, z = j * CELL - HALF, reg = regionWeights(x, z);
  let base = 0, amp = 0, rid = 0, dune = 0, cr = 0, cg = 0, cb = 0;
  const patch = cv[2], hue = cv[3];
  for (let r = 0; r < nR; r++) {
    const w = wts[r]; if (w < .002) continue;
    const R = REGIONS[r], p = pal[r], t = smooth(.36, .66, patch), a = smooth(.46, .68, hue);
    base += R.base * w; amp += R.amp * w; rid += R.ridge * w; dune += R.dune * w;
    for (let k = 0; k < 3; k++) {
      const c = lerp(lerp(p.low[k], p.high[k], t), p.alt[k], a * .55) * w;
      if (k === 0) cr += c; else if (k === 1) cg += c; else cb += c;
    }
  }
  const big = cv[4], n = fbm((x + 900) * .0052, (z - 400) * .0052, 5) - .5, rr = ridged(x * .0038 + 3, z * .0038 + 9, 4);
  let h = base + big * amp * 1.7 + n * amp + rr * rr * rid;
  if (dune > .1) h += dune * (Math.sin((x + z * .45) * .055 + n * 6) * .5 + .5);
  const e = smooth(.87, 1, Math.max(Math.abs(x), Math.abs(z)) / HALF);
  h = lerp(h, -22, e);
  const k = id(i, j);
  H[k] = h; REG[k] = reg;
  COL[k * 3] = cr; COL[k * 3 + 1] = cg; COL[k * 3 + 2] = cb;
}

function stamp(px, pz, radius, fn) {
  const i0 = clamp(Math.floor((px - radius + HALF) / CELL), 0, N), i1 = clamp(Math.ceil((px + radius + HALF) / CELL), 0, N),
    j0 = clamp(Math.floor((pz - radius + HALF) / CELL), 0, N), j1 = clamp(Math.ceil((pz + radius + HALF) / CELL), 0, N);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = i * CELL - HALF, z = j * CELL - HALF, d = Math.hypot(x - px, z - pz);
    if (d <= radius) fn(id(i, j), d);
  }
}

function flattenPois() {
  for (const p of POIS) {
    const target = p.h = Math.max(p.type === 'town' ? 5 : 2.4, heightRaw(p.x, p.z));
    const R = p.r, margin = p.type === 'town' ? 46 : 26;
    stamp(p.x, p.z, R + margin, (k, d) => {
      const t = smooth(R + margin, R * .86, d);
      H[k] = lerp(H[k], target, t);
      if (d < R) BLOCK[k] = 1;
    });
  }
}

export const roadLines = [];
function buildRoads() {
  for (const road of ROADS) {
    const pts = road.map(q => {
      const c = typeof q === 'string' ? [POI[q].x, POI[q].z] : q;
      return new THREE.Vector3(c[0], 0, c[1]);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength(), n = Math.ceil(L / 5), line = [];
    for (let i = 0; i <= n; i++) {
      const v = curve.getPointAt(i / n);
      line.push({ x: v.x, z: v.z, h: heightRaw(v.x, v.z) });
    }
    for (let pass = 0; pass < 2; pass++) {
      const src = line.map(q => q.h);
      for (let i = 0; i < line.length; i++) {
        let s = 0, c = 0;
        for (let k = -8; k <= 8; k++) { const q = src[i + k]; if (q !== undefined) { s += q; c++; } }
        line[i].h = Math.max(1.1, s / c);
      }
    }
    for (const q of line) {
      stamp(q.x, q.z, 15, (k, d) => {
        const t = smooth(15, 6, d);
        H[k] = lerp(H[k], q.h, t * .85);
        if (d < 8) { BLOCK[k] = 1; ROAD[k] = 1; }
      });
    }
    roadLines.push(line);
  }
}

function shade() {
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = id(i, j), hR = H[id(Math.min(N, i + 1), j)], hL = H[id(Math.max(0, i - 1), j)], hU = H[id(i, Math.max(0, j - 1))], hD = H[id(i, Math.min(N, j + 1))];
    const slope = Math.hypot(hR - hL, hD - hU) / (2 * CELL), h = H[k], r = REG[k], p = pal[r];
    let c0 = COL[k * 3], c1 = COL[k * 3 + 1], c2 = COL[k * 3 + 2];
    const rk = smooth(.5, .95, slope);
    c0 = lerp(c0, p.rock[0], rk); c1 = lerp(c1, p.rock[1], rk); c2 = lerp(c2, p.rock[2], rk);
    if (h > 74 && r !== 3) {
      const s = smooth(74, 104, h + vnoise(i * .2, j * .2) * 10) * (1 - rk * .55);
      c0 = lerp(c0, 216, s); c1 = lerp(c1, 226, s); c2 = lerp(c2, 255, s);
    }
    if (h < 2.2) {
      const s = smooth(2.2, .1, h);
      c0 = lerp(c0, 62, s); c1 = lerp(c1, 58, s); c2 = lerp(c2, 96, s);
    }
    const j1 = (vnoise(i * .9, j * .9) - .5) * 40;
    COL[k * 3] = clamp(c0 + j1, 0, 255); COL[k * 3 + 1] = clamp(c1 + j1, 0, 255); COL[k * 3 + 2] = clamp(c2 + j1, 0, 255);
  }
}

function heightRaw(x, z) {
  const fx = clamp((x + HALF) / CELL, 0, N - .001), fz = clamp((z + HALF) / CELL, 0, N - .001), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
  const a = H[id(i, j)], b = H[id(i + 1, j)], c = H[id(i, j + 1)], d = H[id(i + 1, j + 1)];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
export const heightAt = heightRaw;
export const regionIdx = (x, z) => REG[id(clamp(Math.round((x + HALF) / CELL), 0, N), clamp(Math.round((z + HALF) / CELL), 0, N))];
export const regionAt = (x, z) => REGIONS[regionIdx(x, z)];
export const blockedAt = (x, z) => BLOCK[id(clamp(Math.round((x + HALF) / CELL), 0, N), clamp(Math.round((z + HALF) / CELL), 0, N))] === 1;
export const onRoad = (x, z) => ROAD[id(clamp(Math.round((x + HALF) / CELL), 0, N), clamp(Math.round((z + HALF) / CELL), 0, N))] === 1;
export const colorAt = (x, z) => {
  const k = id(clamp(Math.round((x + HALF) / CELL), 0, N), clamp(Math.round((z + HALF) / CELL), 0, N));
  return [COL[k * 3], COL[k * 3 + 1], COL[k * 3 + 2]];
};

export async function buildTerrain(progress) {
  buildCoarse();
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) sample(i, j);
    if (j % 48 === 0) { progress(.05 + j / N * .45, 'Die Welt erhebt sich'); await nextFrame(); }
  }
  flattenPois();
  progress(.52, 'Straßen werden gepflastert'); await nextFrame();
  buildRoads();
  progress(.58, 'Farben werden gemischt'); await nextFrame();
  shade();
}

let aoAt = null;
export const setTerrainAO = fn => { aoAt = fn; };

function gridGeometry(size, step, offsetY, x0, z0) {
  const v = Math.round(size / step) + 1, pos = new Float32Array(v * v * 3), nor = new Float32Array(v * v * 3), col = new Float32Array(v * v * 3), uv = new Float32Array(v * v * 2), rough = new Float32Array(v * v), bio = new Float32Array(v * v * 2), idx = [];
  let a = 0;
  for (let q = 0; q < v; q++) for (let p = 0; p < v; p++, a++) {
    const x = x0 + p * step, z = z0 + q * step, gi = clamp(Math.round((x + HALF) / CELL), 0, N), gj = clamp(Math.round((z + HALF) / CELL), 0, N), k = id(gi, gj);
    pos[a * 3] = x; pos[a * 3 + 1] = H[k] + offsetY; pos[a * 3 + 2] = z;
    const dx = H[id(Math.min(N, gi + 1), gj)] - H[id(Math.max(0, gi - 1), gj)], dz = H[id(gi, Math.min(N, gj + 1))] - H[id(gi, Math.max(0, gj - 1))];
    const l = Math.hypot(dx, 2 * CELL, dz);
    nor[a * 3] = -dx / l; nor[a * 3 + 1] = 2 * CELL / l; nor[a * 3 + 2] = -dz / l;
    const ao = aoAt ? 1 - aoAt(x, z) : 1;
    col[a * 3] = LIN[COL[k * 3]] * ao; col[a * 3 + 1] = LIN[COL[k * 3 + 1]] * ao; col[a * 3 + 2] = LIN[COL[k * 3 + 2]] * (ao * .9 + .1);
    uv[a * 2] = x * .16; uv[a * 2 + 1] = z * .16;
    const rid = REGIONS[REG[k]].id; rough[a] = rid === 'desert' ? .08 : rid === 'frost' ? .16 : rid === 'ash' ? .35 : 1;
    bio[a * 2] = rid === 'desert' ? 1 : 0; bio[a * 2 + 1] = rid === 'frost' ? 1 : smooth(74, 100, H[k]);
    if (p < v - 1 && q < v - 1) { const b = a + 1, c = a + v, d = c + 1; idx.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aRough', new THREE.BufferAttribute(rough, 1));
  g.setAttribute('aBio', new THREE.BufferAttribute(bio, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export class Terrain {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.map = new Map();
    this.cx = -999; this.cz = -999;
    this.radius = 5;
    this.queue = [];
    const far = new THREE.Mesh(gridGeometry(WORLD, 20, -1.6, -HALF, -HALF), MAT.terrain);
    far.frustumCulled = false;
    this.group.add(far);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(4800, 4800), MAT.water);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = .1;
    this.water.renderOrder = 2;
    this.group.add(this.water);
    this.buildRoadMesh();
  }
  buildRoadMesh() {
    const pos = [], col = [], uv = [], nor = [], idx = [];
    let base = 0;
    for (const line of roadLines) {
      let s = 0;
      for (let i = 0; i < line.length; i++) {
        const q = line[i], a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
        let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const w = 3.6 + vnoise(q.x * .05, q.z * .05) * 1.2, r = REGIONS[regionIdx(q.x, q.z)], c = new THREE.Color(r.id === 'desert' ? 0xc7a273 : r.id === 'frost' ? 0xaab8ea : r.id === 'ash' ? 0x5a4f6a : 0x8e86c4);
        for (const side of [-1, 1]) {
          const x = q.x - tz * w * side, z = q.z + tx * w * side;
          pos.push(x, heightRaw(x, z) + .16, z); nor.push(0, 1, 0); col.push(c.r, c.g, c.b); uv.push(side < 0 ? 0 : 1, s / 7.5);
        }
        s += 5;
        if (i < line.length - 1) { const v = base + i * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
      }
      base += line.length * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, MAT.road);
    m.frustumCulled = false; m.receiveShadow = true;
    this.group.add(m);
  }
  update(px, pz, t, budget = 2) {
    const cx = clamp(Math.floor((px + HALF) / CHUNK), 0, CHUNKS - 1), cz = clamp(Math.floor((pz + HALF) / CHUNK), 0, CHUNKS - 1);
    if (cx !== this.cx || cz !== this.cz) {
      this.cx = cx; this.cz = cz;
      const want = new Set(); this.queue = [];
      for (let z = cz - this.radius; z <= cz + this.radius; z++) for (let x = cx - this.radius; x <= cx + this.radius; x++) {
        if (x < 0 || z < 0 || x >= CHUNKS || z >= CHUNKS || Math.hypot(x - cx, z - cz) > this.radius + .5) continue;
        const key = x + z * CHUNKS; want.add(key);
        if (!this.map.has(key)) this.queue.push({ x, z, key, d: Math.hypot(x - cx, z - cz) });
      }
      this.queue.sort((a, b) => b.d - a.d);
      for (const [key, m] of this.map) if (!want.has(key)) { this.group.remove(m); m.geometry.dispose(); this.map.delete(key); }
    }
    for (let i = 0; i < budget && this.queue.length; i++) {
      const c = this.queue.pop();
      const m = new THREE.Mesh(gridGeometry(CHUNK, CELL, 0, c.x * CHUNK - HALF, c.z * CHUNK - HALF), MAT.terrain);
      m.receiveShadow = true;
      this.group.add(m); this.map.set(c.key, m);
    }
    this.water.position.x = px; this.water.position.z = pz;
    waterTex.offset.set((px / 4800 * 80 + t * .012) % 1, (-pz / 4800 * 80 + t * .008) % 1);
  }
  flush(px, pz) { this.cx = -999; this.update(px, pz, 0, 200); }
}
