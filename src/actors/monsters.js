import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/addons/GLTFLoader.js';
import * as SkeletonUtils from '../../vendor/addons/SkeletonUtils.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';
import { Kit, MAT } from '../core/gfx.js';
import { strHash } from '../core/util.js';
import { hat, makeBlob, skullHead } from './models.js';
import { BASE, CLIPS, HUMAN, makeHuman, play, sock, handSock, torsoParts, weaponGeo, cached } from './skinned.js';
import { CREATURES, makeCreature } from './creatures.js';

// Goblin und Dämon: Bestiary von Quaternius (Quaternius Asset License), siehe assets/CREDITS.md.
const V = 1, RIG = {}, MATS = new Map(), HP = Math.PI / 2;
const url = p => new URL(`../../assets/chars/monsters/${p}?v=${V}`, import.meta.url).href;
export const MONSTER = { ready: false };

function retarget(s) {
  const names = new Set(); s.traverse(o => { if (o.isBone) names.add(o.name); });
  const ratio = s.getObjectByName('pelvis').position.z / BASE.m.scene.getObjectByName('pelvis').position.z, out = {};
  for (const [n, c] of Object.entries(CLIPS)) {
    const t = [];
    for (const q of c.tracks) {
      if (!names.has(q.name.split('.')[0])) continue;
      if (q.name.endsWith('.position')) { const r = q.clone(); for (let i = 0; i < r.values.length; i++) r.values[i] *= ratio; t.push(r); } else t.push(q);
    }
    out[n] = new THREE.AnimationClip(n, c.duration, t);
  }
  return out;
}

function prep(gltf, maps) {
  const s = gltf.scene; s.updateMatrixWorld(true);
  let body = null;
  s.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
    const q = o.material; q.metalness = 0; q.metalnessMap = null; q.roughness = 1; q.emissiveIntensity = 1.15; q.color.multiplyScalar(.86); q.side = THREE.FrontSide; q.needsUpdate = true;
    if (o.name === 'body') body = o;
  });
  body.geometry.computeBoundingBox();
  const b = body.geometry.boundingBox;
  return { scene: s, h: b.max.y - b.min.y, foot: -b.min.y, clips: retarget(s), maps };
}

