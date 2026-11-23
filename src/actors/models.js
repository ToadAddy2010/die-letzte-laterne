import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT } from '../core/gfx.js';
import { G } from '../game/state.js';
import { HUMAN, makeHuman, animateHuman } from './skinned.js';
import { makeMonster } from './monsters.js';
import { animateCreature } from './creatures.js';

const cache = new Map(), HP = Math.PI / 2, NEAR = 46;
const blobGeo = new THREE.CircleGeometry(1, 24); blobGeo.rotateX(-HP);
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), d = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const r = Math.hypot(x - 31.5, y - 31.5) / 31.5; d.data[(y * 64 + x) * 4 + 3] = Math.round(Math.pow(Math.max(0, 1 - r * r), 1.4) * 190); }
  g.putImageData(d, 0, 0);
  return new THREE.CanvasTexture(c);
})();
export const BLOB = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x05040e, transparent: true, opacity: .62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
export const makeBlob = r => { const m = new THREE.Mesh(blobGeo, BLOB); m.scale.setScalar(r); m.position.y = .2; m.renderOrder = 1; m.frustumCulled = false; return m; };

const K = seed => new Kit(seed, { lod: true, auto: false });
const GOLD = 0xd8a33c, DARK = 0x14101e, LEATHER = 0x4a2c20, WOOD = 0x5a3c2c;
/** Nur in der Nahversion sichtbar: feine Teile wie Finger, Wimpern oder Zähne. */
const fine = (k, fn) => { k.noLo = true; fn(); k.noLo = false; };

export function weapon(k, type, c = 0xc8cfe8, x = 0, y = -.1, z = .02, neutral = false) {
  if (!type) return;
  if (neutral) k.at(x, y, z, 0, 1, 0); else k.at(x, y, z, type === 'bow' ? 0 : .32, 1, type === 'staff' || type === 'spear' ? -.6 : type === 'bow' ? 0 : .62);
  if (type !== 'bow') k.at(0, 0, 0, 0, 1, HP);
  const blade = { mat: 'metal', seg: 4, flat: true, sub: 1, c2: 0xffffff }, met = { mat: 'metal', seg: 8 }, wood = { mat: 'wood', seg: 7 };
  const hilt = (g, p) => {
    k.cyl(.036, .042, p, 0, -p / 2 + .1, 0, LEATHER, { mat: 'fur', seg: 6 });
    fine(k, () => { for (let i = 0; i < 4; i++) k.torus(.043, .009, 0, .05 - i * p / 4.4, 0, 0x2a1810, { rx: HP, seg: 6, mat: 'plain' }); });
    k.ball(.062, 0, .1 - p - .03, 0, GOLD, { mat: 'metal' });
    k.tube([[-g, .08, 0], [-g * .45, .135, 0], [g * .45, .135, 0], [g, .08, 0]], [.024, .04, .04, .024], GOLD, { mat: 'metal', seg: 6, sub: 3 });
  };
  switch (type) {
    case 'sword': hilt(.27, .32); k.loft([[.14, .078, .021], [.22, .086, .023], [1.02, .07, .019], [1.46, .05, .014], [1.68, .002, .002]], 0, 0, 0, c, blade); break;
    case 'great': hilt(.42, .52); k.loft([[.14, .14, .03], [.3, .155, .034], [1.6, .125, .028], [2.3, .085, .02], [2.62, .002, .002]], 0, 0, 0, c, blade); break;
    case 'dagger': hilt(.15, .2); k.loft([[.13, .055, .016], [.34, .062, .017], [.62, .03, .01], [.82, .002, .002]], 0, 0, 0, c, blade); break;
    case 'axe':
      k.tube([[0, -.3, 0], [.012, .4, 0], [0, .9, 0], [0, 1.42, 0]], [.044, .04, .042, .05], WOOD, { ...wood, seg: 6 });
      k.loft([[.0, .17, .055], [.16, .17, .036], [.38, .3, .016], [.5, .4, .004]], .02, 1.2, 0, c, { mat: 'metal', rz: -HP, seg: 8, c2: 0xffffff });
      k.cyl(.07, .07, .24, 0, 1.2, 0, 0x4a4a58, met); break;
    case 'club': k.loft([[-.2, .05], [.2, .065], [.72, .13], [1.15, .22], [1.42, .25], [1.6, .15], [1.66, .02]], 0, 0, 0, 0x6a4a34, { mat: 'bark', c2: 0x8a6a4c, seg: 10, fold: .12, foldN: 5 }); fine(k, () => { for (let i = 0; i < 6; i++) { const a = i * 2.4, q = .18 + i * .012; k.cone(.045, .13, Math.cos(a) * q, .95 + i * .09, Math.sin(a) * q, 0xbdb6a0, { mat: 'bone', seg: 5, rx: Math.sin(a) * 1.4, rz: -Math.cos(a) * 1.4 }); } }); break;
    case 'mace':
      k.tube([[0, -.3, 0], [0, .3, 0], [0, 1.02, 0]], .042, 0x4a3a40, { ...wood, seg: 6 });
      k.ball(.25, 0, 1.15, 0, c, { mat: 'metal' });
      for (let i = 0; i < 10; i++) { const y = 1 - i / 9 * 2, q = Math.sqrt(1 - y * y), a = i * 2.4; k.cone(.075, .22, Math.cos(a) * q * .3, 1.15 + y * .3, Math.sin(a) * q * .3, c, { mat: 'metal', seg: 5, rz: -Math.atan2(Math.cos(a) * q, y), rx: Math.atan2(Math.sin(a) * q, y) }); }
      break;
    case 'spear':
      k.tube([[0, -.75, 0], [.015, .3, 0], [-.01, 1.3, 0], [0, 2.2, 0]], .038, WOOD, { ...wood, seg: 6 });
      k.torus(.05, .017, 0, 2.2, 0, GOLD, { rx: HP, mat: 'metal', seg: 8 });
      k.loft([[2.18, .03, .022], [2.34, .135, .03], [2.62, .08, .02], [2.95, .002, .002]], 0, 0, 0, c, blade); break;
    case 'scythe': {
      k.tube([[0, -.8, 0], [.04, .2, 0], [-.03, 1.2, 0], [.02, 2.1, 0]], [.04, .038, .04, .044], 0x2a2030, { ...wood, seg: 6 });
      const rows = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * 1.9 - .15, R = 1.05, w = .22 * (1 - t) * (1 - t) + .01, x = Math.sin(a) * R, y = 2.0 + (Math.cos(a) - 1) * R * -.15 + t * .1 - t * t * .62; rows.push([[x, y + w, 0], [x, y, .018], [x, y - w, 0]]); }
      k.sheet(rows, c, { mat: 'metal', c2: 0xffffff }); break;
    }
    case 'staff':
      k.tube([[0, -.9, 0], [.035, -.3, .01], [-.03, .5, -.015], [.03, 1.2, .01], [0, 1.68, 0]], [.044, .05, .044, .048, .07], LEATHER, { mat: 'bark', seg: 7, sub: 3 });
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.tube([[Math.cos(a) * .05, 1.66, Math.sin(a) * .05], [Math.cos(a) * .2, 1.84, Math.sin(a) * .2], [Math.cos(a) * .16, 2.08, Math.sin(a) * .16], [Math.cos(a) * .05, 2.2, Math.sin(a) * .05]], [.03, .026, .018, .006], LEATHER, { mat: 'bark', seg: 5, sub: 3 }); }
      k.oct(.17, 0, 1.97, 0, c === 0xc8cfe8 ? 0x4fc2ff : c, { glow: 1, sy: 1.45 }); break;
    case 'bow':
      k.tube([[0, -1.02, -.22], [0, -.74, .02], [0, -.35, .14], [0, 0, .16], [0, .35, .14], [0, .74, .02], [0, 1.02, -.22]], [.012, .03, .042, .05, .042, .03, .012], WOOD, { mat: 'wood', seg: 6, sub: 3 });
      k.cyl(.055, .055, .24, 0, 0, .16, LEATHER, { mat: 'fur', seg: 7 });
      k.tube([[0, -1.02, -.22], [0, 1.02, -.22]], .006, 0xeeeeee, { mat: 'plain', seg: 3, sub: 1 }); break;
    case 'hammer':
      k.tube([[0, -.3, 0], [.01, .4, 0], [0, 1.45, 0]], .046, WOOD, { ...wood, seg: 6 });
      k.loft([[-.46, .17, .2], [-.4, .21, .25], [.4, .21, .25], [.46, .17, .2]], 0, 1.55, 0, c, { mat: 'metal', rx: HP, seg: 8, sub: 1, flat: true });
      k.box(.5, .07, .5, 0, 1.55, 0, GOLD, { mat: 'metal' }); break;
  }
  if (type !== 'bow') k.pop();
  k.pop();
}

