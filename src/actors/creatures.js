import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';
import { Kit, MAT } from '../core/gfx.js';
import { G } from '../game/state.js';
import { makeBlob } from './models.js';

// Eigene Kreaturen: ein Mesh pro Tier, mit echten Knochen und weicher Hautgewichtung.
const HP = Math.PI / 2, TAU = Math.PI * 2, TOOTH = 0xfff4dc, DARK = 0x120c12, BONE = 0xe8e2cc;
const c01 = x => Math.max(0, Math.min(1, x));
const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const swing = t => t < 0 ? 0 : -ss(0, .32, t) * .7 + ss(.32, .5, t) * 1.35 - ss(.62, 1, t) * .65;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const SIDES = [[-1, 'l'], [1, 'r']];
const onZ = (k, x, y, z, fn) => { k.at(x, y, z, 0, 1, HP); fn(); k.pop(); };

class RB {
  constructor(seed) { this.defs = []; this.id = {}; this.parts = []; this.seed = seed; this.legs = []; }
  b(n, p, x, y, z) { this.id[n] = this.defs.length; this.defs.push({ n, p: p == null ? -1 : this.id[p], x, y, z }); return n; }
  P(n) { const d = this.defs[this.id[n]]; return [d.x, d.y, d.z]; }
  part(set, fn) { const k = new Kit(this.seed++, { auto: false }); fn(k); this.parts.push({ g: k.build(), set: set.map(n => this.id[n]) }); }
  /** Insektenbein: drei Gelenke, die Spitze endet auf dem Boden. */
  leg(name, parent, base, ang, L1, L2, L3, rise) {
    const dx = Math.sin(ang), dz = Math.cos(ang), a = base, b = [a[0] + dx * L1, a[1] + rise, a[2] + dz * L1], c = [b[0] + dx * L2, b[1] - rise * .12, b[2] + dz * L2], d = [c[0] + dx * L3, .03, c[2] + dz * L3];
    this.b(`${name}a`, parent, ...a); this.b(`${name}b`, `${name}a`, ...b); this.b(`${name}c`, `${name}b`, ...c); this.b(`${name}d`, `${name}c`, ...d);
    this.legs.push({ n: name, axis: [dz, 0, -dx], side: dx >= 0 ? 1 : -1 });
    return [a, b, c, d];
  }
  finish() {
    const D = this.defs, seg = D.map((d, i) => {
      const kids = D.filter(q => q.p === i), a = [d.x, d.y, d.z];
      if (kids.length) { const n = kids.length; return [...a, kids.reduce((s, q) => s + q.x, 0) / n, kids.reduce((s, q) => s + q.y, 0) / n, kids.reduce((s, q) => s + q.z, 0) / n]; }
      const p = d.p >= 0 ? D[d.p] : d;
      return [...a, d.x + (d.x - p.x) * .4, d.y + (d.y - p.y) * .4, d.z + (d.z - p.z) * .4];
    });
    const dist = (x, y, z, s) => { const ax = s[3] - s[0], ay = s[4] - s[1], az = s[5] - s[2], l = ax * ax + ay * ay + az * az || 1, t = c01(((x - s[0]) * ax + (y - s[1]) * ay + (z - s[2]) * az) / l), qx = s[0] + ax * t - x, qy = s[1] + ay * t - y, qz = s[2] + az * t - z; return qx * qx + qy * qy + qz * qz; };
    const geos = [];
    for (const { g, set } of this.parts) {
      const p = g.attributes.position, n = p.count; if (!n) continue;
      const si = new Uint8Array(n * 4), sw = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) {
        const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
        let i1 = set[0], d1 = 1e9, i2 = set[0], d2 = 1e9;
        for (const b of set) { const q = dist(x, y, z, seg[b]); if (q < d1) { i2 = i1; d2 = d1; i1 = b; d1 = q; } else if (q < d2) { i2 = b; d2 = q; } }
        const w1 = 1 / (d1 * d1 + 1e-7), w2 = set.length > 1 ? 1 / (d2 * d2 + 1e-7) : 0, s = w1 + w2;
        si[v * 4] = i1; si[v * 4 + 1] = i2; sw[v * 4] = w1 / s; sw[v * 4 + 1] = w2 / s;
      }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geos.push(g);
    }
    return { defs: D, geo: mergeGeometries(geos), legs: this.legs, inv: null };
  }
}

function buildWolf(s) {
  const c = s.c1 ?? 0x4a4a6a, c2 = s.c2 ?? 0x7a7aa0, eye = s.eye ?? 0xffc445, R = new RB(201);
  R.b('root', null, 0, 0, 0); R.b('hips', 'root', 0, 1.04, -.72); R.b('spine', 'hips', 0, 1.1, -.2); R.b('chest', 'spine', 0, 1.14, .34); R.b('neck', 'chest', 0, 1.34, .72); R.b('head', 'neck', 0, 1.58, 1); R.b('jaw', 'head', 0, 1.47, 1.08);
  R.b('t1', 'hips', 0, 1.08, -1.04); R.b('t2', 't1', 0, .98, -1.4); R.b('t3', 't2', 0, .78, -1.72); R.b('t4', 't3', 0, .56, -1.96);
  const LEG = { f: [[.25, 1, .48], [.3, .6, .36], [.27, .23, .47], [.27, .07, .58]], b: [[.25, 1.02, -.74], [.31, .63, -.48], [.28, .31, -.88], [.28, .07, -.73]] };
  for (const [n, pts] of Object.entries(LEG)) for (const [x, sd] of SIDES) { let par = n === 'f' ? 'chest' : 'hips'; pts.forEach((p, i) => { const q = `${n}${sd}${i}`; R.b(q, par, x * p[0], p[1], p[2]); par = q; }); }
  R.part(['hips', 'spine', 'chest', 'neck'], k => {
    onZ(k, 0, 1.08, 0, () => {
      k.loft([[-1.08, .07, .09], [-.96, .25, .29, 0, .02], [-.68, .32, .38], [-.3, .27, .33, 0, -.03], [.06, .3, .4, 0, .05], [.4, .35, .47, 0, .09], [.68, .3, .41, 0, -.06], [.9, .2, .29, 0, -.26]], 0, 0, 0, c, { mat: 'fur', c2, seg: 18, uv: 1.1, shape: (a, t) => 1 + Math.sin(a * 9 + t * 14) * .022 });
      k.loft([[-.7, .17, .05, 0, .36], [-.2, .2, .06, 0, .32], [.38, .25, .08, 0, .5], [.68, .17, .06, 0, .36]], 0, 0, 0, c2, { mat: 'fur', seg: 10 });
    });
    for (let i = 0; i < 26; i++) {
      const u = i / 25, z = -.92 + u * 1.72, top = 1.4 + Math.sin(u * 3.1) * .1 + (u > .65 ? (u - .65) * .3 : 0), sx = (i % 3 - 1) * .07, L = .16 + (i * 7 % 5) * .025;
      k.tube([[sx, top - .1, z], [sx * 1.5, top + L * .55, z - .07], [sx * 1.7, top + L * .75, z - .22]], [.065, .04, .003], i % 2 ? c2 : c, { mat: 'fur', seg: 4, sub: 2 });
    }
  });
  R.part(['chest', 'neck', 'head'], k => {
    k.tube([[0, 1.2, .46], [0, 1.34, .72], [0, 1.5, .94], [0, 1.58, 1.04]], [.36, .31, .24, .2], c, { mat: 'fur', seg: 14, sub: 3, uv: 1 });
    for (let i = 0; i < 30; i++) {
      const a = i / 29 * Math.PI * 1.5 - Math.PI * .75, q = .34 + (i % 2) * .04, x = Math.sin(a) * q, y = 1.32 + Math.cos(a) * q, z = .84 - (i % 3) * .05;
      k.tube([[x * .75, y, z], [x * 1.08, y + Math.cos(a) * .06, z - .2], [x * 1.16, y - .08 + Math.cos(a) * .03, z - .46]], [.095, .06, .004], i % 3 ? c2 : c, { mat: 'fur', seg: 4, sub: 2 });
    }
  });
  R.part(['head'], k => {
    k.at(0, 1.58, 1);
    onZ(k, 0, 0, 0, () => {
      k.loft([[-.16, .19, .23, 0, -.04], [.04, .27, .29, 0, -.02], [.22, .27, .25], [.38, .18, .165, 0, .05], [.56, .13, .105, 0, .08], [.74, .1, .075, 0, .09], [.8, .045, .035, 0, .08]], 0, 0, 0, c, { mat: 'fur', c2, seg: 16, uv: .9 });
      k.loft([[.3, .1, .03, 0, .19], [.52, .1, .035, 0, .18], [.74, .07, .03, 0, .15]], 0, 0, 0, c2, { mat: 'fur', seg: 10 });
    });
    k.ball(.05, 0, -.065, .805, 0x0c0a12, { mat: 'plain', sy: .78, sz: .85 });
    for (const x of [-1, 1]) {
      k.ball(.075, x * .135, .09, .315, DARK, { mat: 'plain', sz: .55, sy: .62, rz: x * .3 });
      k.ball(.041, x * .142, .092, .352, eye, { glow: 1, sz: .55, sy: .68, rz: x * .3 });
      k.tube([[x * .2, .12, .28], [x * .1, .165, .4], [x * .03, .1, .52]], [.035, .03, .008], c, { mat: 'fur', seg: 4, sub: 2 });
      k.tube([[x * .15, .2, .03], [x * .22, .46, -.01], [x * .24, .66, -.08]], [.13, .08, .004], c, { mat: 'fur', seg: 5, sub: 2 });
      k.tube([[x * .15, .23, .06], [x * .2, .42, .03], [x * .22, .56, -.03]], [.065, .04, .003], 0x2a1c26, { mat: 'skin', seg: 4, sub: 2 });
      for (let i = 0; i < 5; i++) k.cone(.016 + (i === 0 ? .012 : 0), i === 0 ? .13 : .07, x * (.088 - i * .002), -.15, .74 - i * .085, TOOTH, { mat: 'bone', seg: 4, rx: Math.PI });
    }
    k.pop();
  });
  R.part(['jaw'], k => {
    onZ(k, 0, 1.47, 1.08, () => k.loft([[-.12, .15, .07], [.12, .125, .055], [.42, .09, .04], [.58, .05, .022]], 0, 0, 0, c2, { mat: 'fur', seg: 10 }));
    k.tube([[0, 1.48, 1.18], [0, 1.47, 1.42], [0, 1.45, 1.58]], [.05, .05, .018], 0x8a2c3a, { mat: 'skin', seg: 5, sub: 2, sz: .4 });
    for (const x of [-1, 1]) for (let i = 0; i < 4; i++) k.cone(.015 + (i === 0 ? .009 : 0), i === 0 ? .1 : .06, x * (.075 - i * .002), 1.52, 1.6 - i * .085, TOOTH, { mat: 'bone', seg: 4 });
  });
  for (const [n, pts] of Object.entries(LEG)) for (const [x, sd] of SIDES) {
    const q = pts.map(p => [x * p[0], p[1], p[2]]), ids = [0, 1, 2, 3].map(i => `${n}${sd}${i}`), F = n === 'f';
    R.part(ids, k => {
      k.tube([[q[0][0], q[0][1] + .18, q[0][2]], q[0], lerp3(q[0], q[1], .55), q[1], lerp3(q[1], q[2], .5), q[2], q[3]], F ? [.2, .185, .145, .098, .07, .056, .06] : [.24, .225, .175, .105, .07, .056, .06], c, { mat: 'fur', seg: 9, sub: 2, uv: .9 });
      k.ball(.092, q[3][0], .075, q[3][2] + .07, c2, { mat: 'fur', sy: .62, sz: 1.3 });
      for (const o of [-.055, 0, .055]) k.cone(.017, .09, q[3][0] + o, .04, q[3][2] + .2, 0x201820, { mat: 'bone', seg: 4, rx: 1.86 });
    });
  }
  R.part(['t1', 't2', 't3', 't4'], k => k.tube([R.P('t1'), lerp3(R.P('t1'), R.P('t2'), .5), R.P('t2'), R.P('t3'), R.P('t4'), [0, .4, -2.12]], [.085, .15, .19, .17, .1, .012], c2, { mat: 'fur', seg: 10, sub: 3, uv: .9, shape: a => 1 + Math.sin(a * 7) * .08 }));
  return R.finish();
}

