import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT } from '../core/gfx.js';
import { RNG, strHash, TAU } from '../core/util.js';
import { POIS } from '../data/world.js';
import { regionAt, heightAt, onRoad } from './terrain.js';
import { addBox, addCircle } from './collision.js';
import { G } from '../game/state.js';
import { NPCS } from '../data/npcs.js';
import { BUILDING_NAMES, FAMILIES } from '../data/houses.js';

const HOUSES = [];
const WIN = 0xffc25a, WIN2 = 0xff7a3a, WINB = 0x7fd8ff;
const STY = {
  pilz: { h: 'shroom', stone: 0x7c78b8, plaza: 0x5e5a9a, lamp: 0xffb845 },
  forest: { h: 'timber', wall: 0x8a7458, beam: 0x2f2028, roof: 0x24645a, roof2: 0x35507a, stone: 0x4e4a70, plaza: 0x46425f, lamp: 0xffb845 },
  moor: { h: 'bone', wall: 0x4a4658, beam: 0x25202e, roof: 0x3a3048, roof2: 0x4a3a30, stone: 0x45405c, plaza: 0x3c3850, lamp: 0x7ff2c8 },
  desert: { h: 'adobe', wall: 0xd9a766, beam: 0x8a5230, roof: 0xe8c07e, roof2: 0x3fa7a0, stone: 0xb8854e, plaza: 0xc59a62, lamp: 0xffd070 },
  frost: { h: 'frost', wall: 0x6a78b0, beam: 0x2d3560, roof: 0xdde8ff, roof2: 0xbcd0ff, stone: 0x5564a8, plaza: 0x7f90cc, lamp: 0x9fe4ff },
  clock: { h: 'copper', wall: 0x7a4f40, beam: 0x3c2830, roof: 0xc98a33, roof2: 0x3f9e88, stone: 0x5c4660, plaza: 0x5a4a5e, lamp: 0xffc445 },
  ash: { h: 'ash', wall: 0x2c2436, beam: 0x151020, roof: 0x41243a, roof2: 0x241a30, stone: 0x2a2238, plaza: 0x2a2234, lamp: 0xff5a2a },
};