export function hat(k, s, y) {
  const c = s.hatColor ?? 0x2743b8, c2 = s.hatColor2 ?? c, cloth = { mat: 'cloth', seg: 18 };
  switch (s.hat) {
    case 'wizard':
      k.loft([[y - .07, .02], [y - .055, .7], [y - .035, .74], [y - .01, .7], [y + .03, .4], [y + .05, .31]], 0, 0, -.02, c, { ...cloth, seg: 24, sub: 2, shape: a => 1 + Math.sin(a * 3 + 1) * .04 });
      k.tube([[0, y, -.03], [0, y + .38, -.07], [.03, y + .74, -.16], [.11, y + 1.04, -.32], [.2, y + 1.22, -.5]], [.34, .24, .15, .075, .01], c, { mat: 'cloth', seg: 16, sub: 5 });
      k.torus(.33, .03, 0, y + .06, -.03, GOLD, { rx: HP, mat: 'metal', seg: 16 });
      fine(k, () => { for (let i = 0; i < 5; i++) { const a = i * 2.1, q = .22 - i * .03; k.oct(.05, Math.cos(a) * q, y + .2 + i * .15, Math.sin(a) * q - .05 - i * .03, 0xfff0a0, { glow: 1 }); } });
      break;
    case 'hood':
      k.loft([[y - .78, .34, .3, 0, -.08], [y - .56, .36, .33, 0, -.07], [y - .3, .37, .36, 0, -.05], [y - .08, .32, .33, 0, -.05], [y + .06, .19, .22, 0, -.08], [y + .13, .03, .04, 0, -.13]], 0, 0, 0, c, { ...cloth, shape: (a, t) => { const fr = Math.max(0, Math.sin(a)); return t < .82 ? 1 - fr * fr * fr * (.1 - t * .06) : 1; } });
      k.tube([[0, y - .02, -.22], [0, y - .1, -.42], [0, y - .3, -.52]], [.13, .08, .012], c, { mat: 'cloth', seg: 8 });
      k.torus(.3, .045, 0, y - .66, .03, c, { rx: HP + .35, mat: 'cloth', seg: 16 });
      break;
    case 'helm':
      k.loft([[y - .42, .325, .35], [y - .28, .335, .36], [y - .1, .315, .34], [y + .02, .24, .26], [y + .08, .11, .12], [y + .1, .01, .01]], 0, 0, -.01, c, { mat: 'metal', seg: 20 });
      k.torus(.34, .026, 0, y - .29, -.01, GOLD, { rx: HP, mat: 'metal', seg: 18, sy: 1.06 });
      k.box(.05, .34, .05, 0, y - .34, .345, c, { mat: 'metal' });
      k.box(.2, .022, .04, -.13, y - .36, .32, DARK, { mat: 'plain', ry: .3 }); k.box(.2, .022, .04, .13, y - .36, .32, DARK, { mat: 'plain', ry: -.3 });
      k.tube([[0, y + .1, .14], [0, y + .2, 0], [0, y + .14, -.2], [0, y - .04, -.36]], [.018, .05, .045, .012], 0xa82e3a, { mat: 'fur', seg: 6 });
      break;
    case 'horns':
      k.loft([[y - .3, .32, .34], [y - .14, .315, .335], [y, .25, .27], [y + .08, .12, .13], [y + .1, .01, .01]], 0, 0, 0, c, { mat: 'metal', seg: 18 });
      k.torus(.325, .024, 0, y - .27, 0, GOLD, { rx: HP, mat: 'metal', seg: 18 });
      for (const x of [-1, 1]) k.tube([[x * .27, y - .1, 0], [x * .47, y - .06, .03], [x * .6, y + .16, .02], [x * .55, y + .46, -.06], [x * .45, y + .6, -.12]], [.1, .085, .062, .032, .004], 0xe8e2cc, { mat: 'bone', seg: 8, sub: 4 });
      break;
    case 'crown':
      k.loft([[y - .21, .31, .33], [y - .1, .325, .345], [y - .02, .34, .36]], 0, 0, 0, 0xffc445, { mat: 'metal', seg: 20, glow: .15, sub: 2 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, big = i % 2 === 0; k.cone(.06, big ? .28 : .17, Math.cos(a) * .325, y + (big ? .11 : .05), Math.sin(a) * .345, 0xffd070, { mat: 'metal', seg: 6, glow: .15 }); if (big) k.ball(.038, Math.cos(a) * .34, y - .11, Math.sin(a) * .36, i % 4 ? 0x5ad0ff : 0xff4a5a, { glow: .9, mat: 'plain' }); }
      break;
    case 'cap':
      k.loft([[y - .2, .315, .335, 0, -.015], [y - .1, .325, .345, 0, -.015], [y + .01, .29, .31, 0, -.02], [y + .08, .16, .18, 0, -.03], [y + .105, .01, .01, 0, -.03]], 0, 0, 0, c, cloth);
      k.sheet([[[-.27, y - .155, .24], [0, y - .13, .33], [.27, y - .155, .24]], [[-.25, y - .2, .39], [0, y - .17, .53], [.25, y - .2, .39]]], c, { mat: 'cloth' });
      break;
    case 'mushroom':
      k.loft([[y - .36, .02], [y - .33, .66, .66], [y - .28, .73, .73], [y - .16, .68, .68], [y + .03, .47, .47], [y + .16, .22, .22], [y + .2, .01, .01]], 0, 0, 0, c, { mat: 'plaster', seg: 24, c2: s.hatColor2 ?? 0xff6a7d });
      k.loft([[y - .37, .05], [y - .345, .63]], 0, 0, 0, 0xf4e6d4, { mat: 'cloth', seg: 24, sub: 1 });
      fine(k, () => { for (const [x, yy, z, r] of [[.3, .05, .2, .09], [-.28, .02, -.25, .1], [.05, .15, -.1, .07], [-.42, -.12, .18, .07], [.48, -.16, -.2, .08]]) k.ball(r, x, y + yy, z, 0xfff4dc, { sy: .55, glow: .7 }); });
      break;
    case 'turban':
      for (let i = 0; i < 5; i++) { const q = .33 - i * .035; k.torus(q, .085, Math.sin(i * 2.2) * .018, y - .2 + i * .075, -.02 + Math.cos(i * 2.2) * .018, c, { rx: HP + (i % 2 ? .13 : -.13), mat: 'cloth', seg: 16 }); }
      k.ball(.18, 0, y + .1, -.02, c, { mat: 'cloth', sy: .7 });
      k.ball(.065, 0, y - .1, .38, 0xff5a4a, { glow: .75, mat: 'plain' }); k.torus(.075, .014, 0, y - .1, .365, GOLD, { mat: 'metal', seg: 12 });
      break;
    case 'gear':
      k.torus(.34, .075, 0, y - .1, 0, 0xc98a33, { rx: HP, seg: 18, mat: 'metal' });
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; k.box(.08, .1, .09, Math.cos(a) * .43, y - .1, Math.sin(a) * .43, 0xb87a2a, { mat: 'metal', ry: -a }); }
      break;
    case 'fur':
      k.loft([[y - .3, .36, .38], [y - .2, .375, .395], [y - .05, .34, .36], [y + .07, .22, .23], [y + .12, .05, .05]], 0, 0, 0, 0xe8e4f4, { mat: 'fur', seg: 18, fold: .05, foldN: 13 });
      k.torus(.345, .07, 0, y - .28, 0, 0xc9c4d8, { rx: HP, mat: 'fur', seg: 18 });
      break;
  }
}

function hand(k, y, c, mat = 'skin') {
  k.ball(.082, 0, y, .012, c, { mat, sx: .92, sy: 1.1 });
  fine(k, () => {
    for (let i = 0; i < 4; i++) { const x = -.057 + i * .038; k.tube([[x, y - .05, .05], [x, y - .1, .075], [x, y - .105, .03], [x, y - .07, -.01]], .019, c, { mat, seg: 4, sub: 1 }); }
    k.tube([[.075, y + .025, .03], [.1, y - .025, .07], [.065, y - .06, .095]], [.024, .021, .017], c, { mat, seg: 4, sub: 1 });
  });
}

function humanFace(head, s, skin) {
  const glow = s.eye, brow = s.hair ?? s.beard ?? 0x3a2a24, side = [-1, 1];
  head.loft([[-.335, .03, .04, 0, .1], [-.3, .115, .125, 0, .085], [-.21, .18, .205, 0, .05], [-.09, .235, .262, 0, .022], [.04, .268, .292], [.16, .275, .3, 0, -.01], [.27, .232, .265, 0, -.018], [.335, .13, .155, 0, -.02], [.36, .012, .012, 0, -.02]], 0, 0, 0, skin, { mat: 'skin', seg: 16, sub: 2 });
  for (const x of side) {
    if (s.ears) head.tube([[x * .25, .05, -.02], [x * .42, .12, -.05], [x * .62, .2, -.1], [x * .82, .3, -.16]], [.1, .09, .05, .004], skin, { mat: 'skin', seg: 6, sub: 3 });
    else head.ball(.07, x * .272, .005, -.02, skin, { mat: 'skin', sx: .45, sy: 1.05, sz: .78 });
    if (glow) head.ball(.05, x * .108, .045, .245, glow, { glow: 1, sz: .55 });
    else {
      head.ball(.056, x * .108, .04, .232, 0xf0ece4, { mat: 'plain', sz: .6 });
      fine(head, () => {
        head.ball(.033, x * .108, .04, .258, s.iris ?? 0x4a6a8a, { mat: 'plain', sz: .5 });
        head.ball(.016, x * .108, .04, .273, 0x0c0a12, { mat: 'plain', sz: .5 });
        head.ball(.0075, x * .1 + .012, .052, .281, 0xffffff, { glow: 1 });
        head.dome(.062, x * .108, .058, .232, skin, { mat: 'skin', sy: .62, sz: .72, rx: -.08, seg: 8 });
      });
    }
    fine(head, () => head.tube([[x * .042, .118, .292], [x * .11, .146, .282], [x * .18, .128, .238]], [.015, .021, .009], brow, { mat: 'fur', seg: 4, sub: 2 }));
    if (s.tusks) head.tube([[x * .1, -.17, .25], [x * .13, -.1, .285], [x * .125, -.015, .275]], [.034, .025, .003], 0xfff4dc, { mat: 'bone', seg: 4, sub: 2 });
  }
  if (s.ears) head.tube([[0, .07, .28], [0, -.01, .36], [0, -.08, .44], [0, -.1, .46]], [.04, .062, .05, .018], skin, { mat: 'skin', seg: 7, sub: 3 });
  else head.tube([[0, .085, .292], [0, -.005, .325], [0, -.06, .345], [0, -.085, .325]], [.024, .032, .046, .025], skin, { mat: 'skin', seg: 7, sub: 3 });
  fine(head, () => {
    head.tube([[-.088, -.162, .266], [-.04, -.178, .296], [.04, -.178, .296], [.088, -.162, .266]], [.006, .015, .015, .006], 0x9a4f48, { mat: 'skin', seg: 4, sub: 2 });
    head.tube([[-.058, -.196, .282], [0, -.206, .298], [.058, -.196, .282]], [.006, .017, .006], 0xb06458, { mat: 'skin', seg: 4, sub: 2 });
  });
  if (s.beard) {
    for (let i = 0; i < 13; i++) { const u = i / 12 * 2 - 1, q = 1 - Math.abs(u), L = .24 + q * .62; head.tube([[u * .235, -.04 - q * .13, .17 - Math.abs(u) * .12 + q * .08], [u * .24, -.2 - q * .1, .25 - Math.abs(u) * .12], [u * .17, -.32 - L * .45, .24 - Math.abs(u) * .08], [u * .05, -.3 - L, .2]], [.05, .068, .05, .004], s.beard, { mat: 'fur', seg: 4, sub: 2 }); }
    for (const x of side) head.tube([[x * .012, -.105, .335], [x * .1, -.125, .315], [x * .18, -.2, .255]], [.024, .028, .004], s.beard, { mat: 'fur', seg: 4, sub: 2 });
  }
  if (s.hair) {
    head.loft([[.11, .292, .315, 0, -.02], [.2, .292, .318, 0, -.022], [.3, .24, .272, 0, -.022], [.375, .125, .145, 0, -.022], [.405, .012, .012, 0, -.022]], 0, 0, 0, s.hair, { mat: 'fur', seg: 18 });
    const n = s.long ? 20 : 15, drop = s.long ? .92 : .32;
    for (let i = 0; i < n; i++) { const a = Math.PI * (-.6 + i / (n - 1) * 1.2), sx = Math.sin(a), cz = -Math.cos(a), R = .305, L = drop * (.82 + (i % 3) * .1), r = .068; head.tube([[sx * R * .95, .24, cz * R * .95 - .02], [sx * (R + .02), .08, cz * (R + .03) - .02], [sx * (R + .025), .08 - L * .55, cz * (R + .05) - .03], [sx * (R + .005), .08 - L, cz * (R + .04) - .04]], [r * .8, r, r * .85, .006], s.hair, { mat: 'fur', seg: 4, sub: 2 }); }
    for (let i = 0; i < 7; i++) { const u = i / 6 * 2 - 1; head.tube([[u * .14, .35, .16], [u * .21, .285, .262], [u * .27, .205 + Math.abs(u) * -.03, .288 - Math.abs(u) * .05]], [.056, .05, .006], s.hair, { mat: 'fur', seg: 4, sub: 2 }); }
  }
}