const insectLegPart = (R, pts, n, c, mat, r = .09, tip = c) => R.part([`${n}a`, `${n}b`, `${n}c`, `${n}d`], k => {
  k.tube([pts[0], lerp3(pts[0], pts[1], .55), pts[1]], [r, r * .98, r * .8], c, { mat, seg: 7, sub: 2 });
  k.ball(r * .96, ...pts[1], tip, { mat });
  k.tube([pts[1], lerp3(pts[1], pts[2], .5), pts[2]], [r * .78, r * .82, r * .56], c, { mat, seg: 7, sub: 2 });
  k.ball(r * .62, ...pts[2], tip, { mat });
  k.tube([pts[2], lerp3(pts[2], pts[3], .6), pts[3]], [r * .54, r * .36, r * .04], tip, { mat, seg: 6, sub: 2 });
});

function buildSpider(s) {
  const c = s.c1 ?? 0x3a2a3a, c2 = s.c2 ?? 0x4a7a52, eye = s.eye ?? 0x57f0a0, R = new RB(221), gear = c2 === 0xc98a33;
  R.b('root', null, 0, 0, 0); R.b('body', 'root', 0, 1, .22); R.b('abd', 'body', 0, 1.16, -.46); R.b('abd2', 'abd', 0, 1.2, -1.2); R.b('head', 'body', 0, 1, .86);
  for (const [x, sd] of SIDES) { R.b(`fg${sd}`, 'head', x * .13, .8, 1.14); R.b(`fgt${sd}`, `fg${sd}`, x * .1, .46, 1.26); }
  R.part(['abd', 'abd2'], k => {
    onZ(k, 0, 1.2, -.84, () => k.loft([[-.78, .05, .05], [-.68, .42, .38], [-.4, .67, .6], [-.02, .76, .7], [.36, .62, .57], [.6, .34, .32], [.7, .06, .06]], 0, 0, 0, c, { mat: gear ? 'metal' : 'fur', c2, seg: 22, uv: .9, shape: (a, t) => 1 + Math.sin(t * 22) * .014 }));
    for (let i = 0; i < 4; i++) { const z = -.38 - i * .3, r = [.54, .72, .74, .6][i]; k.torus(r, gear ? .045 : .022, 0, 1.2, z, gear ? 0xf0bd5a : c2, { mat: gear ? 'metal' : 'fur', seg: 22, sy: .92 }); }
    if (!gear) for (let i = 0; i < 42; i++) { const a = i * 2.4, q = .12 + i * .019, x = Math.cos(a) * q * .72, z = -.84 + Math.sin(a) * q * .78, y = 1.2 + .68 * Math.sqrt(Math.max(.04, 1 - q * q)); k.tube([[x, y, z], [x * 1.1, y + .09, z + Math.sin(a) * .05 - .04], [x * 1.16, y + .13, z + Math.sin(a) * .06 - .1]], [.024, .014, .002], i % 3 ? c : c2, { mat: 'fur', seg: 3, sub: 1 }); }
    else for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.box(.11, .13, .09, Math.cos(a) * .61, 1.66, -.86 + Math.sin(a) * .61, 0xb87a2a, { mat: 'metal', ry: -a, bevel: .012 }); }
  });
  R.part(['body', 'head'], k => {
    onZ(k, 0, 1, .22, () => k.loft([[-.46, .1, .1], [-.3, .4, .32], [.05, .5, .4], [.42, .42, .33], [.74, .24, .2], [.84, .05, .05]], 0, 0, 0, c2, { mat: gear ? 'metal' : 'fur', c2: c, seg: 18, uv: .8 }));
    for (const [x, y, r] of [[-.15, .17, .095], [.15, .17, .095], [-.32, .1, .065], [.32, .1, .065], [-.22, .3, .05], [.22, .3, .05], [-.08, .32, .043], [.08, .32, .043]]) { const z = 1.02 - Math.abs(x) * .32; k.ball(r * 1.28, x, 1 + y, z - .018, DARK, { mat: 'plain' }); k.ball(r, x, 1 + y, z, eye, { glow: 1 }); }
  });
  for (const [x, sd] of SIDES) R.part([`fg${sd}`, `fgt${sd}`], k => { k.tube([[x * .13, .84, 1.08], [x * .17, .68, 1.24], [x * .1, .46, 1.26]], [.1, .075, .006], TOOTH, { mat: 'bone', seg: 7, sub: 3, c2: 0x3a2a22 }); });
  const A = [.62, 1.12, 1.9, 2.5];
  for (const [x, sd] of SIDES) A.forEach((ang, i) => { const n = `L${sd}${i}`, base = [x * .3, .96, .52 - i * .22], len = 1 - Math.abs(i - 1.3) * .1, p = R.leg(n, 'body', base, x * ang, .52 * len, .82 * len, .86 * len, .52); insectLegPart(R, p, n, gear ? 0x7a5230 : c2, gear ? 'metal' : 'fur', .09, gear ? 0xc98a33 : c); });
  return R.finish();
}