function windows(k, w, h, z, col = WIN, n = 2) {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w / 2 + (i + .5) * (w / n);
    k.box(1, 1.3, .1, x, h, z, col, { glow: 1, j: .2 });
    k.box(1.25, .13, .14, x, h + .72, z, 0x2a1c20, {}); k.box(1.25, .13, .14, x, h - .72, z, 0x2a1c20, {}); k.box(.1, 1.3, .14, x, h, z + .02, 0x2a1c20, {});
  }
}
function door(k, z, col = 0x4a2c20, w = 1.8, h = 3) {
  k.box(w, h, .2, 0, h / 2, z, col, {}); k.box(w + .4, .25, .3, 0, h + .1, z, 0x2a1c20, {});
  k.ball(.11, w * .3, h * .46, z + .14, 0xffd070, { seg: 4, glow: 1 });
}
function shroomHouse(k, r) {
  const R = r.range(4, 5.8), h = r.range(5, 7), cap = r.pick([[0x7a2fb5, 0xc24ad0], [0xb82f4d, 0xff6a7d], [0x3347bd, 0x5f86ff], [0xc95a24, 0xffa640]]);
  k.cyl(R * .9, R, h, 0, h / 2, 0, 0xe6dcc8, { seg: 10, c2: 0xc9b9a8 });
  k.dome(R * 1.75, 0, h - .3, 0, cap[0], { sy: .9, seg: 12, c2: cap[1] });
  k.cyl(R * 1.72, R * 1.72, .3, 0, h - .3, 0, 0xf6e4ff, { seg: 12, glow: .3 });
  for (let i = 0; i < 8; i++) { const a = i * 2.4, q = R * (.5 + (i % 3) * .3); k.ball(.55, Math.cos(a) * q, h + R * 1.32 - q * .62, Math.sin(a) * q, 0xfff4dc, { seg: 5, glow: .6 }); }
  k.at(0, 0, R * .95); door(k, 0, 0x6b3a26); windows(k, R * 1.5, h * .68, .02, WIN, 2); k.pop();
  k.box(1.1, 2.3, 1.1, R * .5, h + R * .95, -R * .3, 0x7a6a78, {});
  return [R + .6, R + .6];
}
function timberHouse(k, r, s) {
  const w = r.range(7, 10), d = r.range(7, 10), h = r.range(4, 5), up = r() < .55 ? r.range(3, 3.6) : 0, roof = r() < .6 ? s.roof : s.roof2, H = h + up;
  k.box(w, h, d, 0, h / 2, 0, s.wall, { c2: s.wall }); k.box(w + .5, .4, d + .5, 0, .2, 0, s.stone, {});
  if (up) k.box(w + .7, up, d + .7, 0, h + up / 2, 0, s.wall, {});
  for (const x of [-w / 2, w / 2, 0]) k.box(.34, h, .2, x, h / 2, d / 2 + .05, s.beam, {});
  for (const y of [h, H]) k.box(w + .9, .32, d + .9, 0, y, 0, s.beam, {});
  if (up) for (let x = -w / 2; x <= w / 2; x += w / 3) { k.box(.28, up, .16, x, h + up / 2, d / 2 + .42, s.beam, {}); k.box(.2, up * 1.2, .14, x + w / 6, h + up / 2, d / 2 + .42, s.beam, { rz: x > 0 ? .55 : -.55 }); }
  const rh = w * .62;
  k.prism(w + 1.5, rh, d + 1.3, 0, H, 0, roof, { j: .16 });
  for (let i = 0; i < 4; i++) k.box(w + 1.55, .16, .3, 0, H + i * rh / 4 + .15, d / 2 + .61 - i * .02, 0x000000, { j: 0 });
  k.box(1.1, 3.6, 1.1, w * .28, H + rh * .62, -d * .24, s.stone, {});
  k.at(0, 0, d / 2 + .12); door(k, 0); windows(k, w * .8, h * .62, 0, WIN, 2); if (up) windows(k, w * .8, h + up * .52, .36, WIN, 3); k.pop();
  return [w / 2 + .8, d / 2 + .8];
}
function boneHouse(k, r, s) {
  const w = r.range(7, 9), d = r.range(7, 10), h = r.range(4, 5);
  k.box(w, h, d, 0, h / 2, 0, s.wall, { c2: 0x62586e }); k.prism(w + 1.2, w * .68, d + 1, 0, h, 0, s.roof, { j: .22 });
  for (let z = -d / 2; z <= d / 2; z += 1.8) for (const sd of [-1, 1]) k.box(.22, w * .78, .22, sd * w * .26, h + w * .33, z, 0xd9d3bc, { rz: sd * .63 });
  k.ball(.8, 0, h + .8, d / 2 + .3, 0xe8e2cc, { seg: 6 }); k.box(.25, .25, .1, -.28, h + .9, d / 2 + 1, 0x7ff2c8, { glow: 1 }); k.box(.25, .25, .1, .28, h + .9, d / 2 + 1, 0x7ff2c8, { glow: 1 });
  k.at(0, 0, d / 2 + .1); door(k, 0, 0x2a2230); windows(k, w * .84, h * .55, 0, 0x7ff2c8, 2); k.pop();
  return [w / 2 + .6, d / 2 + .6];
}
function adobeHouse(k, r, s) {
  const w = r.range(7, 11), d = r.range(7, 10), h = r.range(4, 6.5), dome = r() < .6;
  k.box(w, h, d, 0, h / 2, 0, s.wall, { c2: 0xecc98a });
  k.box(w + .5, .34, d + .5, 0, h, 0, s.beam, {});
  if (dome) k.dome(Math.min(w, d) * .44, 0, h, 0, s.roof2, { seg: 10, c2: 0x7fe0cc });
  else for (let x = -w / 2; x <= w / 2; x += 1.5) { k.box(.75, .75, .5, x, h + .5, d / 2, s.wall, {}); k.box(.75, .75, .5, x, h + .5, -d / 2, s.wall, {}); }
  k.at(0, 0, d / 2 + .1);
  k.box(2.2, 3, .2, 0, 1.5, 0, 0x4a2c20, {}); k.cyl(1.1, 1.1, .2, 0, 3, 0, 0x4a2c20, { rx: 1.57, seg: 8 });
  windows(k, w * .84, h * .62, 0, WIN, 2);
  k.box(1, h * .7, .08, -w * .32, h * .55, .08, r() < .5 ? 0xb8302c : 0x2f6fb0, {}); k.pop();
  return [w / 2 + .5, d / 2 + .5];
}
function frostHouse(k, r, s) {
  const w = r.range(7, 10), d = r.range(7, 10), h = r.range(4, 5.2);
  k.box(w, h, d, 0, h / 2, 0, s.wall, { c2: 0x8c9ad0 }); k.box(w + .5, 1, d + .5, 0, .5, 0, s.stone, {});
  k.prism(w + 1.4, w * .95, d + 1.3, 0, h, 0, s.roof, { j: .08 });
  for (let x = -w / 2; x < w / 2; x += .9) k.cone(.16, r.range(.5, 1.5), x, h - .55, d / 2 + .62, 0xbfe4ff, { seg: 4, rx: Math.PI, glow: .3 });
  k.box(1, 3.2, 1, w * .26, h + w * .6, 0, s.stone, {});
  k.at(0, 0, d / 2 + .1); door(k, 0, 0x2d3560); windows(k, w * .8, h * .62, 0, WIN, 2); k.pop();
  return [w / 2 + .7, d / 2 + .7];
}
function copperHouse(k, r, s) {
  const w = r.range(7, 10), d = r.range(7, 10), h = r.range(5, 8);
  k.box(w, h, d, 0, h / 2, 0, s.wall, { c2: 0x94604a });
  for (let y = 1; y < h; y += 1.4) k.box(w + .08, .1, d + .08, 0, y, 0, 0x4a3030, {});
  k.prism(w + 1, w * .45, d + 1, 0, h, 0, r() < .5 ? s.roof : s.roof2, { j: .14 });
  k.cyl(.8, 1, 5, -w * .28, h + 2.4, -d * .2, 0xb87a2a, { seg: 7 }); k.torus(.9, .15, -w * .28, h + 4.7, -d * .2, 0xf0bd5a, { rx: 1.57 });
  const R = Math.min(w, h) * .2;
  k.torus(R, R * .26, w * .22, h * .78, d / 2 + .1, 0xe0a542, {}); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.box(.3, .4, .2, w * .22 + Math.cos(a) * R * 1.2, h * .78 + Math.sin(a) * R * 1.2, d / 2 + .1, 0xe0a542, { rz: a }); }
  k.at(0, 0, d / 2 + .1); door(k, 0, 0x2c1e24); windows(k, w * .36, h * .3, 0, WIN, 1); k.pop();
  return [w / 2 + .6, d / 2 + .6];
}
function ashHouse(k, r, s) {
  const w = r.range(7, 9), d = r.range(7, 9), h = r.range(3.5, 4.8);
  k.box(w, h, d, 0, h / 2, 0, s.wall, { c2: 0x3e3448 }); k.prism(w + 1, w * .4, d + 1, 0, h, 0, s.roof, { j: .25 });
  for (const x of [-w / 2, w / 2]) k.cone(.5, 3, x, h + .9, d / 2, 0x151020, { seg: 4 });
  k.at(0, 0, d / 2 + .1); door(k, 0, 0x151020); windows(k, w * .8, h * .6, 0, WIN2, 2); k.pop();
  return [w / 2 + .5, d / 2 + .5];
}
const HOUSE = { shroom: shroomHouse, timber: timberHouse, bone: boneHouse, adobe: adobeHouse, frost: frostHouse, copper: copperHouse, ash: ashHouse };

