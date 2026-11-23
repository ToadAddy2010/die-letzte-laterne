import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT } from '../core/gfx.js';
import { strHash } from '../core/util.js';

const cache = new Map();
const blobGeo = new THREE.CircleGeometry(1, 16); blobGeo.rotateX(-Math.PI / 2);
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), d = g.createImageData(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const r = Math.hypot(x - 15.5, y - 15.5) / 15.5; d.data[(y * 32 + x) * 4 + 3] = Math.round(Math.max(0, 1 - r * r) * 190); }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
  return t;
})();
export const BLOB = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x05040e, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
export const makeBlob = r => { const m = new THREE.Mesh(blobGeo, BLOB); m.scale.setScalar(r); m.position.y = .2; m.renderOrder = 1; m.frustumCulled = false; return m; };

function weapon(k, type, c = 0xc8cfe8, x = 0, y = -1.05, z = .1) {
  if (!type) return;
  k.at(x, y, z, type === 'bow' ? 0 : .32, 1, type === 'staff' || type === 'spear' ? -.6 : type === 'bow' ? 0 : .62);
  const gold = 0xd8a33c;
  switch (type) {
    case 'sword': k.box(.11, 1.5, .05, 0, .2, .75, c, { rx: 1.57, c2: 0xffffff }); k.box(.46, .1, .1, 0, 0, .05, gold, {}); k.box(.08, .1, .3, 0, 0, -.14, 0x4a2c20, {}); break;
    case 'great': k.box(.2, 2.4, .07, 0, 0, 1.35, c, { rx: 1.57, c2: 0xffffff }); k.box(.72, .12, .14, 0, 0, .1, gold, {}); k.box(.1, .1, .5, 0, 0, -.2, 0x4a2c20, {}); break;
    case 'dagger': k.box(.09, .75, .04, 0, 0, .4, c, { rx: 1.57 }); k.box(.3, .08, .08, 0, 0, 0, gold, {}); break;
    case 'axe': k.box(.08, 1.6, .08, 0, 0, .6, 0x5a3c2c, { rx: 1.57 }); k.box(.08, .72, .6, 0, .2, 1.2, c, {}); break;
    case 'club': k.cyl(.2, .08, 1.5, 0, 0, .68, 0x6a4a34, { rx: 1.57, seg: 5 }); k.ball(.27, 0, 0, 1.4, 0x7a5a40, { seg: 5 }); break;
    case 'mace': k.box(.08, 1.3, .08, 0, 0, .5, 0x5a4a50, { rx: 1.57 }); k.ico(.3, 0, 0, 1.2, c, {}); break;
    case 'spear': k.box(.07, 2.8, .07, 0, 0, .8, 0x5a3c2c, { rx: 1.57 }); k.cone(.14, .6, 0, 0, 2.45, c, { rx: 1.57, seg: 4 }); break;
    case 'scythe': k.box(.08, 2.8, .08, 0, 0, .6, 0x2a2030, { rx: 1.57 }); k.box(.05, 1.5, .3, 0, .68, 1.95, c, {}); break;
    case 'staff': k.box(.08, 2.5, .08, 0, -.05, .55, 0x4a2c20, { rx: 1.57 }); k.oct(.25, 0, 0, 1.95, c === 0xc8cfe8 ? 0x4fc2ff : c, { glow: 1 }); break;
    case 'bow': k.torus(.85, .05, 0, 0, .1, 0x5a3c2c, { arc: 2.3, ry: 1.57, rz: 2.0, seg: 8 }); k.box(.02, .02, 1.5, -.02, 0, .1, 0xeeeeee, {}); break;
    case 'hammer': k.box(.09, 1.7, .09, 0, 0, .7, 0x5a3c2c, { rx: 1.57 }); k.box(.4, .5, .85, 0, 0, 1.55, c, {}); break;
  }
  k.pop();
}