export function skullHead(head, s) {
  const eye = s.eye ?? 0x7ff2c8, bone = 0xe8e2cc;
  head.loft([[-.09, .17, .21, 0, .05], [.0, .245, .27, 0, .015], [.13, .3, .325, 0, -.02], [.25, .28, .315, 0, -.03], [.34, .17, .2, 0, -.03], [.385, .01, .012, 0, -.03]], 0, 0, 0, bone, { mat: 'bone', seg: 18 });
  head.loft([[-.31, .09, .1, 0, .13], [-.27, .15, .18, 0, .09], [-.18, .185, .225, 0, .05], [-.1, .19, .225, 0, .035]], 0, 0, 0, 0xd8d2bc, { mat: 'bone', seg: 14 });
  for (const x of [-1, 1]) { head.ball(.09, x * .12, .055, .225, DARK, { mat: 'plain', sz: .62, sy: .95 }); head.ball(.042, x * .12, .055, .275, eye, { glow: 1 }); head.tube([[x * .21, -.03, .08], [x * .25, -.09, -.02], [x * .185, -.24, .02]], [.03, .03, .022], 0xd8d2bc, { mat: 'bone', seg: 5, sub: 2 }); }
  head.cone(.05, .1, 0, -.045, .32, DARK, { mat: 'plain', seg: 5 });
  fine(head, () => { for (let i = 0; i < 8; i++) { const u = i / 7 * 2 - 1; head.box(.034, .062, .03, u * .13, -.15, .252 - Math.abs(u) * .05, 0xfff8e6, { mat: 'bone', ry: u * .55, bevel: .008 }); head.box(.032, .05, .028, u * .115, -.215, .246 - Math.abs(u) * .05, 0xe8e0c8, { mat: 'bone', ry: u * .55, bevel: .008 }); } });
}

function skeletonBody(body, s, W) {
  const b1 = 0xddd7c2, b2 = 0xbdb6a0;
  body.tube([[0, -.42, -.08], [0, -.1, -.13], [0, .3, -.14], [0, .72, -.07], [0, .92, -.01]], [.052, .046, .042, .04, .036], b2, { mat: 'bone', seg: 6 });
  fine(body, () => { for (let i = 0; i < 13; i++) body.ball(.05, 0, -.36 + i * .1, -.13 + Math.abs(i - 6) * .009, b1, { mat: 'bone', sy: .55 }); });
  for (let i = 0; i < 6; i++) {
    const y = .6 - i * .135, R = (.33 - Math.abs(i - 2) * .025) * W, D = .25 - i * .012;
    for (const x of [-1, 1]) body.tube([[0, y + .03, -.14], [x * R * .85, y, -.09], [x * R, y - .05, .05], [x * R * .55, y - .09, D - .03], [x * .03, y - .05, D]], [.024, .03, .03, .026, .02], b1, { mat: 'bone', seg: 4, sub: 2 });
  }
  body.loft([[-.02, .035, .03], [.2, .05, .035], [.56, .04, .03]], 0, 0, .22, b1, { mat: 'bone', seg: 7 });
  body.loft([[-.52, .05, .05, 0, .02], [-.44, .24 * W, .15], [-.34, .29 * W, .17, 0, -.03], [-.26, .25 * W, .13, 0, -.05], [-.2, .08, .06, 0, -.07]], 0, 0, 0, 0xc9c2a8, { mat: 'bone', seg: 14 });
  for (const x of [-1, 1]) { body.tube([[x * .04, .73, .06], [x * .25 * W, .72, .03], [x * .44 * W, .68, -.03]], [.022, .026, .03], b1, { mat: 'bone', seg: 5 }); body.ball(.12, x * .4 * W, .66, -.09, b2, { mat: 'bone', sz: .55, sy: 1.05 }); }
  if (s.armor) {
    body.loft([[-.2, .29 * W, .22], [.08, .34 * W, .26], [.36, .39 * W, .28], [.58, .38 * W, .25], [.7, .27 * W, .17], [.76, .13, .12]], 0, 0, 0, s.armor, { mat: 'metal', c2: 0x8a90b0, seg: 18 });
    for (const x of [-1, 1]) { body.ball(.215, x * .43 * W, .63, -.01, s.armor, { mat: 'metal', sy: .82 }); body.torus(.2, .02, x * .43 * W, .57, -.01, GOLD, { rx: HP, mat: 'metal', seg: 14 }); }
    for (let i = 0; i < 3; i++) body.torus(.3 * W + i * .012, .018, 0, .06 + i * .17, 0, 0x4a4f62, { rx: HP, mat: 'metal', seg: 18, sy: .74 });
  }
}