export function lampPost(k, x, y, z, col = 0xffb845, h = 4.2) {
  k.cyl(.11, .17, h, x, y + h / 2, z, 0x2a2030, { seg: 5 });
  k.box(.75, .1, .1, x + .3, y + h - .1, z, 0x2a2030, {});
  k.box(.5, .68, .5, x + .6, y + h - .55, z, col, { glow: 1 });
  k.cone(.42, .35, x + .6, y + h - .05, z, 0x2a2030, { seg: 4 });
}
function well(k, s) {
  k.cyl(3.1, 3.3, 1.3, 0, .65, 0, s.stone, { seg: 12 });
  k.cyl(2.6, 2.6, .06, 0, 1.33, 0, 0x4fc2ff, { seg: 12, glow: .85 });
  for (const x of [-2.6, 2.6]) k.box(.38, 5.2, .38, x, 2.6, 0, 0x3c2830, {});
  k.prism(6.6, 1.5, 2.8, 0, 5.1, 0, s.roof ?? 0x7a2fb5, {});
}
function stall(k, r, s) {
  const c = r.pick([0xc23a3a, 0x3a6ac2, 0xd4a13a, 0x7a3ac2]);
  k.box(5, 1.1, 2.1, 0, .55, 0, 0x5a3c2c, {});
  for (const [x, z] of [[-2.4, -1], [2.4, -1], [-2.4, 1], [2.4, 1]]) k.box(.16, 3.2, .16, x, 1.6, z, 0x3c2830, {});
  k.prism(5.5, .9, 2.9, 0, 3.2, 0, c, {});
  for (let i = 0; i < 7; i++) k.ball(.25, -2 + i * .66, 1.34, r.range(-.5, .5), r.pick([0xff5a4a, 0xffc445, 0x6ae06a, 0xc87aff]), { seg: 4 });
}

function shopSign(k, h) {
  const x = 2.75, z = h.hd - .15, y = 3.9;
  k.at(h.lx, 0, h.lz, h.yaw);
  k.box(.14, .14, 1.15, x, y + 1.05, z + .35, 0x2a2030, {});
  for (const a of [-.34, .34]) k.box(.05, .34, .05, x, y + .82, z + .62 + a * .3, 0x2a2030, {});
  k.box(.14, 1.3, 1.3, x, y, z + .68, 0x5a3c26, { c2: 0x7a5233 });
  for (const q of [-.86, .86]) k.at(x + q * .1, y, z + .68, q > 0 ? Math.PI / 2 : -Math.PI / 2);
  k.pop(); k.pop();
  for (const side of [-1, 1]) {
    const px = x + side * .1, pz = z + .68;
    if (h.kind === 'inn') { k.box(.05, .56, .42, px, y - .05, pz, 0xffc445, { glow: .95 }); k.box(.05, .14, .46, px, y + .25, pz, 0xfff4dc, { glow: 1 }); k.box(.05, .34, .1, px, y - .03, pz + .3, 0xffc445, { glow: .95 }); }
    else if (h.kind === 'smith') { k.box(.05, .72, .13, px, y - .08, pz, 0xd8d0c0, { glow: .7 }); k.box(.05, .26, .66, px, y + .28, pz, 0xc8cfe8, { glow: .95 }); }
    else if (h.kind === 'shop') { k.cyl(.36, .36, .05, px, y, pz, 0xffc445, { rz: 1.57, seg: 9, glow: 1 }); k.box(.06, .36, .08, px, y, pz, 0x7a5a20, {}); }
    else { k.oct(.42, px, y, pz, 0xb48aff, { sx: .12, glow: 1 }); k.box(.05, .1, .1, px, y + .38, pz + .35, 0xffffff, { glow: 1 }); }
  }
  k.pop();
}

function buildTown(p) {
  const r = RNG(strHash(p.id)), reg = regionAt(p.x, p.z), s = STY[reg.id], k = new Kit(strHash(p.id) + 5), place = HOUSE[s.h], local = [];
  k.at(p.x, p.h, p.z);
  k.cyl(27, 28, .3, 0, .08, 0, s.plaza, { seg: 22, j: .1 });
  k.torus(27, .5, 0, .2, 0, s.stone, { rx: 1.57, seg: 22 });
  well(k, s); addCircle(p.x, p.z, 3.6);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + .7, x = Math.cos(a) * 20, z = Math.sin(a) * 20, yaw = Math.round((Math.atan2(-x, -z)) / (TAU / 4)) * (TAU / 4);
    k.at(x, 0, z, yaw); stall(k, r, s); k.pop();
    const sw = Math.abs(Math.sin(yaw)) > .5; addBox(p.x + x, p.z + z, sw ? 1.4 : 2.8, sw ? 2.8 : 1.4);
  }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .3; lampPost(k, Math.cos(a) * 25.5, .05, Math.sin(a) * 25.5, s.lamp); }
  const rings = [[37, 9], [58, 13], [78, 15]];
  rings.forEach(([rad, n], ri) => {
    const off = r() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + i / n * TAU, gap = Math.abs(Math.sin(a * 2));
      if (ri > 0 && gap < .16) continue;
      if (ri === 2 && p.r < 80) continue;
      const rr = rad + r.range(-1.5, 2), x = Math.cos(a) * rr, z = Math.sin(a) * rr, yaw = Math.round(Math.atan2(-x, -z) / (TAU / 4)) * (TAU / 4);
      const wx = p.x + x, wz = p.z + z;
      if ([[0, 0], [7, 0], [-7, 0], [0, 7], [0, -7]].some(([u, v]) => onRoad(wx + u, wz + v))) continue;
      if (POIS.some(o => o.type === 'shrine' && Math.hypot(o.x - wx, o.z - wz) < 16)) continue;
      k.at(x, 0, z, yaw);
      const [hw, hd] = place(k, r, s);
      k.box(.36, .46, .36, 0, 3.75, hd - .48, s.lamp, { glow: 1 });
      k.box(.5, .08, .5, 0, 4.02, hd - .48, 0x2a2030, {});
      k.pop();
      const sw = Math.abs(Math.sin(yaw)) > .5; addBox(p.x + x, p.z + z, sw ? hd : hw, sw ? hw : hd);
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      local.push({ id: `${p.id}_h${local.length}`, town: p.id, region: reg.id, lvl: reg.lvl, style: s.h, x: wx, z: wz, lx: x, lz: z, y: p.h, yaw, hw, hd, dist: rr, doorX: wx + sy * (hd + 1.3), doorZ: wz + cy * (hd + 1.3) });
    }
  });
  const services = Object.entries(NPCS).filter(([, n]) => n.town === p.id && (n.shop || n.inn)), near = [...local].sort((a, b) => a.dist - b.dist);
  for (const [id, n] of services) {
    const h = near.shift(); if (!h) break;
    h.npc = id; h.name = BUILDING_NAMES[id] || n.n; h.kind = n.inn ? 'inn' : n.shop === 'smith' ? 'smith' : n.shop === 'general' ? 'shop' : 'magic';
    shopSign(k, h);
  }
  for (const h of near) {
    h.kind = r.pick(['home', 'home', 'home', 'family', 'family', 'study', 'workshop']);
    h.family = FAMILIES[strHash(h.id) % FAMILIES.length];
    h.name = `Haus ${h.family}`;
  }
  HOUSES.push(...local);
  k.pop();
  return k;
}

