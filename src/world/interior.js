import * as THREE from '../../vendor/three.module.js';
import { RNG, strHash, TAU } from '../core/util.js';
import { G } from '../game/state.js';
import { RESIDENTS, CHILDREN, HOME_LINES, CHILD_LINES, INN_LINES, SHOP_LINES, RES_LINES, BOOKS } from '../data/houses.js';

const CS = 5, GRID = 72, HGT = 7.4;
const DIMS = { home: [4, 4], family: [5, 4], study: [4, 4], workshop: [4, 4], inn: [7, 6], smith: [5, 5], shop: [5, 4], magic: [5, 5], hollow: [5, 5], observatory: [5, 5] };
const STYLES = {
  shroom: { floor: 0x8a6440, floor2: 0x74522f, wall: 0xe6d8bc, wall2: 0xc4b092, beam: 0x55321f, ceil: 0x6a4630, rug: 0x7a2fb5, rug2: 0xe0a0ff, cloth: 0xb82f4d, door: 0x6b3a26, stone: 0x77739a },
  timber: { floor: 0x7a5a3c, floor2: 0x644830, wall: 0xb09872, wall2: 0x8f7a5c, beam: 0x33221f, ceil: 0x4a3428, rug: 0x24645a, rug2: 0x72d0b0, cloth: 0x35507a, door: 0x4a2c20, stone: 0x5c587e },
  bone: { floor: 0x4a4658, floor2: 0x3c3848, wall: 0x6a6478, wall2: 0x524c60, beam: 0x2a2434, ceil: 0x34303f, rug: 0x3a2c5a, rug2: 0x7ff2c8, cloth: 0x2a6a70, door: 0x2a2230, stone: 0x565070 },
  adobe: { floor: 0xc49a62, floor2: 0xb08850, wall: 0xe8c890, wall2: 0xd0a86c, beam: 0x8a5230, ceil: 0xc8a070, rug: 0xb8302c, rug2: 0xffc445, cloth: 0x2f6fb0, door: 0x6a3c24, stone: 0xb8854e },
  frost: { floor: 0x5f6a96, floor2: 0x505a84, wall: 0x8c9ad0, wall2: 0x6f7cb4, beam: 0x2d3560, ceil: 0x45507e, rug: 0xe8e4f4, rug2: 0x9fc0ff, cloth: 0x4a5aa8, door: 0x2d3560, stone: 0x5564a8 },
  copper: { floor: 0x5f4640, floor2: 0x4e3834, wall: 0x94604a, wall2: 0x7a4f40, beam: 0x3c2830, ceil: 0x4a3432, rug: 0x3f9e88, rug2: 0xf0bd5a, cloth: 0xc98a33, door: 0x2c1e24, stone: 0x5c4660 },
  ash: { floor: 0x2e2638, floor2: 0x261f2f, wall: 0x41364e, wall2: 0x2f2739, beam: 0x151020, ceil: 0x221b2c, rug: 0x5a1c3a, rug2: 0xff7a3a, cloth: 0x41243a, door: 0x151020, stone: 0x2f2740 },
};
const SKINS = [0xd8b48e, 0xc99a70, 0xa87850, 0xe8c8a8, 0x8a5e3e], HAIRS = [0x3a2418, 0x6a4a2c, 0xc8a050, 0x8a3a24, 0x1a1420, 0xc0c0c8], TOPS = {
  pilz: [0x3f7ad0, 0xb8302c, 0x4a8a5a, 0x7a4ab0], forest: [0x2f6a4a, 0x7a5230, 0x5a6a34, 0x8a3a2c], moor: [0x3c3848, 0x4a5a5a, 0x5a4a60, 0x3a4a44],
  desert: [0xd9a766, 0x3fa7a0, 0xb8302c, 0xe0c070], frost: [0x4a5aa8, 0x6a78b0, 0xa83a4a, 0x5a7a8a], clock: [0x7a4f40, 0x3f9e88, 0x4a3a66, 0x8a6a3a], ash: [0x3a2a3a, 0x4a3a50, 0x2a2430, 0x6a3a4a],
};
const TMP = new THREE.Color(), WARM = new THREE.Color(0xffb060);

