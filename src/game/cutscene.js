import * as THREE from '../../vendor/three.module.js';
import { G } from './state.js';
import { Input } from '../core/input.js';
import { SCENES, ENDINGS } from '../data/story.js';
import { POI } from '../data/world.js';
import { heightAt } from '../world/terrain.js';
import { lerp, smooth } from '../core/util.js';

const v = new THREE.Vector3(), w = new THREE.Vector3();

export class Cutscene {
  constructor() { this.list = null; }
  get active() { return !!this.list; }
  play(id, done, o = {}) {
    const list = SCENES[id];
    if (!list) { done?.(); return; }
    if (G.inDungeon && !o.stay) G.game.exitDungeon(true);
    this.id = id; this.list = list; this.i = -1; this.done = done; this.prevMode = 'play'; this.savedHour = G.hour; this.stay = !!o.stay; this.t = 0; this.keepHour = id.startsWith('end_');
    G.player.model.root.visible = true;
    if (G.net?.isHost && G.net.active) G.net.send({ t: 'cut', id });
    if (G.camera.fov !== 62) { G.camera.fov = 62; G.camera.updateProjectionMatrix(); }
    G.mode = 'cutscene'; Input.unlock(); Input.clear();
    G.ui.letterbox(true); G.audio?.setBattle(0);
    this.next();
  }
  next() {
    this.i++;
    if (this.i >= this.list.length) return this.finish();
    const b = this.b = this.list[this.i];
    this.t = 0;
    if (b.sky !== undefined) { G.hour = b.sky; G.skySnap = true; }
    if (b.moonOpen !== undefined) G.forceMoonOpen = b.moonOpen;
    if (b.moon !== undefined) G.forceMoonOpen = b.moon;
    if (b.flame) G.player.flame = b.flame;
    this.dur = Math.max(4.2, (b.say?.[1]?.length || 40) * .058 + 1.8);
    const target = this.focus(b);
    if (target && !this.stay) { G.focus = { x: target.x, z: target.z }; G.terrain.flush(target.x, target.z); G.props.update(target.x, target.z, true); }
    if (b.say) G.ui.cutLine(b.say[0], b.say[1]);
    G.retro.u.fade.value = .55;
  }
  focus(b) {
    if (b.mount) { const m = G.mount; return { x: m.x, y: m.y + 3, z: m.z }; }
    if (b.poi) { const p = POI[b.poi]; return { x: p.x, y: (p.h ?? heightAt(p.x, p.z)) + 8, z: p.z }; }
    if (b.boss && G.enemies.boss) { const e = G.enemies.boss; return { x: e.x, y: e.y + e.model.height * .6, z: e.z }; }
    const P = G.player;
    return { x: P.x, y: P.y + 2, z: P.z };
  }
  advance() {
    const b = this.b;
    if (!G.ui.cutDone()) return G.ui.cutFinish();
    if (b.ending && this.i === this.list.length - 1) { if (G.net?.isGuest) { this.finish(); return; } if (!this.choosing) this.choose(); return; }
    this.next();
  }
  choose() {
    this.choosing = true;
    G.ui.endingChoice(ENDINGS, e => {
      this.choosing = false;
      G.flags.ending = e.id; G.flags.endingTitle = e.title;
      const done = this.done;
      this.list = null;
      this.play(e.id, () => { done?.(); G.game.showEnding(e); });
    });
  }
  skip() {
    if (this.choosing) return;
    const last = this.list[this.list.length - 1];
    if (last.ending && !G.net?.isGuest) { this.i = this.list.length - 2; this.next(); G.ui.cutFinish(); return; }
    this.finish();
  }
  finish() {
    const done = this.done;
    this.list = null; this.done = null; this.b = null;
    G.focus = null; G.forceMoonOpen = undefined;
    if (!this.keepHour) { G.hour = this.savedHour; G.skySnap = true; }
    G.retro.u.fade.value = .5;
    G.ui.letterbox(false); G.ui.cutLine(null);
    const P = G.player;
    if (!this.stay) { G.terrain.flush(P.x, P.z); G.props.update(P.x, P.z, true); }
    G.mode = 'play';
    G.game.resumeLock();
    done?.();
  }
  update(dt, cam) {
    if (!this.list) return;
    const b = this.b;
    this.t += dt;
    const k = Math.min(1, this.t / this.dur), e = smooth(0, 1, k);
    if (!this.choosing && (Input.hit('Space') || Input.hit('Enter') || Input.hit('KeyE'))) { this.advance(); return; }
    if (!this.choosing && Input.hit('Escape')) { this.skip(); return; }
    if (!this.choosing && this.t > this.dur + 1.6 && G.ui.cutDone()) { this.advance(); return; }
    const f = this.focus(b);
    if (b.body) {
      const P = G.player, dir = b.body === 'moon' ? G.sky.moonDir : G.sky.sunDir, body = (b.body === 'moon' ? G.sky.moon : G.sky.sun).group;
      if (G.inDungeon) { cam.position.set(P.x + 4, P.y + 3, P.z + 5); cam.lookAt(P.x, P.y + 2, P.z); return; }
      const dY = Math.max(.32, dir.y), look = w.set(dir.x, dY, dir.z).normalize();
      cam.position.set(P.x, P.y + 5, P.z);
      body.position.copy(cam.position).addScaledVector(look, 1500);
      body.visible = true; body.lookAt(cam.position);
      cam.fov = lerp(30, 19, e); cam.updateProjectionMatrix();
      cam.lookAt(body.position);
      this.zoomed = true;
      return;
    }
    if (this.zoomed) { cam.fov = 62; cam.updateProjectionMatrix(); this.zoomed = false; }
    if (b.orbit) {
      const [r, h, a0, a1] = b.orbit, a = lerp(a0, a1, e);
      v.set(f.x + Math.cos(a) * r, f.y + h, f.z + Math.sin(a) * r);
      if (!G.inDungeon) v.y = Math.max(v.y, heightAt(v.x, v.z) + 1.5);
      else { const d = G.dungeon; let q = 1; while (q > .15 && d.isWall(lerp(f.x, v.x, q), lerp(f.z, v.z, q))) q -= .08; v.x = lerp(f.x, v.x, q); v.z = lerp(f.z, v.z, q); v.y = Math.min(v.y, 9.6); }
      cam.position.copy(v); cam.lookAt(f.x, f.y, f.z);
    } else if (b.dolly) {
      const [p0, p1] = b.dolly;
      v.set(lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e), lerp(p0[2], p1[2], e));
      const yaw = G.player.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
      cam.position.set(f.x + v.x * c + v.z * s, f.y - 2 + v.y, f.z - v.x * s + v.z * c);
      cam.lookAt(f.x, f.y + .6, f.z);
    }
  }
}