function hat(k, s, y) {
  const c = s.hatColor ?? 0x2743b8;
  switch (s.hat) {
    case 'wizard': k.cyl(.7, .7, .06, 0, y + .1, 0, c, { seg: 10 }); k.cone(.42, 1.25, 0, y + .72, -.05, c, { seg: 8, rx: -.16, c2: s.hatColor2 ?? c }); for (let i = 0; i < 5; i++) k.oct(.07, Math.cos(i * 2.1) * .24, y + .36 + i * .14, Math.sin(i * 2.1) * .24, 0xfff0a0, { glow: 1 }); break;
    case 'hood': k.ball(.47, 0, y - .28, -.05, c, { seg: 7, sy: 1.05 }); k.cone(.3, .5, 0, y + .15, -.2, c, { seg: 5, rx: -.3 }); break;
    case 'helm': k.dome(.41, 0, y - .32, 0, c, { seg: 8 }); k.box(.72, .08, .72, 0, y - .3, 0, c, {}); k.box(.07, .4, .05, 0, y - .4, .39, 0x14101e, {}); k.box(.44, .05, .05, 0, y - .48, .39, 0x14101e, {}); break;
    case 'horns': k.dome(.42, 0, y - .32, 0, c, { seg: 8 }); for (const x of [-.4, .4]) k.cone(.13, .72, x, y - .05, 0, 0xe8e2cc, { seg: 5, rz: -Math.sign(x) * .72 }); break;
    case 'crown': k.cyl(.36, .34, .22, 0, y - .1, 0, 0xffc445, { seg: 8, glow: .45 }); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; k.cone(.08, .28, Math.cos(a) * .32, y + .1, Math.sin(a) * .32, 0xffd070, { seg: 3, glow: .5 }); } break;
    case 'cap': k.dome(.42, 0, y - .34, 0, c, { seg: 8, sy: .7 }); k.box(.5, .05, .3, 0, y - .34, .4, c, {}); break;
    case 'mushroom': k.dome(.72, 0, y - .28, 0, c, { seg: 9, sy: .8, c2: s.hatColor2 ?? 0xff6a7d }); k.ball(.09, .3, y + .08, .2, 0xfff4dc, { seg: 4, glow: .8 }); k.ball(.09, -.28, y + .05, -.25, 0xfff4dc, { seg: 4, glow: .8 }); break;
    case 'turban': k.ball(.46, 0, y - .24, 0, c, { seg: 7, sy: .72 }); k.ball(.13, 0, y - .1, .42, 0xff5a4a, { seg: 4, glow: .7 }); break;
    case 'gear': k.torus(.38, .1, 0, y - .1, 0, 0xc98a33, { rx: 1.57, seg: 10 }); break;
    case 'fur': k.dome(.47, 0, y - .34, 0, 0xe8e4f4, { seg: 7, j: .2 }); break;
  }
}