export async function loadMonsters(progress) {
  const loader = new GLTFLoader(), tl = new THREE.TextureLoader();
  const tex = async n => { const t = await tl.loadAsync(url(n)); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const [pug, imp, p2, p3, i2, i3, gray] = await Promise.all([loader.loadAsync(url('puglin.glb')), loader.loadAsync(url('imp.glb')), tex('puglin_2.webp'), tex('puglin_3.webp'), tex('imp_2.webp'), tex('imp_3.webp'), tex('imp_gray.webp')]);
  progress?.(.8);
  RIG.puglin = prep(pug, { 2: p2, 3: p3 });
  RIG.imp = prep(imp, { 2: i2, 3: i3, gray });
  MONSTER.ready = true;
  progress?.(1);
}

function skinMat(base, map, tint) {
  const id = `${base.uuid}_${map?.uuid ?? ''}_${tint ?? ''}`;
  let m = MATS.get(id);
  if (!m) { m = base.clone(); if (map) m.map = map; if (tint != null) m.color.set(tint).multiplyScalar(2.15); MATS.set(id, m); }
  return m;
}

/** Breite Brust, kleiner Kopf, lange Arme: So wird aus dem Dämon ein Troll. */
const OGRE = { spine_01: 1.08, spine_02: 1.14, spine_03: 1.26, neck_01: .86, Head: .74, lowerarm_l: 1.16, lowerarm_r: 1.16, hand_l: 1.2, hand_r: 1.2, thigh_l: 1.12, thigh_r: 1.12, foot_l: 1.14, foot_r: 1.14 };
const LOOK = { puglin: { H: 2.75, hat: [.42, .1, 1.02] }, imp: { H: 2.4, hat: [.3, .02, .82] }, ogre: { H: 3.05, hat: [.3, .04, .86] } };

function ogreHead(s) {
  const k = new Kit(61, { auto: false });
  for (const x of [-1, 1]) {
    k.tube([[x * .09, -.17, .19], [x * .135, -.09, .25], [x * .12, .03, .245]], [.04, .03, .004], 0xfff0d4, { mat: 'bone', seg: 6, sub: 3 });
    if (s.horn) k.tube([[x * .15, .2, -.02], [x * .34, .28, 0], [x * .47, .5, -.03], [x * .42, .74, -.12]], [.085, .07, .04, .004], 0xe8e2cc, { mat: 'bone', seg: 8, sub: 4 });
  }
  if (s.beard) for (let i = 0; i < 11; i++) { const u = i / 10 * 2 - 1, q = 1 - Math.abs(u), L = .22 + q * .46; k.tube([[u * .19, -.1 - q * .1, .17 - Math.abs(u) * .08], [u * .2, -.24 - q * .1, .21], [u * .13, -.3 - L * .55, .2], [u * .04, -.3 - L, .15]], [.05, .06, .045, .004], s.beard, { mat: 'fur', seg: 4, sub: 2 }); }
  if (s.hat) { k.at(0, .16, .01, 0, .74); hat(k, s, .3); k.pop(); }
  return k.build();
}

function furTufts(c) {
  const k = new Kit(62, { auto: false });
  for (let i = 0; i < 34; i++) { const a = i * 2.39, q = .22 + (i % 5) * .035, x = Math.cos(a) * q, z = Math.sin(a) * q * .8 - .03, y = .28 - i * .012; k.tube([[x * .8, y, z * .8], [x * 1.12, y + .02, z * 1.12], [x * 1.3, y - .14, z * 1.28]], [.09, .06, .004], c, { mat: 'fur', seg: 4, sub: 2 }); }
  return k.build();
}

function impWing(x) {
  const k = new Kit(63 + x, { auto: false }), wc = 0x7a1410, o = [x * .42, .36, -.05], tips = [[x * 1.2, .08, -.14], [x * 1.05, -.34, -.12], [x * .72, -.52, -.08], [x * .22, -.34, -.03]], rows = [];
  k.tube([[0, 0, 0], [x * .2, .24, -.03], o], [.042, .034, .022], wc, { mat: 'skin', seg: 5 }); k.cone(.024, .13, o[0], o[1] + .06, o[2], 0x2a1414, { mat: 'bone', seg: 4 });
  for (const t of tips) k.tube([o, [(o[0] + t[0]) / 2, (o[1] + t[1]) / 2 + .04, (o[2] + t[2]) / 2], t], [.016, .012, .003], wc, { mat: 'bone', seg: 4 });
  for (let i = 0; i < tips.length; i++) { rows.push([0, .5, 1].map(w => [o[0] + (tips[i][0] - o[0]) * w, o[1] + (tips[i][1] - o[1]) * w, o[2] + (tips[i][2] - o[2]) * w])); if (i < tips.length - 1) { const n = tips[i + 1], m = [(tips[i][0] + n[0]) / 2 - x * .04, (tips[i][1] + n[1]) / 2 + .09, (tips[i][2] + n[2]) / 2]; rows.push([0, .5, 1].map(w => [o[0] + (m[0] - o[0]) * w, o[1] + (m[1] - o[1]) * w, o[2] + (m[2] - o[2]) * w])); } }
  rows.push([0, .5, 1].map(w => [o[0] * (1 - w), o[1] + (-.3 - o[1]) * w, o[2] * (1 - w)]));
  k.sheet(rows, wc, { mat: 'fur', c2: 0xc2401c });
  return k.build();
}

function makeRig(spec) {
  const type = spec.rig, ogre = type === 'ogre', R = RIG[ogre ? 'imp' : type], L = LOOK[type], S = spec.scale ?? 1, W = spec.wide || 1, k = L.H / R.h, h = strHash(JSON.stringify(spec));
  const root = new THREE.Group(), inner = new THREE.Group(), char = SkeletonUtils.clone(R.scene);
  root.add(inner); inner.add(char); inner.scale.setScalar(S);
  const sw = ogre ? 1 : 1 + (W - 1) * .5;
  char.scale.set(k * sw, k, k * (ogre ? 1 : 1 + (W - 1) * .4)); char.position.y = R.foot * k;
  const m = { root, inner, spec, kind: 'human', skinned: true, monster: true, meshes: [], bones: {}, base: 0, height: Math.min(2.9, L.H) * S, flash: 0, seatY: 1.42 * S, lt: 0, act: null, cur: '', actions: {}, skip: 0, acc: 0, clips: R.clips, stance: !!spec.weapon && spec.weapon !== 'staff' && spec.weapon !== 'bow' };
  char.traverse(o => { if (o.isBone) m.bones[o.name] = o; });
  if (ogre) for (const [n, v] of Object.entries(OGRE)) m.bones[n]?.scale.setScalar(v * (n === 'spine_03' ? 1 + (W - 1.5) * .2 : 1));
  root.updateMatrixWorld(true);
  const variant = spec.variant ?? 1, map = ogre ? R.maps.gray : R.maps[variant];
  char.traverse(o => {
    if (!o.isSkinnedMesh) return;
    let show = true, tint = ogre ? spec.skin : null, mp = map;
    if (o.name === 'stick') show = spec.weapon === 'club' && type === 'puglin';
    else if (o.name === 'mace') { show = type === 'imp' && !spec.weapon; tint = null; mp = null; }
    else if (o.name === 'cloth') tint = ogre ? spec.bottom ?? 0x3a3028 : null;
    else if (o.name === 'chains' || o.name === 'collar') { show = !spec.beard; if (ogre) { tint = 0x7a7468; } }
    o.visible = show;
    if (show) { o.material = skinMat(o.material, mp, tint); o.userData.base = o.material; m.meshes.push(o); }
  });
  if (ogre) {
    sock(m, 'Head', cached(`og${spec.beard}_${spec.hat}_${spec.hatColor}_${spec.horn}`, () => ogreHead(spec)));
    if (spec.fur) { sock(m, 'spine_03', cached(`fu${spec.fur}`, () => furTufts(spec.fur)), [0, .02, 0]); for (const b of ['upperarm_l', 'upperarm_r']) sock(m, b, cached(`fa${spec.fur}`, () => furTufts(spec.fur))).scale.multiplyScalar(.62); }
  } else if (spec.hat) {
    const [y, z, s] = L.hat, geo = cached(`mh${type}_${spec.hat}_${spec.hatColor}_${spec.hatColor2}`, () => { const q = new Kit(64, { auto: false }); q.at(0, y, z, 0, s); hat(q, spec, .3); q.pop(); return q.build(); });
    sock(m, 'Head', geo);
  }
  if (spec.cape) { const t = cached(`mc${spec.cape}_${spec.cape2}`, () => torsoParts({ cape: spec.cape, cape2: spec.cape2 }, .86)); if (t) sock(m, 'spine_03', t, [0, .02, -.06]); }
  if (spec.weapon && !(spec.weapon === 'club' && type === 'puglin')) handSock(m, 'r', weaponGeo(spec.weapon, spec.weaponColor));
  m.wpn = spec.weapon ?? (type === 'imp' ? 'mace' : undefined);
  if (type === 'imp') {
    const a = sock(m, 'spine_03', cached('iwl', () => impWing(-1)), [-.08, .1, -.14]), b = sock(m, 'spine_03', cached('iwr', () => impWing(1)), [.08, .1, -.14]);
    m.fly = true; m.wingL = a.children[0]; m.wingR = b.children[0];
    m.onAnim = (q, x) => {
      const f = Math.sin(x.t * 13) * .55 + .12;
      q.wingL.rotation.set(0, .34, -f); q.wingR.rotation.set(0, -.34, f);
      if (!(x.dead > 0)) q.inner.position.y = .95 + Math.sin(x.t * 3) * .16;
    };
  }
  m.mixer = new THREE.AnimationMixer(char);
  m.shadow = makeBlob(1.05 * S * (ogre ? 1.25 : 1)); root.add(m.shadow);
  play(m, 'idle', 0); m.mixer.update(h % 100 / 37);
  return m;
}

const M4 = new THREE.Matrix4(), B1 = 0xe6dfc8, B2 = 0xc7bea3;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const SIDE = [['l', -1], ['r', 1]], FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

function rigidGeo(skin, make) {
  const sk = skin.skeleton, id = {}, J = {}, v = new THREE.Vector3(), geos = [], unbind = new THREE.Matrix4().copy(skin.bindMatrix).invert();
  sk.bones.forEach((b, i) => { id[b.name] = i; v.setFromMatrixPosition(M4.copy(sk.boneInverses[i]).invert()).applyMatrix4(unbind); J[b.name] = [v.x, v.y, v.z]; });
  const part = (bone, fn) => {
    if (id[bone] === undefined) return;
    const k = new Kit(90 + geos.length, { auto: false }); fn(k);
    const g = k.build(), n = g.attributes.position?.count ?? 0; if (!n) return;
    const si = new Uint8Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = id[bone]; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); geos.push(g);
  };
  make(part, J);
  return geos.length ? mergeGeometries(geos) : null;
}