function humanoid(s) {
  const skull = s.skull, W = s.wide || 1, skin = s.skin ?? 0xd8b48e, top = s.top ?? 0x3a4a8a, bot = s.bottom ?? 0x2a2a44;
  const body = K(1), head = K(2), aL = K(3), aR = K(4), fL = K(11), fR = K(12), lL = K(5), lR = K(6), sL = K(13), sR = K(14);
  if (s.robe) {
    const low = s.top3 ?? s.top2 ?? top;
    body.loft([[-1.37, .68 * W, .62, 0, -.03], [-1.08, .58 * W, .52, 0, -.02], [-.66, .45 * W, .38], [-.28, .32 * W, .25], [-.1, .265 * W, .2], [.2, .3 * W, .215], [.48, .345 * W, .22], [.64, .285 * W, .175], [.76, .15, .13], [.82, .095, .09]], 0, 0, 0, low, { mat: 'cloth', c2: top, seg: 18, fold: .13, foldN: 9, foldP: 1.3 });
    body.torus(.27 * W, .036, 0, -.1, 0, s.belt ?? GOLD, { rx: HP, seg: 18, mat: 'metal', sy: .78 });
    body.ball(.052, 0, -.1, .2, s.belt ?? GOLD, { mat: 'metal', sz: .55 });
    body.tube([[-.17, .7, .09], [0, .58, .185], [.17, .7, .09]], .032, s.belt ?? GOLD, { mat: 'cloth', seg: 5 });
    body.tube([[.09, -.14, .19], [.11, -.44, .3], [.09, -.8, .43]], [.022, .025, .012], s.belt ?? GOLD, { mat: 'cloth', seg: 4 });
    fine(body, () => { for (let i = 0; i < (s.stars || 0); i++) { const a = i * 2.4, y = .35 - i * .14, R = y > -.1 ? .29 : .3 + (-.1 - y) * .32; body.oct(.05, Math.cos(a) * R * W, y, Math.sin(a) * R * .86, 0xdde2ff, { glow: 1 }); } });
  } else if (skull) skeletonBody(body, s, W);
  else {
    body.loft([[-.78, .395 * W, .32, 0, -.01], [-.62, .365 * W, .29], [-.42, .31 * W, .235], [-.26, .27 * W, .2], [-.08, .252 * W, .185], [.18, .29 * W, .2], [.44, .345 * W, .215], [.62, .3 * W, .18], [.75, .16, .13], [.81, .1, .095]], 0, 0, 0, top, { mat: 'cloth', c2: s.top2 ?? top, seg: 16, fold: .07, foldN: 8, foldP: .5 });
    body.torus(.275 * W, .04, 0, -.2, 0, s.belt ?? 0x3c2830, { rx: HP, seg: 18, mat: 'fur', sy: .76 });
    body.box(.11, .095, .035, 0, -.2, .225, GOLD, { mat: 'metal', bevel: .012 });
    body.torus(.13, .025, 0, .76, .012, s.top2 ?? top, { rx: HP, seg: 12, mat: 'cloth' });
    fine(body, () => { body.tube([[-.07, .72, .125], [0, .5, .205], [.07, .72, .125]], .011, s.belt ?? 0x3c2830, { mat: 'plain', seg: 4 }); for (let i = 0; i < 3; i++) body.ball(.017, 0, .36 - i * .13, .204 + i * .004, GOLD, { mat: 'metal', sz: .5 }); });
    body.box(.16, .17, .05, -.21 * W, -.3, .19, LEATHER, { mat: 'fur', ry: -.5, bevel: .018 });
    if (s.armor) {
      body.loft([[-.14, .275 * W, .21], [.12, .325 * W, .245], [.38, .375 * W, .265], [.56, .35 * W, .23], [.68, .24 * W, .165], [.74, .13, .115]], 0, 0, 0, s.armor, { mat: 'metal', c2: 0xdde2f4, seg: 20 });
      body.tube([[0, -.1, .23], [0, .3, .275], [0, .62, .215]], .018, 0xdde2f4, { mat: 'metal', seg: 5 });
      for (const x of [-1, 1]) { body.ball(.22, x * .41 * W, .64, 0, s.armor, { mat: 'metal', sy: .82 }); body.torus(.205, .02, x * .41 * W, .58, 0, GOLD, { rx: HP, mat: 'metal', seg: 14 }); }
      for (let i = 0; i < 2; i++) body.torus(.295 * W, .016, 0, .08 + i * .2, 0, 0x4a4f62, { rx: HP, mat: 'metal', seg: 18, sy: .76 });
    }
    if (s.apron) {
      const rows = []; for (let i = 0; i <= 6; i++) { const t = i / 6, y = .34 - t * 1.08, w = .19 + t * .1, Z = .215 + t * .1 + (t > .5 ? (t - .5) * .08 : 0); rows.push([-1, -.5, 0, .5, 1].map(u => [u * w * W, y, Z - u * u * .055 + Math.sin(u * 5 + t * 3) * .008])); }
      body.sheet(rows, s.apron, { mat: 'cloth' });
    }
  }
  if (s.cape) {
    const rows = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, y = .72 - t * 1.92, w = (.34 + t * .2) * W, row = []; for (let j = 0; j <= 10; j++) { const u = j / 10 * 2 - 1; row.push([u * w, y, -.205 - t * .17 + (u * u - 1) * .1 * (1 - t * .3) - Math.cos(u * 8.5 + .4) * .05 * (.2 + t)]); } rows.push(row); }
    body.sheet(rows, s.cape, { mat: 'cloth', c2: s.cape2 ?? s.cape });
    body.torus(.17, .024, 0, .74, -.02, s.cape, { rx: HP + .2, mat: 'cloth', seg: 14 });
    for (const x of [-1, 1]) body.ball(.04, x * .17, .72, .1, GOLD, { mat: 'metal', sz: .6 });
  }
  if (!skull) body.loft([[.72, .105, .105], [.86, .092, .095, 0, .012], [.98, .098, .1, 0, .018]], 0, 0, 0, s.noFace ? (s.skin ?? 0x161024) : skin, { mat: 'skin', seg: 12, sub: 2 });

  if (skull) skullHead(head, s);
  else if (s.noFace) {
    const dark = s.skin ?? 0x161024;
    head.loft([[-.3, .08, .1, 0, .05], [-.2, .2, .23, 0, .03], [-.04, .27, .3], [.16, .28, .31, 0, -.01], [.3, .19, .22, 0, -.02], [.36, .01, .012, 0, -.02]], 0, 0, 0, dark, { mat: 'plain', seg: 16 });
    if (s.eye) for (const x of [-1, 1]) head.ball(.052, x * .12, .03, .262, s.eye, { glow: 1, sz: .5, sy: .72, rz: x * .24 });
  } else humanFace(head, s, skin);
  if (s.hat) hat(head, s, .36);

  const armLen = s.longArm ? 1.25 : .95, A = armLen / .95, armC = s.sleeve ?? (s.robe ? top : skull ? 0xddd7c2 : top), hc = skull ? 0xddd7c2 : skin, tw = (s.thin ? .62 : 1) * Math.sqrt(W);
  for (const [up, fore, sign] of [[aL, fL, -1], [aR, fR, 1]]) {
    up.at(0, 0, 0, 0, A); fore.at(0, 0, 0, 0, A);
    if (skull) {
      up.tube([[0, .03, 0], [0, -.46, 0]], [.038, .03], 0xddd7c2, { mat: 'bone', seg: 6, sub: 1 }); up.ball(.062, 0, .03, 0, 0xc9c2a8, { mat: 'bone' }); up.ball(.05, 0, -.47, 0, 0xc9c2a8, { mat: 'bone' });
      for (const x of [-.026, .026]) fore.tube([[x, 0, 0], [x * .7, -.4, 0]], .018, 0xddd7c2, { mat: 'bone', seg: 5, sub: 1 });
      hand(fore, -.45, hc, 'bone');
    } else {
      up.loft([[-.49, .083 * tw, .088 * tw], [-.34, .104 * tw, .11 * tw], [-.14, .125 * tw, .13 * tw], [.03, .132 * tw, .135 * tw], [.105, .085 * tw, .09 * tw], [.125, .01, .01]], 0, 0, 0, armC, { mat: 'cloth', seg: 9, sub: 2 });
      if (s.robe) fore.loft([[-.4, .165, .155, 0, .022], [-.3, .142, .135, 0, .012], [-.1, .112, .112], [.05, .092, .095]], 0, 0, 0, armC, { mat: 'cloth', seg: 12, fold: .08, foldN: 5 });
      else {
        fore.loft([[-.4, .066 * tw, .07 * tw], [-.28, .083 * tw, .09 * tw], [-.1, .1 * tw, .107 * tw], [.05, .088 * tw, .092 * tw]], 0, 0, 0, armC, { mat: 'cloth', seg: 9, sub: 2 });
        fore.torus(.074 * tw, .019, 0, -.385, 0, s.armor ?? LEATHER, { rx: HP, seg: 10, mat: s.armor ? 'metal' : 'fur' });
      }
      if (s.armor) { up.loft([[-.24, .118, .122], [-.04, .146, .15], [.06, .13, .135]], 0, 0, 0, s.armor, { mat: 'metal', seg: 12 }); fore.loft([[-.34, .082, .088], [-.16, .112, .118], [-.02, .112, .115]], 0, 0, 0, s.armor, { mat: 'metal', seg: 12, c2: 0xdde2f4 }); }
      if (!s.robe) up.ball(.09, 0, -.49, 0, armC, { mat: 'cloth' });
      hand(fore, -.45, hc);
    }
    up.pop(); fore.pop();
    const hy = -.53 * A;
    if (sign > 0) weapon(fore, s.weapon, s.weaponColor, 0, hy, .03);
    else if (s.lantern) {
      const y = hy - .1;
      fore.tube([[-.05, hy + .03, .04], [-.07, y - .06, .05], [0, y - .14, .06], [.07, y - .06, .07], [.05, hy + .03, .08]], .011, 0x2a2030, { mat: 'metal', seg: 4, sub: 2 });
      fore.loft([[y - .2, .06, .06], [y - .16, .135, .135], [y - .13, .1, .1], [y - .11, .04, .04]], 0, 0, .06, 0x2a2030, { mat: 'metal', seg: 12, sub: 2 });
      fore.loft([[y - .49, .112, .112], [y - .42, .118, .118], [y - .24, .092, .092], [y - .19, .075, .075]], 0, 0, .06, 0xffc445, { glow: 1, seg: 12, sub: 2 });
      fore.ball(.052, 0, y - .34, .06, 0xfff4d0, { glow: 1 });
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + .78; fore.tube([[Math.cos(a) * .118, y - .49, .06 + Math.sin(a) * .118], [Math.cos(a) * .125, y - .4, .06 + Math.sin(a) * .125], [Math.cos(a) * .082, y - .19, .06 + Math.sin(a) * .082]], .0115, 0x2a2030, { mat: 'metal', seg: 4, sub: 2 }); }
      fore.loft([[y - .55, .02, .02], [y - .53, .125, .125], [y - .49, .14, .14], [y - .47, .1, .1]], 0, 0, .06, 0x2a2030, { mat: 'metal', seg: 12, sub: 2 });
    } else if (s.shield) {
      const sc = s.shieldColor ?? 0x6a4a34;
      fore.at(.15, -.2 * A, .04, 0, 1, 0);
      fore.loft([[-.09, .02, .02], [-.075, .5, .58], [-.03, .57, .65], [-.0, .56, .64], [.015, .02, .02]], 0, 0, 0, sc, { mat: 'wood', rz: -HP, seg: 18, c2: 0x8a6a4c, sub: 2 });
      fore.torus(.585, .03, .05, 0, 0, 0xb8bcc8, { ry: HP, mat: 'metal', seg: 20, sy: 1.12 });
      fore.ball(.14, .12, 0, 0, GOLD, { mat: 'metal', sx: .55 });
      fine(fore, () => { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; fore.ball(.024, .09, Math.sin(a) * .49, Math.cos(a) * .43, 0xc8ccd8, { mat: 'metal' }); } });
      fore.pop();
    }
  }
  if (!s.robe) for (const [th, sh] of [[lL, sL], [lR, sR]]) {
    const boot = s.boots ?? (skull ? 0xc9c2a8 : 0x2a1c20);
    if (skull) {
      th.tube([[0, .02, 0], [0, -.47, 0]], [.05, .036], 0xddd7c2, { mat: 'bone', seg: 6, sub: 1 }); th.ball(.07, 0, .02, 0, 0xc9c2a8, { mat: 'bone' }); th.ball(.062, 0, -.48, 0, 0xc9c2a8, { mat: 'bone' });
      for (const x of [-.022, .03]) sh.tube([[x, -.01, 0], [x * .7, -.4, 0]], [.026, .018], 0xddd7c2, { mat: 'bone', seg: 5, sub: 1 });
      sh.loft([[-.49, .07, .17, 0, .07], [-.445, .08, .18, 0, .07], [-.4, .055, .09, 0, .025]], 0, 0, 0, boot, { mat: 'bone', seg: 10, sub: 2 });
    } else {
      th.loft([[-.5, .112 * W, .122], [-.3, .142 * W, .152], [-.08, .168 * W, .178], [.04, .16 * W, .165], [.1, .08 * W, .085]], 0, 0, 0, bot, { mat: 'cloth', seg: 10, sub: 2 });
      th.ball(.112 * Math.sqrt(W), 0, -.49, 0, bot, { mat: 'cloth' });
      sh.loft([[-.22, .09, .105], [-.13, .108, .125], [-.01, .105, .12], [.06, .092, .1]], 0, 0, 0, bot, { mat: 'cloth', seg: 9, sub: 2 });
      sh.loft([[-.49, .135, .3, 0, .11], [-.45, .14, .305, 0, .11], [-.39, .125, .225, 0, .065], [-.31, .106, .138, 0, .012], [-.18, .112, .128], [-.09, .128, .142], [-.06, .14, .152], [-.04, .1, .11]], 0, 0, 0, boot, { mat: 'fur', seg: 10, sub: 2 });
      sh.torus(.128, .016, 0, -.09, 0, GOLD, { rx: HP, mat: 'metal', seg: 12, sy: 1.1 });
      fine(sh, () => { for (let i = 0; i < 3; i++) sh.tube([[-.09, -.3 + i * .065, .1 - i * .004], [0, -.285 + i * .065, .135 - i * .006], [.09, -.3 + i * .065, .1 - i * .004]], .0085, 0x6a5040, { mat: 'plain', seg: 3, sub: 2 }); });
    }
  }
  const P = {};
  for (const [n, k] of Object.entries({ body, head, armL: aL, armR: aR, foreL: fL, foreR: fR })) P[n] = k.buildLOD();
  if (!s.robe) for (const [n, k] of Object.entries({ legL: lL, legR: lR, shinL: sL, shinR: sR })) P[n] = k.buildLOD();
  return P;
}

