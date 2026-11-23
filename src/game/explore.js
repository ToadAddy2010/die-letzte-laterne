// Offene Welt: Mondprüfungen zum Entdecken und zufällige Begegnungen unterwegs.
import * as THREE from '../../vendor/three.module.js';
import { G } from './state.js';
import { Kit, MAT } from '../core/gfx.js';
import { makeModel, animate } from '../actors/models.js';
import { ROAM } from '../data/enemies.js';
import { CHEST_LOOT } from '../data/items.js';
import { POIS, REGIONS } from '../data/world.js';
import { RNG, TAU, clamp } from '../core/util.js';
import { heightAt, blockedAt, regionAt, regionIdx } from '../world/terrain.js';
import { inTown } from '../actors/enemies.js';
import { resolve } from '../world/collision.js';
import { groundY } from './fx.js';

const KINDS = ['lauf', 'kampf', 'klang'];
export const TRIAL_NAME = { lauf: 'Lichtlauf', kampf: 'Wächterkreis', klang: 'Klangsteine' };
const TRIAL_HELP = { lauf: 'Lauf durch alle Lichtringe, bevor die Zeit abläuft.', kampf: 'Besiege alle Wächter, ohne den Kreis zu verlassen.', klang: 'Merk dir die Reihenfolge und geh dann zu den Steinen.' };
const COLOR = { lauf: 0x7fe0ff, kampf: 0xff7a5a, klang: 0xd8a0ff };
const STONES = [[7.5, 0], [0, 7.5], [-7.5, 0], [0, -7.5]];
const NOTES = [392, 494, 587, 740];

