import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT } from '../core/gfx.js';
import { RNG, clamp } from '../core/util.js';
import { REGIONS } from '../data/world.js';
import { heightAt, regionIdx, blockedAt, setTerrainAO, CHUNK, CHUNKS, HALF } from './terrain.js';

const DEF = {
  shroomBig: { r: 1.5, s: [1.3, 2.9], make: k => { k.cyl(.9, 1.35, 7, 0, 3.5, 0, 0xddd3f2, { c2: 0xb9aee2 }); k.dome(4.6, 0, 6.6, 0, 0x7a2fb5, { sy: .72, c2: 0xc24ad0, seg: 10 }); k.cyl(4.5, 4.5, .3, 0, 6.7, 0, 0xf3d7ff, { seg: 10, glow: .35 }); for (const [x, y, z] of [[2, 8.2, 1.5], [-1.8, 8.5, 1.9], [.4, 9.5, -1.4], [-2.6, 7.7, -1.7], [2.8, 7.6, -1.5]]) k.ball(.52, x, y, z, 0xfff1d6, { seg: 5, glow: .75 }); } },
  shroomSmall: { s: [.55, 1.5], make: k => { k.cyl(.22, .32, 1.1, 0, .55, 0, 0xddd3f2, { seg: 5 }); k.dome(.85, 0, 1, 0, 0xb82f4d, { sy: .75, seg: 7, c2: 0xff6a7d }); k.ball(.13, .35, 1.45, .25, 0xfff1d6, { seg: 4, glow: .9 }); k.ball(.11, -.32, 1.38, -.26, 0xfff1d6, { seg: 4, glow: .9 }); } },
  glowcap: { s: [.6, 1.7], make: k => { k.cyl(.16, .24, 1.2, 0, .6, 0, 0x9fe8ff, { seg: 5, glow: .5 }); k.dome(.65, 0, 1.15, 0, 0x34d5ff, { sy: .85, seg: 7, glow: .95, c2: 0xa6f6ff }); k.cyl(.12, .18, .7, .7, .35, .3, 0x9fe8ff, { seg: 4, glow: .5 }); k.dome(.38, .7, .66, .3, 0x34d5ff, { seg: 5, glow: .95 }); } },
  treeBlue: { r: 1, s: [1.1, 2.3], make: k => { k.cyl(.55, 1.05, 7, 0, 3.5, 0, 0x4a3160, { c2: 0x2d2045, seg: 6 }); k.box(.4, 3, .4, 1.3, 6.6, 0, 0x4a3160, { rz: -.7 }); k.box(.4, 3, .4, -1.2, 6.8, .4, 0x4a3160, { rz: .7 }); k.blob(4.4, 0, 10.2, 0, 0x2743b8, { c2: 0x5a7bff, sy: .84, j: .16 }); k.blob(2.9, 3, 8.5, 1, 0x20389e, { c2: 0x4a68e8, j: .16 }); k.blob(2.8, -3.1, 8.9, -.8, 0x3a2fae, { c2: 0x7458f0, j: .16 }); for (let i = 0; i < 7; i++) { const a = i * 2.4; k.oct(.26, Math.cos(a) * 3.8, 8.2 + i * .55, Math.sin(a) * 3.8, 0xfff0b0, { glow: 1 }); } } },
  pine: { r: .8, s: [1, 2.2], make: k => { k.cyl(.35, .7, 3, 0, 1.5, 0, 0x3a2a35, { seg: 5 }); k.cone(3.7, 4.6, 0, 4.4, 0, 0x123f3f, { seg: 7, c2: 0x1f6b5c, j: .2 }); k.cone(2.9, 4, 0, 7, 0, 0x154a48, { seg: 7, c2: 0x287a66, j: .2 }); k.cone(2, 3.4, 0, 9.4, 0, 0x195650, { seg: 6, c2: 0x34907a, j: .2 }); } },
  treeTwist: { r: 1.2, s: [1.2, 2.2], make: k => { k.cyl(.7, 1.3, 4.5, 0, 2.2, 0, 0x2f2438, { seg: 6 }); k.box(.8, 4.2, .8, 1, 5.6, 0, 0x2f2438, { rz: -.55 }); k.box(.6, 3.6, .6, -1.2, 5.4, .3, 0x2f2438, { rz: .8 }); k.box(.4, 2.5, .4, 3, 7.7, 0, 0x2f2438, { rz: .4 }); k.blob(3.2, 3.2, 9.5, .4, 0x173a64, { c2: 0x2f5fa8, j: .18 }); k.blob(2.4, -3.2, 7.4, .5, 0x192f6a, { c2: 0x3a4fb0, j: .18 }); k.ball(.32, .35, 2.6, 1.05, 0xffc445, { seg: 5, glow: 1 }); k.ball(.32, -.35, 2.65, 1.05, 0xffc445, { seg: 5, glow: 1 }); } },
  treeDead: { r: .7, s: [1, 2], make: k => { k.cyl(.3, .75, 6, 0, 3, 0, 0x2b2432, { seg: 5 }); k.box(.25, 3.4, .25, 1, 5.7, .2, 0x2b2432, { rz: -.85 }); k.box(.2, 2.8, .2, -.9, 5, -.2, 0x2b2432, { rz: .95 }); k.box(.16, 2.2, .16, .25, 7, .5, 0x2b2432, { rx: .6 }); k.box(.13, 1.5, .13, 2.2, 7, .2, 0x2b2432, { rz: .4 }); } },
  stump: { r: .9, s: [.8, 1.4], make: k => { k.cyl(.9, 1.1, 1.1, 0, .55, 0, 0x4b3448, { seg: 7 }); k.cyl(.85, .85, .05, 0, 1.12, 0, 0xc29a6d, { seg: 7 }); } },
  rock: { r: 1.2, s: [.7, 2.2], make: k => { k.ico(1.5, 0, .7, 0, 0x565392, { sy: .75, j: .2 }); k.ico(.75, 1.2, .3, .3, 0x47457c, { j: .2 }); } },
  rockRed: { r: 1.6, s: [.8, 3], make: k => { k.ico(1.7, 0, 1.1, 0, 0xa65536, { sy: 1.2, j: .24, c2: 0xdd8a4b }); k.ico(.95, 1.4, .4, .4, 0x8a4630, { j: .2 }); } },
  rockIce: { r: 1.4, s: [.8, 2.4], make: k => { k.ico(1.6, 0, .8, 0, 0x5d78cc, { sy: .85, j: .22, c2: 0xc7dcff }); } },
  rockDark: { r: 1.5, s: [.8, 2.6], make: k => { k.ico(1.7, 0, .9, 0, 0x201a30, { sy: 1, j: .25 }); k.box(.12, 1.6, .12, .3, .9, 1.2, 0xff5a24, { glow: 1, rz: .4 }); } },
  flowerBlue: { grass: 1, s: [.7, 1.5], make: k => { k.box(.05, .5, .05, 0, .25, 0, 0x2f8a63, {}); k.oct(.22, 0, .58, 0, 0x4f7bff, { glow: .95, sy: .55 }); k.ball(.08, 0, .63, 0, 0xfff1b0, { seg: 4, glow: 1 }); } },
  flowerPink: { grass: 1, s: [.7, 1.5], make: k => { k.box(.05, .4, .05, 0, .2, 0, 0x2f8a63, {}); k.oct(.2, 0, .46, 0, 0xff6fd0, { glow: .9, sy: .55 }); } },
  grass: { grass: 1, s: [.7, 1.5], make: k => { for (let i = 0; i < 4; i++) { const a = i * 1.57 + .3; k.cone(.13, .75, Math.cos(a) * .18, .37, Math.sin(a) * .18, 0x3bb07a, { seg: 3, rz: Math.cos(a) * .3, rx: -Math.sin(a) * .3, c2: 0x8fe0a0 }); } } },
  dryGrass: { grass: 1, s: [.7, 1.4], make: k => { for (let i = 0; i < 3; i++) { const a = i * 2.1; k.cone(.1, .8, Math.cos(a) * .15, .4, Math.sin(a) * .15, 0xa77b3b, { seg: 3, rz: Math.cos(a) * .35, c2: 0xe0bb6a }); } } },
  reed: { grass: 1, water: 1, s: [.8, 1.6], make: k => { for (let i = 0; i < 3; i++) { const x = (i - 1) * .22; k.box(.06, 1.8, .06, x, .9, i * .1, 0x5b7a45, {}); k.cyl(.09, .09, .4, x, 1.85, i * .1, 0x5a3a24, { seg: 4 }); } } },
  grave: { r: .7, s: [.8, 1.3], make: k => { k.box(1, 1.4, .25, 0, .7, 0, 0x6c6a8d, { c2: 0x9a98b8 }); k.cyl(.5, .5, .25, 0, 1.4, 0, 0x8c8aac, { rx: 1.57, seg: 8 }); k.box(.12, .55, .05, 0, 1.05, .14, 0x37344d, {}); k.box(.4, .1, .05, 0, 1.13, .14, 0x37344d, {}); } },
  bones: { s: [.7, 1.4], make: k => { k.ball(.42, 0, .32, 0, 0xddd7c2, { seg: 5 }); k.box(.1, .1, .1, -.14, .34, .38, 0x14101e, {}); k.box(.1, .1, .1, .14, .34, .38, 0x14101e, {}); k.box(.11, .11, 1.4, .8, .08, .1, 0xc9c2a8, { ry: .7 }); k.box(.11, .11, 1.1, -.7, .08, -.3, 0xc9c2a8, { ry: -.5 }); } },
  cactus: { r: .7, s: [.9, 2], make: k => { k.cyl(.5, .6, 5, 0, 2.5, 0, 0x2f7a4d, { seg: 6, c2: 0x4fae62 }); k.box(1.2, .36, .36, .8, 2.4, 0, 0x2f7a4d, {}); k.box(.36, 1.5, .36, 1.3, 3.1, 0, 0x3f9458, {}); k.box(1.1, .32, .32, -.75, 3, 0, 0x2f7a4d, {}); k.box(.32, 1.2, .32, -1.2, 3.5, 0, 0x3f9458, {}); k.ball(.25, 0, 5.1, 0, 0xff5ea8, { seg: 5, glow: .8 }); } },
  obelisk: { r: 1.4, s: [1, 1.6], make: k => { k.box(3, .6, 3, 0, .3, 0, 0x8a4630, {}); k.cyl(.7, 1.3, 10, 0, 5.4, 0, 0xb56a3c, { seg: 4, c2: 0xe39a55, ry: .78 }); k.oct(.8, 0, 11, 0, 0xffc445, { glow: 1 }); for (let y = 2; y < 9; y += 1.6) k.box(.5, .25, .05, 0, y, 1.08 - y * .05, 0xffc445, { glow: .9 }); } },
  pineSnow: { r: .8, s: [1, 2.2], make: k => { k.cyl(.35, .7, 3, 0, 1.5, 0, 0x33304a, { seg: 5 }); k.cone(3.6, 4.5, 0, 4.4, 0, 0x234d70, { seg: 7, c2: 0xe6efff, j: .12 }); k.cone(2.8, 4, 0, 7, 0, 0x2a5a80, { seg: 7, c2: 0xeef4ff, j: .12 }); k.cone(1.9, 3.3, 0, 9.3, 0, 0x336a90, { seg: 6, c2: 0xffffff, j: .1 }); } },
  iceSpike: { r: 1, s: [.8, 2.8], make: k => { k.cone(1.4, 7, 0, 3.5, 0, 0x5d86e8, { seg: 5, c2: 0xdff0ff, glow: .25 }); k.cone(.75, 3.6, 1.2, 1.8, .4, 0x7aa4f4, { seg: 4, c2: 0xe9f5ff, glow: .25 }); k.cone(.62, 2.6, -1, 1.3, -.6, 0x7aa4f4, { seg: 4, c2: 0xe9f5ff, glow: .25 }); } },
  crystal: { r: .6, s: [.7, 2], make: k => { k.oct(.9, 0, 1.6, 0, 0x4fc2ff, { sy: 2, glow: .9, c2: 0xc8f4ff }); k.oct(.45, .8, .75, .2, 0x8a6dff, { sy: 1.8, glow: .9 }); k.oct(.38, -.7, .6, -.3, 0x4fc2ff, { sy: 1.7, glow: .9 }); } },
  gear: { r: 2.5, s: [.7, 1.5], make: k => { const R = 3.5; k.torus(R * .78, R * .2, 0, R * .9, 0, 0xc98a33, { seg: 14, ry: .6, c2: 0xf0bd5a }); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; k.box(.7, .95, .45, Math.cos(a) * R * Math.cos(.6), R * .9 + Math.sin(a) * R, -Math.cos(a) * R * Math.sin(.6), 0xb87a2a, { ry: .6, rz: a }); } k.cyl(.55, .55, .6, 0, R * .9, 0, 0x8a5a24, { rx: 1.57, ry: .6, seg: 8 }); } },
  pillar: { r: 1.2, s: [.9, 1.5], make: k => { k.box(2.6, .5, 2.6, 0, .25, 0, 0x6a5778, {}); k.cyl(.85, .95, 7, 0, 4, 0, 0x8e7a9c, { seg: 8, c2: 0xb8a4c0 }); k.box(2.3, .5, 2.3, 0, 7.7, 0, 0xc98a33, { }); } },
  copperTree: { r: .9, s: [1, 1.9], make: k => { k.cyl(.3, .7, 6, 0, 3, 0, 0x8c5a2e, { seg: 5, c2: 0xc98a33 }); for (let i = 0; i < 6; i++) { const a = i * 1.05; k.box(.12, 2.4, .12, Math.cos(a) * .9, 6.3 + (i % 2) * .6, Math.sin(a) * .9, 0xc98a33, { rz: -Math.cos(a) * .7, rx: Math.sin(a) * .7 }); k.oct(.6, Math.cos(a) * 1.8, 7.5 + (i % 2) * .6, Math.sin(a) * 1.8, 0x3fe0b0, { glow: .7 }); } } },
  spike: { r: 1.1, s: [.8, 2.8], make: k => { k.cone(1.4, 7.5, 0, 3.7, 0, 0x1a1428, { seg: 4, rz: .08, c2: 0x45304f, j: .2 }); k.cone(.7, 3.6, 1.1, 1.8, .3, 0x241a33, { seg: 4, rz: -.2 }); k.box(.09, 2.5, .09, .3, 1.5, .85, 0xff4a20, { glow: 1, rz: .2 }); } },
  ember: { grass: 1, s: [.5, 1.3], make: k => { k.oct(.2, 0, .6, 0, 0xff7a28, { glow: 1 }); k.oct(.1, .3, 1, .2, 0xffc445, { glow: 1 }); k.oct(.08, -.25, 1.25, -.2, 0xffe08a, { glow: 1 }); } },
};