const onZ = (k, fn) => { k.at(0, 0, 0, 0, 1, HP); fn(); k.pop(); };

function wolf(s, c, c2, eye, P) {
  onZ(P.body, () => P.body.loft([[-1.02, .06, .08, 0, -.02], [-.88, .27, .32, 0, -.02], [-.52, .34, .4, 0, .0], [-.1, .34, .4, 0, .02], [.34, .41, .49, 0, -.03], [.72, .36, .46, 0, -.08], [1.0, .2, .26, 0, -.24]], 0, 0, 0, c, { mat: 'fur', c2, seg: 16, uv: .9 }));
  for (let i = 0; i < 11; i++) { const z = -.75 + i * .17, y = .42 + (i > 5 ? (i - 5) * .025 : 0); P.body.tube([[(i % 2 ? .03 : -.03), y - .05, z], [(i % 2 ? .05 : -.05), y + .1, z - .05], [(i % 2 ? .04 : -.04), y + .15, z - .16]], [.055, .04, .004], c2, { mat: 'fur', seg: 4, sub: 2 }); }
  for (let i = 0; i < 10; i++) { const a = i / 9 * Math.PI - HP * 2 + HP, x = Math.sin(a) * .44, y = .2 + Math.cos(a) * .36; P.body.tube([[x * .8, y, .7], [x * 1.05, y * 1.05, .52], [x * 1.08, y * .95 - .07, .3]], [.09, .06, .005], c2, { mat: 'fur', seg: 4, sub: 2 }); }
  const H = P.head;
  onZ(H, () => {
    H.loft([[-.14, .2, .24, 0, -.04], [.06, .29, .3, 0, -.02], [.28, .28, .27, 0, .0], [.48, .18, .17, 0, .05], [.68, .135, .115, 0, .09], [.9, .105, .085, 0, .11], [.98, .05, .04, 0, .1]], 0, 0, 0, c, { mat: 'fur', c2, seg: 14, uv: .9 });
    H.loft([[.36, .13, .05, 0, .2], [.62, .115, .05, 0, .2], [.86, .08, .04, 0, .18], [.93, .02, .02, 0, .17]], 0, 0, 0, c2, { mat: 'fur', seg: 10 });
  });
  H.ball(.056, 0, .1, .95, 0x0c0a12, { mat: 'plain', sy: .75 });
  for (const x of [-1, 1]) {
    H.ball(.052, x * .165, .1, .475, eye, { glow: 1, sz: .6, sy: .72 });
    H.tube([[x * .17, .22, .06], [x * .24, .46, .03], [x * .25, .66, -.03]], [.13, .085, .004], c, { mat: 'fur', seg: 4, sub: 2 });
    fine(H, () => { for (let i = 0; i < 4; i++) H.cone(.018, .08, x * (.085 - i * .002), -.145, .92 - i * .1, 0xfff4dc, { mat: 'bone', seg: 4, rx: Math.PI }); H.cone(.03, .15, x * .085, -.145, .94, 0xfff4dc, { mat: 'bone', seg: 5, rx: Math.PI }); });
  }
  P.leg.tube([[0, .16, -.02], [0, -.13, -.05], [0, -.42, -.09], [0, -.6, .0], [0, -.72, .03]], [.17, .125, .07, .062, .075], c, { mat: 'fur', seg: 8, uv: .9, sub: 3 });
  P.leg.ball(.1, 0, -.735, .07, c2, { mat: 'fur', sy: .55, sz: 1.35 });
  fine(P.leg, () => { for (const x of [-.05, 0, .05]) P.leg.cone(.016, .07, x, -.76, .19, 0x201820, { mat: 'bone', seg: 4, rx: 1.9 }); });
  P.tail.tube([[0, .04, .05], [0, .08, -.3], [0, -.04, -.7], [0, -.3, -1.05], [0, -.45, -1.3]], [.09, .17, .2, .14, .012], c2, { mat: 'fur', seg: 9, sub: 3, uv: .9 });
}

function scorpion(s, c, c2, eye, P) {
  onZ(P.body, () => {
    for (let i = 0; i < 6; i++) { const y = -.9 + i * .34, w = .46 + Math.sin((i + .5) / 6 * Math.PI) * .22; P.body.loft([[y - .19, w * .7, .13], [y - .13, w, .22], [y + .08, w * 1.02, .25], [y + .19, w * .78, .15]], 0, 0, 0, i % 2 ? c : c2, { mat: 'metal', seg: 14, sub: 2 }); }
  });
  const H = P.head;
  onZ(H, () => H.loft([[-.3, .42, .16], [-.14, .52, .22], [.14, .46, .22], [.38, .28, .12], [.46, .1, .04]], 0, 0, 0, c, { mat: 'metal', c2, seg: 14 }));
  for (const x of [-1, 1]) {
    for (const [a, b] of [[.13, .36], [.22, .3]]) H.ball(.045, x * a, .19, b, eye, { glow: 1 });
    H.tube([[x * .4, -.02, .24], [x * .86, .02, .42], [x * .98, .03, .84]], [.12, .105, .1], c, { mat: 'metal', seg: 8 });
    H.at(x * .98, .03, .92, x * -.12);
    H.ball(.24, 0, 0, .14, c2, { mat: 'metal', sx: .9, sy: .68, sz: 1.3 });
    H.tube([[x * .1, 0, .34], [x * .17, 0, .6], [x * .06, 0, .86]], [.13, .09, .006], c2, { mat: 'metal', seg: 6 });
    H.tube([[x * -.1, 0, .34], [x * -.14, 0, .56], [x * -.05, 0, .76]], [.09, .06, .005], c, { mat: 'metal', seg: 6 });
    H.pop();
  }
  P.leg.tube([[0, .1, 0], [.38, .2, 0], [.68, -.08, .02], [.84, -.5, .04]], [.09, .075, .05, .012], c, { mat: 'metal', seg: 6, sub: 3 });
  const T = P.tail, pts = [[0, .08, .05], [0, .42, -.12], [0, .82, -.22], [0, 1.16, -.12], [0, 1.4, .13], [0, 1.47, .4]];
  pts.forEach((p, i) => { if (i < 5) T.ball(.25 - i * .025, p[0], p[1], p[2], i % 2 ? c2 : c, { mat: 'metal', sy: 1.15 }); });
  T.ball(.17, 0, 1.46, .42, 0xc23a2a, { mat: 'metal', glow: .25 });
  T.tube([[0, 1.46, .5], [0, 1.4, .74], [0, 1.18, .86]], [.08, .05, .004], 0xff5a4a, { glow: .75, seg: 7 });
}

function spider(s, c, c2, eye, P) {
  P.body.loft([[-.72, .03], [-.62, .46], [-.3, .72], [.14, .78], [.52, .55], [.78, .06]], 0, .1, -.26, c, { mat: 'fur', c2, seg: 20, sz: .92, uv: .8 });
  P.body.torus(.56, .075, 0, .42, -.26, 0xf0bd5a, { rx: HP, seg: 22, mat: 'metal' });
  fine(P.body, () => { for (let i = 0; i < 26; i++) { const a = i * 2.4, q = .2 + i * .022, y = Math.sqrt(Math.max(.03, 1 - q * q)); P.body.tube([[Math.cos(a) * q * .74, y * .68 + .1, Math.sin(a) * q * .74 - .26], [Math.cos(a) * q * .86, y * .8 + .12, Math.sin(a) * q * .86 - .28]], [.022, .002], c2, { mat: 'fur', seg: 3, sub: 1 }); } });
  const H = P.head;
  onZ(H, () => H.loft([[-.25, .24, .22], [-.04, .42, .36], [.24, .4, .32], [.46, .22, .18], [.52, .04, .04]], 0, 0, 0, c2, { mat: 'fur', seg: 14, uv: .8 }));
  for (const [x, y, r] of [[-.13, .16, .085], [.13, .16, .085], [-.3, .08, .06], [.3, .08, .06], [-.2, .29, .045], [.2, .29, .045], [-.07, .3, .04], [.07, .3, .04]]) H.ball(r, x, y, .48 - Math.abs(x) * .3, eye, { glow: 1 });
  for (const x of [-1, 1]) H.tube([[x * .1, -.14, .46], [x * .15, -.3, .6], [x * .05, -.48, .62]], [.08, .06, .006], c, { mat: 'bone', seg: 6 });
  P.leg.tube([[0, .02, 0], [.3, .34, 0], [.72, .32, 0], [1.0, -.1, .02], [1.12, -.54, .03]], [.1, .085, .068, .04, .008], c2, { mat: 'fur', seg: 7, sub: 3, uv: .8 });
  P.tail.ball(.08, 0, 0, 0, c, { mat: 'fur' });
}

