import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/addons/GLTFLoader.js';
import * as SkeletonUtils from '../../vendor/addons/SkeletonUtils.js';
import { Kit, MAT } from '../core/gfx.js';
import { strHash, clamp } from '../core/util.js';
import { G } from '../game/state.js';
import { weapon, hat, makeBlob } from './models.js';

// Figuren und Animationen: CC0 von Quaternius, Kleidung in tools/bake_chars.py gebaut.
const V = 1, HEIGHT = 2.9, HP = Math.PI / 2;
const url = p => new URL(`../../assets/${p}?v=${V}`, import.meta.url).href;
export const BASE = {}, CLIPS = {};
const MATS = new Map();
let clothMap = null;
export const HUMAN = { ready: false };

export async function loadCharacters(progress) {
  const loader = new GLTFLoader();
  const [male, female, meta, bin] = await Promise.all([
    loader.loadAsync(url('chars/male.glb')), loader.loadAsync(url('chars/female.glb')),
    fetch(url('chars/anims.json')).then(r => r.json()), fetch(url('chars/anims.bin')).then(r => r.arrayBuffer()),
  ]);
  progress?.(.6);
  for (const c of meta.clips) {
    const tracks = [];
    for (const [b, kind, n, off] of c.t) {
      const times = new Float32Array(bin.slice(off, off + n * 4)), name = meta.bones[b];
      if (kind === 0) {
        const raw = new Int16Array(bin.slice(off + n * 4, off + n * 4 + n * 8)), q = new Float32Array(n * 4);
        for (let i = 0; i < q.length; i++) q[i] = raw[i] / 32767;
        tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, q));
      } else tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, new Float32Array(bin.slice(off + n * 4, off + n * 4 + n * 12))));
    }
    CLIPS[c.n] = new THREE.AnimationClip(c.n, c.d, tracks);
  }
  for (const [key, gltf] of [['m', male], ['f', female]]) {
    const s = gltf.scene; s.updateMatrixWorld(true);
    const box = new THREE.Box3();
    s.traverse(o => { if (o.isSkinnedMesh && o.name === 'skin') { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; o.material.metalness = 0; o.material.metalnessMap = null; o.material.roughness = o.name === 'eyes' ? .22 : o.name === 'skin' ? .68 : .8; o.material.needsUpdate = true; } });
    const boots = s.getObjectByName('boots'); boots.geometry.computeBoundingBox();
    const h = box.max.y - Math.min(box.min.y, boots.geometry.boundingBox.min.y);
    BASE[key] = { scene: s, k: HEIGHT / h, foot: -Math.min(box.min.y, boots.geometry.boundingBox.min.y) * HEIGHT / h };
  }
  const tl = new THREE.TextureLoader();
  clothMap = await tl.loadAsync(url('tex/cloth_c.webp'));
  clothMap.wrapS = clothMap.wrapT = THREE.RepeatWrapping; clothMap.repeat.set(7, 7); clothMap.colorSpace = THREE.SRGBColorSpace; clothMap.anisotropy = 4;
  HUMAN.ready = true;
  progress?.(1);
}

const REF_SKIN = new THREE.Color(0xd8b48e), _c = new THREE.Color();
function clothMat(hex, rough = .92, metal = 0) {
  const key = `c${hex}_${rough}_${metal}`;
  let m = MATS.get(key);
  if (!m) { _c.set(hex).getHSL(HS); _c.setHSL(HS.h, HS.s * .78, HS.l); m = new THREE.MeshStandardMaterial({ color: _c.clone(), map: clothMap, roughness: rough, metalness: metal, side: THREE.DoubleSide }); MATS.set(key, m); }
  return m;
}
const HS = { h: 0, s: 0, l: 0 };
function tinted(base, key, color) {
  const id = `${base.uuid}_${key}`;
  let m = MATS.get(id);
  if (!m) { m = base.clone(); m.color.copy(color); MATS.set(id, m); }
  return m;
}