const NAMES = Object.keys(DEF);
const typeIdx = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const cache = new Map();

function chunkList(cx, cz) {
  const key = cx + cz * CHUNKS;
  let list = cache.get(key);
  if (list) return list;
  list = { items: [], cols: [] };
  const rng = RNG(Math.imul(cx + 3, 73856093) ^ Math.imul(cz + 7, 19349663));
  const x0 = cx * CHUNK - HALF, z0 = cz * CHUNK - HALF, seen = new Set();
  for (const [u, v] of [[.05, .05], [.95, .05], [.05, .95], [.95, .95], [.5, .5]]) seen.add(regionIdx(x0 + u * CHUNK, z0 + v * CHUNK));
  for (const r of seen) {
    for (const [name, density] of Object.entries(REGIONS[r].props)) {
      const def = DEF[name], n = density < 1 ? (rng() < density ? 1 : 0) : Math.round(density);
      for (let i = 0; i < n; i++) {
        const x = x0 + rng() * CHUNK, z = z0 + rng() * CHUNK, ry = rng() * 6.283, s = rng.range(def.s[0], def.s[1]);
        if (regionIdx(x, z) !== r || blockedAt(x, z)) continue;
        const y = heightAt(x, z);
        if (def.water ? y > 2.4 : y < .75) continue;
        const dy = Math.abs(heightAt(x + 2, z) - y) + Math.abs(heightAt(x, z + 2) - y);
        if (dy > 2.6 && !def.r) continue;
        list.items.push({ t: typeIdx[name], x, y: y - .06, z, ry, s, grass: !!def.grass, solid: !!def.r });
        if (def.r) list.cols.push({ x, z, r: def.r * Math.min(s, 2) });
      }
    }
  }
  cache.set(key, list);
  return list;
}