function dragon(s, c, c2, eye, P) {
  const B = P.body;
  onZ(B, () => B.loft([[-3.05, .55, .6, 0, -.1], [-2.3, 1.15, 1.2, 0, -.05], [-1, 1.46, 1.58], [.5, 1.52, 1.66, 0, .05], [1.8, 1.36, 1.46, 0, -.05], [2.7, .92, 1.02, 0, -.3], [3.15, .55, .62, 0, -.5]], 0, 0, 0, c, { mat: 'leaf', c2, seg: 22, uv: 1.3, shape: (a, t) => 1 + Math.sin(a * 2) * .025 + Math.sin(t * 40) * .012 }));
  onZ(B, () => B.loft([[-2.7, .55, .5, 0, .78], [-1, 1.04, .94, 0, .78], [1.2, 1.04, .94, 0, .78], [2.7, .46, .45, 0, .62]], 0, 0, 0, c2, { mat: 'tile', seg: 14, uv: .7 }));
  for (let i = 0; i < 11; i++) { const z = -2.75 + i * .58, h = 1.5 + Math.sin(i / 10 * Math.PI) * .22, L = .7 + Math.sin(i / 10 * Math.PI) * .75; B.tube([[0, h - .1, z + .26], [0, h + L * .48, z - .12], [0, h + L, z - .55]], [.3, .17, .008], c2, { mat: 'bone', seg: 6, sub: 3 }); }
  for (const x of [-1, 1]) {
    const root = [x * 1.1, 1.05, .7], el = [x * 3.5, 3.5, -.25], wr = [x * 6.1, 3.2, -.72], tips = [[x * 9.2, .9, -1.4], [x * 8, -.6, -2.2], [x * 6, -1.25, -2.9], [x * 3.7, -1.2, -3.1]];
    B.tube([root, [x * 2.3, 2.7, .3], el], [.42, .3, .24], c, { mat: 'leaf', seg: 8, uv: 1 });
    B.tube([el, [x * 4.8, 3.72, -.5], wr], [.24, .18, .14], c, { mat: 'leaf', seg: 7, uv: 1 });
    for (const t of tips) B.tube([wr, [(wr[0] + t[0]) / 2 + x * .32, (wr[1] + t[1]) / 2 + .32, (wr[2] + t[2]) / 2], t], [.13, .08, .012], c2, { mat: 'bone', seg: 5 });
    B.cone(.14, .6, wr[0] + x * .1, wr[1] + .38, wr[2], 0xe8e2cc, { mat: 'bone', seg: 6, rz: -x * .35 });
    const edge = [wr, ...tips, [x * 1.5, -.25, -2.3]], rows = [];
    for (let i = 0; i < edge.length - 1; i++) for (let k = 0; k < 4; k++) {
      const a = edge[i], b = edge[i + 1], u = k / 4, sag = Math.sin(u * Math.PI) * .42, p = [a[0] + (b[0] - a[0]) * u - x * sag * .15, a[1] + (b[1] - a[1]) * u + sag, a[2] + (b[2] - a[2]) * u + sag * .3];
      const inner = [root[0] + (el[0] - root[0]) * (1 - i / (edge.length - 1)) * .9, root[1] + (el[1] - root[1]) * (1 - i / (edge.length - 1)) * .9, root[2] + (el[2] - root[2]) * (1 - i / (edge.length - 1)) * .9];
      rows.push([0, .34, .68, 1].map(w => [inner[0] + (p[0] - inner[0]) * w, inner[1] + (p[1] - inner[1]) * w - Math.sin(w * Math.PI) * .22, inner[2] + (p[2] - inner[2]) * w]));
    }
    rows.push([0, .34, .68, 1].map(w => [root[0] + (edge[edge.length - 1][0] - root[0]) * w, root[1] + (edge[edge.length - 1][1] - root[1]) * w - Math.sin(w * Math.PI) * .22, root[2] + (edge[edge.length - 1][2] - root[2]) * w]));
    B.sheet(rows, 0x5a1c2c, { mat: 'fur', c2: c2, uv: 1.2 });
  }
  const H = P.head;
  H.tube([[0, -.5, -1], [0, -.05, -.25], [0, .5, .4], [0, .78, 1.05]], [1.04, .8, .72, .66], c, { mat: 'leaf', seg: 14, uv: 1.2, sub: 3 });
  for (let i = 0; i < 4; i++) H.tube([[0, .62 + i * .3, -.26 + i * .42], [0, 1.05 + i * .3, -.48 + i * .42], [0, 1.42 + i * .28, -.76 + i * .42]], [.2, .1, .006], c2, { mat: 'bone', seg: 5 });
  onZ(H, () => {
    H.loft([[.72, .55, .6, 0, -.86], [1.2, .78, .76, 0, -.86], [1.75, .72, .62, 0, -.72], [2.4, .52, .34, 0, -.46], [3.15, .42, .24, 0, -.34], [3.5, .26, .12, 0, -.34]], 0, 0, 0, c, { mat: 'leaf', c2, seg: 16, uv: 1.1 });
    H.loft([[1.6, .52, .14, 0, .02], [2.4, .46, .14, 0, .08], [3.1, .36, .1, 0, .08], [3.4, .12, .05, 0, .06]], 0, 0, 0, c2, { mat: 'leaf', seg: 12, uv: 1.1 });
  });
  for (const x of [-1, 1]) {
    H.ball(.17, x * .55, .68, 2.08, eye, { glow: 1, sz: .6, sy: .72 });
    H.tube([[x * .25, .98, 1.6], [x * .6, .92, 2.05], [x * .78, .68, 2.32]], [.07, .13, .012], c2, { mat: 'leaf', seg: 5 });
    H.tube([[x * .46, 1.25, .78], [x * .72, 2, .3], [x * .86, 2.62, -.5], [x * .82, 2.92, -1.1]], [.27, .2, .11, .008], 0xe8e2cc, { mat: 'bone', seg: 9, sub: 4 });
    H.tube([[x * .75, .78, .9], [x * 1.25, 1.02, .42], [x * 1.56, 1.14, -.1]], [.12, .08, .006], 0xc9c2a8, { mat: 'bone', seg: 6 });
    H.ball(.07, x * .2, .3, 3.42, 0x120c10, { mat: 'plain' });
    fine(H, () => { for (let i = 0; i < 7; i++) { const z = 3.3 - i * .25, w = .36 + i * .04; H.cone(.045, .22, x * w, -.13, z, 0xfff4dc, { mat: 'bone', seg: 5, rx: Math.PI }); } });
  }
  P.leg.tube([[0, .6, -.2], [0, -.1, -.28], [0, -.75, -.42], [0, -1.28, -.2], [0, -1.92, .05]], [.82, .68, .46, .36, .36], c, { mat: 'leaf', seg: 12, uv: 1.1, sub: 3 });
  P.leg.loft([[-2.32, .46, .78, 0, .34], [-2.18, .52, .84, 0, .34], [-2.0, .42, .56, 0, .14], [-1.82, .34, .36, 0, .03]], 0, 0, 0, c2, { mat: 'tile', seg: 12, uv: .7 });
  for (const a of [-.42, 0, .42]) P.leg.tube([[Math.sin(a) * .36, -2.2, .85], [Math.sin(a) * .52, -2.24, 1.2], [Math.sin(a) * .54, -2.34, 1.42]], [.13, .09, .006], 0xe8e2cc, { mat: 'bone', seg: 6 });
  const T = P.tail, p = [[0, .1, .4], [0, .05, -1.3], [0, -.3, -3.3], [.35, -.85, -5.4], [-.1, -1.35, -7.4], [0, -1.55, -8.9]];
  T.tube(p, [.92, .8, .6, .4, .2, .05], c, { mat: 'leaf', seg: 13, sub: 5, uv: 1.1 });
  for (let i = 0; i < 12; i++) { const u = i / 11, z = -.6 - u * 7.8, y = .95 - u * 2.05 - u * u * .35, h = .72 - u * .42; T.tube([[0, y - .12, z + .2], [0, y + h * .55, z - .08], [0, y + h, z - .34]], [.22 - u * .1, .1, .005], c2, { mat: 'bone', seg: 4, sub: 2 }); }
  T.loft([[-.02, .05, .04], [.5, .62, .05], [1.1, .4, .04], [1.62, .01, .01]], 0, -1.58, -8.82, c2, { mat: 'bone', rx: -HP, seg: 8, sub: 2 });
}

function quad(s) {
  const c = s.c1 ?? 0x4a4a6a, c2 = s.c2 ?? 0x7a7aa0, eye = s.eye ?? 0xffc445, P = { body: K(7), head: K(8), leg: K(9), tail: K(10) };
  ({ wolf, scorpion, spider }[s.kind] ?? dragon)(s, c, c2, eye, P);
  return { body: P.body.buildLOD(), head: P.head.buildLOD(), leg: P.leg.buildLOD(), tail: P.tail.buildLOD() };
}

