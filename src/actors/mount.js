import * as THREE from '../../vendor/three.module.js';
import { G } from '../game/state.js';
import { Input as I } from '../core/input.js';
import { Kit, MAT } from '../core/gfx.js';
import { makeBlob } from './models.js';
import { POI } from '../data/world.js';
import { clamp, damp, lerp, smooth, angDiff, TAU } from '../core/util.js';
import { resolve } from '../world/collision.js';
import { heightAt } from '../world/terrain.js';
import { groundY } from '../game/fx.js';

// Borke, ein zotteliger Moos-Elch. Der Sattel ist die Belohnung aus der Nebenquest s_borke.
const FUR = 0x5a4632, FUR2 = 0x7f6548, DARK = 0x33261c, MOSS = 0x3f8a58, MOSS2 = 0x76c982, ANT = 0xc8b990, ANT2 = 0xeadfbe, CAP = 0xc23a55, LEATHER = 0x4a2c20, CLOTH = 0x2743b8, GOLD = 0xd8a33c;
const BODY = 2.56, WALK_SPEED = 19, GALLOP_SPEED = 31, RADIUS = 1.12;
const v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), rot = new THREE.Quaternion(), eul = new THREE.Euler();

/** Verjüngter Ast mit leichter Biegung, für das Geweih. */
function limb(k, a, b, r0, r1, c) {
  const m = [(a[0] + b[0]) / 2 + (b[2] - a[2]) * .06, (a[1] + b[1]) / 2 + .03, (a[2] + b[2]) / 2 - (b[0] - a[0]) * .06];
  k.tube([a, m, b], [r0, (r0 + r1) * .52, r1], c, { mat: 'bone', seg: 6, sub: 3 });
}
const HP = Math.PI / 2, NK = () => new Kit(71, { auto: false }), mossPad = (k, x, y, z, r) => { k.blob(r, x, y, z, MOSS, { c2: MOSS2, j: .08, sy: .62, mat: 'leaf', uv: 1.3 }); k.leaves(x, y + r * .1, z, r, 26, MOSS, MOSS2, { size: r * .24, sy: .66 }); };
const capOn = (k, x, y, z, r) => {
  k.loft([[y - r * .9, .03], [y - r * .3, .035], [y, .05]], x, 0, z, 0xe8ded0, { mat: 'plaster', seg: 6, sub: 1 });
  k.loft([[y - .01, .03], [y + .01, r * .96], [y + r * .24, r], [y + r * .52, r * .62], [y + r * .72, .02]], x, 0, z, CAP, { mat: 'plaster', seg: 12, sub: 2, glow: .35, c2: 0xff7a90 });
  k.ball(r * .17, x + r * .35, y + r * .46, z + r * .2, 0xfff4dc, { glow: 1 });
};