function buildScorpion(s) {
  const c = s.c1 ?? 0x8a3a20, c2 = s.c2 ?? 0xd87a3a, eye = s.eye ?? 0xffe680, R = new RB(241);
  R.b('root', null, 0, 0, 0); R.b('body', 'root', 0, .66, .5); R.b('s1', 'body', 0, .68, .04); R.b('s2', 's1', 0, .68, -.42); R.b('s3', 's2', 0, .68, -.86);
  const T = [[0, .78, -1.2], [0, 1.2, -1.54], [0, 1.72, -1.6], [0, 2.16, -1.34], [0, 2.4, -.94], [0, 2.36, -.54]];
  T.forEach((p, i) => R.b(`t${i}`, i ? `t${i - 1}` : 's3', ...p));
  for (const [x, sd] of SIDES) { R.b(`c1${sd}`, 'body', x * .5, .6, .9); R.b(`c2${sd}`, `c1${sd}`, x * 1.06, .68, 1.28); R.b(`c3${sd}`, `c2${sd}`, x * 1.18, .68, 1.82); R.b(`c4${sd}`, `c3${sd}`, x * 1.08, .7, 2.26); R.b(`c5${sd}`, `c3${sd}`, x * .98, .68, 2.05); R.b(`c6${sd}`, `c5${sd}`, x * .9, .68, 2.42); }
  R.part(['body', 's1', 's2', 's3'], k => {
    onZ(k, 0, .68, 0, () => {
      for (let i = 0; i < 6; i++) { const y = -1.04 + i * .31, w = .46 + Math.sin((i + .5) / 6 * Math.PI) * .2; k.loft([[y - .2, w * .72, .17], [y - .13, w, .25], [y + .1, w * 1.04, .29], [y + .2, w * .8, .2]], 0, 0, 0, i % 2 ? c : c2, { mat: 'metal', c2: i % 2 ? c2 : c, seg: 16, sub: 2 }); k.torus(w * .98, .018, 0, y + .17, 0, 0x2a1410, { rx: 0, mat: 'plain', seg: 16, sz: .3 }); }
      k.loft([[.74, .54, .24], [.96, .6, .3], [1.24, .52, .27], [1.5, .3, .15], [1.6, .08, .04]], 0, 0, 0, c, { mat: 'metal', c2, seg: 16 });
    });
    for (const x of [-1, 1]) for (const [a, b] of [[.14, 1.56], [.26, 1.46], [.36, 1.34]]) { k.ball(.06, x * a, .85, b - .012, DARK, { mat: 'plain' }); k.ball(.045, x * a, .86, b, eye, { glow: 1 }); }
    for (const x of [-1, 1]) k.tube([[x * .12, .6, 1.56], [x * .15, .5, 1.72], [x * .05, .46, 1.82]], [.07, .05, .006], c2, { mat: 'bone', seg: 6, sub: 2 });
  });
  R.part(['s3', 't0', 't1', 't2', 't3', 't4'], k => {
    T.forEach((p, i) => { if (i > 4) return; const r = .28 - i * .028, n = T[i + 1], m = lerp3(p, n, .5); k.tube([lerp3(p, n, -.12), m, lerp3(p, n, 1.08)], [r * .74, r, r * .62], i % 2 ? c2 : c, { mat: 'metal', seg: 12, sub: 2 }); k.ball(r * .72, ...p, 0x2a1410, { mat: 'metal' }); });
  });
  R.part(['t5'], k => { const [x, y, z] = T[5]; k.ball(.2, x, y, z, 0xc23a2a, { mat: 'metal', glow: .22, sy: 1.08, sz: 1.3 }); k.tube([[x, y - .03, z + .15], [x, y - .08, z + .4], [x, y - .32, z + .56]], [.095, .055, .004], 0xff5a4a, { glow: .75, seg: 7, sub: 3 }); });
  for (const [x, sd] of SIDES) {
    const P = n => R.P(`${n}${sd}`);
    R.part([`c1${sd}`, `c2${sd}`], k => { k.tube([P('c1'), lerp3(P('c1'), P('c2'), .5), P('c2')], [.14, .125, .12], c, { mat: 'metal', seg: 9 }); k.ball(.15, ...P('c2'), c2, { mat: 'metal' }); k.tube([P('c2'), lerp3(P('c2'), P('c3'), .5), P('c3')], [.12, .13, .14], c, { mat: 'metal', seg: 9 }); });
    R.part([`c3${sd}`, `c4${sd}`], k => { const p = P('c3'); k.ball(.31, p[0], p[1], p[2] + .14, c2, { mat: 'metal', sx: .86, sy: .66, sz: 1.3 }); k.tube([[p[0] + x * .14, p[1], p[2] + .3], [p[0] + x * .17, p[1], p[2] + .62], [p[0] + x * -.04, p[1], p[2] + .92]], [.15, .1, .006], c2, { mat: 'metal', seg: 7, sub: 3 }); });
    R.part([`c5${sd}`, `c6${sd}`], k => { const a = P('c5'), b = P('c6'); k.tube([a, lerp3(a, b, .5), [b[0] + x * .1, b[1], b[2] + .04]], [.1, .075, .005], c, { mat: 'metal', seg: 6, sub: 3 }); });
  }
  const A = [.82, 1.26, 1.84, 2.36];
  for (const [x, sd] of SIDES) A.forEach((ang, i) => { const n = `L${sd}${i}`, base = [x * .46, .6, .46 - i * .34], p = R.leg(n, i < 2 ? 'body' : 's1', base, x * ang, .4, .56, .6, .3); insectLegPart(R, p, n, c, 'metal', .075, c2); });
  return R.finish();
}