function special(s) {
  const body = K(21), head = K(22), arm = K(23);
  if (s.kind === 'shroom') {
    const c = s.c1 ?? 0xb82f4d;
    body.loft([[.0, .46, .46], [.1, .6, .58], [.34, .58, .56], [.68, .46, .45], [.95, .38, .38], [1.05, .25, .25]], 0, 0, 0, 0xe8ded0, { mat: 'plaster', seg: 18, c2: 0xf6ecdc, fold: .03, foldN: 6 });
    for (const x of [-1, 1]) {
      body.ball(.105, x * .19, .59, .455, 0xfff8ec, { mat: 'plain', sz: .55 });
      body.ball(.06, x * .185, .585, .505, 0x18121e, { mat: 'plain', sz: .6 });
      fine(body, () => body.ball(.018, x * .185 + .02, .605, .535, 0xffffff, { glow: 1 }));
      body.tube([[x * .08, .74, .45], [x * .19, .78, .45], [x * .3, .72, .4]], [.012, .022, .008], 0x4a3026, { mat: 'plain', seg: 4 });
      body.ball(.07, x * .34, .44, .39, 0xffb0a0, { mat: 'skin', sy: .6, sz: .4 });
      body.loft([[.0, .17, .3, 0, .08], [.06, .19, .32, 0, .08], [.15, .14, .17, 0, .02]], x * .3, 0, 0, 0xb09a84, { mat: 'fur', seg: 10, sub: 2 });
    }
    body.tube([[-.1, .4, .515], [0, .36, .535], [.1, .4, .515]], .018, 0x2a1820, { mat: 'plain', seg: 4 });
    head.loft([[-.07, .92, .92], [-.02, 1.03, 1.03], [.14, .98, .98], [.4, .8, .8], [.62, .48, .48], [.74, .16, .16], [.78, .01, .01]], 0, 0, 0, c, { mat: 'plaster', c2: s.c2 ?? 0xff6a7d, seg: 26, shape: a => 1 + Math.sin(a * 5 + .6) * .018 });
    head.loft([[-.105, .24, .24], [-.08, .94, .94]], 0, 0, 0, 0xf4e6d6, { mat: 'cloth', seg: 26, sub: 1 });
    fine(head, () => { for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; head.box(.012, .045, .66, Math.cos(a) * .58, -.108, Math.sin(a) * .58, 0xd8c4b0, { mat: 'plain', ry: -a + HP, bevel: .003 }); } });
    for (let i = 0; i < 8; i++) { const a = i * 2.4, q = .22 + i * .095, y = .78 * Math.sqrt(Math.max(.03, 1 - q * q)) - .01; head.ball(.13 - (i % 3) * .018, Math.cos(a) * q, y, Math.sin(a) * q, 0xfff4dc, { glow: .55, sy: .55 }); }
    arm.loft([[-.46, .075, .08], [-.36, .1, .1], [-.2, .09, .09], [.02, .085, .085]], 0, 0, 0, 0xe8ded0, { mat: 'plaster', seg: 10 });
  } else if (s.kind === 'ghost') {
    const c = s.c1 ?? 0x7ff2c8, c2 = s.c2 ?? 0x2a7a82;
    body.loft([[-1.05, .78, .78, 0, -.08], [-.72, .68, .68, 0, -.05], [-.3, .56, .55, 0, -.02], [.25, .5, .48], [.72, .56, .52], [1.02, .42, .4], [1.22, .08, .08]], 0, 0, 0, c2, { glow: .5, c2: c, seg: 22, fold: .22, foldN: 7, foldP: .8, shape: (a, t) => 1 + (1 - t) * (1 - t) * Math.sin(a * 5 + 1) * .1 });
    head.loft([[-.36, .13, .15, 0, .05], [-.2, .32, .35], [.05, .42, .44], [.28, .34, .36], [.42, .08, .08]], 0, 0, .05, c2, { glow: .4, c2: c, seg: 16 });
    for (const x of [-1, 1]) { head.ball(.105, x * .16, .06, .395, 0x06120f, { mat: 'plain', sy: 1.28, sz: .4 }); head.ball(.028, x * .16, .08, .435, c, { glow: 1 }); }
    head.ball(.09, 0, -.18, .4, 0x06120f, { mat: 'plain', sy: 1.3, sz: .4 });
    arm.tube([[0, .03, 0], [.07, -.3, .05], [.1, -.62, .13], [.08, -.88, .22]], [.12, .15, .11, .012], c, { glow: .5, seg: 8 });
    fine(arm, () => { for (let i = -1; i <= 1; i++) arm.tube([[.1, -.68, .15], [.1 + i * .08, -.86, .24], [.1 + i * .12, -1, .3]], [.035, .022, .003], c, { glow: .5, seg: 4 }); });
  } else if (s.kind === 'imp') {
    const c = s.c1 ?? 0xd8341a, w2 = s.c2 ?? 0x7a1410;
    body.loft([[-.48, .05], [-.4, .24, .2], [-.15, .35, .29], [.12, .37, .3], [.34, .25, .21], [.46, .1, .1]], 0, 0, 0, c, { mat: 'skin', c2: 0xff9a30, seg: 16 });
    body.loft([[-.34, .15, .05, 0, .24], [-.05, .24, .06, 0, .28], [.22, .16, .05, 0, .24]], 0, 0, 0, 0xff9a30, { mat: 'skin', seg: 10 });
    body.tube([[0, -.35, -.2], [0, -.62, -.5], [.18, -.56, -.82], [.28, -.3, -.92]], [.07, .05, .03, .012], c, { mat: 'skin', seg: 6 });
    body.oct(.09, .3, -.22, -.94, w2, { sy: 1.3, glow: .3 });
    for (const x of [-1, 1]) {
      body.tube([[x * .2, .22, -.24], [x * .55, .68, -.36], [x * .95, .84, -.42]], [.05, .035, .01], w2, { mat: 'skin', seg: 5 });
      const tips = [[x * 1.45, .46, -.5], [x * 1.24, -.05, -.46], [x * .84, -.26, -.4], [x * .36, -.16, -.3]], rows = [];
      for (let i = 0; i < tips.length; i++) { const t = tips[i], o = [x * .94, .82, -.42]; rows.push([0, .5, 1].map(w => [o[0] + (t[0] - o[0]) * w, o[1] + (t[1] - o[1]) * w, o[2] + (t[2] - o[2]) * w + Math.sin(w * Math.PI) * .05])); if (i < tips.length - 1) { const n = tips[i + 1], m = [(t[0] + n[0]) / 2 - x * .05, (t[1] + n[1]) / 2 + .13, (t[2] + n[2]) / 2]; rows.push([0, .5, 1].map(w => [o[0] + (m[0] - o[0]) * w, o[1] + (m[1] - o[1]) * w, o[2] + (m[2] - o[2]) * w])); } }
      rows.push([0, .5, 1].map(w => [x * .94 + (x * .2 - x * .94) * w, .82 + (.22 - .82) * w, -.42 + .18 * w]));
      body.sheet(rows, w2, { mat: 'fur', c2: 0xc2401c });
    }
    head.loft([[-.3, .1, .12, 0, .08], [-.2, .24, .26, 0, .05], [-.04, .33, .33], [.14, .35, .34], [.28, .22, .22], [.34, .03, .03]], 0, 0, .04, c, { mat: 'skin', c2: 0xffb030, seg: 16 });
    for (const x of [-1, 1]) {
      head.ball(.075, x * .145, .055, .315, 0xffffa0, { glow: 1, sy: .7, sz: .6, rz: x * .35 });
      head.ball(.024, x * .145, .05, .375, 0x1a0808, { mat: 'plain' });
      head.tube([[x * .17, .25, .02], [x * .33, .42, .0], [x * .38, .62, -.1], [x * .3, .76, -.2]], [.075, .058, .03, .004], 0x2a1414, { mat: 'bone', seg: 6, sub: 3 });
      head.tube([[x * .3, .05, .02], [x * .46, .12, -.02], [x * .62, .24, -.07]], [.07, .05, .004], c, { mat: 'skin', seg: 5 });
    }
    head.tube([[-.13, -.13, .33], [0, -.17, .375], [.13, -.13, .33]], .018, 0x2a0808, { mat: 'plain', seg: 4 });
    fine(head, () => { for (const x of [-.08, .08]) head.cone(.022, .07, x, -.19, .37, 0xfff4dc, { mat: 'bone', seg: 4, rx: Math.PI }); });
    arm.tube([[0, .03, 0], [.03, -.2, .02], [.04, -.42, .08]], [.075, .056, .05], c, { mat: 'skin', seg: 7 });
    fine(arm, () => { for (let i = -1; i <= 1; i++) arm.cone(.018, .11, .04 + i * .035, -.49, .1, 0x1a1010, { mat: 'bone', seg: 4, rx: Math.PI }); });
  } else if (s.kind === 'bat') {
    const c = s.c1 ?? 0x5b3f9a;
    body.loft([[-.34, .06], [-.25, .2, .18], [-.02, .3, .27], [.2, .25, .23], [.32, .08, .08]], 0, 0, 0, c, { mat: 'fur', c2: 0x8e6fe0, seg: 14 });
    head.loft([[-.2, .08, .1, 0, .06], [-.1, .19, .2, 0, .04], [.06, .24, .24, 0, .02], [.19, .15, .16], [.24, .02, .02]], 0, 0, .1, c, { mat: 'fur', seg: 14 });
    head.ball(.05, 0, -.04, .36, 0x281838, { mat: 'plain', sy: .75 });
    for (const x of [-1, 1]) {
      head.tube([[x * .12, .12, .08], [x * .23, .36, .03], [x * .24, .5, -.02]], [.11, .07, .004], c, { mat: 'fur', seg: 6, sub: 3 });
      head.ball(.046, x * .11, .06, .305, 0x7fffe0, { glow: 1, sz: .6 });
      fine(head, () => head.cone(.018, .07, x * .05, -.13, .32, 0xfff4dc, { mat: 'bone', seg: 4, rx: Math.PI }));
    }
    const tips = [[1.22, .1, -.1], [1.02, -.28, -.08], [.62, -.36, -.04], [.14, -.2, 0]], o = [.58, .32, 0], rows = [];
    arm.tube([[.05, .05, 0], [.32, .28, 0], o], [.04, .03, .02], 0x3a2870, { mat: 'fur', seg: 5 });
    for (const t of tips) arm.tube([o, [(o[0] + t[0]) / 2 + .03, (o[1] + t[1]) / 2 + .05, 0], t], [.016, .012, .003], 0x3a2870, { mat: 'bone', seg: 4 });
    for (let i = 0; i < tips.length; i++) { rows.push([0, .5, 1].map(w => [o[0] + (tips[i][0] - o[0]) * w, o[1] + (tips[i][1] - o[1]) * w, tips[i][2] * w])); if (i < tips.length - 1) { const n = tips[i + 1], m = [(tips[i][0] + n[0]) / 2 - .03, (tips[i][1] + n[1]) / 2 + .1, 0]; rows.push([0, .5, 1].map(w => [o[0] + (m[0] - o[0]) * w, o[1] + (m[1] - o[1]) * w, m[2] * w])); } }
    rows.push([0, .5, 1].map(w => [o[0] + (.05 - o[0]) * w, o[1] + (-.15 - o[1]) * w, 0]));
    arm.sheet(rows, c, { mat: 'fur', c2: 0x8e6fe0 });
  }
  return { body: body.buildLOD(), head: head.buildLOD(), arm: arm.buildLOD() };
}

function parts(s) {
  const key = JSON.stringify(s);
  let p = cache.get(key);
  if (!p) { p = ['wolf', 'scorpion', 'spider', 'dragon'].includes(s.kind) ? quad(s) : ['shroom', 'ghost', 'imp', 'bat'].includes(s.kind) ? special(s) : humanoid(s); cache.set(key, p); }
  return p;
}

const piv = (parent, geo, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (geo) { const m = new THREE.Mesh(geo.hi, MAT.solid); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.userData.lod = geo; g.add(m); g.userData.m = m; }
  parent.add(g); return g;
};