function geoBody() {
  const k = NK();
  k.at(0, 0, 0, 0, 1, HP);
  k.loft([[-2.15, .08, .1, 0, -.04], [-1.92, .62, .68, 0, -.04], [-1.3, .9, .98, 0, .0], [-.4, .86, .93, 0, .05], [.45, .92, 1.03, 0, -.02], [1.12, .98, 1.17, 0, -.2], [1.62, .78, 1, 0, -.42], [1.92, .34, .5, 0, -.62]], 0, 0, 0, FUR, { mat: 'fur', c2: FUR2, seg: 22, uv: .9, j: .03, shape: (a, t) => 1 + Math.sin(a * 11 + t * 9) * .012 });
  k.pop();
  for (let i = 0; i < 16; i++) { const a = -1 + i / 15 * 2, x = a * .78, z = 1.32 + Math.cos(a * 2) * .12; k.tube([[x, .28 - Math.abs(a) * .16, z + .42], [x * 1.08, -.34 - Math.abs(a) * .1, z + .54], [x * 1.04, -.92 + Math.abs(a) * .2, z + .36]], [.13, .11, .008], FUR2, { mat: 'fur', seg: 5, sub: 2 }); }
  for (const [x, y, z, r] of [[.1, 1.26, 1.3, .38], [-.14, 1.22, .82, .34], [.3, .88, -1.02, .32], [-.3, .86, -1.3, .36], [.04, .8, -1.68, .28], [-.5, 1, .7, .26], [.52, 1.02, .98, .27]]) mossPad(k, x, y, z, r);
  for (const [x, z] of [[.34, -1.42], [-.2, -1.68]]) capOn(k, x, 1.05, z, .17);
  return k.build();
}
function geoTack() {
  const k = NK(), rows = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10 * 2 - 1, x = u * .96, y = .92 - u * u * .78; rows.push([-.95, -.5, 0, .5, .55].map(z => [x * (1 + Math.abs(z + .2) * .02), y + (1 - Math.abs(u)) * .04, z - .02 + Math.sin(u * 6 + z) * .012])); }
  k.sheet(rows, CLOTH, { mat: 'cloth', c2: 0x4f6ae0 });
  for (const x of [-1, 1]) {
    k.tube([[x * .88, .16, -.96], [x * .96, .15, -.45], [x * .92, .15, .06], [x * .86, .16, .54]], .022, GOLD, { mat: 'metal', seg: 5 });
    k.loft([[.04, .22, .13], [.2, .28, .17], [.5, .28, .17], [.62, .24, .14]], x * 1.08, 0, -.92, 0x6a4a2c, { mat: 'fur', c2: 0x8a6438, seg: 12, sub: 2 });
    k.sheet([[[x * 1.0, .63, -1.12], [x * 1.22, .64, -.92], [x * 1.0, .63, -.72]], [[x * 1.06, .4, -1.14], [x * 1.33, .42, -.92], [x * 1.06, .4, -.7]]], 0x5a3c26, { mat: 'fur' });
    k.ball(.035, x * 1.34, .42, -.92, GOLD, { mat: 'metal' });
    k.tube([[x * .44, 1.02, -.15], [x * .9, .7, -.13], [x * .98, .28, -.12]], .028, LEATHER, { mat: 'fur', seg: 4 });
    k.torus(.085, .018, x * .98, .16, -.12, GOLD, { ry: HP, mat: 'metal', seg: 10 });
  }
  k.at(0, 0, 0, 0, 1, HP);
  k.loft([[-.78, .1, .08, 0, -1.1], [-.62, .42, .2, 0, -1.06], [-.2, .44, .16, 0, -.98], [.2, .4, .16, 0, -.98], [.46, .34, .2, 0, -1.06], [.58, .08, .08, 0, -1.14]], 0, -.2, 0, LEATHER, { mat: 'fur', c2: 0x6f4530, seg: 14 });
  k.pop();
  k.tube([[-.36, 1.08, -.72], [0, 1.27, -.78], [.36, 1.08, -.72]], .07, 0x6f4530, { mat: 'fur', seg: 6 });
  k.tube([[0, 1.1, .27], [0, 1.3, .33], [0, 1.42, .24]], [.1, .07, .05], LEATHER, { mat: 'fur', seg: 7 });
  k.ball(.075, 0, 1.44, .22, GOLD, { mat: 'metal' });
  k.tube([[1.02, .2, .08], [1.05, .32, .08], [1.02, .42, .08]], .018, 0x2a2030, { mat: 'metal', seg: 4 });
  k.loft([[-.14, .1], [-.09, .13], [.1, .11], [.14, .07]], 1.02, .05, .08, 0xffc445, { glow: 1, seg: 9, sub: 1 });
  k.loft([[.14, .13], [.18, .14], [.26, .03]], 1.02, .05, .08, 0x2a2030, { mat: 'metal', seg: 9, sub: 1 });
  k.loft([[-.2, .03], [-.17, .14], [-.14, .11]], 1.02, .05, .08, 0x2a2030, { mat: 'metal', seg: 9, sub: 1 });
  return k.build();
}
function geoNeck() {
  const k = NK();
  k.tube([[0, -.42, -.28], [0, .12, .08], [0, .68, .42], [0, 1.28, .82]], [.86, .68, .5, .4], FUR, { mat: 'fur', c2: FUR2, seg: 16, uv: .9, sub: 3 });
  for (let i = 0; i < 13; i++) { const t = i / 12, y = -.1 + t * 1.26, z = -.5 + t * 1.1, side = i % 2 ? .05 : -.05; k.tube([[side, y, z], [side * 1.6, y + .12, z - .22], [side, y + .06, z - .42]], [.13, .11, .008], i % 3 ? MOSS : MOSS2, { mat: 'leaf', seg: 5, sub: 2 }); }
  for (let i = 0; i < 6; i++) { const u = i / 5 * 2 - 1; k.tube([[u * .22, .32, .7], [u * .25, -.1, .86], [u * .15, -.66, .84]], [.12, .09, .006], DARK, { mat: 'fur', seg: 5, sub: 2 }); }
  return k.build();
}
function geoHead() {
  const k = NK();
  k.at(0, 0, 0, 0, 1, HP);
  k.loft([[-.38, .16, .2, 0, .02], [-.14, .36, .4, 0, 0], [.22, .37, .38, 0, .02], [.56, .29, .3, 0, .09], [.94, .25, .26, 0, .15], [1.24, .26, .22, 0, .17], [1.42, .19, .15, 0, .16], [1.5, .05, .05, 0, .14]], 0, 0, 0, FUR, { mat: 'fur', c2: FUR2, seg: 16, uv: .9 });
  k.loft([[.72, .2, .05, 0, .36], [1.18, .22, .055, 0, .34], [1.38, .15, .05, 0, .3], [1.44, .03, .03, 0, .28]], 0, 0, 0, FUR2, { mat: 'fur', seg: 10 });
  k.pop();
  k.ball(.17, 0, -.1, 1.42, 0x1b1410, { mat: 'skin', sx: 1.3, sy: .72 });
  k.tube([[-.22, -.3, .98], [0, -.33, 1.34], [.22, -.3, .98]], .012, 0x120c0a, { mat: 'plain', seg: 4 });
  for (const x of [-1, 1]) {
    k.ball(.058, x * .11, -.04, 1.54, 0x050404, { mat: 'plain', sz: .6, sy: .75 });
    k.ball(.1, x * .33, .17, .42, 0x120c0a, { mat: 'plain', sz: .72 });
    k.ball(.07, x * .36, .17, .46, 0xffc445, { glow: 1, sz: .7 });
    k.ball(.03, x * .405, .18, .49, 0x0c0806, { mat: 'plain' });
    k.tube([[x * .24, .28, .34], [x * .36, .32, .42], [x * .44, .26, .54]], [.015, .045, .01], DARK, { mat: 'fur', seg: 4 });
    const ear = (u, v) => [x * (.32 + u * .6), .34 + u * .32 + v * Math.sin(u * Math.PI) * .13, -.14 - u * .18 + v * Math.sin(u * Math.PI) * .03];
    k.sheet([0, .25, .5, .75, 1].map(u => [ear(u, -1), ear(u, 0), ear(u, 1)]), FUR2, { mat: 'fur', c2: 0xc89a78 });
    const m = ([a, b, c]) => [x * a, b, c];
    k.tube([m([.22, .24, -.08]), m([.5, .52, -.14]), m([.74, .84, -.18]), m([1.02, 1.3, -.06]), m([1.16, 1.78, .24])], [.135, .115, .1, .08, .05], ANT, { mat: 'bone', seg: 8, sub: 3 });
    for (const [a, b] of [[[.6, .66, -.14], [.88, .94, .54]], [[.86, 1.06, -.12], [1.24, 1.62, -.56]], [[.98, 1.28, -.07], [.76, 1.98, -.24]], [[1.06, 1.5, .06], [1.56, 2.02, -.02]], [[1.16, 1.78, .24], [.98, 2.38, .34]], [[1.16, 1.78, .24], [1.54, 2.26, .58]]]) limb(k, m(a), m(b), .062, .01, ANT2);
    const palm = (u, v) => m([.84 + u * .32 + v * .13, 1.16 + u * .62 + v * .02, -.1 + u * .24 - v * .3]);
    k.sheet([0, .33, .66, 1].map(u => [palm(u, -1), palm(u, 0), palm(u, 1)]), ANT, { mat: 'bone', c2: ANT2 });
    for (const [a, b, c, r] of [[.82, 1.06, -.04, .17], [1.14, 1.54, -.2, .13], [1.2, 1.9, .16, .1]]) capOn(k, x * a, b, c, r);
    mossPad(k, x * .92, .86, -.18, .14); mossPad(k, x * 1.08, 1.24, -.13, .1);
  }
  mossPad(k, 0, .42, -.12, .24);
  return k.build();
}
function geoLegUp(back) {
  const k = NK();
  if (back) k.tube([[0, .18, .12], [0, -.14, .06], [0, -.56, -.14], [0, -.98, -.08]], [.5, .44, .27, .18], FUR, { mat: 'fur', c2: FUR2, seg: 12, uv: .9, sub: 3 });
  else k.tube([[0, .2, -.04], [0, -.2, .02], [0, -.66, .02], [0, -1, 0]], [.4, .35, .22, .17], FUR, { mat: 'fur', c2: FUR2, seg: 12, uv: .9, sub: 3 });
  k.ball(.19, 0, -1.02, 0, FUR2, { mat: 'fur', sy: 1.12 });
  return k.build();
}
function geoLegLow() {
  const k = NK();
  k.tube([[0, .02, 0], [0, -.3, -.015], [0, -.66, -.01], [0, -.84, .01]], [.17, .13, .105, .12], DARK, { mat: 'fur', c2: FUR, seg: 10, uv: 1, sub: 2 });
  k.ball(.15, 0, -.76, .01, FUR2, { mat: 'fur', sy: .85 });
  k.loft([[-1.11, .25, .31, 0, .08], [-1.07, .26, .32, 0, .08], [-.97, .21, .25, 0, .05], [-.87, .15, .17, 0, .02]], 0, 0, 0, 0x171210, { mat: 'bone', seg: 12, sub: 2 });
  k.box(.022, .19, .34, 0, -1.02, .2, 0x050404, { mat: 'plain', sharp: true });
  for (const x of [-1, 1]) k.ball(.05, x * .1, -.82, -.17, 0x171210, { mat: 'bone', sy: 1.3 });
  return k.build();
}
function geoTail() {
  const k = NK();
  k.tube([[0, .05, .05], [0, -.1, -.14], [0, -.42, -.2], [0, -.8, -.14]], [.14, .22, .19, .012], FUR2, { mat: 'fur', c2: DARK, seg: 9, sub: 3 });
  mossPad(k, 0, .02, -.03, .14);
  return k.build();
}
const part = (parent, geo, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (geo) { const m = new THREE.Mesh(geo, MAT.solid); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; g.add(m); }
  parent.add(g); return g;
};

