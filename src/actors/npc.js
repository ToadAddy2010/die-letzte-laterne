import * as THREE from '../../vendor/three.module.js';
import { G } from '../game/state.js';
import { makeModel, animate } from './models.js';
import { NPCS } from '../data/npcs.js';
import { POI } from '../data/world.js';
import { heightAt } from '../world/terrain.js';
import { angDiff, RNG, strHash, TAU } from '../core/util.js';
import { resolve } from '../world/collision.js';

function markerTex(ch, color) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 48;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.font = 'bold 38px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000'; for (const [x, y] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.fillText(ch, 16 + x, 26 + y);
  g.fillStyle = color; g.fillText(ch, 16, 26);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}
const MARK = {};

export class NPCs {
  constructor(scene) {
    this.scene = scene; this.list = [];
    MARK.offer = new THREE.SpriteMaterial({ map: markerTex('!', '#ffd24a'), depthTest: false, fog: false });
    MARK.talk = new THREE.SpriteMaterial({ map: markerTex('?', '#7fe0ff'), depthTest: false, fog: false });
    MARK.main = new THREE.SpriteMaterial({ map: markerTex('!', '#ff7a4a'), depthTest: false, fog: false });
    const perTown = {};
    for (const [id, d] of Object.entries(NPCS)) {
      const r = RNG(strHash(id));
      let x, z;
      if (d.town) {
        const i = perTown[d.town] = (perTown[d.town] ?? -1) + 1, p = POI[d.town], a = i * 2.39996 + .5, q = 7.5 + (i % 3) * 3.6;
        x = p.x + Math.cos(a) * q; z = p.z + Math.sin(a) * q;
      } else {
        const p = POI[d.poi], a = r() * TAU, q = p.r * .62 + 8;
        x = p.x + Math.cos(a) * q; z = p.z + Math.sin(a) * q;
        const o = { x, z }; resolve(o, 1.2); x = o.x; z = o.z;
      }
      this.list.push({ id, d, x, z, hx: x, hz: z, y: heightAt(x, z), yaw: r() * TAU, t: r() * 5, anim: r() * 9, tx: x, tz: z, model: null, mark: null, kind: null, talking: false });
    }
    this.byId = Object.fromEntries(this.list.map(n => [n.id, n]));
    this.staff = []; this.tempHouse = null;
    for (const h of G.structures.houses) {
      const n = h.npc && this.byId[h.npc];
      if (n) { n.house = h; n.still = true; n.x = n.hx = h.doorX; n.z = n.hz = h.doorZ; this.staff.push(n); }
    }
  }
  pos(id) {
    const n = this.byId[id]; if (!n) return null;
    if (n.house && G.house !== n.house) return { x: n.house.doorX, z: n.house.doorZ };
    return { x: n.x, z: n.z };
  }
  enterHouse(h, a) {
    this.clearTemp();
    this.tempHouse = h;
    if (h.npc && this.byId[h.npc]) {
      const n = this.byId[h.npc];
      n.x = n.hx = n.tx = a.staff.x; n.z = n.hz = n.tz = a.staff.z; n.y = 0; n.yaw = a.staff.yaw;
    }
    for (const q of a.residents) this.list.push({ id: q.id, d: q.d, x: q.x, z: q.z, hx: q.x, hz: q.z, tx: q.x, tz: q.z, y: 0, yaw: Math.random() * TAU, t: Math.random() * 4, anim: Math.random() * 9, model: null, mark: null, kind: null, talking: false, house: h, temp: true });
  }
  clearTemp() {
    if (!this.tempHouse) return;
    for (const n of this.list) if (n.temp && n.model) this.scene.remove(n.model.root);
    this.list = this.list.filter(n => !n.temp);
    this.tempHouse = null;
  }
  update(dt) {
    if (this.tempHouse && this.tempHouse !== G.house) this.clearTemp();
    const P = G.player, hidden = !!G.inDungeon;
    for (const n of this.list) {
      const here = n.house ? G.house === n.house : !hidden;
      const d = Math.hypot(n.x - P.x, n.z - P.z), near = here && d < 190;
      if (near && !n.model) { n.model = makeModel(n.d.look); this.scene.add(n.model.root); n.model.root.position.set(n.x, n.y, n.z); }
      else if (!near && n.model) { this.scene.remove(n.model.root); if (n.mark) { this.scene.remove(n.mark); n.mark = null; n.kind = null; } n.model = null; }
      if (!n.model) continue;
      let speed = 0;
      n.t -= dt; n.anim += dt;
      if (n.talking) n.yaw += angDiff(n.yaw, Math.atan2(P.x - n.x, P.z - n.z)) * Math.min(1, dt * 8);
      else if (d < 7) n.yaw += angDiff(n.yaw, Math.atan2(P.x - n.x, P.z - n.z)) * Math.min(1, dt * 4);
      else if (!n.still) {
        if (n.t <= 0) { const a = Math.random() * TAU, q = Math.random() * 4.5; n.tx = n.hx + Math.cos(a) * q; n.tz = n.hz + Math.sin(a) * q; n.t = 3 + Math.random() * 6; }
        const dx = n.tx - n.x, dz = n.tz - n.z, l = Math.hypot(dx, dz);
        if (l > .4 && d < 90) { speed = 2.1; n.x += dx / l * speed * dt; n.z += dz / l * speed * dt; n.yaw += angDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5); const o = { x: n.x, z: n.z }; resolve(o, .6); n.x = o.x; n.z = o.z; }
      }
      n.y = n.house ? 0 : heightAt(n.x, n.z);
      n.model.root.position.set(n.x, n.y, n.z); n.model.root.rotation.y = n.yaw;
      if (d < 90) animate(n.model, { t: n.anim, speed, attack: -1, talk: n.talking });
      const kind = d < 120 ? G.quests.markerFor(n.id) : null;
      if (kind !== n.kind) {
        if (n.mark) { this.scene.remove(n.mark); n.mark = null; }
        n.kind = kind;
        if (kind) { n.mark = new THREE.Sprite(MARK[kind]); n.mark.scale.set(1.15, 1.7, 1); n.mark.renderOrder = 9; this.scene.add(n.mark); }
      }
      if (n.mark) n.mark.position.set(n.x, n.y + n.model.height + .7 + Math.sin(G.t * 3) * .16, n.z);
    }
    for (const n of this.staff) {
      const h = n.house, dd = Math.hypot(h.doorX - P.x, h.doorZ - P.z), kind = !G.inDungeon && dd < 130 ? G.quests.markerFor(n.id) : null;
      if (kind !== n.doorKind) {
        if (n.doorMark) { this.scene.remove(n.doorMark); n.doorMark = null; }
        n.doorKind = kind;
        if (kind) { n.doorMark = new THREE.Sprite(MARK[kind]); n.doorMark.scale.set(1.3, 1.95, 1); n.doorMark.renderOrder = 9; this.scene.add(n.doorMark); }
      }
      if (n.doorMark) n.doorMark.position.set(h.doorX, h.y + 6.2 + Math.sin(G.t * 3) * .18, h.doorZ);
    }
  }
  nearest(x, z, r) {
    let best = null, bd = r;
    for (const n of this.list) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd && n.model) { bd = d; best = n; } }
    return best;
  }
}