function humanoid(s) {
  const skull = s.skull, thin = s.thin ? .55 : 1, W = (s.wide || 1), skin = s.skin ?? 0xd8b48e, top = s.top ?? 0x3a4a8a, bot = s.bottom ?? 0x2a2a44, glowEye = s.eye ?? (skull ? 0x7ff2c8 : null);
  const body = new Kit(1), head = new Kit(2), aL = new Kit(3), aR = new Kit(4), lL = new Kit(5), lR = new Kit(6);
  if (s.robe) {
    body.cyl(.34 * W, .5 * W, .95, 0, .28, 0, top, { seg: 7, c2: s.top2 ?? top });
    body.cyl(.5 * W, .72 * W, .9, 0, -.62, 0, top, { seg: 8, c2: s.top3 ?? (s.top2 ?? top) });
    body.cyl(.52 * W, .52 * W, .1, 0, -.13, 0, s.belt ?? 0xd8a33c, { seg: 8 });
    for (let i = 0; i < (s.stars || 0); i++) { const a = i * 2.4; body.oct(.06, Math.cos(a) * (.42 + i * .025), .35 - i * .09, Math.sin(a) * (.42 + i * .025), 0xdde2ff, { glow: 1 }); }
  } else if (skull) {
    body.box(.5 * W, .15, .3, 0, .62, 0, 0xddd7c2, {}); for (let i = 0; i < 4; i++) body.box(.56 * W, .06, .34, 0, .42 - i * .15, 0, 0xddd7c2, {});
    body.box(.1, .95, .1, 0, .15, -.1, 0xbdb6a0, {}); body.box(.5 * W, .2, .28, 0, -.3, 0, 0xc9c2a8, {});
    if (s.armor) { body.box(.72 * W, .62, .46, 0, .4, 0, s.armor, { c2: 0x8a90b0 }); body.box(.82 * W, .2, .5, 0, .68, 0, s.armor, {}); }
  } else {
    body.box(.72 * W, .95, .44, 0, .2, 0, top, { c2: s.top2 ?? top }); body.box(.76 * W, .12, .48, 0, -.22, 0, s.belt ?? 0x3c2830, {});
    if (s.armor) { body.box(.8 * W, .62, .5, 0, .35, 0, s.armor, { c2: 0xdde2f4 }); for (const x of [-.48, .48]) body.ball(.25, x * W, .68, 0, s.armor, { seg: 5 }); }
    if (s.apron) body.box(.56, .88, .05, 0, -.05, .25, s.apron, {});
  }
  if (s.cape) body.box(.76 * W, 1.6, .06, 0, -.15, -.29, s.cape, { rx: .08, c2: s.cape2 ?? s.cape });

  const hy = .36;
  if (skull) {
    head.ball(.38, 0, .05, 0, 0xe8e2cc, { seg: 6 }); head.box(.28, .22, .3, 0, -.25, .05, 0xd8d2bc, {});
    head.box(.13, .13, .08, -.15, .05, .33, glowEye, { glow: 1 }); head.box(.13, .13, .08, .15, .05, .33, glowEye, { glow: 1 });
    head.box(.2, .04, .06, 0, -.24, .2, 0x14101e, {});
  } else if (s.noFace) {
    head.ball(.36, 0, 0, 0, s.skin ?? 0x161024, { seg: 6 }); if (glowEye) { head.box(.11, .08, .06, -.13, .03, .33, glowEye, { glow: 1 }); head.box(.11, .08, .06, .13, .03, .33, glowEye, { glow: 1 }); }
  } else {
    head.box(.62, .64, .6, 0, 0, 0, skin, { j: .03 });
    const eye = glowEye ?? 0x14101e, ex = .15;
    head.box(.12, .1, .06, -ex, .05, .3, eye, glowEye ? { glow: 1 } : {}); head.box(.12, .1, .06, ex, .05, .3, eye, glowEye ? { glow: 1 } : {});
    head.box(.09, .16, .12, 0, -.06, .33, skin, { j: .1 });
    head.box(.22, .04, .05, 0, -.2, .31, 0x5a2a2a, {});
    if (s.ears) { for (const x of [-1, 1]) head.cone(.17, .72, x * .54, .08, 0, skin, { seg: 3, rz: -x * 1.57, c2: 0xffa0a0 }); head.cone(.1, .34, 0, -.08, .46, skin, { seg: 4, rx: 1.57 }); }
    if (s.tusks) for (const x of [-.14, .14]) head.cone(.05, .2, x, -.17, .32, 0xfff4dc, { seg: 3 });
    if (s.beard) head.cone(.34, .85, 0, -.56, .13, s.beard, { seg: 6, rx: Math.PI });
    if (s.hair) { head.box(.68, .24, .66, 0, .3, -.02, s.hair, {}); head.box(.66, .5, .14, 0, .06, -.31, s.hair, {}); if (s.long) head.box(.62, .9, .14, 0, -.26, -.33, s.hair, {}); }
  }
  if (s.hat) hat(head, s, hy);

  const armLen = s.longArm ? 1.25 : .95, armC = s.sleeve ?? (s.robe ? top : skull ? 0xddd7c2 : top), hand = skull ? 0xddd7c2 : skin;
  for (const [k, sign] of [[aL, -1], [aR, 1]]) {
    if (skull) k.box(.12, armLen, .12, 0, -armLen / 2, 0, armC, {});
    else { k.box(.25 * thin * W, armLen * .78, .25 * thin * W, 0, -armLen * .38, 0, armC, {}); if (s.armor) k.box(.3, .36, .3, 0, -.1, 0, s.armor, {}); }
    k.box(.24, .22, .24, 0, -armLen - .02, 0, hand, {});
    if (sign > 0) weapon(k, s.weapon, s.weaponColor, 0, -armLen - .03, .1);
    else if (s.lantern) {
      const y = -armLen - .12;
      k.box(.03, .22, .03, 0, y - .1, .08, 0x2a2030, {}); k.box(.3, .05, .3, 0, y - .23, .08, 0x2a2030, {});
      k.box(.21, .28, .21, 0, y - .39, .08, 0xffc445, { glow: 1 });
      for (const [a, b] of [[-.12, -.12], [.12, -.12], [-.12, .12], [.12, .12]]) k.box(.035, .3, .035, a, y - .39, .08 + b, 0x2a2030, {});
      k.box(.3, .05, .3, 0, y - .55, .08, 0x2a2030, {});
    } else if (s.shield) { const sc = s.shieldColor ?? 0x6a4a34; k.cyl(.56, .56, .08, .14, -armLen * .7, 0, sc, { rz: 1.57, seg: 7 }); k.ball(.13, .2, -armLen * .7, 0, 0xd8a33c, { seg: 4 }); }
  }
  const legH = .98;
  if (!s.robe) for (const k of [lL, lR]) {
    if (skull) k.box(.14, legH, .14, 0, -legH / 2, 0, 0xddd7c2, {});
    else k.box(.3 * W, legH * .8, .3, 0, -legH * .4, 0, bot, {});
    k.box(.3 * W, .16, .52, 0, -legH + .08, .08, s.boots ?? (skull ? 0xc9c2a8 : 0x2a1c20), {});
  }
  return { body: body.build(), head: head.build(), armL: aL.build(), armR: aR.build(), legL: s.robe ? null : lL.build(), legR: s.robe ? null : lR.build() };
}

