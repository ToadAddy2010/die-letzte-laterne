import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT } from '../core/gfx.js';
import { RNG, strHash, clamp, lerp } from '../core/util.js';
import { G } from '../game/state.js';
import { buildInterior } from './interior.js';

export const THEMES = {
  cave: { floor: 0x3a3a70, wall: 0x4a4677, wall2: 0x7c5ab8, trim: 0x2d2a56, light: 0x4fc2ff, fog: 0x0a0a2a, pack: ['shroomling', 'shroomling', 'spore_bat', 'goblin'], deco: 'mushroom' },
  root: { floor: 0x2c3a30, wall: 0x3a2a3a, wall2: 0x4a7a52, trim: 0x201820, light: 0x57f0a0, fog: 0x081410, pack: ['wolf', 'goblin', 'goblin_archer', 'root_creeper'], deco: 'root' },
  goblin: { floor: 0x4a3c30, wall: 0x5a4634, wall2: 0x7a5a40, trim: 0x2c2018, light: 0xff8a30, fog: 0x160c08, pack: ['goblin', 'goblin', 'goblin_archer', 'goblin_shaman', 'goblin_brute'], deco: 'banner' },
  bone: { floor: 0x38344a, wall: 0x45405c, wall2: 0x8a8678, trim: 0x221e30, light: 0x7ff2c8, fog: 0x081214, pack: ['skeleton', 'skeleton', 'skeleton_archer', 'skeleton_knight', 'ghost'], deco: 'bones' },
  sun: { floor: 0xa87844, wall: 0xc9924e, wall2: 0xe8c07e, trim: 0x6a4424, light: 0xffc445, fog: 0x201006, pack: ['sun_cultist', 'fire_imp', 'scorpion', 'sun_cultist', 'mummy'], deco: 'obelisk' },
  ice: { floor: 0x5f7fd0, wall: 0x5564b4, wall2: 0xc6d6ff, trim: 0x2d3a80, light: 0x9fe4ff, fog: 0x0a1440, pack: ['ice_wraith', 'frost_wolf', 'ice_wraith', 'frost_knight'], deco: 'ice' },
  clock: { floor: 0x5a4640, wall: 0x6a4a44, wall2: 0xc98a33, trim: 0x34222a, light: 0xffc445, fog: 0x140c10, pack: ['clock_knight', 'gear_spider', 'gear_spider', 'clock_mage'], deco: 'gear' },
  shadow: { floor: 0x241c30, wall: 0x2a2238, wall2: 0x5a2c4a, trim: 0x120c18, light: 0xff4a2a, fog: 0x08040e, pack: ['shadow_knight', 'dark_wizard', 'skeleton_knight', 'shadow_hound'], deco: 'spike' },
};

const CS = 5, GRID = 72, HEIGHT = 11;