/* Befestigt ein Teil so an einem Knochen, dass die Achsen der Figur aus der Ruhepose gelten. */
const qa = new THREE.Quaternion(), va = new THREE.Vector3();
export function sock(m, bone, geo, offset) {
  const b = m.bones[bone], g = new THREE.Group(), S = m.inner.scale.x;
  b.getWorldQuaternion(qa); g.quaternion.copy(qa).invert();
  b.getWorldScale(va); g.scale.set(S / va.x, S / va.y, S / va.z);
  if (offset) { va.set(offset[0] * S / va.x, offset[1] * S / va.y, offset[2] * S / va.z).applyQuaternion(g.quaternion); g.position.copy(va); }
  b.add(g);
  if (geo) { const x = new THREE.Mesh(geo, MAT.solid); x.frustumCulled = false; x.castShadow = true; x.receiveShadow = true; g.add(x); m.meshes.push(x); }
  return g;
}
/** Griff in der Faust: Die Waffe zeigt von der kleinen Finger-Seite zur Daumen-Seite. */
export function handSock(m, side, geo) {
  const b = m.bones[`hand_${side}`], S = m.inner.scale.x, f = m.bones[`middle_01_${side}`].position.clone(), a = m.bones[`index_01_${side}`].position.clone().sub((m.bones[`pinky_01_${side}`] ?? m.bones[`ring_01_${side}`]).position).normalize();
  const fd = f.clone().normalize(), y = new THREE.Vector3().crossVectors(a, fd).normalize(), x = new THREE.Vector3().crossVectors(y, a).normalize(), g = new THREE.Group();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, a));
  b.getWorldScale(va); g.scale.set(S / va.x, S / va.y, S / va.z);
  g.position.copy(f).multiplyScalar(1.28).addScaledVector(y, side === 'r' ? 0 : 0);
  b.add(g);
  if (geo) { const q = new THREE.Mesh(geo, MAT.solid); q.frustumCulled = false; q.castShadow = true; g.add(q); m.meshes.push(q); }
  return g;
}

