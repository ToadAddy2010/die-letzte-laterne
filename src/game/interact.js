import * as THREE from '../../vendor/three.module.js';
import { G } from './state.js';
import { Input } from '../core/input.js';
import { Kit, MAT } from '../core/gfx.js';
import { POIS, POI, REGIONS } from '../data/world.js';
import { ITEMS, CHEST_LOOT } from '../data/items.js';
import { LORE } from '../data/story.js';
import { BOOKS } from '../data/houses.js';
import { RNG, TAU } from '../core/util.js';
import { heightAt, blockedAt, regionIdx } from '../world/terrain.js';
import { resolve } from '../world/collision.js';

function geoChest() { const k = new Kit(5); k.box(1.6, .9, 1.05, 0, .45, 0, 0x7a4a24, { c2: 0x9a6a34 }); k.cyl(.53, .53, 1.6, 0, .92, 0, 0x8a5a2c, { rz: 1.57, seg: 8 }); for (const x of [-.6, .6]) k.box(.14, 1.05, 1.12, x, .55, 0, 0xd8a33c, {}); k.box(.3, .34, .08, 0, .78, .54, 0xffd070, { glow: .9 }); return k.build(); }
function geoShard() { const k = new Kit(6); k.oct(.5, 0, 0, 0, 0xbfd0ff, { sy: 1.7, glow: 1, c2: 0xffffff }); k.oct(.24, .4, -.3, .1, 0x7fa0ff, { sy: 1.4, glow: 1 }); return k.build(); }
function geoTablet() { const k = new Kit(7); k.box(1.9, 2.5, .4, 0, 1.25, 0, 0x7c78a0, { c2: 0xb0aed0 }); k.cyl(.95, .95, .4, 0, 2.5, 0, 0x8a86b0, { rx: 1.57, seg: 9 }); for (let i = 0; i < 4; i++) k.box(1.2 - i * .1, .08, .05, 0, 2.3 - i * .36, .22, 0x7fd8ff, { glow: 1 }); return k.build(); }
function geoPick() { const k = new Kit(8); k.oct(.42, 0, 0, 0, 0xffd24a, { glow: 1, sy: 1.3 }); k.torus(.62, .06, 0, 0, 0, 0xfff0b0, { rx: 1.57, glow: 1, seg: 10 }); return k.build(); }
function geoPortal() { const k = new Kit(9); k.torus(2.3, .28, 0, 2.4, 0, 0x9fe4ff, { glow: 1, seg: 18 }); k.cyl(2.1, 2.1, .08, 0, 2.4, 0, 0x4fc2ff, { rx: 1.57, seg: 16, glow: .85 }); return k.build(); }