const nub = (k, r, p, c, o = {}) => k.oct(r, p[0], p[1], p[2], c, { mat: 'bone', ...o });
const limb = (k, a, b, r, c = B1) => {
  k.tube([a, mix(a, b, .18), mix(a, b, .5), mix(a, b, .82), b], [r * 1.02, r * .66, r * .54, r * .66, r * .94], c, { mat: 'bone', seg: 6, sub: 1 });
  nub(k, r * 1.22, a, B2); nub(k, r * 1.08, b, B2);
};
const twin = (k, a, b, r, off) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(), n = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > .8 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)).normalize();
  const at = (p, f) => [p[0] + n.x * f, p[1] + n.y * f, p[2] + n.z * f];
  for (const q of [-1, 1]) k.tube([at(a, off * q), at(mix(a, b, .5), off * q * .7), at(b, off * q * .6)], [r, r * .72, r * .9], B1, { mat: 'bone', seg: 4, sub: 1 });
};

function boneBody(part, J, spec, u) {
  part('Head', k => { k.at(J.Head[0], J.Head[1] + .1 * u, J.Head[2] + .025 * u, 0, .74 * u); skullHead(k, spec); k.pop(); });
  const P = J.pelvis, S1 = J.spine_01, S2 = J.spine_02, S3 = J.spine_03, N = J.neck_01, Wd = spec.wide || 1;
  part('pelvis', k => {
    for (const x of [-1, 1]) { k.ball(.078, x * .085, P[1] + .035, P[2] - .01, B2, { mat: 'bone', sx: .7, sy: 1.12, sz: 1.05, rz: x * .34 }); k.tube([[x * .03, P[1] - .05, P[2] + .05], [x * .085, P[1] - .075, P[2] + .03], [x * .115, P[1] - .035, P[2] - .025]], [.016, .02, .018], B1, { mat: 'bone', seg: 5, sub: 2 }); }
    k.ball(.05, 0, P[1] + .005, P[2] - .05, B2, { mat: 'bone', sy: 1.3, sz: .7 });
  });
  const vert = (k, a, b, n) => { for (let i = 0; i < n; i++) { const q = mix(a, b, (i + .5) / n); k.oct(.024, q[0], q[1], q[2] - .018, B1, { mat: 'bone', sy: .58, sx: 1.1 }); k.cone(.012, .034, q[0], q[1], q[2] - .05, B2, { mat: 'bone', seg: 3, rx: -1.9 }); } };
  part('spine_01', k => { vert(k, P, S1, 3); vert(k, S1, S2, 2); });
  part('spine_02', k => vert(k, S2, S3, 3));
  part('spine_03', k => {
    vert(k, S3, N, 4);
    const top = S3[1] + .135, D = .112, z0 = S3[2] - .035;
    for (let i = 0; i < 7; i++) {
      const y = top - i * .043, R = (.118 + Math.sin((i + 1) / 8 * Math.PI) * .048) * Math.sqrt(Wd), zf = z0 + D + .03 - i * .002;
      for (const x of [-1, 1]) k.tube([[0, y + .012, z0 - .018], [x * R * .72, y + .004, z0 - .022], [x * R, y - .018, z0 + D * .5], [x * R * .7, y - .032, zf - .018], [x * .018, y - .022, zf]], [.0072, .0095, .0095, .008, .006], i % 2 ? B1 : 0xddd5bc, { mat: 'bone', seg: 4, sub: 2 });
    }
    k.loft([[top - .25, .012, .006], [top - .17, .022, .007], [top - .05, .024, .008], [top + .012, .017, .006]], 0, 0, z0 + D + .036, B1, { mat: 'bone', seg: 7 });
  });
  part('neck_01', k => vert(k, N, J.Head, 3));
  for (const [s, x] of SIDE) {
    const j = n => J[`${n}_${s}`];
    part(`clavicle_${s}`, k => { k.tube([[x * .012, j('clavicle')[1] + .004, j('clavicle')[2] + .05], mix(j('clavicle'), j('upperarm'), .55), j('upperarm')], [.009, .011, .012], B1, { mat: 'bone', seg: 5 }); k.ball(.046, j('upperarm')[0] - x * .034, j('upperarm')[1] - .03, j('upperarm')[2] - .035, B2, { mat: 'bone', sz: .36, sy: 1.08 }); });
    part(`upperarm_${s}`, k => limb(k, j('upperarm'), j('lowerarm'), .0185));
    part(`lowerarm_${s}`, k => twin(k, j('lowerarm'), j('hand'), .0092, .0102));
    part(`hand_${s}`, k => { nub(k, .021, j('hand'), B2, { sy: .7 }); for (const f of FINGERS) { const a = J[`${f}_01_${s}`]; if (a) k.tube([mix(j('hand'), a, .2), a], [.0058, .0048], B1, { mat: 'bone', seg: 3, sub: 1 }); } });
    for (const f of FINGERS) for (let i = 1; i <= 3; i++) { const a = J[`${f}_0${i}_${s}`], b = J[`${f}_0${i + 1}_${s}`] ?? J[`${f}_04_leaf_${s}`]; if (a && b) part(`${f}_0${i}_${s}`, k => { k.tube([a, b], [.0052 - i * .0005, .0038 - i * .0004], B1, { mat: 'bone', seg: 3, sub: 1 }); }); }
    part(`thigh_${s}`, k => { limb(k, j('thigh'), j('calf'), .027); nub(k, .031, [j('thigh')[0] - x * .018, j('thigh')[1] + .02, j('thigh')[2]], B2); });
    part(`calf_${s}`, k => { twin(k, j('calf'), j('foot'), .0142, .0126); nub(k, .031, j('calf'), B2, { sy: .7 }); });
    part(`foot_${s}`, k => { const a = j('foot'), b = j('ball'); nub(k, .024, [a[0], a[1] - .004, a[2] - .008], B2, { sz: 1.25 }); for (const o of [-.024, -.012, 0, .012, .024]) k.tube([[a[0] + o * .7, a[1] - .01, a[2] + .012], [b[0] + o * 1.22, b[1], b[2]]], [.0064, .0052], B1, { mat: 'bone', seg: 3, sub: 1 }); });
    part(`ball_${s}`, k => { const b = j('ball'); for (const o of [-.03, -.015, 0, .015, .03]) k.tube([[b[0] + o, b[1], b[2]], [b[0] + o * 1.08, b[1] - .004, b[2] + .043 - Math.abs(o) * .4]], [.0058, .0034], B1, { mat: 'bone', seg: 3, sub: 1 }); });
  }
}