export function buildInterior(D, h, k) {
  const r = RNG(strHash(h.id) + 41), st = STYLES[h.style] || STYLES.timber, kind = DIMS[h.kind] ? h.kind : 'home', [cw, cd] = DIMS[kind];
  const W = cw * CS, L = cd * CS, hw = W / 2, hl = L / 2, i0 = 36 - (cw >> 1), j0 = 36 - (cd >> 1), cx = (i0 + cw / 2) * CS, cz = (j0 + cd / 2) * CS;
  for (let j = j0; j < j0 + cd; j++) for (let i = i0; i < i0 + cw; i++) D.grid[j * GRID + i] = 1;
  D.ceil = HGT - .75;
  const mx = r() < .5 ? 1 : -1, X = v => v * mx, Y = a => a * mx, wood = 0x7a5233, wood2 = 0x4e3322;
  const lights = [{ x: 0, z: 0, p: .85, d: 15 }], chests = [], books = [], spots = [];
  let staff = null, stashN = 0;

  const lit = (col, x, z) => {
    let v = 0;
    for (const l of lights) { const d = Math.hypot(l.x - x, l.z - z); if (d < l.d) v = Math.max(v, l.p * (1 - d / l.d)); }
    TMP.set(col).multiplyScalar(.8 + v * .62).lerp(WARM, v * v * .22);
    return TMP.getHex();
  };
  const solid = (x, z, a, b) => D.boxes.push({ x0: cx + x - a, x1: cx + x + a, z0: cz + z - b, z1: cz + z + b });
  const circle = (x, z, q) => D.cols.push({ x: cx + x, z: cz + z, r: q });
  const rot = (ry, a, b) => (Math.abs(Math.sin(ry)) > .5 ? [b, a] : [a, b]);
  const light = (x, z, p = 1, d = 13) => lights.push({ x, z, p, d });
  const book = (x, z) => books.push({ id: `${h.id}_b${books.length}`, x: cx + x, z: cz + z, idx: r.int(0, BOOKS.length - 1) });
  const chest = (x, z, ry = 0, rich = !!h.rich) => { chests.push({ id: `${h.id}_s${stashN++}`, x: cx + x, z: cz + z, ry, tier: h.lvl, rich, poor: !rich }); circle(x, z, .95); };
  const maybeChest = (x, z, ry) => { if (h.rich || r() < .46) chest(x, z, ry); };

  const candle = (x, y, z) => { k.cyl(.09, .11, .36, x, y + .18, z, 0xf0e6c8, { seg: 5 }); k.oct(.11, x, y + .46, z, 0xffd070, { glow: 1, sy: 1.5 }); };
  const table = (x, z, w = 3.6, d = 2.2, stuff = true) => {
    k.box(w, .18, d, x, 1.55, z, wood, { c2: 0x94683f });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(.2, 1.5, .2, x + a * (w / 2 - .22), .75, z + b * (d / 2 - .22), wood2, {});
    if (stuff) {
      candle(x, 1.64, z);
      k.cyl(.36, .3, .07, x - w * .25, 1.68, z + .2, 0xd8d0c0, { seg: 8 }); k.ball(.18, x - w * .25, 1.8, z + .2, r.pick([0xc23a3a, 0xc99a3a, 0x6ab04a]), { seg: 5 });
      k.cyl(.15, .13, .34, x + w * .27, 1.81, z - .25, 0x8a8aa8, { seg: 6 });
      light(x, z, .62, 8);
    }
    solid(x, z, w / 2, d / 2);
  };
  const chair = (x, z, ry = 0) => {
    k.at(x, 0, z, ry);
    k.box(1, .13, 1, 0, .95, 0, wood, {}); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(.12, .95, .12, a * .4, .47, b * .4, wood2, {});
    k.box(1, 1, .11, 0, 1.5, -.45, wood2, {});
    k.pop(); circle(x, z, .55);
  };
  const bench = (x, z, w, ry = 0) => { k.at(x, 0, z, ry); k.box(w, .14, .8, 0, .92, 0, wood, {}); for (const a of [-1, 1]) k.box(.16, .9, .7, a * (w / 2 - .3), .45, 0, wood2, {}); k.pop(); const [a, b] = rot(ry, w / 2, .4); solid(x, z, a, b); };
  const bed = (x, z, ry = 0, c = st.cloth) => {
    k.at(x, 0, z, ry);
    k.box(2.7, .55, 4.8, 0, .45, 0, wood, {}); k.box(2.5, .36, 4.6, 0, .88, 0, 0xe8e0d0, {});
    k.box(2.56, .28, 3, 0, 1.06, .75, c, { c2: st.rug2 }); k.box(1.75, .26, .95, 0, 1.18, -1.75, 0xf4efe4, {});
    k.box(2.9, 2, .24, 0, 1, -2.42, wood2, {}); k.box(2.9, 1.1, .2, 0, .55, 2.42, wood2, {});
    k.pop();
    const [a, b] = rot(ry, 1.4, 2.55); solid(x, z, a, b);
  };
  const shelf = (x, z, ry = 0, type = 'books', w = 4.2) => {
    k.at(x, 0, z, ry);
    k.box(w, 5.2, .24, 0, 2.6, -.32, wood2, {});
    for (const a of [-1, 1]) k.box(.16, 5.2, .82, a * w / 2, 2.6, 0, wood, {});
    for (const y of [.25, 1.55, 2.85, 4.15, 5.15]) k.box(w, .13, .82, 0, y, 0, wood, {});
    const cols = [0xb8302c, 0x2f52c0, 0x2f8a63, 0xc99a3a, 0x7a3ab0, 0x8a4a2c, 0xd8d0c0];
    for (const y of [.32, 1.62, 2.92, 4.22]) {
      let px = -w / 2 + .2;
      while (px < w / 2 - .35) {
        if (type === 'books') { const t = r.range(.14, .3), q = r.range(.72, 1.12); k.box(t, q, .5, px + t / 2, y + q / 2, .05, r.pick(cols), {}); px += t + .025; if (r() < .1) px += .4; }
        else if (type === 'potions') { const c = r.pick([0xff5ad0, 0x4fc2ff, 0x6dff8a, 0xffc445, 0xb06aff]); k.ball(.2, px + .22, y + .24, .05, c, { seg: 5, glow: .92 }); k.cyl(.07, .07, .22, px + .22, y + .52, .05, 0xd8d0c0, { seg: 4 }); px += .56; }
        else if (type === 'goods') { const c = r.pick([0xc99a3a, 0x8a5a30, 0xd8c8a0, 0x6a8a4a, 0xa83a3a]); if (r() < .5) k.cyl(.22, .25, .55, px + .25, y + .28, .05, c, { seg: 6 }); else k.box(.5, .48, .46, px + .25, y + .24, .05, c, {}); px += .66; }
        else { const c = r.pick([0xd8d0c0, 0x8a7a68, 0xb09872]); k.cyl(.2, .26, .62, px + .24, y + .31, .05, c, { seg: 6 }); px += .62; }
      }
    }
    k.pop();
    const [a, b] = rot(ry, w / 2 + .1, .5); solid(x, z, a, b);
  };
  const hearth = (x, z, ry = 0) => {
    k.at(x, 0, z, ry);
    k.box(6, 4.6, 1.5, 0, 2.3, -.1, st.stone, { c2: 0x8a86a8, j: .16 });
    k.box(3.6, 2.5, .3, 0, 1.25, .68, 0x120a0a, {});
    k.box(6.5, .36, 1.9, 0, 4.7, .05, wood2, {}); k.box(3.5, HGT - 4.7, 1.3, 0, (HGT + 4.7) / 2, -.2, st.stone, {});
    for (const a of [-.9, 0, .9]) k.cyl(.17, .17, 1.5, a * .7, .28, .55, 0x4a2c20, { rz: 1.57, ry: a * .5, seg: 5 });
    k.cone(.72, 1.75, 0, 1.05, .6, 0xff7a28, { seg: 5, glow: 1 }); k.cone(.5, 1.25, -.62, .8, .58, 0xffa83a, { seg: 5, glow: 1 }); k.cone(.48, 1.2, .62, .8, .62, 0xffa83a, { seg: 5, glow: 1 }); k.cone(.3, .9, 0, .75, .7, 0xfff0a0, { seg: 4, glow: 1 });
    candle(-2, 4.88, .2); k.cyl(.2, .24, .5, 2, 5.12, .2, 0xc99a3a, { seg: 6 });
    k.pop();
    const [a, b] = rot(ry, 3.05, .92); solid(x, z, a, b);
    light(x + Math.sin(ry) * 1.2, z + Math.cos(ry) * 1.2, 1.3, 15);
  };
  const barrel = (x, z) => { k.cyl(.8, .7, 1.9, x, .95, z, 0x7a5233, { seg: 9, c2: 0x8e6640 }); for (const y of [.4, 1.5]) k.cyl(.83, .83, .12, x, y, z, 0x4a4a58, { seg: 9 }); circle(x, z, .85); };
  const crate = (x, z, q = 1.6, y = 0) => { k.box(q, q, q, x, y + q / 2, z, 0x9a7446, { j: .15, ry: r.range(-.15, .15) }); k.box(q + .05, .12, q + .05, x, y + q * .85, z, 0x5a3c26, {}); k.box(q + .05, .12, q + .05, x, y + q * .15, z, 0x5a3c26, {}); if (!y) solid(x, z, q / 2, q / 2); };
  const sack = (x, z) => { k.ball(.72, x, .62, z, 0xc8b48a, { sy: 1.05, seg: 6 }); k.cone(.24, .34, x, 1.45, z, 0xb09a70, { seg: 5 }); circle(x, z, .72); };
  const rug = (x, z, w, d, c = st.rug, c2 = st.rug2) => { k.box(w, .05, d, x, .03, z, c2, {}); k.box(w - .5, .05, d - .5, x, .045, z, c, {}); k.box(w - 1.3, .05, d - 1.3, x, .06, z, c2, {}); k.box(w - 1.6, .05, d - 1.6, x, .075, z, c, { j: .12 }); };
  const lamp = (x, z, c = 0xffc25a) => { k.cyl(.09, .16, 4, x, 2, z, 0x2a2030, { seg: 5 }); k.cyl(.45, .45, .08, x, .04, z, 0x2a2030, { seg: 7 }); k.box(.52, .66, .52, x, 4.3, z, c, { glow: 1 }); k.cone(.48, .4, x, 4.82, z, 0x2a2030, { seg: 4 }); circle(x, z, .42); light(x, z, 1.05, 10); };
  const counter = (x, z, w, ry = 0) => { k.at(x, 0, z, ry); k.box(w, 1.5, 1.4, 0, .75, 0, st.beam, { c2: wood }); k.box(w + .3, .15, 1.7, 0, 1.58, 0, 0x94683f, {}); for (let a = -w / 2 + 1; a < w / 2; a += 2) k.box(1.5, 1.05, .05, a, .72, .72, wood, {}); k.pop(); const [a, b] = rot(ry, w / 2 + .15, .85); solid(x, z, a, b); };
  const mug = (x, y, z) => { k.cyl(.15, .13, .32, x, y + .16, z, 0xb8b8c8, { seg: 6 }); k.torus(.12, .03, x + .17, y + .17, z, 0xb8b8c8, { seg: 6 }); };
  const cauldron = (x, z, c = 0x57f0a0) => {
    k.ball(1.45, x, 1.25, z, 0x20202c, { seg: 10 }); k.cyl(1.2, 1.2, .12, x, 2.28, z, c, { seg: 10, glow: 1 }); k.torus(1.24, .13, x, 2.34, z, 0x34344a, { rx: 1.57, seg: 12 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.box(.2, .8, .2, x + Math.cos(a) * 1, .4, z + Math.sin(a) * 1, 0x20202c, {}); k.cone(.3, .5, x + Math.cos(a) * .6, .22, z + Math.sin(a) * .6, 0xff7a28, { seg: 4, glow: 1 }); }
    for (let i = 0; i < 5; i++) k.ball(.13, x + r.range(-.7, .7), 2.42 + i * .28, z + r.range(-.7, .7), c, { seg: 4, glow: 1 });
    circle(x, z, 1.55); light(x, z, 1.15, 12);
  };
  const anvil = (x, z) => { k.box(1.1, .9, .9, x, .45, z, 0x3a2a24, {}); k.box(.65, .55, .55, x, 1.15, z, 0x34344a, {}); k.box(2.3, .42, .85, x, 1.62, z, 0x4a4a62, { c2: 0x8a8aa8 }); k.cone(.42, .85, x + 1.45, 1.62, z, 0x4a4a62, { rz: -1.57, seg: 5 }); k.box(.12, .12, .9, x - .3, 1.92, z, 0x5a3c2c, { ry: .5 }); k.box(.42, .3, .3, x - .05, 1.98, z + .35, 0x8a8aa8, { ry: .5 }); solid(x, z, 1.5, .55); };
  const forge = (x, z, ry = 0) => {
    k.at(x, 0, z, ry);
    k.box(7, 2.4, 2.6, 0, 1.2, 0, st.stone, { c2: 0x8a86a8, j: .17 }); k.box(5.4, .4, 1.9, 0, 2.42, .1, 0x1a0c08, {}); k.box(5, .22, 1.6, 0, 2.6, .1, 0xff7a28, { glow: 1 });
    for (let i = 0; i < 14; i++) k.ico(r.range(.14, .32), r.range(-2.3, 2.3), 2.78, r.range(-.55, .75), r.pick([0xffc445, 0xff5a24, 0x3a1a10]), { glow: .9 });
    k.cone(3.6, 3, 0, 5, -.2, 0x34344a, { seg: 4, ry: .78 }); k.box(1.8, HGT - 6, 1.8, 0, (HGT + 6) / 2, -.2, 0x34344a, {});
    for (const a of [-3.2, 3.2]) k.box(.5, 3.8, .5, a, 1.9, 1.05, 0x34344a, {});
    k.pop();
    const [a, b] = rot(ry, 3.55, 1.35); solid(x, z, a, b);
    light(x + Math.sin(ry) * 1.2, z + Math.cos(ry) * 1.2, 1.45, 17);
  };
  const rack = (x, z, ry = 0) => {
    k.at(x, 0, z, ry);
    k.box(4.4, .22, .3, 0, 3.7, -.25, wood, {}); k.box(4.4, .22, .3, 0, 1.1, -.25, wood, {}); for (const a of [-2.1, 2.1]) k.box(.2, 4, .4, a, 2, -.25, wood2, {});
    for (let i = 0; i < 5; i++) { const a = -1.6 + i * .8, c = r.pick([0xc8cfe8, 0xa8b0d0, 0xffc445, 0x9fe4ff]); k.box(.17, 2.7, .05, a, 2.2, 0, c, { c2: 0xffffff }); k.box(.56, .1, .12, a, 3.45, 0, 0xd8a33c, {}); k.box(.09, .45, .09, a, 3.75, 0, 0x4a2c20, {}); }
    k.pop();
    const [a, b] = rot(ry, 2.25, .4); solid(x, z, a, b);
  };
  const armor = (x, z, ry = 0) => {
    k.at(x, 0, z, ry);
    k.cyl(.5, .5, .1, 0, .05, 0, wood2, { seg: 7 }); k.box(.12, 1.8, .12, 0, .95, 0, wood, {}); k.box(1.25, 1.25, .62, 0, 2.3, 0, r.pick([0x8a92b0, 0xc98a33, 0x6a7490]), { c2: 0xdde2f4 });
    for (const a of [-.74, .74]) k.ball(.34, a, 2.8, 0, 0x9aa2c0, { seg: 5 }); k.dome(.46, 0, 3.15, 0, 0x8a92b0, { seg: 7 }); k.box(.1, .42, .05, 0, 3.2, .45, 0x14101e, {});
    k.pop(); circle(x, z, .75);
  };
  const trough = (x, z, ry = 0) => { k.at(x, 0, z, ry); k.box(3.2, 1, 1.4, 0, .5, 0, wood2, {}); k.box(2.9, .06, 1.1, 0, 1.01, 0, 0x4f9fd8, { glow: .55 }); k.pop(); const [a, b] = rot(ry, 1.65, .75); solid(x, z, a, b); };
  const pot = (x, z, c = 0x34d5ff) => { k.cyl(.45, .34, .6, x, .3, z, 0xa8603a, { seg: 7 }); k.cyl(.07, .1, .7, x, .9, z, 0xd8d0e8, { seg: 4 }); k.dome(.56, x, 1.2, z, c, { seg: 7, glow: .95 }); circle(x, z, .5); };
  const globe = (x, z) => { k.cyl(.45, .55, .12, x, .06, z, wood2, { seg: 7 }); k.box(.1, 1.4, .1, x, .75, z, wood, {}); k.ball(.72, x, 2, z, 0x2f6ab0, { seg: 8, c2: 0x4fae62, j: .2 }); k.torus(.86, .05, x, 2, z, 0xd8a33c, { ry: 1.57, seg: 12 }); circle(x, z, .6); };
  const crystal = (x, y, z) => { k.cyl(.3, .4, .22, x, y + .11, z, 0xd8a33c, { seg: 7 }); k.ball(.45, x, y + .62, z, 0x9f7cff, { seg: 8, glow: 1, c2: 0xdfe8ff }); light(x, z, .8, 7); };
  const telescope = (x, z) => {
    k.at(x, 0, z, .5);
    k.cyl(1.5, 1.9, .5, 0, .25, 0, wood2, { seg: 9 }); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.box(.18, 3, .18, Math.cos(a) * .9, 1.7, Math.sin(a) * .9, 0xc98a33, { rz: Math.cos(a) * .3, rx: -Math.sin(a) * .3 }); }
    k.cyl(.48, .62, 6.4, 0, 4.1, -.7, 0xc98a33, { rx: -.8, seg: 9, c2: 0xf0bd5a }); k.cyl(.68, .68, .22, 0, 6.33, -3.05, 0x9fe4ff, { rx: -.8, seg: 9, glow: 1 }); k.cyl(.25, .32, .9, 0, 1.75, 1.75, 0x34344a, { rx: -.8, seg: 7 });
    k.pop(); circle(x, z, 1.9);
  };
  const deco = (x, z) => {
    switch (h.region) {
      case 'pilz': pot(x, z, r.pick([0x34d5ff, 0xff6ad0, 0xffc445])); break;
      case 'forest': k.cyl(.3, .42, 1.1, x, .55, z, 0x5a3c2c, { seg: 6 }); k.blob(.85, x, 1.6, z, 0x2f8a63, { c2: 0x72d0a0, j: .2 }); circle(x, z, .6); break;
      case 'moor': k.cyl(.4, .5, 1.5, x, .75, z, 0x45405c, { seg: 6 }); k.ball(.42, x, 1.85, z, 0xe8e2cc, { seg: 6 }); k.box(.12, .12, .05, x - .14, 1.9, z + .38, 0x7ff2c8, { glow: 1 }); k.box(.12, .12, .05, x + .14, 1.9, z + .38, 0x7ff2c8, { glow: 1 }); candle(x, 2.2, z); circle(x, z, .55); break;
      case 'desert': for (let i = 0; i < 3; i++) k.ball(.6, x + (i - 1) * .75, .32, z + (i % 2) * .4, r.pick([0xb8302c, 0x2f6fb0, 0xffc445]), { sy: .55, seg: 6 }); circle(x, z, 1); break;
      case 'frost': k.oct(.5, x, 1.15, z, 0x9fe4ff, { sy: 2.1, glow: .9 }); k.cyl(.55, .65, .3, x, .15, z, st.stone, { seg: 6 }); circle(x, z, .62); break;
      case 'clock': k.torus(.95, .24, x, 1.6, z, 0xc98a33, { ry: 1.1, seg: 10 }); k.box(.5, 1.3, .5, x, .65, z, 0x4a3a44, {}); circle(x, z, .7); break;
      default: k.cyl(.75, .4, .8, x, .85, z, 0x2a2030, { seg: 7 }); k.box(.12, .9, .12, x, .3, z, 0x2a2030, {}); for (let i = 0; i < 4; i++) k.cone(.28, .75, x + r.range(-.35, .35), 1.45, z + r.range(-.35, .35), 0xff7a28, { seg: 4, glow: 1 }); circle(x, z, .75); light(x, z, .95, 9);
    }
  };
  const partition = (px, gz) => {
    const g0 = gz - 1.75, g1 = gz + 1.75, seg = (a, b) => {
      const col = lit(st.wall2, px, (a + b) / 2);
      k.box(.42, HGT, b - a, px, HGT / 2, (a + b) / 2, col, { c2: st.wall });
      k.box(.5, .5, b - a, px, .25, (a + b) / 2, st.beam, {});
      for (let q = a; q <= b; q += 3.6) k.box(.52, HGT, .24, px, HGT / 2, q, st.beam, {});
      D.boxes.push({ x0: cx + px - .25, x1: cx + px + .25, z0: cz + a, z1: cz + b });
      D.walls.push({ x0: cx + px - .25, x1: cx + px + .25, z0: cz + a, z1: cz + b });
    };
    seg(-hl, g0); seg(g1, hl);
    k.box(.42, HGT - 4.6, 3.5, px, (HGT + 4.6) / 2, gz, st.wall2, {}); k.box(.56, .28, 3.9, px, 4.6, gz, st.beam, {});
    for (const q of [g0, g1]) k.box(.56, 4.6, .26, px, 2.3, q, st.beam, {});
  };

  const LAYOUT = {
    home() {
      hearth(X(1), -hl + .9, 0); rug(0, 1.8, 9, 7); table(X(-4.2), 1.4); chair(X(-4.2), -.5, 0); chair(X(-4.2), 3.3, Math.PI); chair(X(-6.8), 1.4, Y(Math.PI / 2));
      bed(X(hw - 1.7), -hl + 2.75); maybeChest(X(hw - 1.7), -hl + 6.5, Math.PI);
      shelf(X(-hw + .55), -4.3, Y(Math.PI / 2)); book(X(-hw + 2.4), -4.3);
      barrel(X(-hw + 1.2), hl - 1.4); barrel(X(-hw + 3.1), hl - 1.2); crate(X(hw - 1.4), hl - 1.5); deco(X(hw - 1.4), 2.4); lamp(X(-hw + 1.1), -hl + 1.1);
      spots.push([X(3.2), 2.6], [X(-1.4), -5.6]);
    },
    family() {
      partition(X(4), 3.5); hearth(X(-5), -hl + .9, 0); rug(X(-4), 2.4, 10, 7); table(X(-6.2), 1.8, 4.4, 2.4); chair(X(-7.4), -.2, 0); chair(X(-5), -.2, 0); chair(X(-7.4), 3.8, Math.PI); chair(X(-5), 3.8, Math.PI);
      bed(X(hw - 1.7), -hl + 2.75); bed(X(hw - 5), -hl + 2.75, 0, st.rug); maybeChest(X(hw - 1.5), -hl + 6.6, Math.PI);
      shelf(X(-hw + .55), -4.4, Y(Math.PI / 2), 'goods'); shelf(X(hw - .55), hl - 3.4, Y(-Math.PI / 2)); book(X(hw - 2.4), hl - 3.4);
      barrel(X(-hw + 1.2), hl - 1.4); crate(X(-hw + 3.1), hl - 1.5); deco(X(1.8), -hl + 1.6); lamp(X(1.8), hl - 1.4);
      spots.push([X(-2), 3.6], [X(.8), -4.8], [X(8), 2.4]);
    },
    study() {
      for (const a of [-7, -2.4, 2.4, 7]) shelf(a, -hl + .55, 0); shelf(X(-hw + .55), 0, Y(Math.PI / 2)); shelf(X(-hw + .55), 4.6, Y(Math.PI / 2));
      book(-2.4, -hl + 2.4); book(X(-hw + 2.4), 2.2); rug(0, .8, 9, 7, st.rug, st.rug2); table(X(3.2), -2.2, 4.4, 2.3); chair(X(3.2), -4.1, 0); crystal(X(4.7), 1.64, -2.2);
      for (let i = 0; i < 4; i++) k.box(.72, .08, .95, X(1.8 + i * .34), 1.68 + i * .08, -2.2 + (i % 2) * .15, r.pick([0xe8e0d0, 0xb8302c, 0x2f52c0]), {});
      globe(X(hw - 1.4), 3); maybeChest(X(hw - 1.5), hl - 1.6, Math.PI); lamp(X(hw - 1.1), -hl + 3.1); deco(X(-hw + 1.3), hl - 1.3);
      spots.push([X(.2), 2.5]);
    },
    workshop() {
      counter(X(1), -hl + 1.4, 11); for (let i = 0; i < 6; i++) { const a = X(-3.6 + i * 1.8); k.box(.12, 1, .1, a, 2.1, -hl + 1.3, 0x8a8aa8, { rz: r.range(-.5, .5) }); k.box(.46, .24, .18, a, 2.6, -hl + 1.3, 0x4a2c20, {}); }
      for (let i = 0; i < 7; i++) { const a = -7 + i * 2; k.box(.08, 1.5, .08, a, 4, -hl + .25, 0x6a6a84, {}); k.box(.56, .34, .12, a, 3.2, -hl + .25, r.pick([0x8a8aa8, 0x7a5233]), {}); }
      crate(X(-hw + 1.3), -hl + 1.4); crate(X(-hw + 3.1), -hl + 1.4, 1.3); crate(X(-hw + 1.3), -hl + 1.4, 1, 1.6); shelf(X(-hw + .55), 2.2, Y(Math.PI / 2), 'jars'); book(X(-hw + 2.4), 2.2);
      table(X(4), 2.5, 4, 2.3); chair(X(4), .6, 0); barrel(X(hw - 1.2), hl - 1.4); sack(X(hw - 3), hl - 1.2); maybeChest(X(hw - 1.5), -2, Y(-Math.PI / 2)); deco(X(-hw + 1.3), hl - 1.4); lamp(X(hw - 1.1), -hl + 3.8);
      spots.push([X(-.8), -hl + 3.6]);
    },
    inn() {
      partition(X(-7.5), 8); counter(X(5), -hl + 6.4, 19); staff = { x: X(5), z: -hl + 4, yaw: 0 };
      for (let i = 0; i < 5; i++) shelf(X(-3.2 + i * 4.5), -hl + .55, 0, i % 2 ? 'jars' : 'potions');
      for (let i = 0; i < 7; i++) mug(X(-2 + i * 2.5), 1.66, -hl + 6.4 + r.range(-.3, .3));
      for (const a of [-1.5, 11.5]) chair(X(a), -hl + 8.1, Math.PI);
      barrel(X(hw - 1.2), -hl + 1.4); barrel(X(hw - 3), -hl + 1.2); barrel(X(hw - 1.2), -hl + 3.2);
      hearth(X(hw - .95), 4, Y(-Math.PI / 2)); rug(X(11), 4, 8, 7);
      for (const [a, b] of [[4.5, 1], [11, 1], [4.5, 8.6], [11, 8.6]]) { table(X(a), b, 4.2, 2.3); bench(X(a), b - 1.9, 3.8); bench(X(a), b + 1.9, 3.8); }
      for (const q of [-hl + 2.8, -hl + 9.3, hl - 6]) bed(X(-hw + 1.7), q, Y(Math.PI / 2) * 0, st.cloth);
      maybeChest(X(-hw + 5.2), -hl + 1.5, 0); shelf(X(-8), -hl + .55, 0); book(X(-8), -hl + 2.4); lamp(X(-hw + 1.1), hl - 1.2); lamp(X(-5.4), hl - 1.3); deco(X(hw - 1.3), hl - 1.4); crate(X(1.6), -hl + 1.3);
      spots.push([X(1.8), 4.6], [X(14.6), 6.6], [X(8), 5.1], [X(-1.2), -hl + 9]);
    },
    smith() {
      forge(X(2), -hl + 1.45); anvil(X(-3), -3.5); staff = { x: X(-3), z: -5.9, yaw: 0 };
      rack(X(-hw + .45), -5, Y(Math.PI / 2)); rack(X(-hw + .45), 1.5, Y(Math.PI / 2)); for (const a of [-5, -.8, 3.4]) armor(X(hw - 1.5), a, Y(-Math.PI / 2));
      trough(X(-hw + 3.2), -hl + 1.3); barrel(X(-hw + 1.2), hl - 1.4); crate(X(-hw + 3.1), hl - 1.4); crate(X(hw - 1.4), hl - 1.5); sack(X(hw - 3.2), hl - 1.2); maybeChest(X(hw - 1.5), 7.4, Y(-Math.PI / 2)); lamp(X(hw - 1.1), -hl + 1.2); deco(X(-hw + 1.3), 6.6);
      k.box(4, .08, 3, X(-3), .03, -2.5, 0x2a2028, { j: .2 }); spots.push([X(4), 4]);
    },
    shop() {
      counter(0, -3.5, 15); staff = { x: 0, z: -5.8, yaw: 0 };
      for (const a of [-8.5, -4.1, .3, 4.7, 9.1]) shelf(a, -hl + .55, 0, 'goods'); shelf(X(-hw + .55), 3, Y(Math.PI / 2), 'jars'); shelf(X(hw - .55), 3, Y(-Math.PI / 2), 'goods');
      for (let i = 0; i < 6; i++) { k.box(.08, 1.3, .08, -7 + i * 2.8, HGT - .75, -1, 0x2a2030, {}); k.ball(.4, -7 + i * 2.8, HGT - 1.6, -1, r.pick([0xc99a3a, 0x8a3a2c, 0x6a8a4a]), { seg: 5, sy: 1.5 }); }
      for (const a of [-5, -1, 3.5]) { k.ball(.28, a, 1.86, -3.5, r.pick([0xff5a4a, 0xffc445, 0x6ae06a]), { seg: 5 }); k.box(.6, .3, .45, a + .8, 1.8, -3.4, 0xc8b48a, {}); }
      sack(X(-hw + 1.2), hl - 1.3); sack(X(-hw + 2.9), hl - 1.1); crate(X(hw - 1.4), hl - 1.5); barrel(X(hw - 3.2), hl - 1.4); maybeChest(X(-hw + 1.5), -hl + 3.8, Y(Math.PI / 2)); rug(0, 4.8, 8, 4.4); deco(X(hw - 1.3), -hl + 3.6); lamp(X(-hw + 1.1), 7);
      spots.push([X(5.5), 1.2]);
    },
    magic() {
      rug(X(3.4), 2, 11, 11); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.oct(.28, X(3.4) + Math.cos(a) * 4, .14, 2 + Math.sin(a) * 4, st.rug2, { sy: .15, glow: 1 }); }
      cauldron(X(3.4), 2); table(X(-6), -3.4, 4.6, 2.4, false); crystal(X(-6), 1.64, -3.4); staff = { x: X(-6), z: -5.8, yaw: 0 };
      for (const a of [-9.1, -4.6, 0, 4.6, 9.1]) shelf(a, -hl + .55, 0, a === 0 ? 'books' : 'potions'); book(0, -hl + 2.4);
      shelf(X(-hw + .55), 2.3, Y(Math.PI / 2), 'potions'); shelf(X(hw - .55), 6.6, Y(-Math.PI / 2), 'jars');
      for (let i = 0; i < 5; i++) { const a = X(-9 + i * 4.3); k.box(.07, 1.2, .07, a, HGT - .6, 3, 0x2a2030, {}); k.oct(.3, a, HGT - 1.35, 3, r.pick([0xff5ad0, 0x4fc2ff, 0xffc445]), { glow: 1, sy: 1.5 }); }
      pot(X(-hw + 1.2), hl - 1.3); pot(X(-hw + 2.8), hl - 1.1, 0xff6ad0); deco(X(hw - 1.3), hl - 1.4); maybeChest(X(hw - 1.5), -hl + 3.8, Y(-Math.PI / 2)); lamp(X(-hw + 1.1), -hl + 3.3, 0x9f7cff);
      spots.push([X(-1), 2.6]);
    },
    hollow() {
      k.cyl(4, 4.2, .12, 0, .06, -1, 0x34d5ff, { seg: 14, glow: .85 }); k.torus(4.2, .32, 0, .16, -1, 0xcfc6e8, { rx: 1.57, seg: 16 }); light(0, -1, 1.2, 15);
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU, q = r.range(7.6, 10.2), x = Math.cos(a) * q, z = Math.sin(a) * q - 1; if (z > 7 && Math.abs(x) < 3) continue; if (Math.abs(x) < hw - 1 && Math.abs(z) < hl - 1) pot(x, z, r.pick([0x34d5ff, 0xff6ad0, 0xffc445, 0x72ff9a])); }
      bed(X(hw - 1.7), -hl + 2.75, 0); shelf(X(-hw + .55), -6, Y(Math.PI / 2)); book(X(-hw + 2.4), -6); chest(X(-hw + 1.6), 6, Y(Math.PI / 2), true);
      spots.push([X(5), 5]);
    },
    observatory() {
      rug(0, 0, 13, 13, 0x1a1c5e, 0xc8a0ff); for (let i = 0; i < 26; i++) k.oct(.13, r.range(-5.6, 5.6), .14, r.range(-5.6, 5.6), 0xfff0b0, { sy: .15, glow: 1 }); telescope(0, -.5); light(0, -.5, .8, 12);
      for (const a of [-9.1, -4.6, 0, 4.6, 9.1]) shelf(a, -hl + .55, 0); book(4.6, -hl + 2.4); table(X(-8), 3, 3.8, 2.3); crystal(X(-8), 1.64, 3); globe(X(9), 4); chest(X(hw - 1.5), -hl + 3.8, Y(-Math.PI / 2), true); lamp(X(-hw + 1.1), hl - 1.3, 0x9fe4ff); lamp(X(hw - 1.1), hl - 1.3, 0x9fe4ff);
      spots.push([X(7), -2]);
    },
  };

  k.at(cx, 0, cz);
  LAYOUT[kind]();

  const T = st.floor === STYLES.adobe.floor || st.floor === STYLES.frost.floor || st.floor === STYLES.bone.floor ? 2.5 : 1.25;
  for (let z = -hl + T / 2, row = 0; z < hl; z += T, row++) {
    const pw = T === 2.5 ? 2.5 : 5, off = T === 2.5 ? 0 : (row % 3) * 1.6;
    for (let x = -hw - pw + off; x < hw; x += pw) {
      const a = Math.max(x, -hw), b = Math.min(x + pw, hw); if (b <= a) continue;
      const mid = (a + b) / 2, base = (row + Math.floor(x / pw)) % 2 ? st.floor : st.floor2;
      k.box(b - a - .03, .3, T - .03, mid, -.15, z, lit(base, mid, z), { j: .09 });
    }
  }
  const pane = G.hour < 6.2 || G.hour > 18.8 ? 0x2c3cb4 : 0xa8d8ff;
  const wallSeg = (x, z, ry, len = 2.5) => {
    const col = lit(st.wall, x, z), col2 = lit(st.wall2, x, z);
    k.at(x, 0, z, ry); k.box(len, HGT, .4, 0, HGT / 2, -.2, col2, { c2: col, j: .08 }); k.pop();
  };
  for (let x = -hw + 1.25; x < hw; x += 2.5) { wallSeg(x, -hl, 0); if (Math.abs(x) > 2.4) wallSeg(x, hl, Math.PI); }
  for (let z = -hl + 1.25; z < hl; z += 2.5) { wallSeg(-hw, z, Math.PI / 2); wallSeg(hw, z, -Math.PI / 2); }
  k.box(W, .55, .08, 0, .27, -hl + .05, st.beam, {}); for (const s of [-1, 1]) { k.box(.08, .55, L, s * (hw - .05), .27, 0, st.beam, {}); k.box(hw - 1.75, .55, .08, s * (hw + 1.75) / 2, .27, hl - .05, st.beam, {}); }
  for (const s of [-1, 1]) for (let q = -hl + 3.6; q < hl - 1; q += 5.2) k.box(.14, HGT, .32, s * (hw - .08), HGT / 2, q, st.beam, {});
  for (let q = -hw + 3.6; q < hw - 1; q += 5.2) if (Math.abs(q) > 2.4) k.box(.32, HGT, .14, q, HGT / 2, hl - .08, st.beam, {});
  for (const s of [-1, 1]) for (let q = -hl + 6.2; q < hl - 2.4; q += 5.2 * 2) {
    const wx = s * (hw - .06);
    if (lights.some(l => l.p > 1.2 && Math.abs(l.x - wx) < 3 && Math.abs(l.z - q) < 4)) continue;
    k.box(.08, 2.5, 2.3, wx, 4, q, pane, { glow: 1, c2: 0xe8f4ff });
    k.box(.16, .16, 2.5, wx, 5.28, q, st.beam, {}); k.box(.16, .16, 2.5, wx, 2.72, q, st.beam, {}); k.box(.16, 2.6, .12, wx, 4, q - 1.2, st.beam, {}); k.box(.16, 2.6, .12, wx, 4, q + 1.2, st.beam, {}); k.box(.14, 2.5, .08, wx, 4, q, st.beam, {}); k.box(.14, .08, 2.3, wx, 4, q, st.beam, {});
  }
  k.box(3.5, HGT - 4.7, .4, 0, (HGT + 4.7) / 2, hl + .2, lit(st.wall, 0, hl), {});
  k.box(3.05, 4.7, .16, 0, 2.35, hl + .08, st.door, { j: .13 }); for (let a = -1.15; a < 1.4; a += .76) k.box(.06, 4.6, .19, a, 2.33, hl + .06, 0x000000, { j: 0 });
  for (const a of [-1.65, 1.65]) k.box(.34, 4.9, .4, a, 2.45, hl - .04, st.beam, {}); k.box(3.65, .36, .4, 0, 4.9, hl - .04, st.beam, {});
  k.ball(.13, 1, 2.2, hl - .06, 0xffd070, { seg: 4, glow: 1 }); k.box(3.1, .05, 1.7, 0, .03, hl - 1.3, 0x4a3a2c, { j: .15 });
  k.box(W + 1, .3, L + 1, 0, HGT + .15, 0, lit(st.ceil, 0, 0), { j: .1 });
  for (let z = -hl + 1.8; z < hl; z += 3.7) k.box(W, .5, .55, 0, HGT - .22, z, st.beam, {});
  k.box(.08, 1.2, .08, 0, HGT - .75, 0, 0x2a2030, {}); k.torus(1.25, .08, 0, HGT - 1.35, 0, 0x2a2030, { rx: 1.57, seg: 12 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; candle(Math.cos(a) * 1.25, HGT - 1.42, Math.sin(a) * 1.25); }
  k.pop();

  const world = ([x, z]) => ({ x: cx + x, z: cz + z });
  const free = spots.map(world), residents = [], pool = r.int(0, RESIDENTS.length - 1), reg = RES_LINES[h.region] || RES_LINES.pilz;
  const count = h.kind === 'inn' ? 3 : h.kind === 'family' ? 3 : ['home', 'workshop', 'study'].includes(h.kind) ? (h.rich ? 0 : r() < .72 ? (h.kind === 'home' && r() < .35 ? 2 : 1) : 0) : (h.rich ? 0 : r() < .4 ? 1 : 0);
  const tops = TOPS[h.region] || TOPS.pilz;
  for (let i = 0; i < Math.min(count, free.length); i++) {
    const child = h.kind === 'family' && i === 2, [n, role] = child ? [CHILDREN[r.int(0, CHILDREN.length - 1)], 'Kind'] : RESIDENTS[(pool + i * 7) % RESIDENTS.length];
    const hair = r.pick(HAIRS), long = r() < .45, look = { kind: 'human', top: r.pick(tops), hair, long, skin: r.pick(SKINS), bottom: 0x2d2d48, ...(child ? { scale: .66 } : {}), ...(!child && r() < .25 ? { beard: hair } : {}), ...(!child && r() < .25 ? { apron: 0xe0d8c8 } : {}) };
    const lines = child ? CHILD_LINES : h.kind === 'inn' ? [...INN_LINES, r.pick(reg)] : h.kind === 'shop' || h.kind === 'smith' || h.kind === 'magic' ? [...SHOP_LINES, r.pick(reg)] : [r.pick(HOME_LINES), r.pick(HOME_LINES), ...reg];
    residents.push({ id: `${h.id}_r${i}`, x: free[i].x, z: free[i].z, d: { n, role: child ? role : `${role}${h.family ? ` · ${h.family}` : ''}`, talk: lines, look } });
  }
  staff = staff ? { ...world([staff.x, staff.z]), yaw: staff.yaw } : { ...world([X(3), -3]), yaw: 0 };
  return { house: h, start: { x: cx, z: cz + hl - 5.6 }, exit: { x: cx, z: cz + hl - .9 }, chests, books, staff, residents, spawns: [], bounds: { x0: cx - hw, x1: cx + hw, z0: cz - hl, z1: cz + hl } };
}