function headParts(s) {
  const k = new Kit(31, { auto: false });
  k.at(0, .1, .025, 0, .74);
  if (s.ears) for (const x of [-1, 1]) k.tube([[x * .19, .02, -.03], [x * .36, .1, -.06], [x * .55, .18, -.11], [x * .74, .28, -.16]], [.085, .08, .045, .004], s.skin ?? 0x5fae3f, { mat: 'skin', seg: 6, sub: 3 });
  if (s.tusks) for (const x of [-1, 1]) k.tube([[x * .08, -.2, .18], [x * .105, -.13, .225], [x * .1, -.05, .215]], [.03, .022, .003], 0xfff4dc, { mat: 'bone', seg: 5, sub: 3 });
  if (s.noFace) { k.ball(.285, 0, -.03, .035, s.skin ?? 0x161024, { mat: 'plain', sy: 1.14, sz: .98 }); for (const x of [-1, 1]) k.ball(.05, x * .105, .02, .296, s.eye ?? 0xff3a22, { glow: 1, sz: .45, sy: .7, rz: x * .24 }); }
  else if (s.eye && !s.skull) for (const x of [-1, 1]) k.ball(.034, x * .075, .035, .205, s.eye, { glow: 1, sz: .5 });
  if (s.hat) hat(k, s, .3);
  k.pop();
  return k.build();
}
export function torsoParts(s, W) {
  if (!s.armor && !s.cape) return null;
  const k = new Kit(32, { auto: false });
  if (s.armor) {
    k.loft([[-.46, .27 * W, .19, 0, .02], [-.2, .3 * W, .23, 0, .03], [.08, .36 * W, .26, 0, .03], [.27, .36 * W, .23, 0, .01], [.4, .24 * W, .16], [.46, .13, .11]], 0, 0, 0, s.armor, { mat: 'metal', c2: 0xc8cede, seg: 20 });
    k.tube([[0, -.42, .225], [0, -.05, .29], [0, .3, .245]], .017, 0xdde2f4, { mat: 'metal', seg: 5 });
    for (let i = 0; i < 3; i++) k.torus(.28 * W + i * .02, .014, 0, -.36 + i * .17, .03, 0x3c4152, { rx: HP, mat: 'metal', seg: 20, sy: .76 });
  }
  if (s.cape) {
    const rows = [];
    for (let i = 0; i <= 9; i++) { const t = i / 9, y = .36 - t * 2.05, w = (.3 + t * .24) * W, row = []; for (let j = 0; j <= 10; j++) { const u = j / 10 * 2 - 1; row.push([u * w, y, -.17 - t * .24 + (u * u - 1) * .08 - Math.cos(u * 8.5 + .4) * .05 * (.2 + t)]); } rows.push(row); }
    k.sheet(rows, s.cape, { mat: 'cloth', c2: s.cape2 ?? s.cape });
    for (const x of [-1, 1]) k.ball(.04, x * .17, .36, .09, 0xd8a33c, { mat: 'metal', sz: .6 });
  }
  return k.build();
}
function hipParts(s, W) {
  const k = new Kit(33, { auto: false });
  k.torus(.245 * W, .034, 0, .1, .012, s.belt ?? 0x3c2830, { rx: HP, seg: 20, mat: 'cloth', sy: .78 });
  k.box(.1, .085, .03, 0, .1, .205, 0xd8a33c, { mat: 'metal', bevel: .01 });
  k.box(.14, .17, .05, -.21 * W, -.02, .15, 0x4a2c20, { mat: 'cloth', ry: -.55, bevel: .016 });
  if (s.apron) {
    const rows = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, y = .4 - t * 1.05, w = .2 + t * .08, Z = .2 + t * .07; rows.push([-1, -.5, 0, .5, 1].map(u => [u * w * W, y, Z - u * u * .05 + Math.sin(u * 5 + t * 3) * .007])); }
    k.sheet(rows, s.apron, { mat: 'cloth' });
  }
  return k.build();
}
function shoulder(s) {
  const k = new Kit(34, { auto: false });
  k.ball(.2, 0, .03, 0, s.armor, { mat: 'metal', sy: .84 }); k.torus(.185, .017, 0, -.04, 0, 0xd8a33c, { rx: HP, mat: 'metal', seg: 14 });
  return k.build();
}
function lanternGeo() {
  const k = new Kit(35, { auto: false }), y = 0;
  k.tube([[-.05, .13, 0], [-.075, y, 0], [0, y - .09, 0], [.075, y, 0], [.05, .13, 0]], .011, 0x2a2030, { mat: 'metal', seg: 4, sub: 2 });
  k.loft([[y - .2, .06], [y - .16, .135], [y - .13, .1], [y - .11, .04]], 0, 0, 0, 0x2a2030, { mat: 'metal', seg: 12, sub: 2 });
  k.loft([[y - .49, .112], [y - .42, .118], [y - .24, .092], [y - .19, .075]], 0, 0, 0, 0xffc445, { glow: 1, seg: 12, sub: 2 });
  k.ball(.052, 0, y - .34, 0, 0xfff4d0, { glow: 1 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + .78; k.tube([[Math.cos(a) * .118, y - .49, Math.sin(a) * .118], [Math.cos(a) * .125, y - .4, Math.sin(a) * .125], [Math.cos(a) * .082, y - .19, Math.sin(a) * .082]], .0115, 0x2a2030, { mat: 'metal', seg: 4, sub: 2 }); }
  k.loft([[y - .55, .02], [y - .53, .125], [y - .49, .14], [y - .47, .1]], 0, 0, 0, 0x2a2030, { mat: 'metal', seg: 12, sub: 2 });
  return k.build();
}
function shieldGeo(s) {
  const k = new Kit(36, { auto: false }), c = s.shieldColor ?? 0x6a4a34;
  k.loft([[-.07, .02], [-.06, .46, .52], [-.02, .52, .58], [0, .51, .57], [.014, .02]], 0, 0, 0, c, { mat: 'wood', rz: -HP, seg: 18, c2: 0x8a6a4c, sub: 2 });
  k.torus(.53, .028, .03, 0, 0, 0xb8bcc8, { ry: HP, mat: 'metal', seg: 20, sy: 1.1 });
  k.ball(.12, .08, 0, 0, 0xd8a33c, { mat: 'metal', sx: .55 });
  return k.build();
}
const GEO = new Map();
export const cached = (key, make) => { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); };
export const weaponGeo = (type, c) => cached(`w${type}_${c}`, () => { const k = new Kit(37, { auto: false }); weapon(k, type, c, 0, 0, 0, true); const g = k.build(); if (type === 'bow') { g.rotateZ(-HP); g.rotateY(-HP / 2); } else if (['staff', 'spear', 'scythe'].includes(type)) g.rotateY(-1.05); return g; });