export class Interact {
  constructor(scene) {
    this.scene = scene;
    this.geo = { chest: geoChest(), shard: geoShard(), tablet: geoTablet(), pick: geoPick(), portal: geoPortal() };
    this.world = []; this.pick = []; this.dun = []; this.current = null;
    this.buildWorld();
  }
  obj(list, o) { o.y = o.y ?? heightAt(o.x, o.z); const m = new THREE.Mesh(this.geo[o.geo], MAT.solid); m.position.set(o.x, o.y + (o.float || 0), o.z); m.rotation.y = o.ry || 0; m.visible = false; this.scene.add(m); o.m = m; list.push(o); return o; }
  buildWorld() {
    const r = RNG(4242);
    const find = (cx, cz, spread) => {
      for (let t = 0; t < 50; t++) {
        const a = r() * TAU, q = spread * (.45 + r() * .55), x = cx + Math.cos(a) * q, z = cz + Math.sin(a) * q;
        if (Math.abs(x) > 1480 || Math.abs(z) > 1480 || heightAt(x, z) < 1 || blockedAt(x, z)) continue;
        return { x, z };
      }
      return null;
    };
    let cn = 0, sn = 0;
    for (const p of POIS.filter(p => p.type === 'landmark' || p.type === 'camp')) {
      const c = find(p.x, p.z, p.r + 22);
      if (c) this.obj(this.world, { kind: 'chest', geo: 'chest', id: `w${cn++}`, ...c, tier: REGIONS[regionIdx(c.x, c.z)].lvl, ry: r() * 6 });
      if (p.lore) { const q = { x: p.x + (p.r + 7) * Math.cos(r() * 6), z: p.z + (p.r + 7) * Math.sin(r() * 6) }; resolve(q, 1.5); this.obj(this.world, { kind: 'tablet', geo: 'tablet', id: p.lore, ...q, ry: Math.atan2(p.x - q.x, p.z - q.z) + Math.PI }); }
    }
    for (let i = 0; i < 60; i++) {
      const c = find(r.range(-1420, 1420), r.range(-1420, 1420), 30);
      if (c) this.obj(this.world, { kind: 'shard', geo: 'shard', id: `m${sn++}`, ...c, float: 1.5 });
      if (sn >= 50) break;
    }
    for (let i = 0; i < 26; i++) {
      const c = find(r.range(-1420, 1420), r.range(-1420, 1420), 30);
      if (c) this.obj(this.world, { kind: 'chest', geo: 'chest', id: `w${cn++}`, ...c, tier: REGIONS[regionIdx(c.x, c.z)].lvl, ry: r() * 6 });
    }
    this.shardTotal = sn;
    for (const p of POIS) {
      if (p.type === 'shrine') this.world.push({ kind: 'shrine', id: p.id, x: p.x, z: p.z, y: p.h, name: p.name, poi: p });
      if (p.type === 'dungeon') this.world.push({ kind: 'door', id: p.id, x: p.x, z: p.z + 2.5, y: p.h, name: p.name, poi: p });
    }
    for (const h of G.structures.houses) this.world.push({ kind: 'house', id: h.id, x: h.doorX, z: h.doorZ, y: h.y, h });
  }
  spawnPickups(qid, s) {
    this.clearPickups(qid);
    const p = POI[s.at], have = G.net?.isGuest ? (G.quests.state[qid]?.c || 0) : G.player.count(s.item), r = RNG(strSeed(qid + s.item));
    for (let i = 0; i < s.n; i++) {
      const a = i / s.n * TAU + r() * .4, q = Math.min(p.r * .72, 15) + 3 * r();
      const o = { x: p.x + Math.cos(a) * q, z: p.z + Math.sin(a) * q }; resolve(o, 1);
      if (i < have) continue;
      this.obj(this.pick, { kind: 'pickup', geo: 'pick', qid, item: s.item, ...o, float: 1.2 });
    }
  }
  clearPickups(qid) { for (let i = this.pick.length - 1; i >= 0; i--) if (this.pick[i].qid === qid) { this.scene.remove(this.pick[i].m); this.pick.splice(i, 1); } }
  clearAllPickups() { for (const o of this.pick) this.scene.remove(o.m); this.pick = []; }
  enterDungeon(a) {
    this.clearDungeon();
    for (const c of a.chests) if (!G.opened[c.id]) this.obj(this.dun, { kind: 'chest', geo: 'chest', id: c.id, x: c.x, z: c.z, y: 0, tier: a.poi.lvl, rich: c.rich, ry: 0 });
    this.obj(this.dun, { kind: 'exit', geo: 'portal', x: a.exit.x, z: a.exit.z, y: 0, ry: 0 });
    if (G.bossDead[a.poi.boss]) this.addBossExit(true);
  }
  /** Nach dem Sieg führt ein Portal direkt aus dem Bossraum hinaus. */
  addBossExit(quiet) {
    const a = G.dungeon.active;
    if (!a?.boss || G.house || this.dun.some(o => o.bossExit)) return;
    this.obj(this.dun, { kind: 'exit', geo: 'portal', bossExit: true, x: a.boss.x, z: a.boss.z, y: 0, ry: 0 });
    if (!quiet) { G.fx.ring(a.boss.x, 0, a.boss.z, 9, 0x9fe4ff, 44); G.audio?.lantern(); G.ui.toast('Ein Portal führt dich hinaus', 'quest'); }
  }
  enterHouse(a) {
    this.clearDungeon();
    for (const c of a.chests) if (!G.opened[c.id]) this.obj(this.dun, { kind: 'chest', geo: 'chest', id: c.id, x: c.x, z: c.z, y: 0, tier: c.tier, rich: c.rich, poor: c.poor, ry: c.ry });
    for (const b of a.books) this.dun.push({ kind: 'book', id: b.id, idx: b.idx, x: b.x, z: b.z, y: 0 });
    this.dun.push({ kind: 'exit', x: a.exit.x, z: a.exit.z, y: 0 });
  }
  clearDungeon() { for (const o of this.dun) if (o.m) this.scene.remove(o.m); this.dun = []; }
  refreshOpened() {
    for (const o of this.world) if (o.m) {
      if (o.kind === 'chest' && G.opened[o.id]) o.m.visible = false;
      if (o.kind === 'shard' && G.shards[o.id]) o.m.visible = false;
    }
    for (const id in G.discovered) if (G.shrineFlames?.[id]) G.shrineFlames[id].visible = true;
  }
  label(o) {
    switch (o.kind) {
      case 'chest': return 'Truhe öffnen';
      case 'shard': return 'Mondsplitter nehmen';
      case 'tablet': return `Lesen: ${LORE[o.id]?.[0] || 'Steintafel'}`;
      case 'pickup': return `Nehmen: ${ITEMS[o.item].n}`;
      case 'shrine': return G.discovered[o.id] ? `${o.name}: Rasten und reisen` : `${o.name} entzünden`;
      case 'door': return `Betreten: ${o.name}`;
      case 'house': return `Eintreten: ${o.h.name}`;
      case 'book': return `Lesen: ${BOOKS[o.idx][0]}`;
      case 'exit': return G.house ? 'Hinausgehen' : 'Dungeon verlassen';
      case 'npc': return `Sprechen: ${o.n.d.n}`;
      case 'mount': return 'Aufsitzen: Borke';
      case 'revive': return G.net.reviveLabel();
      case 'trial': return G.explore.label(o);
    }
    return '';
  }
  useable(o) {
    if (o.kind === 'chest') return !G.opened[o.id];
    if (o.kind === 'shard') return !G.shards[o.id];
    if (o.kind === 'trial') return G.explore ? G.explore.useable(o) : false;
    return true;
  }
  update(dt) {
    const P = G.player, t = G.t, dunMode = !!G.inDungeon;
    let best = null, bd = 1e9;
    const scan = (list, active) => {
      for (const o of list) {
        const d = Math.hypot(o.x - P.x, o.z - P.z);
        if (o.m) {
          const vis = active && d < 240 && this.useable(o);
          // Ein Portal direkt an der Kamera würde sonst das ganze Bild verdecken.
          const atCam = o.geo === 'portal' && Math.hypot(o.x - G.camera.position.x, o.z - G.camera.position.z) < 3.4;
          o.m.visible = vis && !atCam;
          if (vis && o.float) { o.m.rotation.y += dt * 1.7; o.m.position.y = o.y + o.float + Math.sin(t * 2.2 + o.x) * .22; }
          if (vis && o.kind === 'chest' && d < 30 && Math.random() < dt * 1.4) G.fx.burst(o.x, o.y + 1.2, o.z, 0xffd070, 1, 1, .12, .8, -2);
          if (vis && o.kind === 'portal') o.m.rotation.y += dt;
        }
        if (!active || !this.useable(o)) continue;
        const R = o.kind === 'trial' ? 5.6 : o.kind === 'shrine' ? 6.5 : o.kind === 'door' ? 8.5 : o.kind === 'exit' ? (G.house ? 3.1 : 5) : 3.6;
        if (d < R && d < bd && Math.abs(P.y - o.y) < 6) { bd = d; best = o; }
      }
    };
    scan(this.world, !dunMode); scan(this.pick, !dunMode); scan(this.dun, dunMode);
    if (!dunMode || G.house) {
      const n = G.npcs.nearest(P.x, P.z, G.house ? 5.6 : 4.6);
      if (n && Math.hypot(n.x - P.x, n.z - P.z) < bd + 1) { best = { kind: 'npc', n }; bd = Math.hypot(n.x - P.x, n.z - P.z); }
    }
    if (G.mount?.canMount() && G.mount.dist() < 5.4 && G.mount.dist() < bd) best = { kind: 'mount' };
    if (G.net?.canRevive()) { best = { kind: 'revive' }; G.net.holdRevive(dt, Input.down('KeyE')); } else if (G.net) G.net.reviveT = 0;
    if (P.dead) best = null;
    this.current = best;
    if (G.mode === 'play') {
      G.ui.prompt(best ? this.label(best) : null);
      if (best && best.kind !== 'revive' && Input.hit('KeyE')) this.use(best);
    } else G.ui.prompt(null);
  }
  gainShard(id) {
    const P = G.player;
    G.shards[id] = 1; G.audio?.shard();
    const c = Object.keys(G.shards).length;
    G.ui.toast(`Mondsplitter ${c}/${this.shardTotal}`, 'spell');
    if (c % 5 === 0) { P.recalc(); P.hp = P.maxHp; P.mp = P.maxMp; G.ui.banner('Die Laterne wächst', '+30 Leben, +15 Mana'); }
  }
  use(o) {
    const P = G.player;
    switch (o.kind) {
      case 'npc': G.dialog.open(o.n); break;
      case 'mount': G.mount.mount(); break;
      case 'chest': {
        G.opened[o.id] = 1; G.audio?.chest();
        G.fx.burst(o.x, o.y + 1, o.z, 0xffd070, 26, 6, .22, .9);
        const tier = Math.min(CHEST_LOOT.length - 1, Math.floor(o.tier / 3.6)), list = CHEST_LOOT[tier], r = Math.random;
        const gold = Math.round((12 + o.tier * 9) * (.7 + r() * .8) * (o.rich ? 2.4 : o.poor ? .3 : 1));
        P.addGold(gold);
        const n = o.poor ? (r() < .5 ? 1 : 0) : o.rich ? 3 : 1 + (r() < .4 ? 1 : 0);
        for (let i = 0; i < n; i++) { const pool = o.poor ? list.slice(0, 3) : o.rich ? list.slice(3) : list.slice(0, r() < .18 ? list.length : 4); P.addItem(pool[Math.floor(r() * pool.length)]); }
        if (o.m) o.m.visible = false;
        G.stats.chests = (G.stats.chests || 0) + 1;
        break;
      }
      case 'shard': {
        G.fx.burst(o.x, o.y + 1.5, o.z, 0xbfd0ff, 30, 6, .2, 1, -2);
        this.gainShard(o.id);
        break;
      }
      case 'tablet': { G.flagsTablet = 1; G.tablets[o.id] = 1; G.ui.loreBox(LORE[o.id]); G.audio?.stone(); break; }
      case 'pickup': { G.fx.burst(o.x, o.y + 1.2, o.z, 0xffd24a, 16, 4, .18, .6); this.scene.remove(o.m); this.pick.splice(this.pick.indexOf(o), 1); if (G.net?.isGuest) { G.net.send({ t: 'q', a: 'pick', q: o.qid }); G.audio?.pickup(); } else P.addItem(o.item); break; }
      case 'shrine': {
        const wasLit = !!G.discovered[o.id];
        if (!wasLit) {
          G.net?.send({ t: 'lit', id: o.id });
          G.discovered[o.id] = 1; if (G.shrineFlames?.[o.id]) G.shrineFlames[o.id].visible = true;
          G.fx.burst(o.x + 1, o.y + 3.6, o.z, 0xffc445, 34, 6, .22, 1, -2); G.audio?.lantern();
          G.ui.banner(o.name, 'Laterne entzündet'); P.addXp(25);
          G.quests.reachCheck(P);
        }
        P.hp = P.maxHp; P.mp = P.maxMp; P.st = P.maxSt; P.lastShrine = o.id;
        G.game.autosave();
        if (wasLit && Object.keys(G.discovered).length > 1 && G.mode === 'play') G.ui.openPanel('map');
        else G.ui.toast('Geheilt und gespeichert', 'quest');
        break;
      }
      case 'trial': G.explore.begin(o.t); break;
      case 'door': G.game.enterDungeon(o.poi); break;
      case 'house': G.game.enterHouse(o.h); break;
      case 'book': G.ui.loreBox(BOOKS[o.idx]); G.audio?.page(); break;
      case 'exit': G.game.exitDungeon(); break;
    }
  }
}
function strSeed(s) { let h = 7; for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return Math.abs(h) + 1; }