export class Mount {
  constructor(scene) {
    const root = this.root = new THREE.Group(), tilt = this.tilt = new THREE.Group();
    root.add(tilt); root.visible = false; scene.add(root);
    root.add(makeBlob(2.6));
    this.body = part(tilt, geoBody(), 0, BODY, 0);
    this.tack = part(this.body, geoTack(), 0, 0, 0);
    this.neck = part(this.body, geoNeck(), 0, .62, 1.58);
    this.head = part(this.neck, geoHead(), 0, 1.2, .82);
    this.tail = part(this.body, geoTail(), 0, .42, -2.02);
    this.saddle = part(this.body, null, 0, 1.1, -.2);
    const front = geoLegUp(0), rear = geoLegUp(1), low = geoLegLow();
    // [x, z, Phase im Schritt, Phase im Galopp]
    this.legs = [[-.54, 1.26, 0, 0], [.54, 1.26, .5, .1], [-.58, -1.3, .75, .52], [.58, -1.3, .25, .62]].map(([x, z, walk, run], i) => {
      const up = part(tilt, i < 2 ? front : rear, x, 2.12, z), down = part(up, low, 0, -1.02, 0);
      return { up, down, walk, run, back: i > 1 };
    });
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0;
    this.reset();
  }
  get owned() { return !!G.flags.borke; }
  reset() {
    this.clearRider();
    Object.assign(this, { riding: false, gallop: false, placed: false, state: 'wait', speed: 0, phase: 0, pitch: 0, roll: 0, turn: 0, neckX: .2, headX: -.1, grazing: false, grazeT: 3, callCd: 0, stepT: 0, stuckT: 0, fleeT: 0, fleeYaw: 0, idleMouse: 0 });
    this.hits = new WeakMap();
    this.root.visible = false;
  }
  clearRider() {
    const m = G.player?.model;
    if (!this.riding || !m) return;
    m.root.rotation.set(0, G.player.yaw, 0);
    if (m.shadow) m.shadow.visible = true;
    m.hip?.rotation.set(0, 0, 0);
  }
  dist() { const P = G.player; return Math.hypot(this.x - P.x, this.z - P.z); }
  canMount() { return this.owned && this.placed && !this.riding && !G.inDungeon && this.state !== 'flee' && !G.player.dead; }
  spot() {
    // Freie Lichtung neben dem Urpilz, damit die Kamera der Zwischensequenz nicht in Bäumen hängt.
    if (!this.home) { const p = POI.l_riesenpilz, o = { x: p.x + 32, z: p.z - 39 }; resolve(o, 1.6); this.home = o; }
    return this.home;
  }
  placeAt(x, z, yaw = this.yaw) { this.x = x; this.z = z; this.y = groundY(x, z); this.yaw = yaw; this.speed = 0; this.placed = true; }
  placeNear(r) {
    const P = G.player;
    let best = null;
    for (let i = 0; i < 12; i++) {
      const a = P.camYaw + i * 1.13 * (i % 2 ? 1 : -1), o = { x: P.x + Math.sin(a) * r, z: P.z + Math.cos(a) * r };
      resolve(o, 1.5);
      if (Math.hypot(o.x - P.x, o.z - P.z) > r * .6 && heightAt(o.x, o.z) > -.3) { best = o; break; }
      best ??= o;
    }
    this.placeAt(best.x, best.z, Math.atan2(P.x - best.x, P.z - best.z));
  }
  unlock() {
    if (this.owned) return;
    G.flags.borke = 1;
    G.net?.send({ t: 'unlock' });
    G.player.removeItem('sattelzeug');
    this.state = 'come';
    G.ui.banner('Borke', 'Dein neues Reittier');
    G.ui.subtitle(G.touch?.on ? 'Die Elch-Taste ruft Borke und lässt dich aufsitzen. Joystick ganz drücken galoppiert.' : 'Q ruft Borke und lässt dich aufsitzen. Shift galoppiert, Leertaste springt, C springt ab.', 10);
    G.audio?.elk();
  }
  key() {
    const P = G.player;
    if (!this.owned) { G.ui.toast(G.quests.isDone('m02') ? 'Hirtin Wenke in Morgenkappe vermisst ihren Elch' : 'Du hast noch kein Reittier', 'warn'); G.audio?.deny(); return; }
    if (G.inDungeon) { G.ui.toast('Borke wartet draußen', 'warn'); G.audio?.deny(); return; }
    if (this.riding) { this.dismount(); return; }
    if (P.dead) return;
    if (this.state !== 'flee' && this.dist() < 6.5) { this.mount(); return; }
    this.call();
  }
  call() {
    if (this.callCd > 0) { G.ui.toast(`Borke beruhigt sich noch (${Math.ceil(this.callCd)} s)`, 'warn'); G.audio?.deny(); return; }
    if (this.dist() > 75) this.placeNear(42);
    this.state = 'come'; this.grazing = false; this.stuckT = 0;
    G.audio?.elk(); G.ui.toast('Borke kommt', 'quest');
  }
  mount() {
    const P = G.player;
    if (!this.canMount()) return;
    this.riding = true; this.state = 'ride'; this.grazing = false; this.idleMouse = 0;
    P.place(this.x, this.z, this.y); P.yaw = this.yaw; P.atkT = -1; P.rolling = 0; P.blocking = false; P.onGround = true;
    G.audio?.elk();
    G.fx.burst(this.x, this.y + 2.6, this.z, 0x76c982, 12, 3, .14, .5, -1);
  }
  dismount(o = {}) {
    if (!this.riding) return;
    const P = G.player;
    this.clearRider();
    this.riding = false; this.gallop = false; this.state = o.flee ? 'flee' : 'wait';
    const t = { x: P.x + Math.cos(P.yaw) * 2.5, z: P.z - Math.sin(P.yaw) * 2.5 };
    resolve(t, .72);
    P.place(t.x, t.z);
  }
  throwOff(src) {
    const P = G.player, ax = P.x - (src?.x ?? P.x - Math.sin(P.yaw)), az = P.z - (src?.z ?? P.z - Math.cos(P.yaw));
    this.fleeYaw = Math.atan2(ax, az); this.fleeT = 2.2; this.callCd = 6;
    this.dismount({ flee: true });
    P.invuln = Math.max(P.invuln, .9); P.vy = 7; P.onGround = false;
    G.ui.toast('Du wurdest abgeworfen', 'warn'); G.audio?.elk();
  }
  /** Fahrphysik. Wird aus Player.update aufgerufen, solange man im Sattel sitzt. */
  drive(P, dt, mx, mz, ml, play) {
    const wet = heightAt(P.x, P.z) < .25;
    this.gallop = play && ml > 0 && P.sprintOn && P.st > 1;
    let top = ml > 0 ? (this.gallop ? GALLOP_SPEED : WALK_SPEED) * P.speedMul : 0;
    if (wet) top *= .72;
    if (P.slowT > 0) top *= .7;
    if (ml > 0) {
      const diff = angDiff(P.yaw, Math.atan2(mx, mz)), rate = lerp(4.6, 2.5, smooth(8, GALLOP_SPEED, this.speed));
      P.yaw += clamp(diff, -rate * dt, rate * dt);
      top *= clamp(Math.cos(diff) * .7 + .55, .3, 1);
      this.turn = clamp(diff, -1, 1);
    } else this.turn = 0;
    const acc = top > this.speed ? (this.gallop ? 13 : 16) : ml > 0 ? 14 : 22;
    this.speed += clamp(top - this.speed, -acc * dt, acc * dt);
    P.vx = Math.sin(P.yaw) * this.speed; P.vz = Math.cos(P.yaw) * this.speed;
    if (play && I.hit('Space') && P.onGround && P.st >= 8) { P.vy = 14.6; P.onGround = false; P.st -= 8; G.audio?.jump(); }
    P.vy -= 30 * dt;
    const ox = P.x, oz = P.z;
    P.x += P.vx * dt; P.z += P.vz * dt; P.y += P.vy * dt;
    resolve(P, RADIUS);
    if (this.speed > 4 && dt > 0) { const real = Math.hypot(P.x - ox, P.z - oz) / dt; if (real < this.speed * .6) this.speed = Math.max(real, this.speed - 70 * dt); }
    const g = groundY(P.x, P.z);
    if (P.y <= g + (P.onGround ? .75 : 0) && P.vy <= 0) {
      if (!P.onGround) { G.audio?.hoof(1); G.fx.burst(P.x, g + .1, P.z, wet ? 0x8fb8ff : 0xb0a8a0, 8, 4, .2, .45, 0); }
      P.y = g; P.vy = 0; P.onGround = true;
    } else if (P.y > g + .85) P.onGround = false;
    this.x = P.x; this.y = P.y; this.z = P.z; this.yaw = P.yaw;
    if (play) this.trample(P);
  }
  trample(P) {
    if (this.speed < 19) return;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let any = false;
    for (const e of G.enemies.list) {
      if (e.dead || e.boss) continue;
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
      if (d > e.rad + 2.2 || dx * fx + dz * fz < -.4 || Math.abs(e.y - P.y) > 3.2) continue;
      if (G.t - (this.hits.get(e) ?? -9) < 1.1) continue;
      this.hits.set(e, G.t);
      e.hurt(P.atk * (.6 + this.speed / GALLOP_SPEED * .6), { kx: fx, kz: fz, knock: 9 });
      any = true;
    }
    if (any) { G.hitstop = .035; P.shake(.16); G.audio?.hit(); }
  }
  ai(dt) {
    const P = G.player, dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    let want = 0, ty = this.yaw;
    if (this.state === 'come') {
      if (d < 4.6) this.state = 'wait';
      else { ty = Math.atan2(dx, dz); want = d > 16 ? 27 : clamp(d * 1.6, 6, 16); }
    } else if (this.state === 'flee') {
      this.fleeT -= dt; want = 22; ty = this.fleeYaw;
      if (this.fleeT <= 0) this.state = 'wait';
    } else {
      this.grazeT -= dt;
      if (this.grazeT <= 0) { this.grazing = !this.grazing; this.grazeT = this.grazing ? 4 + Math.random() * 4 : 3 + Math.random() * 5; }
    }
    this.speed = damp(this.speed, want, want > this.speed ? 3.2 : 6, dt);
    this.yaw += angDiff(this.yaw, ty) * Math.min(1, dt * 4.5);
    const ox = this.x, oz = this.z;
    this.x += Math.sin(this.yaw) * this.speed * dt; this.z += Math.cos(this.yaw) * this.speed * dt;
    resolve(this, 1.25);
    this.y = damp(this.y, groundY(this.x, this.z), 16, dt);
    if (this.state === 'come' && dt > 0) {
      this.stuckT = Math.hypot(this.x - ox, this.z - oz) / dt < 2 && this.speed > 4 ? this.stuckT + dt : 0;
      if (this.stuckT > 1.1) { this.placeNear(8); this.stuckT = 0; this.state = 'wait'; }
    }
  }
  pose(dt) {
    const P = G.player, sp = this.speed, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), air = this.riding && !P.onGround;
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.y = this.yaw;
    const slope = clamp(Math.atan2(groundY(this.x - fx * 1.8, this.z - fz * 1.8) - groundY(this.x + fx * 1.8, this.z + fz * 1.8), 3.6), -.42, .42);
    this.pitch = damp(this.pitch, air ? clamp(-P.vy * .03, -.35, .35) : slope, 9, dt);
    this.roll = damp(this.roll, this.riding ? -this.turn * sp * .012 : 0, 6, dt);
    this.tilt.rotation.set(this.pitch, 0, this.roll);