function armorPlates(part, J, c, skull) {
  const M = { mat: 'metal', c2: 0xdde2f4, seg: 10, sub: 1 }, G2 = 0xd8a33c;
  for (const [s] of SIDE) {
    const j = n => J[`${n}_${s}`];
    part(`lowerarm_${s}`, k => { const a = j('lowerarm'), b = j('hand'); k.tube([mix(a, b, .14), mix(a, b, .52), mix(a, b, .94)], [.043, .046, .036], c, M); k.torus(.037, .0062, ...mix(a, b, .94), G2, { rz: HP, mat: 'metal', seg: 12 }); });
    part(`calf_${s}`, k => { const a = j('calf'), b = j('foot'); k.tube([mix(a, b, .06), mix(a, b, .42), mix(a, b, .92)], [.054, .06, .044], c, M); k.ball(.058, a[0], a[1], a[2] + .012, c, { mat: 'metal', c2: 0xdde2f4 }); });
    part(`foot_${s}`, k => { const a = j('foot'), b = j('ball'); k.tube([[a[0], a[1] + .01, a[2] - .03], mix(a, b, .6), [b[0], b[1] - .002, b[2] + .03]], [.05, .05, .036], c, M); });
    if (!skull) {
      part(`thigh_${s}`, k => { const a = j('thigh'), b = j('calf'); k.tube([mix(a, b, .1), mix(a, b, .5), mix(a, b, .92)], [.072, .068, .054], c, M); });
      part(`upperarm_${s}`, k => { const a = j('upperarm'), b = j('lowerarm'); k.tube([mix(a, b, .32), mix(a, b, .64), mix(a, b, .94)], [.05, .05, .043], c, M); });
      part(`hand_${s}`, k => k.ball(.046, ...mix(j('hand'), J[`middle_01_${s}`], .5), c, { mat: 'metal', sy: .62 }));
    }
  }
}