export function makeModel(spec) {
  const monster = makeMonster(spec); if (monster) return monster;
  if (HUMAN.ready && (spec.kind || 'human') === 'human' && !spec.skull && !spec.noFace) return makeHuman(spec);
  const root = new THREE.Group(), inner = new THREE.Group(), p = parts(spec), S = spec.scale ?? 1;
  root.add(inner); inner.scale.setScalar(S);
  const m = { root, inner, spec, kind: spec.kind || 'human', meshes: [], base: 0, height: 2.6 * S, flash: 0, near: true };
  if (['wolf', 'scorpion', 'spider', 'dragon'].includes(m.kind)) {
    const big = m.kind === 'dragon', top = big ? 3.1 : m.kind === 'wolf' ? .85 : .6, fx = big ? 1.1 : m.kind === 'wolf' ? .24 : .6, fz = big ? 2 : m.kind === 'wolf' ? .7 : .55;
    m.body = piv(inner, p.body, 0, top, 0); m.head = piv(m.body, p.head, 0, big ? .4 : .1, big ? 2.8 : .92);
    m.tail = piv(m.body, p.tail, 0, 0, big ? -2.7 : -.9);
    m.legs = [[-fx, fz], [fx, fz], [-fx, -fz], [fx, -fz]].map(([x, z]) => piv(inner, p.leg, x, top - (big ? .5 : .1), z));
    if (m.kind === 'scorpion' || m.kind === 'spider') m.legs.forEach((l, i) => { l.scale.x = i % 2 ? 1 : -1; });
    m.height = (big ? 6 : 1.5) * S;
  } else if (['shroom', 'ghost', 'imp', 'bat'].includes(m.kind)) {
    const hy = m.kind === 'shroom' ? 1 : m.kind === 'ghost' ? 2 : m.kind === 'imp' ? 1.5 : 1.8;
    m.body = piv(inner, p.body, 0, m.kind === 'shroom' ? 0 : hy - .5, 0);
    m.head = piv(m.body, p.head, 0, m.kind === 'shroom' ? .95 : m.kind === 'ghost' ? 1.15 : .5, 0);
    m.armL = piv(m.body, p.arm, -.48, m.kind === 'shroom' ? .55 : .7, 0); m.armL.scale.x = -1;
    m.armR = piv(m.body, p.arm, .48, m.kind === 'shroom' ? .55 : .7, 0);
    m.height = (m.kind === 'shroom' ? 1.9 : 2.5) * S;
  } else {
    const A = (spec.longArm ? 1.25 : .95) / .95;
    m.hip = piv(inner, null, 0, .98, 0);
    m.body = piv(m.hip, p.body, 0, .42, 0);
    m.head = piv(m.body, p.head, 0, 1.02, 0);
    const w = (spec.wide || 1) * (spec.skull ? .45 : .405);
    m.armL = piv(m.body, p.armL, -w, .66, 0); m.armR = piv(m.body, p.armR, w, .66, 0);
    m.foreL = piv(m.armL, p.foreL, 0, -.49 * A, 0); m.foreR = piv(m.armR, p.foreR, 0, -.49 * A, 0);
    m.legL = p.legL ? piv(inner, p.legL, -.2 * (spec.wide || 1), .98, 0) : null;
    m.legR = p.legR ? piv(inner, p.legR, .2 * (spec.wide || 1), .98, 0) : null;
    m.shinL = m.legL ? piv(m.legL, p.shinL, 0, -.49, 0) : null;
    m.shinR = m.legR ? piv(m.legR, p.shinR, 0, -.49, 0) : null;
    m.height = 2.9 * S;
  }
  root.traverse(o => { if (o.isMesh) m.meshes.push(o); });
  m.shadow = makeBlob(m.kind === 'dragon' ? 7 * S : ['wolf', 'scorpion', 'spider'].includes(m.kind) ? 1.5 * S : 1.05 * S);
  root.add(m.shadow);
  return m;
}

export function setFlash(m, on) {
  if (m.flashing === on) return;
  m.flashing = on;
  if (on && m.skinned) m.hitT = .34;
  for (const o of m.meshes) o.material = on ? MAT.flash : o.userData.base ?? MAT.solid;
}

/** Figuren in der Ferne nutzen eine einfachere Version. */
export function updateDetail(m) {
  if (m.skinned) return;
  const c = G.camera?.position; if (!c) return;
  const p = m.root.position, big = m.kind === 'dragon' ? 3 : 1, q = (p.x - c.x) ** 2 + (p.z - c.z) ** 2, lim = (NEAR * big * (m.near ? 1.12 : 1)) ** 2, near = q < lim && (!G.settings.low || q < 196);
  if (near === m.near) return;
  m.near = near;
  for (const o of m.meshes) if (o.userData.lod) o.geometry = near ? o.userData.lod.hi : o.userData.lod.lo;
}

/** a: { t, speed, attack (0..1 oder -1), cast, block, dead (0..1), roll } */
export function animate(m, a) {
  if (m.creature) return animateCreature(m, a);
  if (m.skinned) return animateHuman(m, a);
  updateDetail(m);
  const ph = a.t * Math.min(13, 4 + a.speed * 1.1), amp = Math.min(.95, a.speed * .14), sw = Math.sin(ph) * amp;
  const atk = a.attack >= 0 ? a.attack : -1;
  if (m.legs) {
    m.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * sw * .9; });
    m.body.position.y = (m.kind === 'dragon' ? 3.1 : m.kind === 'wolf' ? .85 : .6) + Math.abs(sw) * .06 + Math.sin(a.t * 1.7) * .012;
    if (m.tail) m.tail.rotation.y = Math.sin(a.t * 3) * (m.kind === 'dragon' ? .22 : .35);
    m.head.rotation.x = atk >= 0 ? Math.sin(atk * Math.PI) * .55 : Math.sin(a.t * 1.6) * .06;
    m.body.rotation.x = atk >= 0 ? -Math.sin(atk * Math.PI) * .24 : 0;
  } else if (m.kind === 'ghost' || m.kind === 'imp' || m.kind === 'bat') {
    m.body.position.y = (m.kind === 'ghost' ? 1.5 : m.kind === 'imp' ? 1 : 1.3) + Math.sin(a.t * 3) * .18;
    const f = m.kind === 'bat' ? Math.sin(a.t * 18) * .75 : Math.sin(a.t * 2.2) * .24;
    m.armL.rotation.z = m.kind === 'bat' ? -f : -.24 + f; m.armR.rotation.z = m.kind === 'bat' ? f : .24 - f;
    if (atk >= 0) { m.armR.rotation.x = -2.2 + atk * 2.6; m.armL.rotation.x = -2.2 + atk * 2.6; } else { m.armR.rotation.x = m.armL.rotation.x = 0; }
  } else if (m.kind === 'shroom') {
    m.inner.scale.y = (m.spec.scale ?? 1) * (1 + Math.sin(a.t * 7) * Math.min(.1, a.speed * .03));
    m.armL.rotation.x = sw * 1.5; m.armR.rotation.x = atk >= 0 ? -2 + atk * 3 : -sw * 1.5;
    m.head.rotation.x = atk >= 0 ? Math.sin(atk * Math.PI) * .5 : 0;
  } else {
    const idle = Math.sin(a.t * 1.7) * (a.speed > .1 ? 0 : 1);
    if (m.legL) {
      m.legL.rotation.set(a.ride ? -.5 : sw, 0, a.ride ? -.82 : 0); m.legR.rotation.set(a.ride ? -.5 : -sw, 0, a.ride ? .82 : 0);
      const c = Math.cos(ph) * amp * 1.45;
      m.shinL.rotation.x = a.ride ? 1.05 : Math.max(0, -c) + Math.max(0, sw) * .28 + .025;
      m.shinR.rotation.x = a.ride ? 1.05 : Math.max(0, c) + Math.max(0, -sw) * .28 + .025;
    }
    const bob = Math.abs(Math.sin(ph)) * Math.min(.1, a.speed * .016);
    m.hip.position.y = .98 + bob + idle * .008;
    m.body.rotation.y = -sw * .13; m.body.rotation.x = Math.min(.18, a.speed * .018) + idle * .008;
    m.armL.rotation.set(-sw * .8, 0, -.09 - idle * .012);
    m.armR.rotation.set(sw * .8, 0, .09 + idle * .012);
    let fL = -.16 - Math.max(0, sw) * .75, fR = -.16 - Math.max(0, -sw) * .75;
    if (atk >= 0) {
      const wind = atk < .32 ? atk / .32 : 1 - (atk - .32) / .68, hit = atk < .32 ? 0 : Math.min(1, (atk - .32) / .22);
      const combo = a.combo || 0;
      if (combo === 1) { m.armR.rotation.set(-1.45, 1.35 - hit * 2.8, .2); m.body.rotation.y = .55 - hit * 1.2; }
      else if (combo === 2) { m.armR.rotation.set(-3 + hit * 2.5, 0, .1); m.body.rotation.x = -.14 + hit * .46; }
      else { m.armR.rotation.set(-1.45, -1.35 + hit * 2.8, -.1); m.body.rotation.y = -.55 + hit * 1.2; }
      m.body.rotation.y *= Math.max(wind, .35);
      fR = -.5 * wind - .08;
    } else if (a.cast > 0) {
      m.armR.rotation.set(-1.75 - a.cast * .5, 0, .1); m.armL.rotation.set(-1.4 - a.cast * .3, 0, -.2); fR = -.22; fL = -.35;
    } else if (a.block) {
      m.armL.rotation.set(-1.5, .95, -.1); m.armR.rotation.set(-1.15, -.75, .1); fL = -.75; fR = -.6;
    } else if (a.ride) {
      m.armL.rotation.set(-.62, 0, .2); m.armR.rotation.set(-.62, 0, -.2); m.body.rotation.x = .1; m.body.rotation.y = 0; fL = fR = -.72;
    } else if (a.talk) {
      m.armR.rotation.x = -.45 + Math.sin(a.t * 3) * .22; m.head.rotation.y = Math.sin(a.t * .9) * .2; fR = -.75 + Math.sin(a.t * 3) * .25;
    }
    m.foreL.rotation.x = fL; m.foreR.rotation.x = fR;
  }
  const r = a.roll ?? 0;
  if (r > 0 && m.hip) { m.inner.rotation.x = r * Math.PI * 2; m.inner.position.y = Math.sin(r * Math.PI) * .25 + (1 - Math.abs(r * 2 - 1)) * .55; }
  else if (!a.dead) { m.inner.rotation.x = 0; m.inner.position.y = 0; }
  if (a.dead > 0) { m.inner.rotation.x = -Math.min(1, a.dead * 2.4) * HP; m.inner.position.y = Math.min(1, a.dead * 2.4) * .4 - Math.max(0, a.dead - .7) * 2.2; }
}