function buildDragon(s) {
  const c = s.c1 ?? 0x4a6ad8, c2 = s.c2 ?? 0xcfe6ff, eye = s.eye ?? 0xffffff, skel = c === 0xbdb6a0, R = new RB(261), mem = skel ? 0x4a4438 : 0x24305e;
  R.b('root', null, 0, 0, 0); R.b('hips', 'root', 0, 3.5, -2.1); R.b('spine', 'hips', 0, 3.8, 0); R.b('chest', 'spine', 0, 3.9, 1.9);
  const N = [[0, 4.5, 3.05], [0, 5.3, 3.85], [0, 6.05, 4.75], [0, 6.45, 5.75]]; N.forEach((p, i) => R.b(`n${i}`, i ? `n${i - 1}` : 'chest', ...p));
  R.b('head', 'n3', 0, 6.55, 6.05); R.b('jaw', 'head', 0, 6.12, 6.3);
  const T = [[0, 3.4, -3.5], [0, 3.1, -5.3], [.2, 2.65, -7.1], [-.15, 2.15, -8.8], [.1, 1.65, -10.3], [0, 1.25, -11.6]]; T.forEach((p, i) => R.b(`t${i}`, i ? `t${i - 1}` : 'hips', ...p));
  const LEG = { f: [[1.3, 3, 1.9], [1.62, 1.8, 1.62], [1.6, .72, 2.08], [1.6, .14, 2.62]], b: [[1.42, 3.2, -2], [1.78, 1.92, -1.25], [1.72, .92, -2.25], [1.72, .15, -1.72]] };
  for (const [n, pts] of Object.entries(LEG)) for (const [x, sd] of SIDES) { let par = n === 'f' ? 'chest' : 'hips'; pts.forEach((p, i) => { const q = `${n}${sd}${i}`; R.b(q, par, x * p[0], p[1], p[2]); par = q; }); }
  const W = { a: [1.05, 4.75, 1.3], b: [3.6, 6.9, .55], c: [6.3, 6.5, -.25] }, TIPS = [[9.9, 3.5, -1.3], [8.5, 1.9, -2.6], [6.4, 1.3, -3.4], [3.9, 1.5, -3.7]];
  for (const [x, sd] of SIDES) { R.b(`wa${sd}`, 'chest', x * W.a[0], W.a[1], W.a[2]); R.b(`wb${sd}`, `wa${sd}`, x * W.b[0], W.b[1], W.b[2]); R.b(`wc${sd}`, `wb${sd}`, x * W.c[0], W.c[1], W.c[2]); TIPS.forEach((t, i) => R.b(`wf${i}${sd}`, `wc${sd}`, x * t[0], t[1], t[2])); }
  R.part(['hips', 'spine', 'chest', 'n0'], k => {
    onZ(k, 0, 3.75, 0, () => {
      k.loft([[-3.5, .62, .66, 0, .2], [-2.6, 1.22, 1.24, 0, .06], [-1.2, 1.5, 1.6], [.5, 1.56, 1.7, 0, .05], [1.9, 1.42, 1.54, 0, -.05], [2.8, 1, 1.12, 0, -.32], [3.4, .7, .78, 0, -.68]], 0, 0, 0, c, { mat: skel ? 'bone' : 'tile', c2, seg: 24, uv: 1.3, shape: (a, t) => 1 + Math.sin(a * 2) * .025 + Math.sin(t * 44) * .014 });
      if (!skel) k.loft([[-2.9, .62, .5, 0, .86], [-1, 1.08, .94, 0, .84], [1.2, 1.08, .96, 0, .84], [2.9, .54, .46, 0, .66]], 0, 0, 0, c2, { mat: 'tile', seg: 14, uv: .7 });
    });
    if (skel) for (let i = 0; i < 11; i++) { const z = -2.3 + i * .46, r = 1.74 - Math.abs(i - 5) * .05; for (const x of [-1, 1]) k.tube([[x * .12, 5.32, z], [x * r * .8, 5, z - .05], [x * r * 1.02, 3.8, z - .12], [x * r * .68, 2.5, z - .1], [x * .1, 2.12, z - .02]], [.11, .13, .13, .1, .07], BONE, { mat: 'bone', seg: 6, sub: 3 }); }
    for (let i = 0; i < 12; i++) { const z = -3.1 + i * .56, h = 5.1 + Math.sin(i / 11 * Math.PI) * .32, L = .7 + Math.sin(i / 11 * Math.PI) * .85; k.tube([[0, h - .14, z + .28], [0, h + L * .48, z - .12], [0, h + L, z - .58]], [.32, .18, .008], c2, { mat: 'bone', seg: 6, sub: 3 }); }
  });
  R.part(['chest', 'n0', 'n1', 'n2', 'n3', 'head'], k => {
    const P = [[0, 4.1, 2.2], ...N, R.P('head')];
    k.tube(P, [1.14, .96, .78, .66, .6, .54], c, { mat: skel ? 'bone' : 'tile', c2, seg: 16, sub: 4, uv: 1.2 });
    if (!skel) k.tube(P.map(p => [p[0], p[1] - .42, p[2] + .28]), [.72, .62, .5, .42, .36, .3], c2, { mat: 'tile', seg: 10, sub: 4, uv: .7 });
    for (let i = 0; i < 9; i++) { const u = i / 8, p = lerp3(P[0], P[5], u); k.tube([[0, p[1] + .5, p[2] - .18], [0, p[1] + 1.02, p[2] - .55], [0, p[1] + 1.34, p[2] - .98]], [.22, .1, .006], c2, { mat: 'bone', seg: 5, sub: 2 }); }
  });
  R.part(['head'], k => {
    k.at(0, 6.55, 6.05);
    onZ(k, 0, 0, 0, () => {
      k.loft([[-.5, .46, .5, 0, .08], [-.1, .7, .68], [.42, .72, .62, 0, -.08], [1.02, .55, .4, 0, .04], [1.7, .44, .28, 0, .2], [2.28, .4, .24, 0, .28], [2.56, .22, .12, 0, .3]], 0, 0, 0, c, { mat: skel ? 'bone' : 'tile', c2, seg: 18, uv: 1.1 });
      k.loft([[.9, .46, .11, 0, .52], [1.6, .42, .1, 0, .54], [2.2, .36, .08, 0, .52], [2.48, .14, .05, 0, .46]], 0, 0, 0, c2, { mat: skel ? 'bone' : 'tile', seg: 12, uv: 1.1 });
    });
    for (const x of [-1, 1]) {
      k.ball(.2, x * .46, .24, .9, DARK, { mat: 'plain', sz: .62, sy: .66, rz: x * .3 });
      k.ball(.135, x * .49, .25, .98, eye, { glow: 1, sz: .6, sy: .7, rz: x * .3 });
      k.tube([[x * .62, .42, .84], [x * .4, .58, 1.2], [x * .16, .36, 1.62]], [.1, .1, .02], c2, { mat: skel ? 'bone' : 'tile', seg: 5, sub: 2 });
      k.tube([[x * .44, .54, .02], [x * .78, 1.14, -.56], [x * .94, 1.62, -1.32], [x * .84, 1.86, -2.04]], [.27, .2, .11, .006], BONE, { mat: 'bone', seg: 9, sub: 4 });
      k.tube([[x * .68, .1, -.1], [x * 1.22, .34, -.62], [x * 1.56, .5, -1.16]], [.13, .08, .006], 0xc9c2a8, { mat: 'bone', seg: 6, sub: 2 });
      k.ball(.075, x * .2, -.05, 2.5, 0x120c10, { mat: 'plain' });
      for (let i = 0; i < 9; i++) { const z = 2.42 - i * .2, w = .32 + i * .036; k.cone(.05 + (i === 1 ? .025 : 0), i === 1 ? .4 : .24, x * w, -.54, z, TOOTH, { mat: 'bone', seg: 5, rx: Math.PI }); }
    }
    k.pop();
  });
  R.part(['jaw'], k => {
    onZ(k, 0, 6.12, 6.3, () => k.loft([[-.3, .5, .2], [.3, .5, .19], [1.1, .42, .14], [1.9, .3, .09], [2.2, .12, .05]], 0, 0, 0, c2, { mat: skel ? 'bone' : 'tile', seg: 12, uv: 1 }));
    k.tube([[0, 6.28, 6.6], [0, 6.26, 7.6], [0, 6.24, 8.18]], [.2, .18, .06], 0x8a2c3a, { mat: 'skin', seg: 6, sub: 2 });
    for (const x of [-1, 1]) for (let i = 0; i < 8; i++) { const z = 8.22 - i * .2, w = .25 + i * .03; k.cone(.042, .2, x * w, 6.34, z, TOOTH, { mat: 'bone', seg: 5 }); }
  });
  for (const [n, pts] of Object.entries(LEG)) for (const [x, sd] of SIDES) {
    const q = pts.map(p => [x * p[0], p[1], p[2]]), F = n === 'f';
    R.part([0, 1, 2, 3].map(i => `${n}${sd}${i}`), k => {
      k.tube([[q[0][0] * .86, q[0][1] + .62, q[0][2]], q[0], lerp3(q[0], q[1], .6), q[1], lerp3(q[1], q[2], .55), q[2], q[3]], F ? [.82, .78, .6, .46, .36, .32, .36] : [1, .94, .72, .5, .38, .33, .38], c, { mat: skel ? 'bone' : 'tile', seg: 12, sub: 2, uv: 1.1 });
      k.loft([[.04, .42, .78, 0, .34], [.16, .5, .86, 0, .34], [.34, .42, .56, 0, .14], [.52, .34, .36, 0, .03]], q[3][0], 0, q[3][2], c2, { mat: 'tile', seg: 12, uv: .7 });
      for (const a of [-.42, 0, .42]) k.tube([[q[3][0] + Math.sin(a) * .36, .2, q[3][2] + .82], [q[3][0] + Math.sin(a) * .52, .15, q[3][2] + 1.16], [q[3][0] + Math.sin(a) * .54, .04, q[3][2] + 1.42]], [.14, .09, .006], BONE, { mat: 'bone', seg: 6 });
    });
  }
  R.part(T.map((_, i) => `t${i}`), k => {
    k.tube([[0, 3.5, -2.8], ...T], [.96, .82, .68, .5, .34, .2, .05], c, { mat: skel ? 'bone' : 'tile', c2, seg: 13, sub: 5, uv: 1.1 });
    for (let i = 0; i < 13; i++) { const u = i / 12, a = Math.min(4.99, u * 5), j = Math.floor(a), p = lerp3(T[j], T[j + 1], a - j), h = .76 - u * .46; k.tube([[p[0], p[1] + .46 - u * .34, p[2] + .2], [p[0], p[1] + .6 - u * .34 + h * .55, p[2] - .08], [p[0], p[1] + .6 - u * .34 + h, p[2] - .36]], [.22 - u * .1, .1, .005], c2, { mat: 'bone', seg: 4, sub: 2 }); }
    const E = T[5]; k.sheet([[[E[0], E[1] + .05, E[2] + .34], [E[0], E[1] + .55, E[2] - .3], [E[0], E[1] + .22, E[2] - 1.4]], [[E[0], E[1] - .02, E[2] + .34], [E[0], E[1] - .55, E[2] - .3], [E[0], E[1] - .22, E[2] - 1.4]]], c2, { mat: 'bone' });
  });
  for (const [x, sd] of SIDES) {
    const m = v => [x * v[0], v[1], v[2]], a = m(W.a), b = m(W.b), w = m(W.c), tips = TIPS.map(m), ids = ['wa', 'wb', 'wc', 'wf0', 'wf1', 'wf2', 'wf3'].map(q => `${q}${sd}`);
    R.part([`wa${sd}`, `wb${sd}`], k => { k.tube([a, lerp3(a, b, .5), b], [.46, .36, .26], c, { mat: skel ? 'bone' : 'tile', seg: 9, uv: 1 }); k.tube([b, lerp3(b, w, .5), w], [.26, .2, .16], c, { mat: skel ? 'bone' : 'tile', seg: 8, uv: 1 }); k.cone(.17, .7, w[0] + x * .08, w[1] + .42, w[2], BONE, { mat: 'bone', seg: 6, rz: -x * .35 }); });
    tips.forEach((t, i) => R.part([`wc${sd}`, `wf${i}${sd}`], k => k.tube([w, [(w[0] + t[0]) / 2 + x * .34, (w[1] + t[1]) / 2 + .34, (w[2] + t[2]) / 2], t], [.14, .09, .012], c2, { mat: 'bone', seg: 5, sub: 3 })));
    R.part(ids, k => {
      const edge = [w, ...tips, m([1.4, 3.7, -2.6])], rows = [];
      for (let i = 0; i < edge.length - 1; i++) for (let q = 0; q < 4; q++) {
        const e0 = edge[i], e1 = edge[i + 1], u = q / 4, sag = Math.sin(u * Math.PI) * .46, p = [e0[0] + (e1[0] - e0[0]) * u - x * sag * .16, e0[1] + (e1[1] - e0[1]) * u + sag, e0[2] + (e1[2] - e0[2]) * u + sag * .3], f = 1 - i / (edge.length - 1), inner = [a[0] + (b[0] - a[0]) * f * .92, a[1] + (b[1] - a[1]) * f * .92, a[2] + (b[2] - a[2]) * f * .92];
        rows.push([0, .34, .68, 1].map(v => [inner[0] + (p[0] - inner[0]) * v, inner[1] + (p[1] - inner[1]) * v - Math.sin(v * Math.PI) * .24, inner[2] + (p[2] - inner[2]) * v]));
      }
      const L = edge[edge.length - 1]; rows.push([0, .34, .68, 1].map(v => [a[0] + (L[0] - a[0]) * v, a[1] + (L[1] - a[1]) * v - Math.sin(v * Math.PI) * .24, a[2] + (L[2] - a[2]) * v]));
      k.sheet(rows, mem, { mat: 'fur', c2: skel ? 0x6a6050 : c, uv: 1.2 });
    });
  }
  return R.finish();
}