function bandages(part, J, c) {
  const band = (k, a, b, r0, r1, n) => { for (let i = 0; i < n; i++) { const t = (i + .5) / n, q = mix(a, b, t - .06), p = mix(a, b, t + .06), r = (r0 + (r1 - r0) * t) * (1 + (i % 3) * .035); k.tube([q, p], [r * .9, r * .93], i % 2 ? c : 0xb8a884, { mat: 'cloth', seg: 8, sub: 1 }); } };
  for (const [s] of SIDE) {
    const j = n => J[`${n}_${s}`];
    part(`upperarm_${s}`, k => band(k, j('upperarm'), j('lowerarm'), .054, .044, 5));
    part(`lowerarm_${s}`, k => band(k, j('lowerarm'), j('hand'), .044, .033, 5));
    part(`thigh_${s}`, k => band(k, j('thigh'), j('calf'), .078, .056, 6));
    part(`calf_${s}`, k => band(k, j('calf'), j('foot'), .056, .04, 6));
  }
  part('spine_02', k => band(k, [0, J.spine_01[1], J.spine_02[2]], [0, J.spine_03[1] + .1, J.spine_03[2]], .142, .158, 8));
  part('Head', k => { const h = J.Head; band(k, [h[0], h[1] + .015, h[2] + .012], [h[0], h[1] + .185, h[2] + .012], .1, .095, 5); });
}

