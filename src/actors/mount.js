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

/** Verjüngter Ast zwischen zwei Punkten, für das Geweih. */
function limb(k, a, b, r0, r1, c) {
  dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const h = dir.length();
  rot.setFromUnitVectors(UP, dir.normalize()); eul.setFromQuaternion(rot, 'XYZ');
  k.cyl(r1, r0, h, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, c, { seg: 4, rx: eul.x, ry: eul.y, rz: eul.z });
}

function geoBody() {
  const k = new Kit(71);
  k.ball(1, 0, 0, -.05, FUR, { seg: 8, sx: .86, sy: .92, sz: 1.85, c2: FUR2, j: .04 });
  k.ball(.98, 0, .28, 1.02, FUR, { seg: 7, sx: .92, sy: 1.02, sz: .95, c2: FUR2, j: .04 });
  k.ball(.86, 0, .06, -1.22, FUR, { seg: 7, sy: .98, c2: FUR2, j: .04 });
  for (const [x, y, z, r] of [[.1, 1.24, 1.3, .36], [-.14, 1.2, .82, .32], [.3, .86, -1.02, .3], [-.3, .84, -1.3, .34], [.04, .78, -1.68, .26], [-.5, .98, .7, .24], [.52, 1, .98, .25]]) k.blob(r, x, y, z, MOSS, { c2: MOSS2, j: .08, sy: .62 });
  for (const [x, z] of [[.34, -1.42], [-.2, -1.68]]) { k.cyl(.04, .05, .18, x, .94, z, 0xe8ded0, { seg: 4 }); k.dome(.15, x, 1.02, z, CAP, { seg: 6, sy: .7, glow: .55 }); }
  return k.build();
}
function geoTack() {
  const k = new Kit(78);
  k.box(1.74, .07, 1.36, 0, .86, -.2, CLOTH, { c2: 0x4f6ae0 });
  for (const x of [-.88, .88]) { k.box(.07, .72, 1.36, x, .52, -.2, CLOTH, { c2: 0x1c2f88 }); k.box(.08, .06, 1.38, x, .18, -.2, GOLD, {}); k.box(.26, .5, .6, x * 1.15, .36, -.92, 0x6a4a2c, { c2: 0x8a6438 }); }
  k.box(.8, .2, 1.05, 0, .98, -.2, LEATHER, { c2: 0x6f4530 }); k.box(.74, .4, .14, 0, 1.16, -.72, LEATHER, { c2: 0x6f4530 }); k.box(.38, .34, .14, 0, 1.13, .3, LEATHER, { c2: 0x6f4530 }); k.box(.4, .05, .16, 0, 1.31, .3, GOLD, {});
  k.box(.2, .26, .2, 1.02, -.02, .08, 0xffc445, { glow: 1 }); k.box(.24, .05, .24, 1.02, .13, .08, 0x2a2030, {});
  return k.build();
}
function geoNeck() {
  const k = new Kit(72);
  k.cyl(.42, .66, 1.55, 0, .62, .34, FUR, { rx: .52, seg: 7, c2: FUR2, j: .04 });
  k.box(.2, 1.24, .46, 0, .78, -.03, MOSS, { rx: .52, c2: MOSS2, j: .1 });
  k.cone(.3, .9, 0, .04, .72, DARK, { rx: Math.PI - .2, seg: 5 });
  return k.build();
}
function geoHead() {
  const k = new Kit(73);
  k.box(.66, .64, .92, 0, .06, .2, FUR, { c2: FUR2, j: .03 });
  k.box(.48, .44, .88, 0, -.13, .9, FUR2, { c2: FUR, j: .03 });
  k.box(.42, .22, .12, 0, -.02, 1.36, 0x1b1410, {});
  k.box(.3, .05, .1, 0, -.27, 1.28, 0x1b1410, {});
  for (const x of [-1, 1]) {
    k.box(.09, .1, .08, x * .34, .17, .42, 0xffc445, { glow: 1 });
    k.cone(.17, .56, x * .48, .32, -.14, FUR2, { seg: 3, rz: -x * 1.1 });
    const m = ([a, b, c]) => [x * a, b, c];
    limb(k, m([.26, .28, -.1]), m([.72, .82, -.18]), .13, .095, ANT);
    limb(k, m([.72, .82, -.18]), m([1.02, 1.3, -.06]), .095, .075, ANT);
    limb(k, m([1.02, 1.3, -.06]), m([1.16, 1.78, .24]), .075, .05, ANT2);
    for (const [a, b] of [[[.6, .66, -.14], [.88, .94, .54]], [[.86, 1.06, -.12], [1.24, 1.62, -.56]], [[.98, 1.28, -.07], [.76, 1.98, -.24]], [[1.06, 1.5, .06], [1.56, 2.02, -.02]], [[1.16, 1.78, .24], [.98, 2.38, .34]], [[1.16, 1.78, .24], [1.54, 2.26, .58]]]) limb(k, m(a), m(b), .06, .014, ANT2);
    k.box(.07, .32, .46, x * 1.03, 1.42, -.02, ANT, { rz: -x * .42, c2: ANT2 });
    for (const [a, b, c, r] of [[.82, 1.02, -.04, .17], [1.14, 1.5, -.2, .13], [1.2, 1.86, .16, .1]]) { k.cyl(.035, .045, .16, x * a, b - .08, c, 0xe8ded0, { seg: 4 }); k.dome(r, x * a, b, c, CAP, { seg: 6, sy: .72, glow: .7 }); k.ball(.035, x * a, b + r * .66, c, 0xfff4dc, { seg: 4, glow: 1 }); }
    k.box(.09, .42, .09, x * .92, .72, -.2, MOSS, { c2: MOSS2 }); k.box(.07, .3, .07, x * 1.1, 1.12, -.14, MOSS2, {});
  }
  return k.build();
}
function geoLegUp(back) {
  const k = new Kit(74 + back);
  k.cyl(back ? .4 : .32, .19, 1.08, 0, -.5, back ? -.04 : 0, FUR, { seg: 6, c2: FUR2 });
  return k.build();
}
function geoLegLow() {
  const k = new Kit(76);
  k.cyl(.17, .12, .94, 0, -.46, 0, DARK, { seg: 5, c2: FUR });
  k.ball(.19, 0, -.74, 0, FUR2, { seg: 5, sy: .8 });
  k.cyl(.17, .23, .2, 0, -1, .03, 0x171210, { seg: 6 });
  return k.build();
}
function geoTail() {
  const k = new Kit(77);
  k.cone(.24, .72, 0, -.3, -.04, FUR2, { rx: Math.PI, seg: 5, c2: DARK });
  k.blob(.14, 0, -.02, -.02, MOSS, {});
  return k.build();
}
const part = (parent, geo, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (geo) { const m = new THREE.Mesh(geo, MAT.solid); m.frustumCulled = false; g.add(m); }
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
    model.root.position.set(v.x, v.y - .9, v.z);
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