function buildBat(s) {
  const c = s.c1 ?? 0x5b3f9a, d = 0x3a2870, R = new RB(281);
  R.b('root', null, 0, 0, 0); R.b('body', 'root', 0, 1.5, 0); R.b('head', 'body', 0, 1.86, .12);
  R.b('t', 'body', 0, 1.2, -.06);
  const TIP = [[1.62, 1.72, -.08], [1.32, 1.3, -.06], [.86, 1.16, -.04], [.3, 1.32, -.02]];
  for (const [x, sd] of SIDES) { R.b(`w1${sd}`, 'body', x * .16, 1.68, 0); R.b(`w2${sd}`, `w1${sd}`, x * .62, 2, 0); TIP.forEach((p, i) => R.b(`f${i}${sd}`, `w2${sd}`, x * p[0], p[1], p[2])); }
  R.part(['body', 't'], k => {
    k.loft([[1.14, .06, .06], [1.26, .2, .18], [1.5, .29, .26], [1.72, .24, .22], [1.86, .08, .08]], 0, 0, 0, c, { mat: 'fur', c2: 0x8e6fe0, seg: 14, uv: .9 });
    for (let i = 0; i < 20; i++) { const a = i * 2.4, y = 1.3 + i * .025, r = .22 + Math.sin(i / 19 * Math.PI) * .07; k.tube([[Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a) * (r + .06), y - .08, Math.sin(a) * (r + .06)]], [.04, .003], i % 2 ? c : 0x8e6fe0, { mat: 'fur', seg: 3, sub: 1 }); }
    for (const x of [-1, 1]) k.tube([[x * .1, 1.26, 0], [x * .13, 1.08, .03], [x * .1, .98, .08]], [.035, .022, .006], d, { mat: 'skin', seg: 4, sub: 2 });
  });
  R.part(['head'], k => {
    k.loft([[1.68, .08, .1, 0, .06], [1.76, .19, .2, 0, .04], [1.92, .24, .24, 0, .02], [2.05, .15, .16], [2.1, .02, .02]], 0, 0, .1, c, { mat: 'fur', seg: 14 });
    k.ball(.06, 0, 1.82, .4, 0x281838, { mat: 'plain', sy: .75 });
    for (const x of [-1, 1]) { k.tube([[x * .12, 1.98, .1], [x * .25, 2.26, .04], [x * .27, 2.44, -.02]], [.12, .08, .004], c, { mat: 'fur', seg: 6, sub: 3 }); k.tube([[x * .12, 2, .13], [x * .22, 2.2, .09], [x * .24, 2.34, .03]], [.06, .04, .002], 0xc26a8a, { mat: 'skin', seg: 4, sub: 2 }); k.ball(.05, x * .11, 1.93, .31, 0x7fffe0, { glow: 1, sz: .6 }); k.cone(.02, .09, x * .05, 1.72, .32, TOOTH, { mat: 'bone', seg: 4, rx: Math.PI }); }
  });
  for (const [x, sd] of SIDES) {
    const a = [x * .16, 1.68, 0], o = [x * .62, 2, 0], t = TIP.map(p => [x * p[0], p[1], p[2]]), ids = [`w1${sd}`, `w2${sd}`, ...t.map((_, i) => `f${i}${sd}`)];
    R.part([`w1${sd}`, `w2${sd}`], k => { k.tube([a, lerp3(a, o, .5), o], [.05, .04, .026], d, { mat: 'fur', seg: 5 }); k.cone(.024, .13, o[0], o[1] + .05, o[2], TOOTH, { mat: 'bone', seg: 4 }); });
    t.forEach((p, i) => R.part([`w2${sd}`, `f${i}${sd}`], k => k.tube([o, [(o[0] + p[0]) / 2 + x * .03, (o[1] + p[1]) / 2 + .05, (o[2] + p[2]) / 2], p], [.018, .013, .003], d, { mat: 'bone', seg: 4 })));
    R.part(ids, k => {
      const rows = [], fan = (p, f) => rows.push([0, .5, 1].map(w => [o[0] + (p[0] - o[0]) * w, o[1] + (p[1] - o[1]) * w, o[2] + (p[2] - o[2]) * w + Math.sin(w * Math.PI) * f]));
      for (let i = 0; i < t.length; i++) { fan(t[i], .03); if (i < t.length - 1) fan([(t[i][0] + t[i + 1][0]) / 2 - x * .03, (t[i][1] + t[i + 1][1]) / 2 + .1, (t[i][2] + t[i + 1][2]) / 2], .05); }
      fan([x * .1, 1.34, 0], .02);
      k.sheet(rows, c, { mat: 'fur', c2: 0x8e6fe0 });
    });
  }
  return R.finish();
}

