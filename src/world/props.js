import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT } from '../core/gfx.js';
import { RNG, clamp } from '../core/util.js';
import { REGIONS } from '../data/world.js';
import { heightAt, regionIdx, blockedAt, setTerrainAO, CHUNK, CHUNKS, HALF } from './terrain.js';

const TAU = Math.PI * 2, HP = Math.PI / 2;
const fine = (k, fn) => { k.noLo = true; fn(); k.noLo = false; };
const crown = (k, x, y, z, R, c, c2, n = 42, o = {}) => { k.blob(R * .9, x, y, z, c, { c2, mat: 'leaf', j: .12, uv: 1.15, ...o }); k.leaves(x, y, z, R, n * 3, c, c2, { size: Math.min(.62, R * .15), sx: o.sx, sy: o.sy, sz: o.sz }); };
const roots = (k, r, c, n = 5) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + .4, ca = Math.cos(a), sa = Math.sin(a), L = r * (1.9 + (i % 2) * .6); k.tube([[ca * r * .5, .85, sa * r * .5], [ca * r * 1.15, .25, sa * r * 1.15], [ca * L, -.2, sa * L]], [r * .36, r * .24, .03], c, { mat: 'bark', seg: 5, sub: 2 }); } };
const trunk = (k, h, r, c, c2, bend = .35) => { k.tube([[0, -.35, 0], [bend * .25, h * .32, -bend * .1], [-bend * .3, h * .66, bend * .22], [bend * .2, h, 0]], [r * 1.22, r * .9, r * .7, r * .5], c, { mat: 'bark', seg: 10, sub: 3, c2, uv: .55 }); roots(k, r, c); };
const limb = (k, a, b, r0, r1, c, seg = 6) => k.tube([a, [(a[0] + b[0]) / 2 + (b[2] - a[2]) * .12, (a[1] + b[1]) / 2 + .18, (a[2] + b[2]) / 2 - (b[0] - a[0]) * .12], b], [r0, (r0 + r1) / 2, r1], c, { mat: 'bark', seg, sub: 3 });
const capShroom = (k, y, R, c, c2, o = {}) => {
  const H = o.h ?? R * .68;
  k.loft([[y - .03, R * .18], [y + .05 * R, R * .95], [y + .12 * R, R * 1.02], [y + H * .46, R * .86], [y + H * .78, R * .52], [y + H * .96, R * .18], [y + H, .01]], 0, 0, 0, c, { mat: 'plaster', c2, seg: o.seg ?? 24, glow: o.glow, shape: a => 1 + Math.sin(a * 5 + .7) * .018 });
  k.loft([[y - .04, R * .16], [y + .045 * R, R * .94]], 0, 0, 0, o.under ?? 0xf3d7ff, { mat: 'cloth', seg: o.seg ?? 24, sub: 1, glow: o.ug ?? .25 });
  if (o.gills) fine(k, () => { for (let i = 0; i < o.gills; i++) { const a = i / o.gills * TAU; k.box(.035 * R, .022 * R, R * .72, Math.cos(a) * R * .56, y, Math.sin(a) * R * .56, 0xc8b0dc, { mat: 'plain', ry: -a + HP, sharp: true }); } });
};
const pineTiers = (k, c, c2, tiers, snow) => {
  tiers.forEach(([y, R, H], i) => {
    k.loft([[y, .04], [y + .08, R * .92], [y + .18, R], [y + H * .3, R * .66], [y + H * .62, R * .34], [y + H, .02]], 0, 0, 0, c, { mat: 'leaf', c2, seg: 20, uv: .55, j: .1, sub: 2, shape: (a, t) => 1 + Math.sin(a * 9 + i * 1.7) * .15 * (1 - t) + Math.sin(a * 17 + i) * .07 * (1 - t) });
    if (snow) k.loft([[y + H * .22, R * .62], [y + H * .38, R * .54], [y + H * .68, R * .27], [y + H * 1.02, .02]], 0, .03, 0, 0xf2f6ff, { mat: 'plaster', seg: 18, sub: 2, shape: (a, t) => 1 + Math.sin(a * 9 + i * 1.7) * .11 * (1 - t) });
  });
};
const stem = (k, y0, y1, c, x = 0, z = 0, r = .035) => k.tube([[x, y0, z], [x + .03, (y0 + y1) / 2, z - .02], [x, y1, z]], [r * 1.2, r, r * .75], c, { mat: 'plain', seg: 4, sub: 2 });
const petals = (k, y, R, c, c2, n = 6, cup = .28, x = 0, z = 0) => {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a), P = (u, v) => { const L = u * R, w = Math.sin(u * Math.PI) * R * .36 * v; return [x + ca * L - sa * w, y + u * u * R * cup + u * R * .12, z + sa * L + ca * w]; };
    k.sheet([[P(.02, -1), P(.02, 1)], [P(.4, -1), P(.4, 1)], [P(.75, -1), P(.75, 1)], [P(1, -.1), P(1, .1)]], c, { mat: 'cloth', c2, glow: .3 });
  }
};
const blades = (k, n, H, c, c2, spread = .22) => {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + .3, ca = Math.cos(a), sa = Math.sin(a), h = H * (.72 + (i * 37 % 10) / 28), w = .055, lean = .22 + (i % 3) * .14, bx = ca * spread, bz = sa * spread, px = -sa * w, pz = ca * w;
    const row = (t, W) => { const dx = ca * lean * h * t * t, dz = sa * lean * h * t * t, y = h * t * (1 - t * t * .14); return [[bx + dx - px * W, y, bz + dz - pz * W], [bx + dx + px * W, y, bz + dz + pz * W]]; };
    const draw = () => k.sheet([row(0, 1), row(.45, .86), row(.8, .46), row(1, .03)], c, { mat: 'leaf', c2, uv: .9 });
    if (i < 2) draw(); else fine(k, draw);
  }
};