    const run = smooth(19, 26, sp), rate = .55 + sp * lerp(.1, .075, run), amp = clamp(sp / 7) * lerp(.62, .92, run);
    if (sp > .25) this.phase = (this.phase + rate * dt) % 1;
    for (const l of this.legs) {
      const a = (this.phase + lerp(l.walk, l.run, run)) * TAU;
      if (air) {
        l.up.rotation.x = damp(l.up.rotation.x, l.back ? .62 : -.72, 14, dt);
        l.down.rotation.x = damp(l.down.rotation.x, .95, 14, dt);
      } else {
        l.up.rotation.x = -Math.sin(a) * amp;
        l.down.rotation.x = Math.max(0, Math.cos(a)) * amp * (l.back ? .95 : 1.3);
      }
    }
    const beat = this.phase * TAU;
    this.body.position.y = BODY + Math.abs(Math.sin(beat)) * lerp(clamp(sp / 19) * .05, .2, run) + Math.sin(G.t * 1.7) * .012;
    this.body.rotation.x = Math.sin(beat) * .07 * run;
    this.neckX = damp(this.neckX, this.grazing ? 1.36 : lerp(.14, .46, run), 4, dt);
    this.headX = damp(this.headX, this.grazing ? .28 : -this.neckX * .58, 5, dt);
    this.neck.rotation.x = this.neckX + Math.sin(beat + .8) * .06 * run + Math.sin(G.t * 1.6) * .012;
    this.head.rotation.x = this.headX;
    const near = !this.riding && !this.grazing && this.dist() < 11;
    this.head.rotation.y = damp(this.head.rotation.y, near ? clamp(angDiff(this.yaw, Math.atan2(P.x - this.x, P.z - this.z)) * .6, -.7, .7) : -this.turn * .22, 5, dt);
    this.tail.rotation.y = Math.sin(G.t * 2.4) * .24; this.tail.rotation.x = lerp(.06, -.72, run);