function quad(s) {
  const c = s.c1 ?? 0x4a4a6a, c2 = s.c2 ?? 0x7a7aa0, eye = s.eye ?? 0xffc445, body = new Kit(7), head = new Kit(8), leg = new Kit(9), tail = new Kit(10);
  if (s.kind === 'wolf') {
    body.box(.7, .75, 1.8, 0, 0, 0, c, { c2 }); body.cone(.28, .4, 0, .48, -.2, c2, { seg: 4 }); body.cone(.28, .4, 0, .46, .35, c2, { seg: 4 });
    head.box(.56, .52, .62, 0, 0, .25, c, { c2 }); head.box(.3, .24, .46, 0, -.1, .72, c2, {}); head.box(.1, .1, .05, -.17, .08, .57, eye, { glow: 1 }); head.box(.1, .1, .05, .17, .08, .57, eye, { glow: 1 });
    for (const x of [-.2, .2]) { head.cone(.13, .36, x, .42, .1, c, { seg: 3 }); head.cone(.04, .14, x * .7, -.27, .9, 0xfff4dc, { seg: 3, rx: Math.PI }); }
    leg.box(.2, .78, .24, 0, -.36, 0, c, {}); tail.box(.16, .16, 1, 0, 0, -.45, c2, { rx: -.5 });
  } else if (s.kind === 'scorpion') {
    body.box(1.25, .45, 1.9, 0, 0, 0, c, { c2 }); for (let i = 0; i < 3; i++) body.box(1.28 - i * .1, .1, .12, 0, .24, -.6 + i * .6, c2, {});
    head.box(.8, .36, .5, 0, 0, .24, c, { c2 }); head.box(.08, .08, .05, -.18, .12, .5, eye, { glow: 1 }); head.box(.08, .08, .05, .18, .12, .5, eye, { glow: 1 });
    for (const x of [-.75, .75]) { head.box(.2, .18, .95, x, 0, .55, c, { ry: x > 0 ? -.45 : .45 }); head.cone(.3, .62, x * 1.2, 0, 1.1, c2, { rx: 1.57, seg: 4 }); }
    leg.box(.1, .55, .1, 0, -.25, 0, c, { rz: .7 });
    for (let i = 0; i < 4; i++) tail.ball(.24 - i * .02, 0, .2 + i * .32, -.12 - i * .1 + (i > 2 ? .3 : 0), c, { seg: 5 }); tail.cone(.13, .46, 0, 1.45, .38, 0xff5a4a, { rx: 2.2, seg: 4, glow: .8 });
  } else if (s.kind === 'spider') {
    body.ball(.74, 0, .08, -.1, c, { seg: 7, c2 }); body.torus(.5, .1, 0, .4, -.1, 0xf0bd5a, { rx: 1.57, seg: 8 });
    head.ball(.4, 0, 0, .2, c2, { seg: 6 }); for (const [x, y] of [[-.16, .1], [.16, .1], [-.28, -.05], [.28, -.05]]) head.ball(.08, x, y, .55, eye, { seg: 4, glow: 1 });
    leg.box(.1, .9, .1, 0, -.4, 0, c2, { rz: .75 }); tail.ball(.1, 0, 0, 0, c, { seg: 4 });
  } else {
    body.box(2.4, 2.2, 5.6, 0, 0, 0, c, { c2, j: .14 }); for (let i = 0; i < 7; i++) body.cone(.42, 1.1, 0, 1.4, -2.4 + i * .85, c2, { seg: 4 });
    for (const x of [-1, 1]) { body.box(.25, 2.9, 4.6, x * 3.1, 1.3, 0, c, { rz: x * 1.05, j: .2, c2 }); body.box(.2, 2.3, 3.5, x * 5.1, 2.5, -.3, c2, { rz: x * .58, j: .2 }); }
    head.box(1.25, 1.2, 1.5, 0, .2, 1.2, c, { c2 }); head.box(1, .55, 1.5, 0, -.2, 2.7, c2, {}); head.box(.26, .22, .08, -.45, .42, 2, eye, { glow: 1 }); head.box(.26, .22, .08, .45, .42, 2, eye, { glow: 1 });
    for (const x of [-.48, .48]) head.cone(.22, 1.3, x, 1.1, .6, 0xe8e2cc, { seg: 4, rx: -.65 });
    for (let i = 0; i < 4; i++) head.cone(.08, .32, -.36 + i * .24, -.55, 3.25, 0xfff4dc, { seg: 3, rx: Math.PI });
    leg.box(.7, 2.1, .8, 0, -1, 0, c, {}); leg.box(.85, .3, 1.2, 0, -2.05, .2, c2, {});
    for (let i = 0; i < 6; i++) tail.box(.9 - i * .12, .75 - i * .09, 1.4, 0, 0, -.7 - i * 1.25, i % 2 ? c2 : c, {}); tail.cone(.36, 1, 0, 0, -8.2, c2, { rx: -1.57, seg: 4 });
  }
  return { body: body.build(), head: head.build(), leg: leg.build(), tail: tail.build() };
}