function shrine(p, parent) {
  const k = new Kit(strHash(p.id));
  k.at(p.x, p.h, p.z);
  k.cyl(3.4, 3.8, .6, 0, .3, 0, 0x6c6890, { seg: 8 }); k.cyl(2.5, 2.9, .5, 0, .85, 0, 0x8a86b0, { seg: 8 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .78; k.box(.4, 2, .4, Math.cos(a) * 2.9, 1.5, Math.sin(a) * 2.9, 0x5c5880, {}); k.oct(.28, Math.cos(a) * 2.9, 2.8, Math.sin(a) * 2.9, 0x7fd0ff, { glow: 1 }); }
  k.cyl(.2, .34, 4, 0, 3, 0, 0x2a2030, { seg: 6 }); k.box(1.6, .16, .16, .45, 4.9, 0, 0x2a2030, {});
  k.box(1.05, .1, 1.05, 1, 4.1, 0, 0x2a2030, {}); k.box(1.05, .1, 1.05, 1, 3.1, 0, 0x2a2030, {});
  for (const [x, z] of [[.55, -.45], [1.45, -.45], [.55, .45], [1.45, .45]]) k.box(.08, 1, .08, x, 3.6, z, 0x2a2030, {});
  k.pop(); addCircle(p.x, p.z, 3.1);
  const f = new Kit(strHash(p.id) + 1);
  f.oct(.42, 0, 0, 0, 0xffc445, { glow: 1, sy: 1.25 });
  const flame = f.mesh(); flame.position.set(p.x + 1, p.h + 3.6, p.z); flame.visible = false; parent.add(flame);
  (G.shrineFlames ??= {})[p.id] = flame;
  return k;
}

function camp(p) {
  const r = RNG(strHash(p.id)), k = new Kit(strHash(p.id) + 3), hot = p.pack.startsWith('cult') || p.pack === 'imps', bone = /skel|bog/.test(p.pack), ice = /frost|wraith|yeti/.test(p.pack), tent = hot ? 0x9a3226 : bone ? 0x3c3448 : ice ? 0x5f7fd0 : p.pack === 'clockwork' || p.pack === 'gears' ? 0x7a5230 : p.pack === 'mages' || p.pack === 'shadows' ? 0x3a1f55 : 0x5e6a38;
  k.at(p.x, p.h, p.z);
  k.cyl(1.5, 1.7, .4, 0, .2, 0, 0x3c3448, { seg: 8 });
  k.cone(1.05, 2.3, 0, 1.45, 0, 0xff7a28, { seg: 5, glow: 1 }); k.cone(.55, 1.5, .3, 1.1, .2, 0xffd070, { seg: 4, glow: 1 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + r() * .5, x = Math.cos(a) * 13, z = Math.sin(a) * 13, yaw = Math.round(Math.atan2(-x, -z) / (TAU / 4)) * (TAU / 4);
    k.at(x, 0, z, yaw); k.prism(6, 3.6, 6.5, 0, 0, 0, tent, { j: .2 }); k.box(1.4, 2.1, .1, 0, 1, 3.28, 0x1a1420, {}); k.pop();
    addCircle(p.x + x, p.z + z, 3.2);
  }
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * TAU; if (Math.abs(Math.sin(a * 1.5)) < .17) continue;
    const q = 24 + r.range(-.8, .8);
    k.cyl(.28, .36, 3.2, Math.cos(a) * q, 1.5, Math.sin(a) * q, bone ? 0xd2ccb4 : 0x5a3c2c, { seg: 5, rz: r.range(-.1, .1) });
    k.cone(.34, .8, Math.cos(a) * q, 3.5, Math.sin(a) * q, bone ? 0xe8e2cc : 0x7a5a40, { seg: 5 });
  }
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .78; k.box(.14, 3.8, .14, Math.cos(a) * 19, 1.9, Math.sin(a) * 19, 0x2a2030, {}); k.ball(.42, Math.cos(a) * 19, 4, Math.sin(a) * 19, 0xe8e2cc, { seg: 5 }); }
  k.pop();
  return k;
}