function buildShroom(s) {
  const c = s.c1 ?? 0xb82f4d, c2 = s.c2 ?? 0xff6a7d, st = 0xe8ded0, R = new RB(301);
  R.b('root', null, 0, 0, 0); R.b('body', 'root', 0, .3, 0); R.b('top', 'body', 0, .78, 0); R.b('cap', 'top', 0, 1.06, 0);
  for (const [x, sd] of SIDES) { R.b(`a${sd}`, 'body', x * .47, .66, .02); R.b(`h${sd}`, `a${sd}`, x * .66, .28, .12); R.b(`l${sd}`, 'root', x * .23, .24, .03); R.b(`f${sd}`, `l${sd}`, x * .25, .04, .1); }
  R.part(['body', 'top', 'cap'], k => {
    k.loft([[.04, .4, .4], [.14, .56, .54], [.36, .57, .55], [.66, .47, .46], [.94, .39, .39], [1.1, .26, .26]], 0, 0, 0, st, { mat: 'plaster', seg: 22, c2: 0xf6ecdc, fold: .035, foldN: 7 });
    for (const x of [-1, 1]) {
      k.ball(.115, x * .19, .63, .445, 0xfff8ec, { mat: 'plain', sz: .55 }); k.ball(.066, x * .185, .625, .498, 0x18121e, { mat: 'plain', sz: .6 }); k.ball(.02, x * .185 + .022, .65, .53, 0xffffff, { glow: 1 });
      k.tube([[x * .07, .8, .43], [x * .2, .85, .43], [x * .33, .77, .37]], [.012, .025, .008], 0x4a3026, { mat: 'plain', seg: 4 });
      k.ball(.075, x * .34, .47, .385, 0xffb0a0, { mat: 'skin', sy: .6, sz: .4 });
    }
    k.tube([[-.12, .42, .51], [0, .36, .535], [.12, .42, .51]], [.016, .024, .016], 0x2a1820, { mat: 'plain', seg: 4 });
  });
  R.part(['cap'], k => {
    k.at(0, 1.06, 0);
    k.loft([[-.07, .96, .96], [-.02, 1.08, 1.08], [.15, 1.03, 1.03], [.42, .84, .84], [.65, .5, .5], [.78, .17, .17], [.82, .01, .01]], 0, 0, 0, c, { mat: 'plaster', c2, seg: 30, shape: a => 1 + Math.sin(a * 5 + .6) * .022 + Math.sin(a * 11) * .008 });
    k.loft([[-.105, .25, .25], [-.08, .98, .98]], 0, 0, 0, 0xf4e6d6, { mat: 'cloth', seg: 30, sub: 1 });
    for (let i = 0; i < 34; i++) { const a = i / 34 * TAU; k.box(.012, .05, .68, Math.cos(a) * .6, -.11, Math.sin(a) * .6, 0xd8c4b0, { mat: 'plain', ry: -a + HP, bevel: .003 }); }
    for (let i = 0; i < 11; i++) { const a = i * 2.4, q = .18 + i * .075, y = .82 * Math.sqrt(Math.max(.03, 1 - q * q)) - .02; k.ball(.14 - (i % 3) * .022, Math.cos(a) * q, y, Math.sin(a) * q, 0xfff4dc, { glow: .55, sy: .5 }); }
    k.pop();
  });
  for (const [x, sd] of SIDES) {
    R.part([`a${sd}`, `h${sd}`], k => { k.tube([[x * .42, .68, .02], [x * .58, .48, .06], [x * .66, .26, .12]], [.09, .105, .09], st, { mat: 'plaster', seg: 9, sub: 2 }); for (const o of [-.05, 0, .05]) k.tube([[x * .67 + o, .22, .14], [x * .69 + o, .12, .16]], [.03, .012], st, { mat: 'plaster', seg: 4, sub: 1 }); });
    R.part([`l${sd}`, `f${sd}`], k => k.loft([[.0, .19, .32, 0, .09], [.07, .21, .34, 0, .09], [.17, .16, .19, 0, .03], [.27, .12, .13]], x * .24, 0, 0, 0xb09a84, { mat: 'fur', seg: 12, sub: 2 }));
  }
  return R.finish();
}

function buildGhost(s) {
  const c = s.c1 ?? 0x7ff2c8, c2 = s.c2 ?? 0x2a7a82, R = new RB(321);
  R.b('root', null, 0, 0, 0); R.b('chest', 'root', 0, 2.05, 0); R.b('head', 'chest', 0, 2.62, .05);
  R.b('t1', 'chest', 0, 1.66, -.02); R.b('t2', 't1', 0, 1.26, -.06); R.b('t3', 't2', 0, .86, -.12); R.b('t4', 't3', 0, .46, -.2);
  for (const [x, sd] of SIDES) { R.b(`a${sd}`, 'chest', x * .42, 2.28, .04); R.b(`b${sd}`, `a${sd}`, x * .66, 1.86, .22); R.b(`h${sd}`, `b${sd}`, x * .72, 1.42, .42); }
  R.part(['chest', 't1', 't2', 't3', 't4'], k => {
    k.loft([[.34, .86, .84, 0, -.26], [.62, .74, .72, 0, -.18], [1.02, .62, .6, 0, -.1], [1.5, .54, .52, 0, -.04], [1.98, .52, .48], [2.32, .54, .48], [2.56, .36, .32], [2.72, .08, .08]], 0, 0, 0, c2, { glow: .46, c2: c, seg: 26, fold: .24, foldN: 7, foldP: .8, shape: (a, t) => 1 + (1 - t) * (1 - t) * (Math.sin(a * 5 + 1) * .12 + Math.sin(a * 11) * .05) });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2, r = .86, x = Math.cos(a) * r, z = Math.sin(a) * r - .26, L = .3 + (i * 5 % 4) * .08; k.tube([[x * .94, .5, z], [x * 1.02, .3, z - .02], [x * .98, .34 - L, z - .06]], [.12, .08, .004], c2, { glow: .4, seg: 5, sub: 2 }); }
  });
  R.part(['head'], k => {
    k.at(0, 2.62, .05);
    k.loft([[-.42, .26, .28, 0, -.05], [-.22, .38, .4], [.06, .47, .48], [.3, .4, .42], [.48, .22, .24, 0, -.04], [.58, .02, .02, 0, -.08]], 0, 0, 0, c2, { glow: .36, c2: c, seg: 20, shape: (a, t) => { const fr = Math.max(0, Math.sin(a)); return t < .8 ? 1 - fr * fr * fr * .08 : 1; } });
    k.ball(.3, 0, -.02, .19, 0x051110, { mat: 'plain', sz: .78, sy: 1.1 });
    for (const x of [-1, 1]) { k.ball(.06, x * .12, .04, .435, c, { glow: 1, sy: 1.3, sz: .45 }); k.ball(.024, x * .12, .05, .475, 0xffffff, { glow: 1 }); }
    k.ball(.07, 0, -.17, .425, c2, { glow: .7, sy: 1.25, sz: .35 });
    k.pop();
  });
  for (const [x, sd] of SIDES) R.part([`a${sd}`, `b${sd}`, `h${sd}`], k => {
    const a = R.P(`a${sd}`), b = R.P(`b${sd}`), h = R.P(`h${sd}`);
    k.tube([a, lerp3(a, b, .5), b, h], [.15, .18, .15, .1], c2, { glow: .46, c2: c, seg: 9, sub: 2 });
    for (let i = -1; i <= 1; i++) k.tube([[h[0], h[1] + .02, h[2]], [h[0] + i * .07, h[1] - .14, h[2] + .08], [h[0] + i * .12, h[1] - .3, h[2] + .14]], [.04, .026, .003], c, { glow: .55, seg: 4, sub: 2 });
  });
  return R.finish();
}

/** Hält das Becken beim Umkippen an seinem Platz. */
const topple = (b, ang, h, drop) => { b.rotation.z = ang; b.position.x = h * Math.sin(ang); b.position.y = h * (1 - Math.cos(ang)) - drop; };