export function makeHuman(spec, dress) {
  const h = strHash(JSON.stringify(spec)), fem = spec.skull ? false : spec.fem ?? (spec.long ? true : spec.beard || (spec.wide || 1) > 1.1 ? false : !!(h & 1)), src = BASE[fem ? 'f' : 'm'], S = spec.scale ?? 1, W = spec.wide || 1;
  const root = new THREE.Group(), inner = new THREE.Group(), char = SkeletonUtils.clone(src.scene);
  root.add(inner); inner.add(char); inner.scale.setScalar(S);
  char.scale.set(src.k * (1 + (W - 1) * .6), src.k, src.k * (1 + (W - 1) * .45)); char.position.y = src.foot;
  const m = { root, inner, spec, kind: 'human', skinned: true, meshes: [], bones: {}, base: 0, height: HEIGHT * S, flash: 0, seatY: 1.42 * S, lt: 0, act: null, cur: '', actions: {}, skip: 0, acc: 0, fem, gait: spec.gait, stance: (!!spec.skull || !!spec.noFace) && !!spec.weapon && !['staff', 'bow'].includes(spec.weapon) };
  root.updateMatrixWorld(true);
  char.traverse(o => { if (o.isBone) m.bones[o.name] = o; });
  const skin = _c.set(spec.skin ?? (spec.noFace ? 0x161024 : 0xd8b48e)).clone(); skin.r = Math.min(1.4, skin.r / REF_SKIN.r); skin.g = Math.min(1.4, skin.g / REF_SKIN.g); skin.b = Math.min(1.4, skin.b / REF_SKIN.b); skin.multiplyScalar(1.9);
  const covered = ['helm', 'hood', 'horns', 'fur', 'turban', 'mushroom'].includes(spec.hat), goblin = (spec.ears && !spec.hair) || spec.noFace || spec.bandage;
  const hairC = new THREE.Color(spec.hair ?? [0x2e2018, 0x4a2c20, 0x6a4a2c, 0x20181a][h >>> 3 & 3]).multiplyScalar(2.1);
  const hairName = goblin ? '' : fem ? (covered ? 'hair_buzzedfemale' : spec.long || (h >>> 5 & 1) ? 'hair_long' : 'hair_buns') : (covered || (h >>> 5 & 1) ? 'hair_buzzed' : 'hair_simpleparted');
  char.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const n = o.name;
    let show = true;
    if (n === 'skin') o.material = tinted(o.material, `s${spec.skin ?? 0}`, skin);
    else if (n === 'top') o.material = clothMat(spec.top ?? 0x3a4a8a);
    else if (n === 'legs') { o.material = clothMat(spec.bottom ?? 0x2a2a44); show = !spec.robe; }
    else if (n === 'boots') { o.material = clothMat(spec.boots ?? 0x2a1c20, .7); show = !spec.robe; }
    else if (n === 'tunic') { o.material = clothMat(spec.top2 ?? spec.top ?? 0x3a4a8a); show = !spec.robe; }
    else if (n === 'robe') { o.material = clothMat(spec.top3 ?? spec.top2 ?? spec.top ?? 0x3a4a8a); show = !!spec.robe; }
    else if (n === 'hair_beard') { show = !!spec.beard && !fem; if (show) o.material = tinted(o.material, `b${spec.beard}`, new THREE.Color(spec.beard).multiplyScalar(2.1)); }
    else if (n.startsWith('hair_')) { show = n === hairName; if (show) o.material = tinted(o.material, `h${hairC.getHex()}`, hairC); }
    else if (n === 'brows') { show = !goblin; if (show) o.material = tinted(o.material, `h${hairC.getHex()}`, hairC); }
    else if (n === 'eyes') show = !spec.eye;
    if (spec.skull) show = false;
    o.visible = show;
    if (show) { o.userData.base = o.material; m.meshes.push(o); }
  });
  sock(m, 'Head', cached(`h${spec.hat}_${spec.hatColor}_${spec.hatColor2}_${spec.ears}_${spec.tusks}_${spec.eye}_${spec.skin}_${spec.noFace}_${spec.skull}`, () => headParts(spec)));
  const t = cached(`t${spec.armor}_${spec.cape}_${spec.cape2}_${W}`, () => torsoParts(spec, W)); if (t) sock(m, 'spine_03', t);
  if (!spec.skull) sock(m, 'pelvis', cached(`p${spec.belt}_${spec.apron}_${W}`, () => hipParts(spec, W)));
  if (spec.armor) for (const side of ['l', 'r']) sock(m, `upperarm_${side}`, cached(`sh${spec.armor}`, () => shoulder(spec)));
  if (spec.weapon) { m.wSock = handSock(m, 'r', weaponGeo(spec.weapon, spec.weaponColor)); m.wType = spec.weapon; }
  if (spec.lantern) { m.lantern = handSock(m, 'l', null); const q = new THREE.Mesh(cached('lantern', lanternGeo), MAT.solid); q.frustumCulled = false; q.castShadow = true; m.lantern.add(q); m.meshes.push(q); m.lanternMesh = q; }
  else if (spec.shield) sock(m, 'lowerarm_l', cached(`sd${spec.shieldColor}`, () => shieldGeo(spec)), [.13, -.1, 0]);
  dress?.(m, char);
  m.mixer = new THREE.AnimationMixer(char);
  m.shadow = makeBlob(1.05 * S); root.add(m.shadow);
  play(m, 'idle', 0); m.mixer.update(h % 100 / 37);
  return m;
}