function special(s) {
  const body = new Kit(21), head = new Kit(22), arm = new Kit(23);
  if (s.kind === 'shroom') {
    const c = s.c1 ?? 0xb82f4d;
    body.cyl(.44, .62, .95, 0, .45, 0, 0xe8ded0, { seg: 7 });
    body.box(.12, .15, .04, -.19, .58, .47, 0x14101e, {}); body.box(.12, .15, .04, .19, .58, .47, 0x14101e, {}); body.box(.2, .05, .04, 0, .36, .49, 0x14101e, {});
    head.dome(1, 0, 0, 0, c, { seg: 9, sy: .72, c2: s.c2 ?? 0xff6a7d }); head.cyl(.98, .98, .05, 0, 0, 0, 0xf6e4d4, { seg: 9 });
    for (let i = 0; i < 6; i++) { const a = i * 2.4, q = .3 + i * .1; head.ball(.13, Math.cos(a) * q, .7 * Math.sqrt(Math.max(.04, 1 - q * q)), Math.sin(a) * q, 0xfff4dc, { seg: 4, glow: .85 }); }
    arm.box(.13, .42, .13, 0, -.2, 0, 0xe8ded0, {});
  } else if (s.kind === 'ghost') {
    const c = s.c1 ?? 0x7ff2c8;
    body.cone(.72, 2, 0, -.05, 0, c, { seg: 7, rx: Math.PI, glow: .55, c2: s.c2 ?? 0x2a7a82 }); body.ball(.56, 0, .7, 0, c, { seg: 7, glow: .55 });
    head.ball(.42, 0, 0, .05, s.c2 ?? 0x2a7a82, { seg: 6, glow: .4 }); head.box(.14, .19, .05, -.16, .05, .44, 0x06120f, {}); head.box(.14, .19, .05, .16, .05, .44, 0x06120f, {}); head.ball(.12, 0, -.2, .42, 0x06120f, { seg: 4 });
    arm.box(.17, .85, .17, 0, -.38, 0, c, { glow: .55 });
  } else if (s.kind === 'imp') {
    const c = s.c1 ?? 0xd8341a;
    body.ball(.42, 0, .05, 0, c, { seg: 6, c2: 0xff9a30 });
    for (const x of [-1, 1]) body.box(.08, .78, .9, x * .66, .28, -.14, s.c2 ?? 0x7a1410, { rz: x * 1.1, glow: .2 });
    head.ball(.35, 0, 0, .05, c, { seg: 6, c2: 0xffb030 }); head.box(.1, .1, .05, -.14, .05, .37, 0xffffa0, { glow: 1 }); head.box(.1, .1, .05, .14, .05, .37, 0xffffa0, { glow: 1 });
    for (const x of [-.22, .22]) head.cone(.08, .36, x, .36, 0, 0x2a1414, { seg: 3, rz: -x * 1.6 });
    arm.box(.11, .42, .11, 0, -.2, 0, c, {});
  } else if (s.kind === 'bat') {
    const c = s.c1 ?? 0x5b3f9a;
    body.ball(.32, 0, 0, 0, c, { seg: 5, c2: 0x8e6fe0 }); head.ball(.24, 0, 0, .1, c, { seg: 5 });
    for (const x of [-.14, .14]) { head.cone(.08, .28, x, .26, 0, c, { seg: 3 }); head.box(.06, .06, .03, x * .7, .05, .32, 0x7fffe0, { glow: 1 }); }
    arm.box(.82, .05, .58, .4, 0, 0, c, { c2: 0x8e6fe0 });
  }
  return { body: body.build(), head: head.build(), arm: arm.build() };
}