/** Skelette, Ritter ohne Gesicht und Mumien: echtes Rig, eigene Knochen und Rüstungsteile. */
export function dressUndead(m, char) {
  const s = m.spec, ref = char.getObjectByName('skin');
  const key = `ud${s.skull}_${s.eye}_${s.armor}_${s.bandage}_${s.top}_${s.wide}_${m.fem}`;
  const geo = cached(key, () => rigidGeo(ref, (part, J) => {
    const u = 1 / BASE[m.fem ? 'f' : 'm'].k;
    if (s.skull) boneBody(part, J, s, u);
    if (s.armor) armorPlates(part, J, s.armor, !!s.skull);
    if (s.bandage) bandages(part, J, s.top ?? 0xc8b890);
  }));
  if (!geo) return;
  const x = new THREE.SkinnedMesh(geo, MAT.solid);
  x.position.copy(ref.position); x.quaternion.copy(ref.quaternion); x.scale.copy(ref.scale);
  ref.parent.add(x); x.bind(ref.skeleton, ref.bindMatrix);
  x.frustumCulled = false; x.castShadow = true; x.receiveShadow = true; m.meshes.push(x);
}

export { rigidGeo };
export function makeMonster(spec) {
  if (!HUMAN.ready) return null;
  if (CREATURES.includes(spec.kind)) return makeCreature(spec);
  if (spec.rig && MONSTER.ready) return makeRig(spec);
  if (spec.skull || spec.noFace || spec.bandage || spec.gait) return makeHuman(spec, dressUndead);
  return null;
}