export class Props {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.cx = -999; this.cz = -999;
    this.meshes = NAMES.map((n, i) => {
      const k = new Kit(1000 + i); DEF[n].make(k);
      const m = new THREE.InstancedMesh(k.build(), MAT.solid, DEF[n].grass ? 4200 : 1400);
      m.frustumCulled = false; m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
      return m;
    });
    this.radius = 3; this.grassRadius = 2; this.thin = false;
    // Bäume und große Pilze werfen einen weichen Schatten auf den Boden.
    setTerrainAO((x, z) => {
      const R0 = 14, c0 = clamp(Math.floor((x - R0 + HALF) / CHUNK), 0, CHUNKS - 1), c1 = clamp(Math.floor((x + R0 + HALF) / CHUNK), 0, CHUNKS - 1), d0 = clamp(Math.floor((z - R0 + HALF) / CHUNK), 0, CHUNKS - 1), d1 = clamp(Math.floor((z + R0 + HALF) / CHUNK), 0, CHUNKS - 1);
      let dark = 0;
      for (let b = d0; b <= d1; b++) for (let a = c0; a <= c1; a++) for (const c of chunkList(a, b).cols) {
        const R = Math.min(R0, c.r * 4.2 + 2.5), dx = c.x - x, dz = c.z - z, q = dx * dx + dz * dz;
        if (q < R * R) { const k = 1 - Math.sqrt(q) / R; if (k > dark) dark = k; }
      }
      return dark * dark * .28 + dark * .22;
    });
  }
  colliders(x, z) {
    const cx = clamp(Math.floor((x + HALF) / CHUNK), 0, CHUNKS - 1), cz = clamp(Math.floor((z + HALF) / CHUNK), 0, CHUNKS - 1);
    return chunkList(cx, cz).cols;
  }
  update(px, pz, force = false) {
    const cx = clamp(Math.floor((px + HALF) / CHUNK), 0, CHUNKS - 1), cz = clamp(Math.floor((pz + HALF) / CHUNK), 0, CHUNKS - 1);
    if (!force && cx === this.cx && cz === this.cz) return;
    this.cx = cx; this.cz = cz;
    for (const m of this.meshes) m.count = 0;
    const R = this.radius;
    for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || z < 0 || x >= CHUNKS || z >= CHUNKS) continue;
      const d = Math.hypot(x - cx, z - cz);
      if (d > R + .5) continue;
      const items = chunkList(x, z).items;
      for (let n = 0; n < items.length; n++) {
        const it = items[n];
        if (it.grass && d > this.grassRadius + .5) continue;
        // Sparmodus: Hindernisse bleiben sichtbar, von der Deko nur jedes dritte Stück.
        if (this.thin && !it.solid && n % 3) continue;
        const m = this.meshes[it.t];
        if (m.count >= m.instanceMatrix.count) continue;
        const e = m.instanceMatrix.array, a = m.count * 16, c = Math.cos(it.ry) * it.s, s = Math.sin(it.ry) * it.s;
        e[a] = c; e[a + 1] = 0; e[a + 2] = -s; e[a + 3] = 0; e[a + 4] = 0; e[a + 5] = it.s; e[a + 6] = 0; e[a + 7] = 0;
        e[a + 8] = s; e[a + 9] = 0; e[a + 10] = c; e[a + 11] = 0; e[a + 12] = it.x; e[a + 13] = it.y; e[a + 14] = it.z; e[a + 15] = 1;
        m.count++;
      }
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