function altarGeo() {
  const k = new Kit(9101);
  k.cyl(3.1, 3.5, .5, 0, .25, 0, 0x5c587e, { seg: 10, c2: 0x8a86ac, j: .08 });
  k.cyl(1.25, 1.65, .9, 0, .9, 0, 0x6e6a92, { seg: 8, c2: 0xa6a2c8 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.box(.5, .08, .9, Math.cos(a) * 2.5, .54, Math.sin(a) * 2.5, 0x9fe4ff, { ry: -a, glow: .85 }); }
  for (const [x, z] of STONES) { k.cyl(.62, .95, 2.5, x, 1.25, z, 0x4e4a6e, { seg: 6, c2: 0x8682a8, j: .1 }); k.oct(.28, x, 2.8, z, 0xbfd0ff, { glow: 1 }); }
  return k.build();
}
function crystalGeo() {
  const k = new Kit(9102);
  k.oct(.95, 0, 0, 0, 0xffffff, { sy: 1.7, glow: 1, c2: 0xdfe8ff });
  k.oct(.34, .9, -.4, .2, 0xbfd0ff, { sy: 1.4, glow: 1 });
  k.oct(.28, -.75, .35, -.4, 0xbfd0ff, { sy: 1.4, glow: 1 });
  return k.build();
}

export class Explore {
  constructor(scene) {
    this.scene = scene; this.trials = []; this.run = null; this.ev = null; this.nextEv = 45;
    this.altar = altarGeo(); this.crystal = crystalGeo();
    const beam = new THREE.CylinderGeometry(1, 1, 150, 8, 1, true); beam.translate(0, 75, 0);
    this.beamGeo = beam;
    this.ringGeo = new THREE.TorusGeometry(3.3, .24, 6, 20);
    this.ringMats = { next: new THREE.MeshBasicMaterial({ color: 0xfff0a0, fog: false }), later: new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: .55, fog: false }) };
    this.rings = [];
    this.hud = document.createElement('div'); this.hud.id = 'trialHud'; document.getElementById('hud').appendChild(this.hud);
    this.place();
  }
  beam(color, op = .2, r = 1) {
    const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.scale.set(r, 1, r); m.frustumCulled = false; return m;
  }
  place() {
    const r = RNG(77031), avoid = POIS.map(p => ({ x: p.x, z: p.z, r: (p.r || 20) + 32 }));
    let n = 0;
    REGIONS.forEach((reg, ri) => {
      let made = 0;
      for (let tries = 0; tries < 420 && made < 4; tries++) {
        const a = r() * TAU, q = 50 + r() * 470, x = reg.c[0] + Math.cos(a) * q, z = reg.c[1] + Math.sin(a) * q, y = heightAt(x, z);
        if (Math.abs(x) > 1430 || Math.abs(z) > 1430 || regionIdx(x, z) !== ri || y < 1.2 || blockedAt(x, z)) continue;
        if (Math.abs(heightAt(x + 8, z) - y) + Math.abs(heightAt(x, z + 8) - y) > 4.5) continue;
        if (avoid.some(p => Math.hypot(p.x - x, p.z - z) < p.r)) continue;
        if (G.props.colliders(x, z).some(c => Math.hypot(c.x - x, c.z - z) < c.r + 10)) continue;
        const kind = KINDS[n % 3], id = `t${n++}`, group = new THREE.Group(); group.position.set(x, y, z);
        const base = new THREE.Mesh(this.altar, MAT.solid), crystal = new THREE.Mesh(this.crystal, MAT.solid), glow = this.beam(COLOR[kind], .17, 1.1);
        crystal.position.y = 3.4; group.add(base, crystal, glow); group.visible = false; G.worldGroup.add(group);
        const t = { id, kind, x, z, y, ri, group, crystal, glow };
        this.trials.push(t); avoid.push({ x, z, r: 110 });
        G.interact.world.push({ kind: 'trial', id, x, z, y, t });
        made++;
      }
    });
    G.interact.shardTotal += this.trials.length;
  }
  label(o) { return `Mondprüfung starten: ${TRIAL_NAME[o.t.kind]}`; }
  useable(o) { return !G.shards[o.id] && !this.run && !G.net?.isGuest; }
  reset() {
    if (this.run) this.clearRun();
    this.endEvent(); this.nextEv = 45;
  }

  // ── Mondprüfungen ──
  begin(t) {
    if (this.run) return;
    const R = this.run = { t, kind: t.kind, time: 0 };
    G.ui.banner(TRIAL_NAME[t.kind], TRIAL_HELP[t.kind]); G.audio?.quest();
    if (t.kind === 'lauf') this.startLauf(R);
    else if (t.kind === 'kampf') this.startKampf(R);
    else this.startKlang(R);
  }
  startLauf(R) {
    const t = R.t, r = RNG(t.id.length * 977 + t.x * 13 + (G.t * 1000 | 0)), pts = [];
    let x = t.x, z = t.z, a = r() * TAU, path = 0;
    for (let i = 0; i < 6; i++) {
      for (let q = 0; q < 14; q++) {
        const d = 24 + r() * 10, nx = x + Math.sin(a) * d, nz = z + Math.cos(a) * d;
        if (Math.hypot(nx - t.x, nz - t.z) < 92 && heightAt(nx, nz) > 1 && !blockedAt(nx, nz) && !inTown(nx, nz, 8)) { const o = { x: nx, z: nz }; resolve(o, 3.8); path += Math.hypot(o.x - x, o.z - z); x = o.x; z = o.z; break; }
        a += 1.1;
      }
      pts.push({ x, z, y: groundY(x, z) + 3.1 }); a += (r() - .5) * 1.6;
    }
    R.pts = pts; R.i = 0; R.limit = Math.ceil(path / 11 + 4);
    pts.forEach(p => { const m = new THREE.Mesh(this.ringGeo, this.ringMats.later); m.position.set(p.x, p.y, p.z); this.scene.add(m); this.rings.push(m); });
    this.markRing(R);
  }
  markRing(R) {
    this.rings.forEach((m, i) => { m.visible = i >= R.i; m.material = i === R.i ? this.ringMats.next : this.ringMats.later; });
    const p = R.pts[R.i], P = G.player;
    if (p && this.rings[R.i]) this.rings[R.i].rotation.y = Math.atan2(p.x - P.x, p.z - P.z);
  }
  startKampf(R) {
    const t = R.t, reg = REGIONS[t.ri], list = ROAM[reg.id].day, n = 4 + Math.min(2, Math.floor(reg.lvl / 8));
    R.foes = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, o = { x: t.x + Math.cos(a) * 15, z: t.z + Math.sin(a) * 15 }; resolve(o, 1.5);
      G.fx.burst(o.x, groundY(o.x, o.z) + 1, o.z, COLOR.kampf, 20, 6, .24, .7);
      const e = G.enemies.spawn(list[i % list.length], o.x, o.z, { aggro: true, lv: reg.lvl }); e.state = 'chase'; e.summoned = true; R.foes.push(e);
    }
  }
  startKlang(R) {
    const r = RNG((R.t.x * 31 + R.t.z * 7 + G.t * 100) | 0), len = 4 + Math.min(2, Math.floor(REGIONS[R.t.ri].lvl / 9));
    R.seq = Array.from({ length: len }, () => r() * 4 | 0);
    for (let i = 1; i < len; i++) if (R.seq[i] === R.seq[i - 1]) R.seq[i] = (R.seq[i] + 1) % 4;
    R.phase = 'show'; R.show = -1; R.wait = .9; R.i = 0; R.armed = true;
  }
  flashStone(t, s) {
    const [dx, dz] = STONES[s];
    G.fx.burst(t.x + dx, t.y + 2.9, t.z + dz, 0xffe9a8, 22, 5, .24, .55, -2);
    G.fx.ring(t.x + dx, t.y, t.z + dz, 2.4, 0xd8a0ff, 16);
    G.audio?.tone?.(NOTES[s], .5, 'triangle', .1);
  }
  updateRun(dt) {
    const R = this.run, P = G.player, t = R.t;
    if (G.inDungeon || P.dead) { this.fail(P.dead ? 'Prüfung nicht bestanden' : null); return; }
    if (G.mode !== 'play') return;
    R.time += dt;
    if (R.kind === 'lauf') {
      const left = R.limit - R.time, p = R.pts[R.i];
      this.hudText(`${TRIAL_NAME.lauf}: Ring ${R.i + 1} von ${R.pts.length} · ${Math.max(0, left).toFixed(1)} s`);
      this.rings[R.i].rotation.y += dt * 1.2;
      if (Math.hypot(p.x - P.x, p.z - P.z) < 4.2) {
        G.fx.burst(p.x, p.y, p.z, 0xfff0a0, 24, 7, .24, .55, 0); G.audio?.tone?.(520 + R.i * 90, .22, 'triangle', .09);
        R.i++;
        if (R.i >= R.pts.length) { this.win(); return; }
        this.markRing(R);
      } else if (left <= 0) this.fail('Die Zeit ist abgelaufen');
    } else if (R.kind === 'kampf') {
      const live = R.foes.filter(e => !e.dead).length;
      this.hudText(`${TRIAL_NAME.kampf}: noch ${live} Wächter`);
      if (!live) this.win();
      else if (Math.hypot(P.x - t.x, P.z - t.z) > 52) this.fail('Du hast den Kreis verlassen');
    } else {
      if (Math.hypot(P.x - t.x, P.z - t.z) > 30) { this.fail('Du hast die Steine verlassen'); return; }
      if (R.phase === 'show') {
        this.hudText(`${TRIAL_NAME.klang}: Hör gut zu`);
        R.wait -= dt;
        if (R.wait <= 0) { R.show++; if (R.show >= R.seq.length) { R.phase = 'play'; R.i = 0; R.armed = false; } else { this.flashStone(t, R.seq[R.show]); R.wait = .72; } }
      } else {
        this.hudText(`${TRIAL_NAME.klang}: Stein ${R.i + 1} von ${R.seq.length}`);
        let on = -1;
        STONES.forEach(([dx, dz], s) => { if (Math.hypot(t.x + dx - P.x, t.z + dz - P.z) < 2.9) on = s; });
        if (on < 0) R.armed = true;
        else if (R.armed) {
          R.armed = false;
          if (on === R.seq[R.i]) { this.flashStone(t, on); R.i++; if (R.i >= R.seq.length) this.win(); }
          else { G.audio?.deny(); G.ui.toast('Falscher Stein, hör noch einmal zu', 'warn'); R.phase = 'show'; R.show = -1; R.wait = 1.2; R.i = 0; }
        }
      }
    }
  }
  hudText(s) { if (s !== this.hudS) { this.hudS = s; this.hud.textContent = s; } this.hud.style.display = 'block'; }
  clearRun() {
    const R = this.run; this.run = null;
    for (const m of this.rings) this.scene.remove(m);
    this.rings = [];
    if (R?.foes) for (const e of R.foes) if (!e.dead && G.enemies.list.includes(e)) G.enemies.removeEnemy(e);
    this.hud.style.display = 'none'; this.hudS = '';
  }
  fail(msg) {
    this.clearRun();
    if (msg) { G.ui.toast(`${msg}. Du kannst es jederzeit neu versuchen.`, 'warn'); G.audio?.deny(); }
  }
  win() {
    const R = this.run, t = R.t, P = G.player, lvl = REGIONS[t.ri].lvl;
    this.clearRun();
    G.fx.ring(t.x, t.y, t.z, 12, 0xbfd0ff, 54); G.fx.burst(t.x, t.y + 3.4, t.z, 0xdfe8ff, 50, 9, .28, 1.1, -2);
    G.ui.banner('Prüfung bestanden', 'Ein Mondsplitter gehört dir'); G.audio?.questDone();
    G.interact.gainShard(t.id);
    P.addXp(40 + lvl * 24); G.ui.toast(`+${40 + lvl * 24} EP`, 'xp'); P.addGold(25 + lvl * 14);
    const list = CHEST_LOOT[Math.min(CHEST_LOOT.length - 1, Math.floor(lvl / 3.6))];
    P.addItem(list[Math.floor(Math.random() * list.length)]);
    G.game.autosave();
  }

  // ── Begegnungen ──
  spot(minD, maxD) {
    const P = G.player;
    for (let i = 0; i < 18; i++) {
      const a = Math.atan2(P.vx, P.vz) + (Math.random() - .5) * 2.2, d = minD + Math.random() * (maxD - minD), x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
      if (Math.abs(x) > 1480 || Math.abs(z) > 1480 || heightAt(x, z) < 1 || blockedAt(x, z) || inTown(x, z, 20)) continue;
      const o = { x, z }; resolve(o, 2); return o;
    }
    return null;
  }
  startEvent() {
    const roll = Math.random();
    if (roll < .28) this.evStar(); else if (roll < .52) this.evRaid(); else if (roll < .72) this.evTreasure(); else this.evRift();
  }
  evStar() {
    const o = this.spot(55, 95); if (!o) return;
    const m = this.beam(0xbfd0ff, .34, 1.5); m.position.set(o.x, groundY(o.x, o.z), o.z); G.worldGroup.add(m);
    this.ev = { kind: 'star', ...o, life: 75, m };
    G.ui.toast('Ein Sternsplitter fällt ganz in der Nähe', 'spell'); G.audio?.chime();
  }
  evRaid() {
    const o = this.spot(60, 95); if (!o) return;
    const reg = regionAt(o.x, o.z), list = ROAM[reg.id].day, n = 3 + (reg.lvl > 8 ? 1 : 0), foes = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, e = G.enemies.spawn(list[i % list.length], o.x + Math.cos(a) * 7, o.z + Math.sin(a) * 7, { lv: reg.lvl }); e.summoned = true; foes.push(e); }
    const npc = makeModel({ kind: 'human', top: 0xc99a3a, bottom: 0x4a3a28, skin: 0xd8b48e, hair: 0x5a3a24, hat: 'cap', hatColor: 0x7a4a2c, apron: 0x6a4a2c });
    npc.root.position.set(o.x, groundY(o.x, o.z), o.z); G.worldGroup.add(npc.root);
    const m = this.beam(0xff9a5a, .28, 1.2); m.position.set(o.x, groundY(o.x, o.z), o.z); G.worldGroup.add(m);
    this.ev = { kind: 'raid', ...o, life: 110, m, npc, foes, lvl: reg.lvl, t: 0 };
    G.ui.toast('Hilferufe aus der Nähe: Ein Händler wird überfallen', 'quest'); G.audio?.quest();
  }
  evTreasure() {
    const o = this.spot(34, 52); if (!o) return;
    const reg = regionAt(o.x, o.z), e = G.enemies.spawn('goblin', o.x, o.z, { lv: reg.lvl });
    e.treasure = true; e.summoned = true; e.spd *= 1.05; e.maxHp = e.hp = Math.round(e.maxHp * 1.6); e.state = 'chase'; e.aggro = true;
    const m = this.beam(0xffd24a, .3, .9); m.position.set(e.x, e.y, e.z); G.worldGroup.add(m);
    this.ev = { kind: 'treasure', x: e.x, z: e.z, life: 32, m, e, lvl: reg.lvl };
    G.ui.toast('Ein Schatzgoblin rennt mit Beute davon!', 'gold'); G.audio?.quest();
  }
  /** Mondriss: drei Wellen, am Ende wartet seltene Beute. */
  evRift() {
    const o = this.spot(58, 98); if (!o) return;
    const reg = regionAt(o.x, o.z), y = groundY(o.x, o.z), c = 0x9a5aff, m = this.beam(c, .3, 2.1), portal = new THREE.Group();
    m.position.set(o.x, y, o.z); G.worldGroup.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, .24, 10, 44), new THREE.MeshBasicMaterial({ color: 0xc8a0ff, fog: false, toneMapped: false }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.15, 40), new THREE.MeshBasicMaterial({ color: 0x5a22c0, transparent: true, opacity: .62, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    portal.add(ring, disc); portal.position.set(o.x, y + 3.9, o.z); G.worldGroup.add(portal);
    this.ev = { kind: 'rift', ...o, y, life: 170, m, portal, lvl: reg.lvl, reg, foes: [], wave: 0, wait: 0, c };
    G.ui.toast('Ein Mondriss öffnet sich ganz in der Nähe', 'spell'); G.audio?.roar();
  }
  riftWave(E) {
    E.wave++;
    const list = ROAM[E.reg.id].night, n = 2 + E.wave + (E.lvl > 10 ? 1 : 0);
    G.ui.banner(`Welle ${E.wave} von 3`, 'Schließe den Mondriss');
    G.vfx?.shock(E.x, E.y, E.z, 16, E.c, .7); G.audio?.roar();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + E.wave, q = { x: E.x + Math.cos(a) * 9, z: E.z + Math.sin(a) * 9 }; resolve(q, 1.2);
      const e = G.enemies.spawn(list[i % list.length], q.x, q.z, { lv: E.lvl + E.wave - 1, elite: E.wave === 3 && i === 0 ? ['flamme', 'frost', 'vampir', 'schatten', 'rasend', 'fels'][Math.floor(Math.random() * 6)] : undefined });
      e.summoned = true; e.aggro = true; e.state = 'chase'; E.foes.push(e);
      G.fx.burst(q.x, groundY(q.x, q.z) + 1, q.z, E.c, 16, 6, .22, .6);
    }
  }
  updateEvent(dt) {
    const E = this.ev, P = G.player;
    if (G.mode === 'play') E.life -= dt;
    if (E.m) E.m.material.opacity = (E.kind === 'star' ? .3 : .24) + Math.sin(G.t * 4) * .06;
    if (E.kind === 'star') {
      if (Math.random() < dt * 22) G.fx.burst(E.x, groundY(E.x, E.z) + 1 + Math.random() * 3, E.z, 0xdfe8ff, 2, 2, .16, .7, -2);
      if (Math.hypot(E.x - P.x, E.z - P.z) < 5) {
        const lvl = regionAt(E.x, E.z).lvl;
        G.fx.ring(E.x, groundY(E.x, E.z), E.z, 8, 0xbfd0ff, 36); G.audio?.shard();
        P.addXp(20 + lvl * 12); P.addGold(15 + lvl * 8); P.addItem(lvl > 12 ? 'mana2' : 'mana1');
        G.ui.toast('Sternsplitter gefunden', 'spell'); this.endEvent(); return;
      }
    } else if (E.kind === 'raid') {
      E.t += dt;
      if (E.npc) { animate(E.npc, { t: E.t, speed: 0, attack: -1, talk: true }); E.npc.root.rotation.y = Math.atan2(P.x - E.x, P.z - E.z); }
      if (!E.foes.some(e => !e.dead)) {
        P.addGold(30 + E.lvl * 16); P.addItem(E.lvl > 12 ? 'trank2' : 'trank1'); P.addXp(30 + E.lvl * 14);
        G.ui.whisper('Geretteter Händler', ['Bei allen Pilzen, das war knapp! Nimm das, und erzähl niemandem, wie laut ich geschrien habe.']);
        this.endEvent(); return;
      }
    } else if (E.kind === 'rift') {
      E.portal.rotation.y += dt * .7; E.portal.children[1].material.opacity = .52 + Math.sin(G.t * 3.4) * .14;
      if (Math.random() < dt * 24) { const a = Math.random() * TAU; G.fx.burst(E.x + Math.cos(a) * 3.2, E.y + 3.9 + Math.sin(a) * 3.2, E.z, 0xc8a0ff, 1, 1.5, .16, .7, -1); }
      if (!E.wave) { if (Math.hypot(E.x - P.x, E.z - P.z) < 24) this.riftWave(E); }
      else if (!E.foes.some(e => !e.dead)) {
        E.wait += dt;
        if (E.wait > 1.3) {
          E.wait = 0; E.foes = [];
          if (E.wave < 3) this.riftWave(E);
          else {
            P.addXp(60 + E.lvl * 34); P.addGold(70 + E.lvl * 34); P.addItem(E.lvl > 12 ? 'trank3' : 'trank2');
            G.feats?.bump('rifts'); G.vfx?.shock(E.x, E.y, E.z, 24, E.c, .9); G.fx.burst(E.x, E.y + 4, E.z, E.c, 60, 12, .3, 1.1); G.audio?.shard();
            if (!G.enemies.legend({ x: E.x, y: E.y, z: E.z, lv: E.lvl + 2 }, .5)) G.ui.banner('Mondriss geschlossen', 'Das Licht hält noch eine Nacht');
            this.endEvent(); return;
          }
        }
      }
    } else if (E.kind === 'treasure') {
      if (E.m && !E.e.dead) E.m.position.set(E.e.x, E.e.y, E.e.z);
      if (E.e.dead) {
        G.fx.burst(E.e.x, E.e.y + 1, E.e.z, 0xffd24a, 40, 9, .24, .9); G.audio?.chest();
        P.addGold(60 + E.lvl * 30);
        const list = CHEST_LOOT[Math.min(CHEST_LOOT.length - 1, Math.floor(E.lvl / 3.6))];
        P.addItem(list[Math.floor(Math.random() * list.length)]);
        this.endEvent(); return;
      }
    }
    if (E.life <= 0 || Math.hypot(E.x - P.x, E.z - P.z) > 380) {
      if (E.kind === 'rift') G.ui.toast('Der Mondriss schließt sich', 'warn');
      if (E.kind === 'treasure') { G.ui.toast('Der Schatzgoblin ist entkommen', 'warn'); G.fx.burst(E.e.x, E.e.y + 1, E.e.z, 0xb0a8a0, 24, 6, .3, .7); }
      this.endEvent();
    }
  }
  endEvent() {
    const E = this.ev; this.ev = null; this.nextEv = 55 + Math.random() * 75;
    if (!E) return;
    if (E.m) { G.worldGroup.remove(E.m); E.m.material.dispose(); }
    if (E.npc) G.worldGroup.remove(E.npc.root);
    if (E.portal) { G.worldGroup.remove(E.portal); for (const q of E.portal.children) { q.geometry.dispose(); q.material.dispose(); } }
    if (E.foes) for (const e of E.foes) if (!e.dead && G.enemies.list.includes(e)) G.enemies.removeEnemy(e);
    if (E.e && !E.e.dead && G.enemies.list.includes(E.e)) G.enemies.removeEnemy(E.e);
  }
  update(dt) {
    const P = G.player;
    if (G.mode === 'menu') return;
    for (const t of this.trials) {
      const d = Math.hypot(t.x - P.x, t.z - P.z), vis = !G.inDungeon && d < 640, done = !!G.shards[t.id];
      t.group.visible = vis;
      if (!vis) continue;
      t.crystal.visible = !done; t.glow.visible = !done;
      if (!done) { t.crystal.rotation.y += dt * 1.1; t.crystal.position.y = 3.5 + Math.sin(G.t * 1.8 + t.x) * .3; }
      if (d < 46 && !G.seen[t.id]) { G.seen[t.id] = 1; G.ui.toast(`Entdeckt: Mondprüfung (${TRIAL_NAME[t.kind]})`, 'quest'); }
    }
    if (this.run) this.updateRun(dt);
    if (G.net?.role) return;
    if (this.ev) this.updateEvent(dt);
    else if (G.mode === 'play' && !G.inDungeon && !this.run && !G.tutorial?.on) {
      this.nextEv -= dt;
      if (this.nextEv <= 0) {
        this.nextEv = 12;
        if (!inTown(P.x, P.z, 10) && !G.enemies.inCombat && Math.hypot(P.vx, P.vz) > 2) this.startEvent();
      }
    }
  }
}
export { clamp };