    if (sp > 3 && !air && this.dist() < 60) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 1 / (rate * (run > .5 ? 2 : 4)); G.audio?.hoof(run); }
      if (sp > 12 && Math.random() < dt * sp * .7) {
        const wet = heightAt(this.x, this.z) < .25;
        G.fx.burst(this.x - fx * 1.7 + (Math.random() - .5), this.y + .12, this.z - fz * 1.7 + (Math.random() - .5), wet ? 0x8fb8ff : 0xb0a8a0, 1, 2, .2, .45, 0);
      }
    }
  }
  seat() { this.seatOn(G.player.model, G.player.yaw); }
  seatOn(model, yaw) {
    this.root.updateMatrixWorld(true);
    this.saddle.getWorldPosition(v);
    model.root.position.set(v.x, v.y - (model.seatY ?? .9), v.z);
    model.root.rotation.set(this.pitch, yaw, this.roll, 'YXZ');
    if (model.shadow) model.shadow.visible = false;
  }
  update(dt) {
    const P = G.player;
    this.callCd = Math.max(0, this.callCd - dt);
    if (G.mode === 'play' && I.hit('KeyQ')) this.key();
    const step = this.owned ? null : G.quests.step('s_borke')?.k, quest = step === 'go' || step === 'scene';
    if (!G.inDungeon && !this.placed) {
      if (quest) { const s = this.spot(); this.placeAt(s.x, s.z, 2.4); this.grazing = true; }
      else if (this.owned) this.placeNear(7);
    }
    const show = !G.inDungeon && this.placed && (this.owned || quest);
    this.root.visible = show;
    if (!show) return;
    this.tack.visible = this.owned || !!G.cut?.b?.saddle;
    if (!this.riding) this.ai(dt);
    if (G.cut?.active && G.cut.id === 'borke') this.grazing = G.cut.i === 0;
    this.pose(dt);
    if (this.riding) {
      this.seat();
      const m = P.model, attacking = P.atkT >= 0 || P.cast > 0;
      let turn = 0;
      if (attacking) { const [ax, az] = P.aimDir(); turn = clamp(angDiff(P.yaw, Math.atan2(ax, az)), -1.45, 1.45); }
      if (m.hip) m.hip.rotation.y = damp(m.hip.rotation.y, turn, 14, dt);
    }
  }
}