const DOORS = { cave: [0x4a4677, 0x4fc2ff], root: [0x3a2a3a, 0x57f0a0], goblin: [0x5a4a38, 0xff7a28], bone: [0x5a5470, 0x7ff2c8], sun: [0xb8854e, 0xffc445], ice: [0x5f7fd0, 0x9fe4ff], clock: [0x7a5230, 0xffc445], shadow: [0x241a30, 0xff3a2a] };
function exterior(p, k) {
  const id = p.id;
  if (id === 'zitadelle') {
    k.box(70, 28, 26, 0, 14, -24, 0x2a2238, { c2: 0x463a58 });
    for (let x = -34; x <= 34; x += 4) k.box(2, 2.4, 26.2, x, 29, -24, 0x352c46, {});
    k.box(40, 62, 34, 0, 31, -46, 0x241c30, { c2: 0x3e3350 });
    for (const [x, z, R, h] of [[-36, -14, 8, 54], [36, -14, 8, 54], [-24, -44, 7, 88], [24, -44, 7, 88], [0, -62, 11, 122], [-46, -40, 6, 66], [46, -40, 6, 66]]) {
      k.cyl(R, R * 1.14, h, x, h / 2, z, 0x2a2238, { seg: 10, c2: 0x483c5c });
      k.cone(R * 1.35, R * 3.2, x, h + R * 1.6, z, 0x4a1c3a, { seg: 10, c2: 0x8a2c4a });
      for (let y = 10; y < h - 3; y += 8) for (const a of [0, .6, -.6]) k.box(.9, 2.3, .1, x + Math.sin(a) * (R + .05), y, z + Math.cos(a) * (R + .05), 0xff5a2a, { glow: 1, ry: a });
      addCircle(p.x + x, p.z + z, R + 1);
    }
    addBox(p.x, p.z - 38, 46, 25);
    k.box(11, 16, 1, 0, 8, -10.6, 0x12091c, {});
    for (let i = 0; i < 10; i++) k.box(14 + (9 - i) * 2, .6, 2, 0, .3 + i * .05, -9 + i * 2, 0x352c46, {});
  } else if (id === 'goblinfeste') {
    for (let i = 0; i < 44; i++) { const a = i / 44 * TAU; if (Math.abs(a - Math.PI * 1.5) < .34 || Math.abs(a - Math.PI * .5) < .34) continue; k.cyl(.8, .95, 12, Math.cos(a) * 36, 6, Math.sin(a) * 36 - 18, 0x5a3c2c, { seg: 6, c2: 0x7a5a40 }); k.cone(.95, 2.2, Math.cos(a) * 36, 13, Math.sin(a) * 36 - 18, 0x8a6a4c, { seg: 6 }); addCircle(p.x + Math.cos(a) * 36, p.z + Math.sin(a) * 36 - 18, 1.2); }
    k.box(26, 14, 20, 0, 7, -32, 0x4a3c30, { c2: 0x6a5a40 }); k.prism(29, 12, 23, 0, 14, -32, 0x7a2c20, { j: .2 }); addBox(p.x, p.z - 32, 14, 11);
    for (const x of [-16, 16]) { k.cyl(5, 6, 24, x, 12, -14, 0x5a4634, { seg: 8 }); k.cone(7, 8, x, 28, -14, 0x7a2c20, { seg: 8 }); addCircle(p.x + x, p.z - 14, 6.4); }
    k.ball(5, 0, 20, -21.5, 0xe8e2cc, { seg: 8 }); k.box(1.8, 1.8, .4, -2, 21, -17, 0xff5a2a, { glow: 1 }); k.box(1.8, 1.8, .4, 2, 21, -17, 0xff5a2a, { glow: 1 });
    k.box(9, 12, 1, 0, 6, -21.6, 0x1a1016, {});
  } else if (id === 'sonnengrab') {
    for (let i = 0; i < 9; i++) { const s = 62 - i * 6.6; k.box(s, 5, s, 0, 2.5 + i * 5, -36, i % 2 ? 0xc9924e : 0xd8a662, { c2: 0xecc98a }); }
    k.oct(5.5, 0, 53, -36, 0xffc445, { glow: 1 }); addBox(p.x, p.z - 36, 32, 32);
    k.box(11, 13, 1, 0, 6.5, -4.4, 0x2a1408, {});
    for (const x of [-11, 11]) { k.box(4, 14, 4, x, 7, -3, 0xb8854e, { c2: 0xe8c07e }); k.ball(2.4, x, 16, -3, 0xffc445, { seg: 6, glow: 1 }); addBox(p.x + x, p.z - 3, 2.2, 2.2); }
  } else if (id === 'frostfeste') {
    k.box(58, 24, 24, 0, 12, -28, 0x4f60ac, { c2: 0xbfd0ff }); addBox(p.x, p.z - 28, 30, 13);
    for (const [x, z, R, h] of [[-30, -16, 7, 42], [30, -16, 7, 42], [-16, -40, 7, 62], [16, -40, 7, 62], [0, -46, 9, 88]]) { k.cyl(R, R * 1.12, h, x, h / 2, z, 0x5564b4, { seg: 10, c2: 0xc6d6ff }); k.cone(R * 1.32, R * 3, x, h + R * 1.5, z, 0xe6efff, { seg: 10 }); addCircle(p.x + x, p.z + z, R + 1); }
    k.box(10, 14, 1, 0, 7, -15.6, 0x0c1438, {});
    for (let i = 0; i < 16; i++) k.cone(1.4, 7, -28 + i * 3.7, 21, -15.5, 0xbfe4ff, { seg: 4, rx: Math.PI, glow: .3 });
  } else if (id === 'uhrwerk') {
    k.box(36, 44, 30, 0, 22, -28, 0x6a4a44, { c2: 0x8e6650 }); addBox(p.x, p.z - 28, 19, 16);
    k.torus(13, 1, 0, 30, -12.6, 0xf0bd5a, { seg: 22 }); k.cyl(12.4, 12.4, .4, 0, 30, -13, 0xf0e6c8, { rx: 1.57, seg: 22, glow: .5 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box(.6, 2, .2, Math.cos(a) * 10.8, 30 + Math.sin(a) * 10.8, -12.7, 0x241420, { rz: a + 1.57 }); }
    k.box(.7, 9, .25, 0, 34, -12.6, 0x241420, {}); k.box(.7, 7, .25, 2.6, 31.6, -12.55, 0x241420, { rz: -1.25 });
    k.cone(14, 20, 0, 54, -28, 0xc98a33, { seg: 4, ry: .78, c2: 0x3f9e88 }); k.box(9, 12, 1, 0, 6, -12.6, 0x1a1016, {});
  } else if (id === 'knochengruft' || id === 'moorkapelle') {
    k.box(26, 13, 22, 0, 6.5, -20, 0x45405c, { c2: 0x6a6480 }); k.prism(28, 12, 24, 0, 13, -20, 0x2e2a40, { j: .2 }); addBox(p.x, p.z - 20, 14, 12);
    for (const x of [-13, 13]) { k.box(5, 26, 5, x, 13, -10, 0x3c3850, { c2: 0x6a6480 }); k.cone(4, 9, x, 30, -10, 0x2e2a40, { seg: 4, ry: .78 }); addBox(p.x + x, p.z - 10, 2.8, 2.8); }
    k.ball(4, 0, 18, -7.6, 0xe8e2cc, { seg: 8 }); k.box(1.4, 1.4, .3, -1.6, 18.6, -4, 0x7ff2c8, { glow: 1 }); k.box(1.4, 1.4, .3, 1.6, 18.6, -4, 0x7ff2c8, { glow: 1 });
    k.box(8, 11, 1, 0, 5.5, -8.5, 0x0e0a16, {});
  } else {
    const [wall, glow] = DOORS[p.theme];
    k.ico(19, 0, 8, -18, wall, { sy: .85, j: .26, c2: 0x8a86b0 }); addCircle(p.x, p.z - 18, 17);
    k.box(9, 12, 1.2, 0, 6, -4.5, 0x0c0a14, {}); k.torus(5.6, 1, 0, 8, -3.8, wall, { arc: Math.PI, seg: 9 });
    for (const x of [-5.5, 5.5]) k.box(1.8, 8, 1.8, x, 4, -3.8, wall, {});
    k.oct(1.1, 0, 14.6, -3.2, glow, { glow: 1 });
  }
}
function dungeonEntrance(p) {
  const k = new Kit(strHash(p.id) + 9), [wall, glow] = DOORS[p.theme];
  k.at(p.x, p.h, p.z);
  exterior(p, k);
  k.box(8, .3, 7, 0, .15, 3, wall, {});
  for (const x of [-4.2, 4.2]) { k.box(.9, 5, .9, x, 2.5, 5.6, wall, {}); k.oct(.62, x, 5.6, 5.6, glow, { glow: 1 }); addCircle(p.x + x, p.z + 5.6, .8); }
  k.pop();
  return k;
}

const LM = {
  bigmushroom(k) { k.cyl(5, 9, 34, 0, 17, 0, 0xe0d6f2, { seg: 12, c2: 0xb9aee2 }); k.dome(30, 0, 31, 0, 0x7a2fb5, { sy: .62, seg: 16, c2: 0xd14ad6 }); k.cyl(29.5, 29.5, .8, 0, 31, 0, 0xf6e4ff, { seg: 16, glow: .35 }); for (let i = 0; i < 24; i++) { const a = i * 2.4, q = 5 + i; k.ball(1.8, Math.cos(a) * q, 31 + 18.4 * Math.sqrt(Math.max(.02, 1 - q * q / 900)), Math.sin(a) * q, 0xfff4dc, { seg: 6, glow: .75 }); } k.at(0, 0, 8.2); k.box(4, 6, .4, 0, 3, 0, 0x4a2c20, {}); windows(k, 7, 12, 0, WIN, 2); k.pop(); addCircle(0, 0, 9); },
  moonwell(k) { k.cyl(12, 13, 1.2, 0, .6, 0, 0x6c6890, { seg: 16 }); k.cyl(10, 10, .1, 0, 1.25, 0, 0x7fd8ff, { seg: 16, glow: 1 }); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.cyl(.7, .8, 8, Math.cos(a) * 12, 4, Math.sin(a) * 12, 0x8a86b0, { seg: 6 }); k.oct(.8, Math.cos(a) * 12, 8.8, Math.sin(a) * 12, 0x9fe4ff, { glow: 1 }); } k.torus(7, 1.1, 0, 13, 0, 0xc8d4ff, { glow: .6, arc: 4.8, rz: 2.5 }); addCircle(0, 0, 11); },
  statue(k, r, tint = 0x7c78a0) { k.box(16, 3, 16, 0, 1.5, 0, 0x4e4a70, {}); k.cone(6.8, 22, 0, 13, 0, tint, { seg: 9, c2: 0xa8a4c8 }); k.ball(3.4, 0, 25, 0, tint, { seg: 8 }); k.cone(7, 1, 0, 27.2, 0, tint, { seg: 10 }); k.cone(3.8, 11, 0, 32, -.4, tint, { seg: 8, rx: -.12 }); k.box(2.4, 4.6, 1, 0, 21.8, 3, 0xd4d0e8, { rx: -.12 }); k.box(1, 26, 1, 6.5, 14, 2, 0x5c5880, {}); k.oct(2.2, 6.5, 28.5, 2, 0x4fc2ff, { glow: 1 }); k.box(.6, .6, .3, -1.2, 25.6, 3.3, 0xffc445, { glow: 1 }); k.box(.6, .6, .3, 1.2, 25.6, 3.3, 0xffc445, { glow: 1 }); addBox(0, 0, 8.5, 8.5); },
  skullrock(k) { k.blob(19, 0, 11, 0, 0x8a8678, { sy: .9, j: .18, c2: 0xd8d2bc }); k.ball(4.6, -7, 13, 15, 0x14101e, { seg: 7, sz: .5 }); k.ball(4.6, 7, 13, 15, 0x14101e, { seg: 7, sz: .5 }); k.ball(1, -7, 13, 17.2, 0xff5a2a, { seg: 5, glow: 1 }); k.ball(1, 7, 13, 17.2, 0xff5a2a, { seg: 5, glow: 1 }); k.cone(2.8, 5, 0, 5.5, 17, 0x14101e, { seg: 3 }); for (let i = -3; i <= 3; i++) k.box(2, 3.4, 1.5, i * 2.5, 1.8, 15.5, 0xe0dac4, {}); addCircle(0, 0, 18); },
  witchhut(k) { for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) k.cyl(.4, .7, 5, x, 2.5, z, 0x2f2438, { seg: 5, rz: x * .03 }); k.box(11, 6, 10, 0, 7.6, 0, 0x4a3c52, { c2: 0x5e4c60 }); k.prism(13, 8, 12, 0, 10.6, 0, 0x2a4a3a, { rz: .07, j: .3 }); k.cyl(.6, .9, 4, 3, 17, -2, 0x3c3448, { seg: 6, rz: .2 }); k.at(0, 4.6, 5.05); door(k, 0, 0x2a1c20); windows(k, 8, 3, 0, 0x7fff8a, 2); k.pop(); for (let i = 0; i < 6; i++) k.box(2.6, .2, 1.1, 0, .5 + i * .8, 11 - i * 1, 0x4a3030, {}); addBox(0, 0, 6, 6); },
  greattree(k) { k.cyl(8, 15, 46, 0, 23, 0, 0x3a2a3e, { seg: 11, c2: 0x2a1f34 }); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.box(5, 26, 5, Math.cos(a) * 15, 49, Math.sin(a) * 15, 0x3a2a3e, { rz: -Math.cos(a) * .72, rx: Math.sin(a) * .72 }); k.blob(19, Math.cos(a) * 30, 64 + (i % 2) * 8, Math.sin(a) * 30, i % 2 ? 0x24359e : 0x3a2fae, { c2: 0x6078ff, j: .2 }); } k.blob(26, 0, 78, 0, 0x2743b8, { c2: 0x7a90ff, j: .2 }); for (let i = 0; i < 40; i++) { const a = i * 2.4, q = 10 + i * 1.1; k.oct(.65, Math.cos(a) * q, 54 + i % 5 * 3, Math.sin(a) * q, 0xfff0b0, { glow: 1 }); } addCircle(0, 0, 15.5); },
  tower(k) { k.at(0, 0, 0, 0); k.cyl(7, 9, 38, 1.5, 19, 0, 0x4a4660, { seg: 9, rz: -.09, c2: 0x6c6684 }); k.cone(9.5, 15, 4.9, 45, 0, 0x2e2a48, { seg: 9, rz: -.09 }); for (let y = 8; y < 34; y += 6.5) k.box(1.2, 2.4, .2, 1.4 + y * .09, y, 8, y % 2 ? WIN : WINB, { glow: 1 }); k.pop(); addCircle(0, 0, 9.5); },
  bonegiant(k) { for (let i = 0; i < 12; i++) { const z = -26 + i * 4.6, h = 16 - Math.abs(i - 5) * .8; for (const sd of [-1, 1]) { k.torus(h, .75, sd * .5, 1, z, 0xd9d3bc, { arc: Math.PI * .62, ry: sd > 0 ? 0 : Math.PI, seg: 8 }); } k.box(2.2, 2, 3.4, 0, 1, z, 0xc9c2a8, {}); addCircle(0 - 16 * .75, z, 1.2); addCircle(16 * .75, z, 1.2); } k.blob(12, 0, 8, 36, 0xddd7c2, { sy: .92, j: .15 }); k.ball(3.4, -4.5, 10, 45.6, 0x14101e, { seg: 6, sz: .4 }); k.ball(3.4, 4.5, 10, 45.6, 0x14101e, { seg: 6, sz: .4 }); k.ball(.7, -4.5, 10, 47, 0x7ff2c8, { seg: 4, glow: 1 }); k.ball(.7, 4.5, 10, 47, 0x7ff2c8, { seg: 4, glow: 1 }); addCircle(0, 36, 12); },
  graveyard(k, r) { for (let i = 0; i < 34; i++) { const x = r.range(-27, 27), z = r.range(-27, 27); k.at(x, 0, z, r.range(-.3, .3)); k.box(1.2, 2, .3, 0, 1, 0, 0x6c6a8d, { c2: 0xa4a2c2, rz: r.range(-.12, .12) }); k.pop(); addCircle(x, z, .8); } k.box(13, 8, 9, 0, 4, 0, 0x4a4660, { c2: 0x6c6684 }); k.prism(14, 5, 10, 0, 8, 0, 0x2e2a40, {}); k.box(3, 5, .2, 0, 2.5, 4.55, 0x12101e, {}); addBox(0, 0, 7, 5); },
  sunstone(k) { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box(2.4, 10 + (i % 2) * 4, 1.6, Math.cos(a) * 15, 5 + (i % 2) * 2, Math.sin(a) * 15, 0xa8603a, { ry: -a, c2: 0xe39a55 }); addCircle(Math.cos(a) * 15, Math.sin(a) * 15, 1.8); } k.cyl(5, 6, 3, 0, 1.5, 0, 0xb56a3c, { seg: 8 }); k.ball(4.6, 0, 8.6, 0, 0xffa42c, { seg: 10, glow: 1, c2: 0xfff0a0 }); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.cone(1.2, 4, Math.cos(a) * 7, 8.6 + Math.sin(a) * 7, 0, 0xffd070, { rz: a - 1.57, glow: 1, seg: 4 }); } addCircle(0, 0, 6); },
  arch(k) { for (const x of [-11, 11]) { k.box(5, 22, 5, x, 11, 0, 0x8a8ab0, { c2: 0xb0aed0 }); addBox(x, 0, 2.8, 2.8); } k.torus(11, 2.5, 0, 22, 0, 0x8a8ab0, { arc: Math.PI, seg: 12 }); k.oct(2, 0, 33, 0, 0x9fe4ff, { glow: 1 }); k.box(30, 1, 8, 0, .5, 0, 0x6c6890, {}); },
  sandship(k) { k.at(0, 3, 0, 0); k.box(9, 8, 40, 0, 2, 0, 0x6a4a34, { rz: .13, c2: 0x8e6a48 }); k.cone(4.8, 15, 0, 2, 27, 0x6a4a34, { rx: 1.57, seg: 4 }); for (const z of [-10, 8]) { k.cyl(.6, .8, 26, 0, 15, z, 0x4a3024, { seg: 6, rz: .13 }); k.box(16, 10, .2, -1.4, 19, z, 0xd8c8a8, { rz: .13, c2: 0x9a3a2c }); } k.pop(); addBox(0, 0, 5.5, 21); },
  icecrown(k) { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, h = 16 + (i % 3) * 7; k.cone(4.2, h, Math.cos(a) * 19, h / 2 - 1, Math.sin(a) * 19, 0x5d86e8, { seg: 5, c2: 0xe3f2ff, glow: .3, rz: -Math.cos(a) * .2, rx: Math.sin(a) * .2 }); addCircle(Math.cos(a) * 19, Math.sin(a) * 19, 3.5); } k.oct(3.4, 0, 12, 0, 0x9fe4ff, { sy: 1.6, glow: 1 }); },
  dragonbones(k) { for (let i = 0; i < 16; i++) { const z = -34 + i * 4.4, h = 13 - Math.abs(i - 6) * .7; for (const sd of [-1, 1]) k.cone(1, h, sd * h * .42, h * .42, z, 0xe6e0d0, { rz: sd * .95, seg: 4 }); k.box(1.8, 1.8, 3.6, 0, 1, z, 0xc9c2a8, {}); } k.box(11, 6.4, 16, 0, 3.2, 37, 0xddd7c2, { j: .14 }); k.cone(2.3, 10, -4.4, 11, 31, 0xc9c2a8, { seg: 4, rx: -.5 }); k.cone(2.3, 10, 4.4, 11, 31, 0xc9c2a8, { seg: 4, rx: -.5 }); k.box(2, 2, .4, -3, 4.6, 45.2, 0x4fc2ff, { glow: 1 }); k.box(2, 2, .4, 3, 4.6, 45.2, 0x4fc2ff, { glow: 1 }); addBox(0, 37, 5.8, 8.5); },
  clocktower(k) { k.box(15, 62, 15, 0, 31, 0, 0x6a4a44, { c2: 0x9c7458 }); for (const [a, b, ry] of [[0, 7.6, 0], [7.6, 0, 1.57], [0, -7.6, 3.14], [-7.6, 0, -1.57]]) { k.torus(6, .55, a, 48, b, 0xf0bd5a, { ry }); k.cyl(5.7, 5.7, .25, a, 48, b, 0xf0e6c8, { rx: 1.57, rz: ry, seg: 16, glow: .6 }); } k.box(.5, 5, .3, 0, 50, 7.85, 0x241420, {}); k.cone(11.5, 22, 0, 73, 0, 0x3f9e88, { seg: 4, ry: .78 }); addBox(0, 0, 8.2, 8.2); },
  gearwreck(k) { const R = 22; k.at(0, 5, 0, .4); k.torus(R * .8, R * .16, 0, 12, 0, 0xc98a33, { rx: .55, seg: 22, c2: 0xf0bd5a }); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; k.box(4.2, 5, 3, Math.cos(a) * R, 12 + Math.sin(a) * R * Math.cos(.55), -Math.sin(a) * R * Math.sin(.55), 0xb87a2a, { rx: .55, rz: a }); } for (let i = 0; i < 4; i++) k.box(2, R * 1.5, 1, 0, 12, 0, 0x8a5a24, { rx: .55, rz: i * .78 }); k.pop(); addCircle(0, 0, 18); },
  observatory(k) { k.cyl(12, 13, 17, 0, 8.5, 0, 0x6a6090, { seg: 14, c2: 0x9488bc }); k.dome(13, 0, 17, 0, 0xc98a33, { seg: 14, c2: 0x3f9e88 }); k.cyl(1.7, 2.2, 22, 8, 27, 3, 0xf0bd5a, { seg: 8, rz: -.8, rx: .22 }); k.cyl(2.3, 2.3, .6, 16.4, 34.5, 5.6, 0x9fe4ff, { seg: 8, rz: -.8, rx: .22, glow: 1 }); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.box(1.2, 2.4, .1, Math.cos(a) * 12.5, 11, Math.sin(a) * 12.5, WINB, { ry: -a + 1.57, glow: 1 }); } addCircle(0, 0, 13.5); },
  swords(k, r) { for (let i = 0; i < 46; i++) { const x = r.range(-27, 27), z = r.range(-27, 27), rz = r.range(-.35, .35), rx = r.range(-.35, .35), L = r.range(4, 7); k.at(x, 0, z, r() * TAU); k.box(.42, L, .12, 0, L / 2 - .6, 0, 0x9aa0c0, { rz, rx, c2: 0xe6e8ff }); k.box(1.6, .22, .22, Math.sin(-rz) * L * .9, L * .88 - .6, 0, 0x7a5a30, { rz }); k.pop(); } k.box(3.6, 12, 1.2, 0, 6, 0, 0x4a4660, {}); k.box(11, 1.8, 1.2, 0, 8.5, 0, 0x4a4660, {}); addCircle(0, 0, 2.4); },
};