export class Dungeon {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.grid = new Uint8Array(GRID * GRID);
    this.mesh = null;
    this.active = null;
    this.cols = []; this.boxes = []; this.walls = []; this.ceil = 10;
  }
  idx(i, j) { return j * GRID + i; }
  cellAt(x, z) { return [Math.floor(x / CS), Math.floor(z / CS)]; }
  isWall(x, z) {
    const i = Math.floor(x / CS), j = Math.floor(z / CS);
    if (i < 0 || j < 0 || i >= GRID || j >= GRID || this.grid[this.idx(i, j)] === 0) return true;
    for (const b of this.walls) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
    return false;
  }
  collide(p, r) {
    for (let pass = 0; pass < 2; pass++) {
      const ci = Math.floor(p.x / CS), cj = Math.floor(p.z / CS);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        if (i >= 0 && j >= 0 && i < GRID && j < GRID && this.grid[this.idx(i, j)] !== 0) continue;
        const x0 = i * CS, x1 = x0 + CS, z0 = j * CS, z1 = z0 + CS;
        const nx = clamp(p.x, x0, x1), nz = clamp(p.z, z0, z1), dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { p.x = (Math.floor(p.x / CS) + .5) * CS; p.z = (Math.floor(p.z / CS) + .5) * CS; }
      }
      for (const c of this.cols) {
        const dx = p.x - c.x, dz = p.z - c.z, min = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), k = (min - d) / d; p.x += dx * k; p.z += dz * k; }
      }
      for (const b of this.boxes) {
        const nx = clamp(p.x, b.x0, b.x1), nz = clamp(p.z, b.z0, b.z1), dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { const l = p.x - b.x0, R = b.x1 - p.x, u = p.z - b.z0, D = b.z1 - p.z, m = Math.min(l, R, u, D); if (m === l) p.x = b.x0 - r; else if (m === R) p.x = b.x1 + r; else if (m === u) p.z = b.z0 - r; else p.z = b.z1 + r; }
      }
    }
  }
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 1.2);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.isWall(lerp(ax, bx, t), lerp(az, bz, t))) return false; }
    return true;
  }
  generate(poi) {
    const r = RNG(strHash(poi.id) + 17), g = this.grid; g.fill(0);
    const rooms = [], count = poi.rooms;
    let cx = 36, cz = 62;
    for (let n = 0; n < count; n++) {
      const boss = n === count - 1, w = boss ? 17 : n === 0 ? 7 : r.int(7, 13), d = boss ? 17 : n === 0 ? 7 : r.int(7, 12);
      let room = null;
      for (let tries = 0; tries < 60 && !room; tries++) {
        const prev = rooms[n - 1];
        let x, z;
        if (!prev) { x = cx - (w >> 1); z = cz - (d >> 1); }
        else {
          const dir = r.pick([[0, -1], [0, -1], [1, 0], [-1, 0]]), gap = r.int(3, 6);
          x = dir[0] ? (dir[0] > 0 ? prev.x + prev.w + gap : prev.x - w - gap) : prev.x + r.int(-3, 3);
          z = dir[1] ? prev.z - d - gap : prev.z + r.int(-3, 3);
        }
        if (x < 2 || z < 2 || x + w > GRID - 2 || z + d > GRID - 2) continue;
        if (rooms.some(o => x < o.x + o.w + 1 && x + w + 1 > o.x && z < o.z + o.d + 1 && z + d + 1 > o.z)) continue;
        room = { x, z, w, d, boss };
      }
      if (!room) {
        for (let q = 0; q < 900 && !room; q++) {
          const x = r.int(2, GRID - w - 2), z = r.int(2, GRID - d - 2);
          if (!rooms.some(o => x < o.x + o.w + 1 && x + w + 1 > o.x && z < o.z + o.d + 1 && z + d + 1 > o.z)) room = { x, z, w, d, boss };
        }
      }
      if (!room) continue;
      rooms.push(room);
      for (let j = room.z; j < room.z + room.d; j++) for (let i = room.x; i < room.x + room.w; i++) g[this.idx(i, j)] = 1;
    }
    rooms[rooms.length - 1].boss = true;
    const carve = (i, j) => { if (i > 0 && j > 0 && i < GRID - 1 && j < GRID - 1 && g[this.idx(i, j)] === 0) g[this.idx(i, j)] = 2; };
    for (let n = 1; n < rooms.length; n++) {
      const a = rooms[n - 1], b = rooms[n];
      let i = a.x + (a.w >> 1), j = a.z + (a.d >> 1); const ti = b.x + (b.w >> 1), tj = b.z + (b.d >> 1);
      const step = () => { for (let q = 0; q < 2; q++) for (let w = 0; w < 2; w++) carve(i + q, j + w); };
      if (r() < .5) { while (i !== ti) { step(); i += Math.sign(ti - i); } while (j !== tj) { step(); j += Math.sign(tj - j); } }
      else { while (j !== tj) { step(); j += Math.sign(tj - j); } while (i !== ti) { step(); i += Math.sign(ti - i); } }
      step();
    }
    return { rooms, r };
  }
  enter(poi) {
    this.leave();
    const th = THEMES[poi.theme], { rooms, r } = this.generate(poi), g = this.grid;
    this.cols = [];
    const lights = [], k = new Kit(strHash(poi.id));
    for (const q of rooms) {
      const n = q.boss ? 8 : 4;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + .78, x = (q.x + q.w / 2 + Math.cos(a) * (q.w / 2 - 1.2)) * CS, z = (q.z + q.d / 2 + Math.sin(a) * (q.d / 2 - 1.2)) * CS;
        lights.push({ x, z });
      }
    }
    const warm = new THREE.Color(th.light), a0 = new THREE.Color(th.floor), a1 = new THREE.Color(), tmp = new THREE.Color();
    const lit = (x, z, base) => {
      let v = 0; for (const l of lights) { const d = Math.hypot(l.x - x, l.z - z); if (d < 20) v = Math.max(v, 1 - d / 20); }
      tmp.set(base).multiplyScalar(.42 + v * .78).lerp(warm, v * v * .24);
      return tmp.getHex();
    };
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const x = (i + .5) * CS, z = (j + .5) * CS, f = g[this.idx(i, j)];
      if (f) {
        const c = (i + j) % 2 ? th.floor : a1.set(th.floor).multiplyScalar(.82).getHex();
        k.box(CS, .5, CS, x, -.25, z, lit(x, z, c), { j: .1 });
        if (r() < .34) k.box(CS * .42, .06, CS * .28, x + r.range(-1, 1), .03, z + r.range(-1, 1), lit(x, z, th.trim), { j: .2 });
      } else {
        let edge = false;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const u = i + a, v = j + b;
          if (u >= 0 && v >= 0 && u < GRID && v < GRID && g[this.idx(u, v)]) edge = true;
        }
        if (!edge) continue;
        const cl = lit(x, z, th.wall), cr = lit(x, z, th.wall2);
        k.box(CS, HEIGHT, CS, x, HEIGHT / 2, z, cl, { j: .14, c2: cr });
        k.box(CS + .1, .7, CS + .1, x, .35, z, lit(x, z, th.trim), {});
        k.box(CS + .3, .6, CS + .3, x, HEIGHT, z, lit(x, z, th.trim), {});
      }
    }
    for (const l of lights) {
      const fx = Math.floor(l.x / CS), fz = Math.floor(l.z / CS);
      if (g[this.idx(fx, fz)]) {
        k.cyl(.26, .36, 4, l.x, 2, l.z, 0x241a22, { seg: 6 });
        k.cone(.8, 1.7, l.x, 4.6, l.z, th.light, { seg: 5, glow: 1 });
        k.oct(.42, l.x, 4.45, l.z, 0xffffff, { glow: 1 });
        this.cols.push({ x: l.x, z: l.z, r: .55 });
      }
    }
    for (let n = 0; n < rooms.length; n++) {
      const q = rooms[n], area = q.w * q.d, count = q.boss ? 6 : Math.floor(area / 18);
      for (let i = 0; i < count; i++) {
        const x = (q.x + r.range(1.2, q.w - 1.2)) * CS, z = (q.z + r.range(1.2, q.d - 1.2)) * CS;
        if (q.boss && Math.hypot(x - (q.x + q.w / 2) * CS, z - (q.z + q.d / 2) * CS) < 24) continue;
        this.deco(k, th.deco, x, z, r, th);
      }
    }
    const b = rooms[rooms.length - 1], bx = (b.x + b.w / 2) * CS, bz = (b.z + b.d / 2) * CS;
    k.torus(26, .5, bx, .08, bz, th.light, { rx: 1.57, seg: 26, glow: 1 });
    k.cyl(4, 4, .1, bx, .05, bz, th.light, { seg: 16, glow: .5 });
    const s = rooms[0], sx = (s.x + s.w / 2) * CS, sz = (s.z + s.d / 2) * CS;
    k.cyl(3.4, 3.8, .3, sx, .15, sz + 8, 0x8a86b0, { seg: 8 });
    k.oct(1, sx, 2.1, sz + 8, 0x9fe4ff, { glow: 1, sy: 1.6 });
    this.mesh = k.mesh();
    this.group.add(this.mesh);
    this.group.visible = true;

    const spawns = [], chests = [];
    for (let n = 1; n < rooms.length - 1; n++) {
      const q = rooms[n], cnt = Math.max(2, Math.floor((q.w * q.d) / 24));
      for (let i = 0; i < cnt; i++) {
        const x = (q.x + r.range(1.5, q.w - 1.5)) * CS, z = (q.z + r.range(1.5, q.d - 1.5)) * CS;
        spawns.push({ type: r.pick(th.pack), x, z, room: n });
      }
      if (r() < .6 || n === rooms.length - 2) chests.push({ id: `${poi.id}_c${n}`, x: (q.x + q.w / 2) * CS, z: (q.z + 1.1) * CS, rich: n === rooms.length - 2 });
    }
    this.active = { poi, rooms, th, spawns, chests, start: { x: sx, z: sz }, exit: { x: sx, z: sz + 8 }, boss: { x: bx, z: bz, room: b } };
    return this.active;
  }
  deco(k, type, x, z, r, th) {
    if (this.isWall(x, z)) return;
    const c = (h, opt = {}) => opt;
    if (type === 'mushroom') { const s = r.range(.8, 2); k.cyl(.3 * s, .42 * s, 2 * s, x, s, z, 0xcfc6e8, { seg: 5 }); k.dome(1.2 * s, x, 1.9 * s, z, r() < .5 ? 0x34d5ff : 0xc24ad0, { seg: 7, glow: .85, sy: .8 }); this.cols.push({ x, z, r: .5 * s }); }
    else if (type === 'root') { for (let i = 0; i < 3; i++) k.box(.4, .4, r.range(3, 6), x + r.range(-1, 1), .2, z + r.range(-1, 1), 0x3a2a3a, { ry: r() * 6 }); k.oct(.4, x, .6, z, 0x57f0a0, { glow: 1 }); }
    else if (type === 'banner') { k.box(.2, 5, .2, x, 2.5, z, 0x3c2830, {}); k.box(1.6, 2.6, .08, x + .8, 3.6, z, 0xa8302c, {}); k.ball(.4, x, 5.3, z, 0xe8e2cc, { seg: 5 }); this.cols.push({ x, z, r: .4 }); }
    else if (type === 'bones') { k.ball(.5, x, .4, z, 0xddd7c2, { seg: 5 }); k.box(.14, .14, 1.8, x + .7, .1, z, 0xc9c2a8, { ry: r() * 6 }); k.box(.14, .14, 1.3, x - .4, .1, z + .6, 0xc9c2a8, { ry: r() * 6 }); }
    else if (type === 'obelisk') { k.cyl(.3, .7, 4.4, x, 2.2, z, th.wall2, { seg: 4 }); k.oct(.4, x, 4.8, z, 0xffc445, { glow: 1 }); this.cols.push({ x, z, r: .7 }); }
    else if (type === 'ice') { k.cone(.9, r.range(2.4, 5), x, 1.5, z, 0x7aa4f4, { seg: 4, c2: 0xe3f2ff, glow: .4 }); this.cols.push({ x, z, r: .7 }); }
    else if (type === 'gear') { k.torus(1.5, .36, x, 1.6, z, 0xc98a33, { ry: r() * 6, seg: 10 }); k.box(.7, 1.6, .7, x, .8, z, 0x5a4640, {}); this.cols.push({ x, z, r: .9 }); }
    else if (type === 'spike') { k.cone(.8, r.range(2.5, 5), x, 1.6, z, 0x1a1428, { seg: 4 }); k.box(.08, 1.6, .08, x + .2, .9, z + .45, 0xff4a20, { glow: 1 }); this.cols.push({ x, z, r: .7 }); }
  }
  enterHouse(h) {
    this.leave();
    this.grid.fill(0);
    const k = new Kit(strHash(h.id)), a = buildInterior(this, h, k);
    this.mesh = k.mesh();
    this.group.add(this.mesh);
    this.group.visible = true;
    this.active = a;
    return a;
  }
  leave() {
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.group.visible = false; this.active = null; this.cols = []; this.boxes = []; this.walls = []; this.ceil = 10;
    G.house = null;
  }
}