const ANIM = {
  wolf(m, a) {
    const B = m.b, t = a.t, sp = m.sp, run = c01(sp / 9), ph = m.ph, amp = ss(.15, 2, sp) * (.42 + run * .34), d = a.dead || 0;
    let crouch = 0, lunge = 0, bite = 0;
    if (a.attack >= 0) { const q = a.attack; crouch = ss(0, .28, q) * (1 - ss(.28, .42, q)); lunge = ss(.28, .42, q) * (1 - ss(.6, 1, q)); bite = ss(.3, .42, q) * (1 - ss(.5, .72, q)); }
    const breath = Math.sin(t * 2.1) * .012, fl = m.hitT > 0 ? m.hitT * 1.8 : 0;
    B.root.position.set(0, -crouch * .2 + lunge * .3 + Math.abs(Math.sin(ph)) * amp * .1 + breath, lunge * .8 - fl * .3); B.root.rotation.set(0, 0, 0);
    B.hips.rotation.x = -crouch * .12 + lunge * .08 + Math.sin(ph * 2) * amp * .05;
    B.spine.rotation.x = Math.sin(ph + 1) * amp * .1 + fl * .1; B.spine.rotation.y = Math.sin(ph) * amp * .05;
    B.chest.rotation.x = crouch * .12 - lunge * .18 - Math.sin(ph) * amp * .07 - fl * .3;
    B.neck.rotation.x = crouch * .36 - lunge * .1 + run * .22 + Math.sin(ph * 2) * amp * .05;
    B.head.rotation.set(crouch * .1 - lunge * .1 - run * .08 + Math.sin(t * 1.3) * .025 * (1 - run), Math.sin(t * .7) * .13 * (1 - run), 0);
    B.jaw.rotation.x = bite * .72 + crouch * .22 + .03 + run * .1;
    for (const [n, F] of [['f', 1], ['b', 0]]) for (const [x, sd] of SIDES) {
      const off = (n === 'f') === (sd === 'l') ? 0 : Math.PI, p = ph + off + (F ? run * .6 : 0), f = Math.sin(p), l = Math.max(0, Math.cos(p)), up = B[`${n}${sd}0`], lo = B[`${n}${sd}1`], pa = B[`${n}${sd}2`];
      const reach = F ? -lunge * 1 : lunge * .55, sq = crouch * (F ? .4 : .7);
      up.rotation.x = -f * amp * (F ? .95 : .82) + reach - sq * (F ? -.3 : .6); lo.rotation.x = l * amp * (F ? 1.15 : .9) + sq * (F ? .4 : 1) - (F ? 0 : l * amp * .2); pa.rotation.x = -lo.rotation.x * .62 + l * amp * .3;
      up.rotation.z = x * (d > 0 ? ss(.1, .6, d) * .7 : 0);
    }
    const sway = Math.sin(t * 2.3 + sp * .1) * (.14 + run * .1);
    B.t1.rotation.set(-.25 * run + .12 + lunge * -.4, sway * .6, 0); B.t2.rotation.set(.08, sway * .9, 0); B.t3.rotation.set(.1, sway * 1.2, 0); B.t4.rotation.set(.08, sway * 1.4, 0);
    if (d > 0) { topple(B.root, ss(0, .4, d) * 1.5, 1.05, ss(0, .4, d) * .72); B.neck.rotation.x = ss(.1, .6, d) * .4; B.jaw.rotation.x = ss(.2, .6, d) * .5; }
  },
  spider(m, a) {
    const B = m.b, t = a.t, sp = m.sp, amp = ss(.15, 2.2, sp) * .5, atk = a.attack >= 0 ? swing(a.attack) : 0, d = a.dead || 0, fl = m.hitT > 0 ? m.hitT * 1.4 : 0;
    B.root.position.set(0, Math.sin(m.ph * 2) * amp * .05 + Math.sin(t * 1.5) * .018 + Math.max(0, -atk) * .1, Math.max(0, atk) * .55); B.root.rotation.set(0, 0, 0);
    B.body.rotation.x = -Math.max(0, -atk) * .55 + Math.max(0, atk) * .3 - fl * .2;
    B.abd.rotation.set(Math.sin(t * 1.9) * .035 + Math.max(0, -atk) * .4, Math.sin(m.ph) * amp * .12, 0); B.abd2.rotation.x = Math.sin(t * 2.3) * .03;
    B.head.rotation.x = Math.max(0, atk) * .22;
    for (const [x, sd] of SIDES) { B[`fg${sd}`].rotation.set(-Math.max(0, -atk) * .9 + Math.max(0, atk) * .7, x * (.1 + Math.sin(t * 5) * .03 - Math.max(0, atk) * .25), 0); }
    legs(m, amp, -Math.max(0, -atk) * .5, d);
    if (d > 0) { const q = ss(0, .42, d); B.root.rotation.z = q * Math.PI; B.root.position.y = q * 2.1 - ss(.2, .5, d) * .14; }
  },
  scorpion(m, a) {
    const B = m.b, t = a.t, sp = m.sp, amp = ss(.15, 2.2, sp) * .46, atk = a.attack >= 0 ? swing(a.attack) : 0, d = a.dead || 0, wind = Math.max(0, -atk), hit = Math.max(0, atk), fl = m.hitT > 0 ? m.hitT * 1.4 : 0;
    B.root.position.set(0, Math.sin(m.ph * 2) * amp * .04 + Math.sin(t * 1.4) * .012, hit * .3); B.root.rotation.set(0, 0, 0);
    B.body.rotation.x = -wind * .1 + hit * .08 - fl * .16; B.s1.rotation.y = Math.sin(m.ph) * amp * .1; B.s2.rotation.y = Math.sin(m.ph + .7) * amp * .12; B.s3.rotation.y = Math.sin(m.ph + 1.3) * amp * .14;
    const sw = Math.sin(t * 1.3) * .05;
    B.t0.rotation.set(-wind * .3 + hit * .24 + sw * .4, sw, 0); B.t1.rotation.set(-wind * .36 + hit * .36 + sw * .3, sw * .6, 0); B.t2.rotation.set(-wind * .4 + hit * .46, sw * .4, 0); B.t3.rotation.set(-wind * .34 + hit * .52, 0, 0); B.t4.rotation.set(-wind * .2 + hit * .46, 0, 0); B.t5.rotation.x = hit * .3 - wind * .2;
    const snap = Math.max(0, Math.sin(t * 2.2 + 1)) * .12 + wind * .45 - hit * .1;
    for (const [x, sd] of SIDES) { B[`c1${sd}`].rotation.y = x * (wind * .3 - hit * .22 + Math.sin(t * 1.1 + x) * .04); B[`c2${sd}`].rotation.y = x * (-wind * .25 + hit * .34); B[`c5${sd}`].rotation.y = x * (snap + .06); }
    legs(m, amp, 0, d);
    if (d > 0) { const q = ss(0, .42, d); B.root.rotation.z = q * 2.9; B.root.position.y = q * 1.34; B.t1.rotation.x = q * .35; B.t3.rotation.x = q * .3; }
  },
  dragon(m, a) {
    const B = m.b, t = a.t, sp = m.sp, run = c01(sp / 7), ph = m.ph, amp = ss(.2, 2.5, sp) * .4, atk = a.attack >= 0 ? swing(a.attack) : 0, wind = Math.max(0, -atk), hit = Math.max(0, atk), d = a.dead || 0, fl = m.hitT > 0 ? m.hitT * .6 : 0, breath = Math.sin(t * 1.25);
    B.root.position.set(0, Math.abs(Math.sin(ph)) * amp * .28 + breath * .05 - hit * .22, hit * .6); B.root.rotation.set(0, 0, 0);
    B.hips.rotation.x = Math.sin(ph * 2) * amp * .05 + wind * .06; B.spine.rotation.set(-wind * .12 + hit * .08, Math.sin(ph) * amp * .08, 0); B.chest.rotation.set(-wind * .2 + hit * .16 - fl * .18 + breath * .01, Math.sin(ph + .7) * amp * .08, 0);
    const look = Math.sin(t * .55) * .12;
    B.n0.rotation.set(-wind * .22 + hit * .44, look, 0); B.n1.rotation.set(-wind * .26 + hit * .4 + breath * .02, look, 0); B.n2.rotation.set(-wind * .2 + hit * .2 + breath * .02, look, 0); B.n3.rotation.set(wind * .05 + hit * .18, look * .6, 0); B.head.rotation.x = -hit * .3 + wind * .1;
    B.jaw.rotation.x = .05 + wind * .5 + hit * .22 + Math.max(0, Math.sin(t * .4) - .9) * 3;
    for (const [n, F] of [['f', 1], ['b', 0]]) for (const [x, sd] of SIDES) {
      const p = ph + ((n === 'f') === (sd === 'l') ? 0 : Math.PI), f = Math.sin(p), l = Math.max(0, Math.cos(p));
      B[`${n}${sd}0`].rotation.set(-f * amp * .72 - (F ? wind * .32 - hit * .16 : 0), 0, 0); B[`${n}${sd}1`].rotation.x = l * amp * .92 + (F ? wind * .24 : 0); B[`${n}${sd}2`].rotation.x = -l * amp * .55;
    }
    const flap = wind > .05 ? -wind * .7 : hit > .05 ? hit * .7 : Math.sin(t * .9) * .04 + run * Math.sin(ph * .5) * .1;
    for (const [x, sd] of SIDES) { B[`wa${sd}`].rotation.set(0, x * .08, x * (-.34 + flap)); B[`wb${sd}`].rotation.z = x * (.14 - flap * .6); B[`wc${sd}`].rotation.z = x * (-.1 + flap * .32); }
    const sw = Math.sin(t * 1.1) * .08 + Math.sin(ph) * amp * .09;
    for (let i = 0; i < 6; i++) B[`t${i}`].rotation.set(i ? .02 : wind * .1, Math.sin(t * 1.1 - i * .55) * .07 + sw * (i + 1) * .3, 0);
    if (d > 0) { const q = ss(0, .5, d); topple(B.root, q * 1.38, 3.6, q * 2.2); B.n0.rotation.x = q * .5; B.n1.rotation.x = q * .4; B.n2.rotation.x = q * .3; B.jaw.rotation.x = q * .55; for (const [x, sd] of SIDES) B[`wa${sd}`].rotation.z = x * (-.34 + q * .5); }
  },
  bat(m, a) {
    const B = m.b, t = a.t, atk = a.attack >= 0 ? swing(a.attack) : 0, d = a.dead || 0, rate = 15 + Math.min(8, m.sp * .8), f = d > 0 ? 0 : Math.sin(t * rate) * .72, lag = d > 0 ? 0 : Math.sin(t * rate - .9) * .52;
    B.root.position.set(0, d > 0 ? 0 : Math.sin(t * 3) * .16 - Math.max(0, atk) * .5 + Math.max(0, -atk) * .28 - f * .08, Math.max(0, atk) * .9); B.root.rotation.set(Math.min(.5, m.sp * .05) + Math.max(0, atk) * .7 - Math.max(0, -atk) * .4, 0, 0);
    B.head.rotation.x = -Math.min(.42, m.sp * .04); B.t.rotation.x = Math.min(.5, m.sp * .05);
    for (const [x, sd] of SIDES) { B[`w1${sd}`].rotation.z = x * (f + .12); B[`w2${sd}`].rotation.z = x * lag * .8; for (let i = 0; i < 4; i++) B[`f${i}${sd}`].rotation.z = x * lag * .18; }
    if (d > 0) { const q = ss(0, .34, d); B.root.position.y = -q * 1.32; B.root.rotation.z = q * 1.5; for (const [x, sd] of SIDES) { B[`w1${sd}`].rotation.z = x * (.5 - q * .9); } }
  },
  shroom(m, a) {
    const B = m.b, t = a.t, sp = m.sp, ph = m.ph, amp = ss(.1, 1.8, sp), atk = a.attack >= 0 ? swing(a.attack) : 0, d = a.dead || 0, wind = Math.max(0, -atk), hit = Math.max(0, atk), fl = m.hitT > 0 ? m.hitT * 1.5 : 0, hop = Math.abs(Math.sin(ph)) * amp;
    const sq = 1 - hop * .05 + Math.sin(t * 2.4) * .014 + wind * .16 - hit * .22;
    B.root.position.set(0, hop * .16, hit * .28); B.root.rotation.set(0, 0, 0);
    B.body.scale.set(2 - sq, sq, 2 - sq); B.body.rotation.set(wind * -.14 + hit * .34 - fl * .18, Math.sin(ph) * amp * .08, Math.sin(ph) * amp * .05);
    B.cap.rotation.set(wind * -.24 + hit * .46 + Math.sin(ph * 2) * amp * .05, 0, Math.sin(ph + .5) * amp * .1 + Math.sin(t * 1.3) * .025);
    for (const [x, sd] of SIDES) {
      const s = x * Math.sin(ph);
      B[`a${sd}`].rotation.set(s * amp * .85 - wind * 1.5 + hit * .9, 0, x * (.14 + Math.sin(t * 2) * .03)); B[`h${sd}`].rotation.x = -.2 - wind * .4;
      B[`l${sd}`].rotation.x = -s * amp * .8;
    }
    if (d > 0) { const q = ss(0, .4, d); topple(B.root, q * 1.45, .52, q * .08); B.body.scale.set(1, 1 - q * .12, 1); }
  },
  ghost(m, a) {
    const B = m.b, t = a.t, sp = m.sp, atk = a.attack >= 0 ? swing(a.attack) : 0, d = a.dead || 0, wind = Math.max(0, -atk), hit = Math.max(0, atk), lean = Math.min(.34, sp * .05), fl = m.hitT > 0 ? m.hitT * 1.6 : 0;
    B.root.position.set(0, d > 0 ? -ss(0, 1, d) * 1.3 : Math.sin(t * 2.1) * .17 + .1, hit * .4); B.root.rotation.set(lean - fl * .4, 0, Math.sin(t * .9) * .03);
    B.chest.rotation.set(-wind * .22 + hit * .3, Math.sin(t * .8) * .1, 0); B.head.rotation.set(-lean * .7 + wind * .1 + Math.sin(t * 1.2) * .05, Math.sin(t * .6) * .16, 0);
    for (let i = 1; i <= 4; i++) { const k = i / 4; B[`t${i}`].rotation.set(-lean * .4 * k + Math.sin(t * 2.6 - i * .75) * .1 * k, Math.sin(t * 1.9 - i * .6) * .12 * k, Math.cos(t * 2.2 - i * .7) * .1 * k); }
    for (const [x, sd] of SIDES) { B[`a${sd}`].rotation.set(-wind * 1.7 + hit * .5 + Math.sin(t * 1.7 + x) * .1, 0, x * (.18 + Math.sin(t * 2.2) * .06 + wind * .3)); B[`b${sd}`].rotation.x = -.3 - wind * .3 + Math.sin(t * 2.4 + x) * .1; B[`h${sd}`].rotation.x = Math.sin(t * 3 + x) * .14; }
    if (d > 0) { const q = ss(0, .8, d); B.head.scale.setScalar(1 - q * .6); B.chest.scale.set(1 - q * .5, 1 - q * .4, 1 - q * .5); }
    else { B.head.scale.setScalar(1); B.chest.scale.setScalar(1); }
  },
};