const DEF = {
  shroomBig: { r: 1.5, s: [1.3, 2.9], make: k => {
    k.loft([[-.2, 1.75], [.3, 1.42], [1.4, 1.06], [3.6, .9], [5.6, .86], [6.8, 1.05]], 0, 0, 0, 0xddd3f2, { mat: 'plaster', c2: 0xb9aee2, seg: 16, fold: .05, foldN: 7 });
    k.loft([[4.1, .95], [4.34, 1.6], [4.46, 1.82], [4.62, 1]], 0, 0, 0, 0xf0e4ff, { mat: 'cloth', seg: 18, fold: .1, foldN: 9, sub: 2 });
    capShroom(k, 6.5, 4.7, 0x7a2fb5, 0xc24ad0, { h: 3.3, seg: 28, gills: 34 });
    for (const [x, y, z, r] of [[2, 8.3, 1.5, .52], [-1.8, 8.55, 1.9, .5], [.4, 9.35, -1.4, .44], [-2.6, 7.8, -1.7, .55], [2.8, 7.7, -1.5, .52], [-.6, 9.65, .5, .36], [3.5, 7.1, .8, .34], [-3.6, 7.2, .7, .38]]) k.ball(r, x, y, z, 0xfff1d6, { glow: .72, sy: .62 });
  } },
  shroomSmall: { s: [.55, 1.5], make: k => {
    k.loft([[-.05, .3], [.16, .25], [.65, .17], [1.05, .19]], 0, 0, 0, 0xddd3f2, { mat: 'plaster', seg: 9 });
    capShroom(k, .98, .88, 0xb82f4d, 0xff6a7d, { h: .68, seg: 14, under: 0xf6e4d4 });
    fine(k, () => { for (const [x, y, z, r] of [[.36, 1.46, .25, .13], [-.33, 1.42, -.26, .11], [.05, 1.62, -.1, .09], [-.15, 1.4, .46, .08]]) k.ball(r, x, y, z, 0xfff1d6, { glow: .85, sy: .6 }); });
  } },
  glowcap: { s: [.6, 1.7], make: k => {
    k.loft([[-.05, .25], [.2, .18], [.8, .13], [1.2, .16]], 0, 0, 0, 0x9fe8ff, { glow: .5, seg: 9 });
    capShroom(k, 1.12, .68, 0x34d5ff, 0xa6f6ff, { h: .6, seg: 14, glow: .9, under: 0xd8fbff, ug: .9 });
    k.loft([[-.05, .16], [.3, .11], [.7, .12]], .7, 0, .3, 0x9fe8ff, { glow: .5, seg: 7 });
    capShroom(k, .64, .4, 0x34d5ff, 0xa6f6ff, { h: .36, seg: 10, glow: .9, under: 0xd8fbff, ug: .9 });
  } },
  treeBlue: { r: 1, s: [1.1, 2.3], make: k => {
    trunk(k, 8.2, 1, 0x4a3160, 0x2d2045); limb(k, [.2, 6, 0], [3, 8.4, .9], .42, .16, 0x4a3160); limb(k, [-.1, 6.3, .1], [-3, 8.8, -.7], .4, .15, 0x4a3160); limb(k, [0, 7.4, 0], [.5, 10, -1.6], .32, .12, 0x4a3160);
    crown(k, 0, 10.4, 0, 4.5, 0x2743b8, 0x5a7bff, 60, { sy: .84 }); crown(k, 3.1, 8.6, 1, 3, 0x20389e, 0x4a68e8, 34); crown(k, -3.2, 9, -.8, 2.9, 0x3a2fae, 0x7458f0, 34); crown(k, .8, 8.3, -2.8, 2.5, 0x2a3cb0, 0x5a6ff0, 26);
    fine(k, () => { for (let i = 0; i < 8; i++) { const a = i * 2.4; k.oct(.2, Math.cos(a) * 4, 8.2 + i * .52, Math.sin(a) * 4, 0xfff0b0, { glow: 1 }); } });
  } },
  pine: { r: .8, s: [1, 2.2], make: k => { k.tube([[0, -.3, 0], [.05, 3, 0], [0, 9.5, 0]], [.72, .46, .08], 0x3a2a35, { mat: 'bark', seg: 8, sub: 2 }); roots(k, .55, 0x3a2a35, 4); pineTiers(k, 0x123f3f, 0x2a8a70, [[2.3, 3.9, 3.6], [4.3, 3.2, 3.4], [6.1, 2.5, 3], [7.8, 1.8, 2.6], [9.2, 1.05, 2.2]]); } },
  treeTwist: { r: 1.2, s: [1.2, 2.2], make: k => {
    k.tube([[0, -.3, 0], [.5, 2.2, .1], [-.2, 4.4, .2], [1, 6, 0], [2.8, 7.8, .2]], [1.45, 1.05, .82, .58, .24], 0x2f2438, { mat: 'bark', seg: 11, sub: 3 }); roots(k, 1.15, 0x2f2438, 6);
    k.tube([[-.1, 4.2, .1], [-1.2, 5.3, .3], [-2.4, 6.5, .4], [-3.2, 7.1, .5]], [.5, .34, .22, .08], 0x2f2438, { mat: 'bark', seg: 7, sub: 3 }); limb(k, [1.1, 6, 0], [.6, 8.6, -1.4], .3, .08, 0x2f2438);
    crown(k, 3.2, 9.5, .4, 3.3, 0x173a64, 0x2f5fa8, 40); crown(k, -3.2, 7.5, .5, 2.5, 0x192f6a, 0x3a4fb0, 28); crown(k, .7, 9.4, -1.7, 2.1, 0x1a3a70, 0x3a60b0, 22);
    k.ball(.42, .38, 2.7, 1.02, 0x1a1420, { mat: 'plain', sz: .5 }); k.ball(.42, -.42, 2.75, 1.02, 0x1a1420, { mat: 'plain', sz: .5 }); k.ball(.24, .38, 2.7, 1.2, 0xffc445, { glow: 1 }); k.ball(.24, -.42, 2.75, 1.2, 0xffc445, { glow: 1 });
    k.tube([[-.45, 1.75, 1.2], [0, 1.45, 1.36], [.45, 1.78, 1.2]], [.04, .13, .04], 0x120e18, { mat: 'plain', seg: 5 });
  } },
  treeDead: { r: .7, s: [1, 2], make: k => {
    const c = 0x2b2432; trunk(k, 6.2, .72, c, 0x1f1a28, .5);
    k.tube([[.1, 4.5, 0], [1, 5.5, .2], [2.1, 6.4, .3], [3, 7.4, .2]], [.3, .22, .14, .03], c, { mat: 'bark', seg: 6, sub: 3 }); k.tube([[-.1, 4.1, 0], [-1, 4.9, -.2], [-1.9, 5.3, -.3], [-2.8, 6.2, -.1]], [.26, .18, .12, .03], c, { mat: 'bark', seg: 6, sub: 3 });
    k.tube([[.1, 6, .05], [.3, 7.3, .5], [-.1, 8.4, .9]], [.17, .1, .025], c, { mat: 'bark', seg: 5 }); limb(k, [2, 6.3, .3], [2.1, 7.9, 1.1], .08, .015, c, 4); limb(k, [-1.8, 5.3, -.3], [-1.9, 6.6, -1.1], .07, .015, c, 4); limb(k, [1, 5.5, .2], [.9, 6.7, -.9], .08, .015, c, 4);
  } },
  stump: { r: .9, s: [.8, 1.4], make: k => {
    k.loft([[-.2, 1.42], [.15, 1.15], [.6, .96], [1.1, .9], [1.14, .86]], 0, 0, 0, 0x4b3448, { mat: 'bark', seg: 14, fold: .06, foldN: 7 }); roots(k, .75, 0x4b3448, 4);
    k.cyl(.84, .84, .04, 0, 1.13, 0, 0xc29a6d, { mat: 'wood', seg: 12 });
    fine(k, () => { for (const r of [.24, .45, .66]) k.torus(r, .012, 0, 1.155, 0, 0x7a5a3e, { rx: HP, mat: 'plain', seg: 18 }); });
  } },
  rock: { r: 1.2, s: [.7, 2.2], make: k => { k.ico(1.55, 0, .68, 0, 0x565392, { sy: .75, j: .16, c2: 0x7a78ae }); k.ico(.8, 1.25, .3, .4, 0x47457c, { j: .16, sy: .8 }); k.ico(.42, -1.2, .14, .7, 0x5a5894, { sy: .7 }); } },
  rockRed: { r: 1.6, s: [.8, 3], make: k => { k.ico(1.75, 0, 1.1, 0, 0xa65536, { sy: 1.2, j: .2, c2: 0xdd8a4b }); k.ico(1, 1.45, .42, .4, 0x8a4630, { j: .18, sy: .85 }); k.ico(.5, -1.45, .2, -.6, 0xb4643e, { sy: .75 }); } },
  rockIce: { r: 1.4, s: [.8, 2.4], make: k => { k.ico(1.65, 0, .8, 0, 0x5d78cc, { sy: .85, j: .18, c2: 0xc7dcff }); k.ico(.72, 1.3, .3, .5, 0x7a94dc, { c2: 0xd8e8ff }); } },
  rockDark: { r: 1.5, s: [.8, 2.6], make: k => { k.ico(1.75, 0, .9, 0, 0x201a30, { j: .2, c2: 0x3a3048 }); k.ico(.8, 1.3, .32, -.5, 0x2a2238, { sy: .8 }); k.tube([[.1, .2, 1.48], [.42, .76, 1.45], [.2, 1.25, 1.3], [.5, 1.7, .92]], [.09, .065, .05, .012], 0xff5a24, { glow: 1, seg: 4 }); } },
  flowerBlue: { grass: 1, s: [.7, 1.5], make: k => { stem(k, 0, .54, 0x2f8a63); petals(k, .54, .25, 0x4f7bff, 0xa0c0ff, 6); k.ball(.06, 0, .6, 0, 0xfff1b0, { glow: 1 }); fine(k, () => k.sheet([[[.02, .18, 0], [.02, .2, .03]], [[.14, .3, .06], [.11, .31, .1]], [[.24, .33, .1], [.24, .33, .1]]], 0x2f8a63, { mat: 'leaf' })); } },
  flowerPink: { grass: 1, s: [.7, 1.5], make: k => { stem(k, 0, .46, 0x2f8a63); petals(k, .46, .22, 0xff6fd0, 0xffc0ea, 5, .5); k.ball(.05, 0, .52, 0, 0xfff1b0, { glow: 1 }); } },
  grass: { grass: 1, s: [.7, 1.5], make: k => blades(k, 6, .78, 0x2f9a6c, 0x9fe8a8) },
  dryGrass: { grass: 1, s: [.7, 1.4], make: k => blades(k, 5, .86, 0x9a7134, 0xecc878, .18) },
  reed: { grass: 1, water: 1, s: [.8, 1.6], make: k => { for (let i = 0; i < 3; i++) { const x = (i - 1) * .24, z = i * .1, h = 1.7 + i * .12; k.tube([[x, 0, z], [x + .04, h * .55, z], [x + .12, h, z + .04]], [.042, .034, .02], 0x5b7a45, { mat: 'leaf', seg: 4, sub: 2 }); k.loft([[h - .05, .02], [h, .085], [h + .3, .092], [h + .42, .02]], x + .12, 0, z + .04, 0x5a3a24, { mat: 'fur', seg: 6, sub: 2 }); } blades(k, 3, 1.1, 0x4a6a3c, 0x8fb070, .12); } },
  grave: { r: .7, s: [.8, 1.3], make: k => {
    k.box(1.3, .16, .62, 0, .08, 0, 0x5a5878, { mat: 'stone' });
    k.loft([[.1, .46, .12], [.95, .48, .13], [1.3, .36, .125], [1.5, .17, .12], [1.56, .01, .08]], 0, 0, 0, 0x6c6a8d, { mat: 'stone', c2: 0x9a98b8, seg: 12, sub: 2, shape: a => 1 + Math.abs(Math.cos(a)) * .08 });
    k.box(.1, .54, .03, 0, 1, .135, 0x37344d, { mat: 'plain', bevel: .01 }); k.box(.36, .1, .03, 0, 1.12, .135, 0x37344d, { mat: 'plain', bevel: .01 });
  } },
  bones: { s: [.7, 1.4], make: k => {
    k.loft([[.02, .2, .22, 0, .06], [.1, .26, .3, 0, .03], [.32, .38, .42], [.56, .34, .38], [.74, .02, .02]], 0, 0, 0, 0xddd7c2, { mat: 'bone', seg: 14 });
    for (const x of [-1, 1]) { k.ball(.11, x * .15, .36, .34, 0x14101e, { mat: 'plain', sz: .6 }); k.tube([[x * .9, .08, .1], [x * .5, .13, .5], [x * .15, .08, .95]], [.075, .05, .075], 0xc9c2a8, { mat: 'bone', seg: 5 }); k.ball(.1, x * .92, .08, .08, 0xddd7c2, { mat: 'bone' }); }
    k.cone(.05, .1, 0, .26, .4, 0x14101e, { mat: 'plain', seg: 4, rx: .3 });
  } },
  cactus: { r: .7, s: [.9, 2], make: k => {
    const ribs = { mat: 'leaf', c2: 0x4fae62, seg: 16, sub: 2, shape: a => 1 + Math.abs(Math.sin(a * 4)) * .1 - .05 }, c = 0x2f7a4d;
    k.loft([[-.2, .6], [.6, .62], [3.6, .56], [4.9, .44], [5.3, .12]], 0, 0, 0, c, ribs);
    k.tube([[.4, 2.3, 0], [1.05, 2.35, 0], [1.42, 2.8, 0], [1.42, 3.5, 0], [1.42, 3.95, 0]], [.28, .3, .3, .28, .08], 0x3f9458, { mat: 'leaf', seg: 9, sub: 3 });
    k.tube([[-.4, 2.95, 0], [-1, 3, 0], [-1.3, 3.4, 0], [-1.3, 4.05, 0], [-1.3, 4.35, 0]], [.25, .27, .26, .24, .06], 0x3f9458, { mat: 'leaf', seg: 9, sub: 3 });
    fine(k, () => { for (let i = 0; i < 26; i++) { const a = i * 2.4, y = .4 + i * .18; k.cone(.018, .17, Math.cos(a) * .63, y, Math.sin(a) * .63, 0xf4ecc8, { mat: 'bone', seg: 3, rz: -Math.cos(a) * 1.35, rx: Math.sin(a) * 1.35 }); } });
    petals(k, 5.24, .34, 0xff5ea8, 0xffc0dc, 7, .45); k.ball(.09, 0, 5.34, 0, 0xffe080, { glow: 1 });
  } },
  obelisk: { r: 1.4, s: [1, 1.6], make: k => {
    k.box(3.1, .55, 3.1, 0, .27, 0, 0x8a4630, { mat: 'stone' }); k.box(2.5, .4, 2.5, 0, .72, 0, 0x9a5238, { mat: 'stone' });
    k.cyl(.68, 1.28, 10, 0, 5.8, 0, 0xb56a3c, { mat: 'stone', seg: 4, c2: 0xe39a55, ry: .78 }); k.cyl(.04, .78, .9, 0, 11.2, 0, 0xffc445, { seg: 4, ry: .78, glow: .8 });
    fine(k, () => { for (let y = 2.2; y < 9.6; y += 1.1) { const w = 1.08 - y * .05; k.box(.5, .14, .04, 0, y, w, 0xffc445, { glow: .9, bevel: .01 }); k.box(.14, .4, .04, (y * 7 % 3 - 1) * .14, y + .34, w - .02, 0xffc445, { glow: .9, bevel: .01 }); } });
  } },
  pineSnow: { r: .8, s: [1, 2.2], make: k => { k.tube([[0, -.3, 0], [.05, 3, 0], [0, 9.4, 0]], [.7, .44, .08], 0x33304a, { mat: 'bark', seg: 8, sub: 2 }); pineTiers(k, 0x234d70, 0x4a84a8, [[2.3, 3.8, 3.6], [4.3, 3.1, 3.3], [6.1, 2.45, 3], [7.8, 1.7, 2.5]], true); } },
  iceSpike: { r: 1, s: [.8, 2.8], make: k => { for (const [x, z, h, r, tilt] of [[0, 0, 7.2, 1.45, .05], [1.25, .4, 3.8, .78, -.18], [-1.05, -.6, 2.8, .66, .2], [.2, -1.15, 2.2, .5, .14]]) k.loft([[-.1, r * 1.02], [h * .3, r * .78], [h * .72, r * .34], [h, .01]], x, 0, z, 0x5d86e8, { seg: 7, flat: true, sub: 1, c2: 0xe9f5ff, glow: .22, mat: 'metal', rz: tilt }); } },
  crystal: { r: .6, s: [.7, 2], make: k => { for (const [x, z, h, r, c, tz, tx] of [[0, 0, 3.4, .78, 0x4fc2ff, .05, 0], [.82, .24, 1.9, .42, 0x8a6dff, -.32, .1], [-.72, -.3, 1.6, .36, 0x4fc2ff, .34, -.1], [.15, .78, 1.3, .3, 0x8a6dff, .05, .36]]) k.loft([[-.05, r * .62], [h * .16, r], [h * .74, r * .92], [h, .01]], x, 0, z, c, { seg: 6, flat: true, sub: 1, glow: .75, c2: 0xc8f4ff, rz: tz, rx: tx }); } },
  gear: { r: 2.5, s: [.7, 1.5], make: k => {
    const R = 3.5; k.at(0, R * .9, 0, .6);
    k.torus(R * .78, R * .15, 0, 0, 0, 0xc98a33, { seg: 22, c2: 0xf0bd5a, mat: 'metal' }); k.torus(R * .34, R * .07, 0, 0, 0, 0xb87a2a, { seg: 16, mat: 'metal' });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.box(R * .9, .34, .24, Math.cos(a) * R * .46, Math.sin(a) * R * .46, 0, 0xa8702a, { mat: 'metal', rz: a }); }
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; k.box(.72, .95, .46, Math.cos(a) * R, Math.sin(a) * R, 0, 0xb87a2a, { mat: 'metal', rz: a + HP }); }
    k.cyl(.62, .62, .72, 0, 0, 0, 0x8a5a24, { rx: HP, seg: 10, mat: 'metal' }); k.pop();
  } },
  pillar: { r: 1.2, s: [.9, 1.5], make: k => {
    k.box(2.7, .4, 2.7, 0, .2, 0, 0x6a5778, { mat: 'stone' }); k.loft([[.4, 1.12], [.58, 1.16], [.74, .96], [.92, .9]], 0, 0, 0, 0x7a6688, { mat: 'stone', seg: 18, sub: 2 });
    k.loft([[.9, .92], [4, .84], [6.9, .78]], 0, 0, 0, 0x8e7a9c, { mat: 'stone', seg: 20, c2: 0xb8a4c0, shape: a => 1 + Math.abs(Math.sin(a * 6)) * .055 - .03, sub: 2 });
    k.loft([[6.9, .8], [7.16, .92], [7.34, 1.18], [7.5, 1.22]], 0, 0, 0, 0xc98a33, { mat: 'metal', seg: 18, sub: 2 }); k.box(2.4, .36, 2.4, 0, 7.68, 0, 0x8e7a9c, { mat: 'stone' });
  } },
  copperTree: { r: .9, s: [1, 1.9], make: k => {
    k.tube([[0, -.2, 0], [.12, 2.5, .05], [-.1, 4.6, -.05], [0, 6.4, 0]], [.74, .46, .36, .22], 0x8c5a2e, { mat: 'metal', seg: 9, c2: 0xc98a33 });
    for (let i = 0; i < 6; i++) { const a = i * 1.05, h = (i % 2) * .6, x = Math.cos(a), z = Math.sin(a); k.tube([[x * .15, 5.2 + h * .4, z * .15], [x * 1, 6.2 + h, z * 1], [x * 1.9, 7.2 + h, z * 1.9]], [.14, .09, .05], 0xc98a33, { mat: 'metal', seg: 5 }); k.loft([[-.55, .02], [-.3, .42], [.06, .52], [.42, .3], [.68, .02]], x * 2, 7.65 + h, z * 2, 0x3fe0b0, { seg: 6, flat: true, sub: 1, glow: .68, c2: 0xb0ffe8 }); }
  } },
  spike: { r: 1.1, s: [.8, 2.8], make: k => {
    for (const [x, z, h, r, t] of [[0, 0, 7.6, 1.42, .08], [1.15, .32, 3.7, .74, -.22], [-.9, -.5, 2.6, .6, .24]]) k.loft([[-.1, r], [h * .32, r * .72], [h * .7, r * .36], [h, .01]], x, 0, z, 0x1a1428, { mat: 'rock', seg: 9, c2: 0x45304f, j: .16, rz: t, shape: a => 1 + Math.sin(a * 3 + x) * .12, uv: .55 });
    k.tube([[.32, .2, .95], [.5, 1.2, .78], [.22, 2.1, .56], [.34, 3, .36]], [.09, .07, .05, .012], 0xff4a20, { glow: 1, seg: 4 });
  } },
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
  const rg = RNG(Math.imul(cx + 11, 40503) ^ Math.imul(cz + 5, 65599));
  for (const r of seen) for (const [name, density] of Object.entries(REGIONS[r].props)) {
    if (name !== 'grass' && name !== 'dryGrass') continue;
    const def = DEF[name], n = Math.round(density * 2.2);
    for (let i = 0; i < n; i++) {
      const x = x0 + rg() * CHUNK, z = z0 + rg() * CHUNK, ry = rg() * 6.283, s = rg.range(def.s[0], def.s[1] * 1.1);
      if (regionIdx(x, z) !== r || blockedAt(x, z)) continue;
      const y = heightAt(x, z);
      if (y < .75 || Math.abs(heightAt(x + 2, z) - y) + Math.abs(heightAt(x, z + 2) - y) > 2.2) continue;
      list.items.push({ t: typeIdx[name], x, y: y - .06, z, ry, s, grass: true, solid: false });
    }
  }
  cache.set(key, list);
  return list;
}