function parts(s) {
  const key = JSON.stringify(s);
  let p = cache.get(key);
  if (!p) { p = ['wolf', 'scorpion', 'spider', 'dragon'].includes(s.kind) ? quad(s) : ['shroom', 'ghost', 'imp', 'bat'].includes(s.kind) ? special(s) : humanoid(s); cache.set(key, p); }
  return p;
}

const piv = (parent, geo, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (geo) { const m = new THREE.Mesh(geo, MAT.solid); m.frustumCulled = false; g.add(m); g.userData.m = m; }
  parent.add(g); return g;
};

export function makeModel(spec) {
  const root = new THREE.Group(), inner = new THREE.Group(), p = parts(spec), S = spec.scale ?? 1;
  root.add(inner); inner.scale.setScalar(S);
  const m = { root, inner, spec, kind: spec.kind || 'human', meshes: [], base: 0, height: 2.6 * S, flash: 0 };
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
    m.hip = piv(inner, null, 0, .98, 0);
    m.body = piv(m.hip, p.body, 0, .42, 0);
    m.head = piv(m.body, p.head, 0, 1.02, 0);
    const w = (spec.wide || 1) * .48;
    m.armL = piv(m.body, p.armL, -w, .68, 0); m.armR = piv(m.body, p.armR, w, .68, 0);
    m.legL = p.legL ? piv(inner, p.legL, -.2 * (spec.wide || 1), .98, 0) : null;
    m.legR = p.legR ? piv(inner, p.legR, .2 * (spec.wide || 1), .98, 0) : null;
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
  for (const o of m.meshes) o.material = on ? MAT.flash : MAT.solid;
}