function legs(m, amp, tuck, d) {
  const q = new THREE.Quaternion(), ax = new THREE.Vector3();
  m.legs.forEach((L, i) => {
    const group = (i + (L.side > 0 ? 1 : 0)) % 2, p = m.ph + group * Math.PI + i * .22, s = Math.sin(p), lift = Math.max(0, Math.cos(p)) * amp + tuck, curl = d > 0 ? ss(.05, .5, d) * .95 : 0;
    L.a.rotation.y = -L.side * s * amp * .62;
    ax.set(L.axis[0], L.axis[1], L.axis[2]);
    L.b.quaternion.copy(q.setFromAxisAngle(ax, -lift * .9 + curl * .6)); L.c.quaternion.copy(q.setFromAxisAngle(ax, lift * .35 + curl * 1.1));
  });
}

const BUILD = { wolf: buildWolf, spider: buildSpider, scorpion: buildScorpion, dragon: buildDragon, bat: buildBat, shroom: buildShroom, ghost: buildGhost };
const STRIDE = { wolf: .92, spider: 1.25, scorpion: 1.2, dragon: .42, bat: 0, shroom: 1.5, ghost: 0 };
const SIZE = { wolf: [1.5, 1.5], spider: [1.5, 1.5], scorpion: [1.5, 1.5], dragon: [6, 7], bat: [2.5, 1.05], shroom: [1.9, 1.05], ghost: [2.5, 1.05] };
const TPL = new Map(), IDM = new THREE.Matrix4();

export const CREATURES = Object.keys(BUILD);

export function makeCreature(spec) {
  const key = `${spec.kind}_${spec.c1}_${spec.c2}_${spec.eye}`;
  let T = TPL.get(key); if (!T) { T = BUILD[spec.kind](spec); TPL.set(key, T); }
  const S = spec.scale ?? 1, root = new THREE.Group(), inner = new THREE.Group();
  root.add(inner); inner.scale.setScalar(S);
  const bones = T.defs.map(d => { const b = new THREE.Bone(); b.name = d.n; return b; }), b = {};
  T.defs.forEach((d, i) => { b[d.n] = bones[i]; if (d.p >= 0) { const q = T.defs[d.p]; bones[i].position.set(d.x - q.x, d.y - q.y, d.z - q.z); bones[d.p].add(bones[i]); } else bones[i].position.set(d.x, d.y, d.z); });
  const mesh = new THREE.SkinnedMesh(T.geo, MAT.solid); mesh.add(bones[0]);
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.updateMatrixWorld(true);
  const sk = new THREE.Skeleton(bones, T.inv ?? []); T.inv ??= sk.boneInverses;
  mesh.bind(sk, IDM); inner.add(mesh);
  const [height, blob] = SIZE[spec.kind], m = { root, inner, spec, kind: spec.kind, skinned: true, creature: true, meshes: [mesh], b, height: height * S, flash: 0, lt: 0, sp: 0, ph: Math.random() * TAU, skip: 0, acc: 0, hitT: 0, legs: T.legs.map(L => ({ a: b[`${L.n}a`], b: b[`${L.n}b`], c: b[`${L.n}c`], axis: L.axis, side: L.side })) };
  m.shadow = makeBlob(blob * S); root.add(m.shadow);
  return m;
}

export function animateCreature(m, a) {
  let dt = a.t - m.lt; m.lt = a.t; if (dt < 0 || dt > .25) dt = .016;
  m.sp += (a.speed - m.sp) * Math.min(1, dt * 9);
  m.ph += dt * Math.max(1.1, m.sp) * STRIDE[m.kind] * (m.sp > .2 ? 1 : .22);
  if (m.hitT > 0) m.hitT = Math.max(0, m.hitT - dt);
  const c = G.camera?.position, p = m.root.position, lim = m.kind === 'dragon' ? 14400 : 3600;
  if (c && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 > lim && ++m.skip % 3) return;
  ANIM[m.kind](m, a);
  m.inner.position.y = a.dead > 0 ? -Math.max(0, a.dead - .8) * 2.4 : 0;
}