const LM_DOOR = {
  bigmushroom: { z: 10.4, kind: 'hollow' },
  witchhut: { z: 7.6, kind: 'magic', npc: () => 'moosa' },
  tower: { z: 11, draw: 9.1, kind: 'study', npc: p => (p.id === 'l_turmmoor' ? 'anna' : undefined) },
  observatory: { z: 15, draw: 13.15, kind: 'observatory' },
};

export function buildStructures(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const meshes = [];
  for (const p of POIS) {
    let k;
    if (p.type === 'town') k = buildTown(p);
    else if (p.type === 'shrine') k = shrine(p, group);
    else if (p.type === 'camp') k = camp(p);
    else if (p.type === 'dungeon') k = dungeonEntrance(p);
    else if (p.type === 'landmark') {
      k = new Kit(strHash(p.id));
      const r = RNG(strHash(p.id));
      k.at(p.x, p.h, p.z);
      withOffsetColliders(p, () => (LM[p.kind] || LM.statue)(k, r));
      const ld = LM_DOOR[p.kind];
      if (ld) {
        if (ld.draw) { k.at(0, 0, ld.draw); door(k, 0, 0x2a1c20, 2.2, 3.4); k.box(.42, .42, .42, 0, 4.1, .2, 0xffc25a, { glow: 1 }); k.pop(); }
        const reg = regionAt(p.x, p.z);
        HOUSES.push({ id: `${p.id}_in`, poi: p.id, region: reg.id, lvl: reg.lvl, style: STY[reg.id].h, kind: ld.kind, name: p.name, rich: true, npc: ld.npc?.(p), x: p.x, z: p.z, lx: 0, lz: 0, y: p.h, yaw: 0, hw: 6, hd: ld.z - 1.3, dist: 0, doorX: p.x, doorZ: p.z + ld.z });
      }
      k.pop();
    }
    const m = k.mesh();
    m.userData.poi = p;
    group.add(m); meshes.push(m);
  }
  return { group, meshes, houses: HOUSES, update(x, z) { for (const m of meshes) { const p = m.userData.poi; m.visible = Math.hypot(p.x - x, p.z - z) < 1150; } } };
}

// Landmark-Bauten beschreiben Kollisionen lokal. Hier werden sie in Weltkoordinaten umgerechnet.
import * as collision from './collision.js';
function withOffsetColliders(p, fn) {
  collision.setOffset(p.x, p.z);
  try { fn(); } finally { collision.setOffset(0, 0); }
}
export { heightAt };