/** a: { t, speed, attack (0..1 oder -1), cast, block, dead (0..1), roll } */
export function animate(m, a) {
  const sw = Math.sin(a.t * Math.min(13, 4 + a.speed * 1.1)) * Math.min(.95, a.speed * .14);
  const atk = a.attack >= 0 ? a.attack : -1;
  if (m.legs) {
    m.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * sw * .9; });
    m.body.position.y = (m.kind === 'dragon' ? 3.1 : m.kind === 'wolf' ? .85 : .6) + Math.abs(sw) * .06;
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
    if (m.legL) { m.legL.rotation.set(a.ride ? -.5 : sw, 0, a.ride ? -.82 : 0); m.legR.rotation.set(a.ride ? -.5 : -sw, 0, a.ride ? .82 : 0); }
    const bob = Math.abs(Math.sin(a.t * Math.min(13, 4 + a.speed * 1.1))) * Math.min(.1, a.speed * .016);
    m.hip.position.y = .98 + bob;
    m.body.rotation.y = 0; m.body.rotation.x = Math.min(.18, a.speed * .018);
    m.armL.rotation.set(-sw * .8, 0, -.07);
    m.armR.rotation.set(sw * .8, 0, .07);
    if (atk >= 0) {
      const wind = atk < .32 ? atk / .32 : 1 - (atk - .32) / .68, hit = atk < .32 ? 0 : Math.min(1, (atk - .32) / .22);
      const combo = a.combo || 0;
      if (combo === 1) { m.armR.rotation.set(-1.45, 1.35 - hit * 2.8, .2); m.body.rotation.y = .55 - hit * 1.2; }
      else if (combo === 2) { m.armR.rotation.set(-3 + hit * 2.5, 0, .1); m.body.rotation.x = -.14 + hit * .46; }
      else { m.armR.rotation.set(-1.45, -1.35 + hit * 2.8, -.1); m.body.rotation.y = -.55 + hit * 1.2; }
      m.body.rotation.y *= Math.max(wind, .35);
    } else if (a.cast > 0) {
      m.armR.rotation.set(-1.75 - a.cast * .5, 0, .1); m.armL.rotation.set(-1.4 - a.cast * .3, 0, -.2);
    } else if (a.block) {
      m.armL.rotation.set(-1.5, .95, -.1); m.armR.rotation.set(-1.15, -.75, .1);
    } else if (a.ride) {
      m.armL.rotation.set(-.88, 0, .2); m.armR.rotation.set(-.88, 0, -.2); m.body.rotation.x = .1;
    } else if (a.talk) {
      m.armR.rotation.x = -.45 + Math.sin(a.t * 3) * .22; m.head.rotation.y = Math.sin(a.t * .9) * .2;
    }
  }
  const r = a.roll ?? 0;
  if (r > 0 && m.hip) { m.inner.rotation.x = r * Math.PI * 2; m.inner.position.y = Math.sin(r * Math.PI) * .25 + (1 - Math.abs(r * 2 - 1)) * .55; }
  else if (!a.dead) { m.inner.rotation.x = 0; m.inner.position.y = 0; }
  if (a.dead > 0) { m.inner.rotation.x = -Math.min(1, a.dead * 2.4) * Math.PI / 2; m.inner.position.y = Math.min(1, a.dead * 2.4) * .4 - Math.max(0, a.dead - .7) * 2.2; }
}