const NEAR_SOLID = 105, NEAR_SMALL = 52;

export class Props {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.cx = -999; this.cz = -999; this.lx = 1e9; this.lz = 1e9;
    const inst = (geo, cap, shadow) => {
      const m = new THREE.InstancedMesh(geo, MAT.solid, cap);
      m.frustumCulled = false; m.count = 0; m.castShadow = shadow; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
      return m;
    };
    this.near = []; this.far = [];
    NAMES.forEach((n, i) => {
      const k = new Kit(1000 + i, { lod: true }); DEF[n].make(k);
      const { hi, lo } = k.buildLOD(), small = !!DEF[n].grass;
      this.near.push(inst(hi, small ? 2600 : 420, !small && !!DEF[n].r));
      this.far.push(inst(lo, small ? 4200 : 1400, false));
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
    // Die Nahversion folgt der Spielfigur, deshalb wird schon nach kurzem Weg neu verteilt.
    if (!force && Math.hypot(px - this.lx, pz - this.lz) < 18) return;
    this.lx = px; this.lz = pz;
    const cx = clamp(Math.floor((px + HALF) / CHUNK), 0, CHUNKS - 1), cz = clamp(Math.floor((pz + HALF) / CHUNK), 0, CHUNKS - 1);
    this.cx = cx; this.cz = cz;
    for (const m of this.near) m.count = 0;
    for (const m of this.far) m.count = 0;
    const R = this.radius, lowDetail = !Kit.detail || this.thin;
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
        const q = (it.x - px) ** 2 + (it.z - pz) ** 2, lim = it.solid ? NEAR_SOLID : NEAR_SMALL;
        let m = !lowDetail && q < lim * lim ? this.near[it.t] : this.far[it.t];
        if (m.count >= m.instanceMatrix.count) m = this.far[it.t];
        if (m.count >= m.instanceMatrix.count) continue;
        const e = m.instanceMatrix.array, a = m.count * 16, c = Math.cos(it.ry) * it.s, s = Math.sin(it.ry) * it.s;
        e[a] = c; e[a + 1] = 0; e[a + 2] = -s; e[a + 3] = 0; e[a + 4] = 0; e[a + 5] = it.s; e[a + 6] = 0; e[a + 7] = 0;
        e[a + 8] = s; e[a + 9] = 0; e[a + 10] = c; e[a + 11] = 0; e[a + 12] = it.x; e[a + 13] = it.y; e[a + 14] = it.z; e[a + 15] = 1;
        m.count++;
      }
    }
    for (const m of this.near) m.instanceMatrix.needsUpdate = true;
    for (const m of this.far) m.instanceMatrix.needsUpdate = true;
  }
}