export function play(m, n, fade = .16, loop = true, ts = 1) {
  if (m.cur === n) { m.act.timeScale = ts; return m.act; }
  const a = m.actions[n] ??= m.mixer.clipAction((m.clips ?? CLIPS)[n]);
  a.reset(); a.paused = false; a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = !loop; a.timeScale = ts; a.setEffectiveWeight(1); a.play();
  if (m.act && fade > 0) a.crossFadeFrom(m.act, fade, false); else if (m.act) m.act.stop();
  m.act = a; m.cur = n;
  return a;
}
const seek = (a, k) => { a.paused = true; a.time = a.getClip().duration * clamp(k, 0, .999); };
const qb = new THREE.Quaternion();

/** a: { t, speed, attack (0..1 oder -1), combo, cast, block, dead (0..1), roll, ride, talk, air } */
export function animateHuman(m, a) {
  let dt = a.t - m.lt; m.lt = a.t; if (dt < 0 || dt > .25) dt = .016;
  const c = G.camera?.position, p = m.root.position, far = c ? (p.x - c.x) ** 2 + (p.z - c.z) ** 2 > 3600 : false;
  const atk = a.attack >= 0 ? a.attack : -1, wpn = m.wpn ?? m.spec.weapon, zombie = m.gait === 'zombie';
  if (a.dead > 0) { play(m, 'death', .12, false); m.inner.position.y = -Math.max(0, a.dead - .78) * 2.2; }
  else {
    m.inner.position.y = 0;
    if (a.roll > 0) seek(play(m, 'roll', .07, false), a.roll * .94);
    else if (atk >= 0) {
      const n = !wpn ? (a.combo === 1 ? 'punch2' : 'punch1') : wpn === 'bow' ? 'throw' : wpn === 'staff' ? 'cast' : ['great', 'hammer', 'club', 'axe', 'scythe'].includes(wpn) && !a.combo ? 'atkOld' : ['atk1', 'atk2', 'atk3'][a.combo || 0];
      seek(play(m, n, .07, false), .06 + atk * .86);
    } else if (m.hitT > 0 && !a.block && !a.ride) { m.hitT -= dt; play(m, zombie ? 'zombieHit' : m.spec.scale > 1.3 ? 'hitChest' : (m.skip & 1 ? 'hitHead' : 'hitChest'), .05, false, 1.5); }
    else if (a.cast > 0) seek(play(m, 'cast', .08, false), .2 + (1 - Math.min(1, a.cast)) * .6);
    else if (a.block) seek(play(m, 'block', .1, false), .34);
    else if (a.ride) play(m, 'sit', .2);
    else if (a.air) play(m, 'jumpLoop', .12);
    else if (a.talk) play(m, 'talk', .25);
    else if (m.fly) play(m, 'jumpLoop', .16);
    else if (zombie) { if (a.speed < .3) play(m, 'zombieIdle', .22); else play(m, 'zombieWalk', .18, true, clamp(a.speed / 2.6, .7, 1.7)); }
    else {
      const s = a.speed;
      if (s < .35) play(m, (a.combat || m.stance) && wpn && !['staff', 'hammer', 'bow'].includes(wpn) ? 'idleSword' : 'idle', .22);
      else if (s < 4.2) play(m, 'walk', .18, true, clamp(s / 2.5, .6, 1.5));
      else if (s < 12.6) play(m, 'jog', .16, true, clamp(s / 6.6, .75, 1.5));
      else play(m, 'sprint', .14, true, clamp(s / 13, .8, 1.5));
    }
  }
  m.onAnim?.(m, a);
  m.acc += dt;
  if (far && ++m.skip % 3) return;
  m.mixer.update(m.acc); m.acc = 0;
  if (m.lanternMesh) {
    // Die Laterne hängt immer senkrecht und pendelt leicht.
    m.lantern.getWorldQuaternion(qb).invert();
    m.lanternMesh.quaternion.copy(qb);
    m.lanternMesh.rotateZ(Math.sin(a.t * 2.4) * .09 + clamp(a.speed * .012, 0, .16) * Math.sin(a.t * 7));
    m.lanternMesh.rotateX(-clamp(a.speed * .018, 0, .3));
  }
}
