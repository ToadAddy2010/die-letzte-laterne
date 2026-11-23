// Multiplayer: Der Gastgeber berechnet Welt, Gegner und Quests, der Mitspieler bekommt sie gespiegelt.
import * as THREE from '../../vendor/three.module.js';
import { G } from './state.js';
import { makeModel, animate, setFlash } from '../actors/models.js';
import { Mount } from '../actors/mount.js';
import { playerSpec } from '../actors/player.js';
import { ITEMS, SPELLS } from '../data/items.js';
import { POI } from '../data/world.js';
import { angDiff, clamp, damp } from '../core/util.js';
import { resolve } from '../world/collision.js';
import { groundY } from './fx.js';
import { Link, cleanName } from './p2p.js';
import { KINDS } from '../world/weather.js';

const F = { dead: 1, down: 2, busy: 4, ride: 8, ground: 16, roll: 32, block: 64 };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const num = (v, min, max) => (Number.isFinite(v) ? clamp(v, min, max) : min);
const DOWN_TIME = 45, REVIVE_TIME = 1.3, DUEL_RANGE = 80;

class Remote {
  constructor(name, scene, guest) {
    Object.assign(this, { name, scene, guest, x: 0, y: 0, z: 0, yaw: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, vx: 0, vz: 0, hp: 100, maxHp: 100, level: 1, flags: F.ground, area: 'w', dead: false, rolling: 0, anim: 0, atk: -1, combo: 0, cast: 0, mx: 0, my: 0, mz: 0, myaw: 0, msp: 0, fresh: true, model: null, tagKey: '' });
    this.canvas = document.createElement('canvas'); this.canvas.width = 192; this.canvas.height = 48;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, fog: false, transparent: true }));
    this.tag.scale.set(4.4, 1.1, 1); this.tag.renderOrder = 9; this.tag.visible = false; scene.add(this.tag);
  }
  get busy() { return !!(this.flags & F.busy); }
  get down() { return !!(this.flags & F.down); }
  get riding() { return !!(this.flags & F.ride); }
  setLook(equip) {
    if (!equip || !ITEMS[equip.armor] || !ITEMS[equip.weapon]) return;
    if (this.model) this.scene.remove(this.model.root);
    this.model = makeModel(playerSpec(equip, this.guest));
    this.model.root.visible = false; this.scene.add(this.model.root);
  }
  apply(s, area) {
    if (!Array.isArray(s) || s.length < 19) return;
    [this.tx, this.ty, this.tz, this.tyaw, this.vx, this.vz, this.atk, this.combo, this.cast, this.hp, this.maxHp, this.level, this.flags, this.mx, this.my, this.mz, this.myaw, this.msp, this.st] = s.map(v => (Number.isFinite(v) ? v : 0));
    this.area = typeof area === 'string' ? area.slice(0, 40) : 'w';
    this.dead = !!(this.flags & F.dead);
    if (this.fresh || Math.hypot(this.tx - this.x, this.tz - this.z) > 26) { this.x = this.tx; this.y = this.ty; this.z = this.tz; this.yaw = this.tyaw; this.fresh = false; }
  }
  targetable() { return !this.dead && !this.busy && this.area === G.net.area(); }
  // Schnittstelle für die Gegner-KI: Sie behandelt den Mitspieler wie die eigene Spielfigur.
  hurt(amount, src, o = {}) {
    if (!this.targetable()) return false;
    G.net.send({ t: 'hurt', a: r1(amount), x: r1(src?.x ?? this.x), z: r1(src?.z ?? this.z), slow: o.slow || 0 });
    return true;
  }
  shake() {}
  drawTag() {
    const key = `${this.name}|${Math.round(this.hp / (this.maxHp || 1) * 24)}|${this.down}`;
    if (key === this.tagKey) return;
    this.tagKey = key;
    const g = this.canvas.getContext('2d'), w = 192, k = clamp(this.hp / (this.maxHp || 1));
    g.clearRect(0, 0, w, 48); g.font = 'bold 21px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#000'; for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.fillText(this.name, w / 2 + a, 15 + b);
    g.fillStyle = this.down ? '#ff8a7a' : '#ffe9a8'; g.fillText(this.name, w / 2, 15);
    g.fillStyle = '#000'; g.fillRect(26, 34, w - 52, 10); g.fillStyle = this.down ? '#ff5a4f' : '#6dff8a'; g.fillRect(28, 36, (w - 56) * k, 6);
    this.tex.needsUpdate = true;
  }
  update(dt, here) {
    this.anim += dt;
    const m = this.model;
    if (!m) return;
    if (!here) { m.root.visible = false; this.tag.visible = false; if (this.elk) this.elk.root.visible = false; return; }
    m.root.visible = true; this.tag.visible = true;
    const ox = this.x, oz = this.z;
    this.x = damp(this.x, this.tx, 15, dt); this.y = damp(this.y, this.ty, 15, dt); this.z = damp(this.z, this.tz, 15, dt);
    this.yaw += angDiff(this.yaw, this.tyaw) * Math.min(1, dt * 15);
    const speed = dt > 0 ? Math.hypot(this.x - ox, this.z - oz) / dt : 0, ride = this.riding;
    if (ride) {
      this.elk ??= new Mount(this.scene);
      const E = this.elk;
      E.x = this.x; E.y = this.y; E.z = this.z; E.yaw = this.yaw; E.speed = this.msp; E.placed = true;
      E.root.visible = true; E.tack.visible = true; E.pose(dt); E.seatOn(m, this.yaw);
    } else {
      if (this.elk) this.elk.root.visible = false;
      m.root.position.set(this.x, this.y, this.z); m.root.rotation.set(0, this.yaw, 0);
      if (m.shadow) m.shadow.visible = true;
    }
    animate(m, { t: this.anim, speed: ride || this.atk >= 0 ? 0 : speed, attack: this.atk, combo: this.combo, cast: this.cast, block: !!(this.flags & F.block), ride, roll: this.flags & F.roll ? .5 : 0, dead: this.dead ? 1 : 0 });
    this.drawTag();
    this.tag.position.set(this.x, this.y + (ride ? 7 : 4), this.z);
  }
  remove() {
    if (this.model) this.scene.remove(this.model.root);
    if (this.elk) this.scene.remove(this.elk.root);
    this.scene.remove(this.tag); this.tex.dispose(); this.tag.material.dispose();
  }
}

export class Net {
  constructor(scene) {
    this.scene = scene;
    Object.assign(this, { ws: null, role: null, remote: null, room: null, error: '', myName: '', pendingSave: null, known: new Set(), lastQuests: '', duel: null, reviveT: 0, tP: 0, tE: 0, tClock: 0, tQuests: 0, tSave: 0, tPing: 0, tDuel: 0 });
  }
  get isHost() { return this.role === 'host'; }
  get isGuest() { return this.role === 'guest'; }
  /** Erst mit einem verbundenen Partner läuft die Welt im Menü weiter. */
  get active() { return !!this.remote; }
  get duelOn() { return this.duel?.state === 'run'; }
  get isInvited() { return false; }
  /** Läuft ohne eigenen Server direkt von Browser zu Browser. */
  get available() { return !!window.RTCPeerConnection && !!globalThis.crypto?.getRandomValues; }
  area() { return G.house ? `h:${G.house.id}` : G.inDungeon ? `d:${G.inDungeon}` : 'w'; }
  send(obj) { if (this.ws?.readyState === 1) this.ws.send(obj); }
  refresh() { if (G.mode === 'panel' && G.ui.tab === 'party') G.ui.drawPanel(); }

  // ── Verbindung ──
  connect(hello) {
    this.drop();
    this.error = '';
    const ws = this.ws = new Link(hello);
    ws.onmessage = m => { try { this.handle(m); } catch (err) { console.error(err); } };
    ws.onclose = () => { if (this.ws === ws) this.closed(); };
    ws.onerror = text => { if (this.ws === ws && text && !this.error) this.error = text; };
    ws.onask = (name, answer) => { if (this.ws === ws) this.askJoin(name, answer); };
    ws.start();
  }
  /** Niemand kommt ohne Zustimmung des Gastgebers in die Welt. */
  askJoin(name, answer) {
    clearTimeout(this.joinT);
    if (!name) { if (this.joinAsk) { this.joinAsk = null; G.netui.ask(null); } return; }
    this.joinAsk = yes => { clearTimeout(this.joinT); this.joinAsk = null; G.netui.ask(null); answer(yes); };
    this.joinT = setTimeout(() => this.joinAsk?.(false), 40000);
    G.netui.askPlayer(`${name} möchte in deine Welt`);
    G.audio?.quest();
  }
  host() { if (this.isHost) return; this.role = 'host'; this.room = { state: 'opening' }; this.connect({ t: 'hello', role: 'host' }); this.refresh(); }
  join(code, name) { this.role = 'guest'; this.myName = name; this.connect({ t: 'hello', role: 'guest', code, name }); }
  drop() {
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onclose = null; ws.close(); }
    this.clearRemote();
  }
  clearRemote() {
    if (this.remote) { this.remote.remove(); this.remote = null; }
    this.duel = null; this.known.clear(); this.lastQuests = ''; this.reviveT = 0;
    if (G.netui?.chatOpen) G.netui.closeChat();
    G.netui?.ask(null);
    const P = G.player;
    if (P?.downed) this.downExpired();
  }
  /** Raum schließen oder als Mitspieler gehen. */
  leave() {
    if (this.isGuest) this.saveChar();
    const was = this.isGuest;
    this.joinAsk = null; this.drop(); this.role = null; this.room = null; this.pendingSave = null;
    if (was) G.ui.toast('Verbindung beendet', 'warn');
    this.refresh();
  }
  closed() {
    const guest = this.isGuest, inGame = guest && G.mode !== 'menu', why = this.error;
    this.ws = null; this.clearRemote(); this.role = null; this.room = null;
    if (guest) {
      if (inGame) G.game.toMenu();
      G.netui.joinPane(this.lastCode, why || 'Die Verbindung zum Gastgeber wurde getrennt.');
    } else { if (why) this.error = why; G.ui.toast('Multiplayer-Raum geschlossen', 'warn'); this.refresh(); }
  }
  inviteLink() { return this.room?.url && this.room?.code ? `${this.room.url}/#join=${this.room.code}` : null; }

  // ── Nachrichten ──
  handle(m) {
    const P = G.player;
    switch (m.t) {
      case 'hosting': this.send({ t: 'open' }); break;
      case 'opened': this.room = { state: 'open', code: m.code, url: m.url || null }; this.error = m.error || ''; G.audio?.chime(); this.refresh(); break;
      case 'denied': this.error = m.why || 'Beitritt nicht möglich.'; if (this.isGuest) G.netui.joinPane(this.lastCode, this.error); this.refresh(); break;
      case 'joined': this.myName = m.name; this.pendingSave = m.save; break;
      case 'peer': this.onPeer(cleanName(m.name) || 'Gast'); break;
      case 'peerLeft': { const n = this.remote?.name; this.clearRemote(); G.netui.line(null, `${n || 'Dein Mitspieler'} hat das Spiel verlassen.`); G.ui.toast(`${n || 'Mitspieler'} ist gegangen`, 'warn'); this.refresh(); break; }
      case 'hostLeft': this.error = 'Der Gastgeber hat den Raum geschlossen.'; break;
      case 'welcome': this.onWelcome(m); break;
      case 'p': this.remote?.apply(m.s, m.a); this.checkWipe(); break;
      case 'look': this.remote?.setLook(m.e); break;
      case 'e': if (this.isGuest && G.mode !== 'menu' && G.enemies.applySnapshot(m)) this.send({ t: 'eReset' }); break;
      case 'eReset': if (this.isHost) this.known.clear(); break;
      case 'clock': if (this.isGuest) { G.hour = num(m.h, 0, 24); G.day = m.d | 0; G.moonGaze = num(m.g, 0, 60); if (m.b) G.bossDead = m.b; if (KINDS[m.w]) G.weather.set(KINDS[m.w], true); G.bloodMoon = !!m.bm; } break;
      case 'quests': if (this.isGuest) G.quests.mirror(m.s, m.tr); break;
      case 'q': if (this.isHost) this.onQuest(m); break;
      case 'lit': if (this.isHost && POI[m.id]?.type === 'shrine' && !G.discovered[m.id]) { G.discovered[m.id] = 1; if (G.shrineFlames?.[m.id]) G.shrineFlames[m.id].visible = true; G.quests.reachCheck(P); } break;
      case 'hit': if (this.isHost) { const e = G.enemies.list.find(x => x.id === m.id); if (e) e.hurt(num(m.d, 1, 99999), { crit: !!m.c, spell: !!m.sp, kx: num(m.kx, -1, 1), kz: num(m.kz, -1, 1), knock: num(m.k, 0, 12), slow: num(m.sl, 0, 6), post: num(m.p, 0, 14), finish: !!m.f }); } break;
      case 'hurt': if (!P.dead) P.hurt(num(m.a, 0, 99999), { x: m.x, z: m.z }, { slow: num(m.slow, 0, 8) }); break;
      case 'kill': if (this.isGuest) this.onKillShare(m); break;
      case 'reward': if (this.isGuest) this.onReward(m); break;
      case 'vfx': this.onVfx(m); break;
      case 'cut': if (this.isGuest) this.onCut(m.id); break;
      case 'area': if (this.isGuest) this.onHostArea(m.d); break;
      case 'unlock': if (this.isGuest && !G.flags.borke) { G.flags.borke = 1; G.ui.toast('Borke begleitet jetzt auch dich (Q)', 'quest'); } break;
      case 'chat': if (this.remote && typeof m.s === 'string') { G.netui.line(this.remote.name, m.s.slice(0, 160)); G.audio?.tick(); } break;
      case 'give': this.onGive(m); break;
      case 'duel': this.onDuel(m); break;
      case 'pvp': if (this.duelOn && !P.dead) P.hurt(num(m.d, 1, 9999), { x: m.x, z: m.z }, { pvp: true }); break;
      case 'revive': this.onRevived(); break;
      case 'wipe': if (P.downed) this.downExpired(); break;
    }
  }
  onPeer(name) {
    if (!this.isHost) return;
    this.clearRemote();
    this.remote = new Remote(name, this.scene, true);
    const P = G.player;
    this.send({ t: 'welcome', name: this.myName || G.profiles?.cur?.name || 'Gastgeber', x: r1(P.x), z: r1(P.z), h: G.hour, day: G.day, g: G.moonGaze || 0, bossDead: G.bossDead, borke: G.flags.borke || 0, dungeon: G.house ? null : G.inDungeon, door: G.house ? [G.house.doorX, G.house.doorZ] : null, q: G.quests.toJSON(), e: P.equip });
    this.lastQuests = JSON.stringify(G.quests.toJSON());
    G.audio?.quest(); G.ui.banner(name, 'ist deinem Spiel beigetreten');
    G.netui.line(null, `${name} ist beigetreten. ${G.touch?.on ? 'Tippe auf Chat zum Schreiben.' : 'Drück Enter zum Schreiben.'}`);
    this.refresh();
  }
  onWelcome(m) {
    this.clearRemote();
    this.remote = new Remote(cleanName(m.name) || 'Gastgeber', this.scene, false);
    this.remote.setLook(m.e);
    G.game.startGuest(this.pendingSave, m);
    this.sendLook();
    G.netui.line(null, `Du spielst bei ${this.remote.name}. ${G.touch?.on ? 'Chat und Menü findest du oben links.' : 'Drück Enter zum Schreiben, P für das Teammenü.'}`);
  }
  sendLook() { if (this.remote) this.send({ t: 'look', e: G.player.equip }); }

  // ── Takt ──
  update(dt) {
    if (!this.ws) return;
    this.tPing -= dt;
    if (this.tPing <= 0) { this.tPing = 20; this.send({ t: 'ping' }); }
    const R = this.remote; if (!R) return;
    const here = R.area === this.area();
    R.update(dt, here && G.mode !== 'menu');
    this.tP -= dt;
    if (this.tP <= 0) { this.tP = .066; this.sendState(); }
    if (this.isHost) {
      this.tE -= dt; if (this.tE <= 0) { this.tE = .083; this.sendEnemies(); }
      this.tClock -= dt; if (this.tClock <= 0) { this.tClock = 1; this.send({ t: 'clock', h: r2(G.hour), d: G.day, g: r1(G.moonGaze || 0), b: G.bossDead, w: G.weather.id, bm: G.bloodMoon ? 1 : 0 }); }
      this.tQuests -= dt;
      if (this.tQuests <= 0) { this.tQuests = .33; const q = G.quests.toJSON(), s = JSON.stringify(q); if (s !== this.lastQuests) { this.lastQuests = s; this.send({ t: 'quests', s: q.state, tr: q.tracked }); } }
    } else {
      this.tSave -= dt; if (this.tSave <= 0) { this.tSave = 20; this.saveChar(); }
    }
    this.updateDuel(dt);
  }
  sendState() {
    const P = G.player, M = G.mount;
    const flags = (P.dead ? F.dead : 0) | (P.downed ? F.down : 0) | (G.mode !== 'play' ? F.busy : 0) | (M?.riding ? F.ride : 0) | (P.onGround ? F.ground : 0) | (P.rolling > 0 ? F.roll : 0) | (P.blocking ? F.block : 0);
    this.send({ t: 'p', a: this.area(), s: [r1(P.x), r2(P.y), r1(P.z), r2(P.yaw), r1(P.vx), r1(P.vz), r2(P.atkT), P.combo, r2(P.cast), Math.ceil(P.hp), P.maxHp, P.level, flags, r1(M?.x ?? 0), r1(M?.y ?? 0), r1(M?.z ?? 0), r2(M?.yaw ?? 0), r1(M?.speed ?? 0), Math.round(P.st)] });
  }
  sendEnemies() {
    const R = this.remote, here = R.area === this.area(), s = [], n = [], now = new Set(), bossE = G.enemies.boss;
    if (here) for (const e of G.enemies.list) {
      if (Math.hypot(e.x - R.x, e.z - R.z) > 210 && e !== bossE) continue;
      now.add(e.id);
      if (!this.known.has(e.id)) n.push([e.id, e.type, e.maxHp, e.lv, e.elite || 0]);
      s.push([e.id, r1(e.x), r1(e.z), r2(e.yaw), Math.max(0, Math.round(e.hp)), r2(e.atk), (e.dead ? 1 : 0) | (e.boss ? 2 : 0) | (bossE === e ? 4 : 0) | (e.aggro && e.state !== 'idle' && e.state !== 'return' ? 8 : 0) | (e.stun > 0 ? 16 : 0)]);
    }
    this.known = now;
    this.send({ t: 'e', n, s });
  }

  // ── Gegner und Kampf ──
  targetFor(e) {
    const me = G.player, R = this.remote;
    if (!R || !R.targetable()) return me;
    if (me.dead || G.mode !== 'play') return R;
    const dm = Math.hypot(e.x - me.x, e.z - me.z), dr = Math.hypot(e.x - R.x, e.z - R.z);
    if (e.tgt === 'r') { if (dm < dr * .65) e.tgt = 'm'; } else if (dr < dm * .65) e.tgt = 'r';
    return e.tgt === 'r' ? R : me;
  }
  boltTargets() { const R = this.remote; return R?.targetable() ? [G.player, R] : [G.player]; }
  worldAnchors(P) { const R = this.remote; return R && R.area === 'w' ? [P, R] : [P]; }
  sendHit(e, dmg, o) { this.send({ t: 'hit', id: e.id, d: dmg, c: o.crit ? 1 : 0, sp: o.spell ? 1 : 0, kx: r2(o.kx || 0), kz: r2(o.kz || 0), k: o.knock || 0, sl: o.slow || 0, p: r1(o.post ?? (o.spell ? .6 : 1)), f: o.finish ? 1 : 0 }); }
  onEnemyDied(e) {
    const R = this.remote;
    if (!this.isHost || !R || R.area !== this.area()) return;
    const d = e.d, items = [];
    if (e.boss) items.push(...(d.loot || []).filter(id => ITEMS[id]?.t !== 'quest'));
    else if (!e.summoned) for (const [id, p] of d.drops || []) if (p > 0 && ITEMS[id]?.t !== 'quest' && Math.random() < p) items.push(id);
    if (e.elite && Math.random() < .22) { const id = G.enemies.pickLegend(e.lv); if (id) items.push(id); }
    this.send({ t: 'kill', x: e.xp, g: d.gold ? Math.round(d.gold * (.7 + Math.random() * .6)) : 0, d: items, ty: e.type, b: e.boss ? 1 : 0, n: d.n });
  }
  onKillShare(m) {
    const P = G.player, xp = num(m.x, 0, 1e6);
    P.addXp(xp); G.stats.kills++;
    if (typeof m.ty === 'string') G.killed[m.ty] = (G.killed[m.ty] || 0) + 1;
    if (m.g) P.addGold(num(m.g, 0, 1e6) | 0, !m.b);
    for (const id of Array.isArray(m.d) ? m.d.slice(0, 12) : []) if (ITEMS[id]) P.addItem(id, 1, !m.b);
    if (m.b) { G.bossDead[m.ty] = 1; if (G.inDungeon && G.dungeon.active?.poi?.boss === m.ty) G.interact.addBossExit(); G.ui.bossBar(null); G.ui.banner(`${String(m.n || '').slice(0, 40)} besiegt`, 'Großer Feind gefallen'); G.audio?.victory(); this.saveChar(); }
  }
  sendReward(R, title) { if (this.isHost && this.remote) this.send({ t: 'reward', xp: R.xp || 0, gold: R.gold || 0, items: (R.items || []).filter(id => ITEMS[id]?.t !== 'quest'), spell: R.spell || null, title }); }
  onReward(m) {
    const P = G.player;
    G.ui.questPop('Auftrag abgeschlossen', String(m.title || '').slice(0, 60)); G.audio?.questDone(); G.stats.quests = (G.stats.quests || 0) + 1;
    if (m.gold) P.addGold(num(m.gold, 0, 1e6) | 0);
    if (m.xp) { P.addXp(num(m.xp, 0, 1e6)); G.ui.toast(`+${m.xp} EP`, 'xp'); }
    for (const id of Array.isArray(m.items) ? m.items.slice(0, 12) : []) if (ITEMS[id]) P.addItem(id);
    if (SPELLS[m.spell]) P.knowSpell(m.spell);
    this.saveChar();
  }
  vfx(k, o) {
    const R = this.remote;
    if (!R || R.area !== this.area()) return;
    if (k === 'b') this.send({ t: 'vfx', k, x: r1(o.x), y: r1(o.y), z: r1(o.z), dx: r2(o.dx), dz: r2(o.dz), vy: r1(o.vy || 0), s: o.speed, c: o.color, sz: o.size ?? 1, l: o.life ?? 2.6 });
    else if (k === 't') this.send({ t: 'vfx', k, x: r1(o.x), z: r1(o.z), r: o.r, l: o.time, c: o.color });
    else if (k === 'm') this.send({ t: 'vfx', k, x: r1(o.x), y: r1(o.y), z: r1(o.z), r: o.r, c: o.color, l: o.time });
  }
  onVfx(m) {
    const R = this.remote;
    if (!R || R.area !== this.area() || G.mode === 'menu') return;
    const c = num(m.c, 0, 0xffffff);
    if (m.k === 'b') G.fx.bolt({ x: num(m.x, -2000, 2000), y: num(m.y, -50, 500), z: num(m.z, -2000, 2000), dx: num(m.dx, -1, 1), dz: num(m.dz, -1, 1), vy: num(m.vy, -30, 30), speed: num(m.s, 1, 90), color: c, size: num(m.sz, .2, 3), life: num(m.l, .1, 4), owner: 'v', ghost: true });
    else if (m.k === 't') G.fx.tele(num(m.x, -2000, 2000), num(m.z, -2000, 2000), num(m.r, .5, 30), num(m.l, .1, 3), c, null, true);
    else if (m.k === 'm') G.fx.beam(num(m.x, -2000, 2000), num(m.y, -50, 500), num(m.z, -2000, 2000), num(m.r, .5, 20), c, num(m.l, .1, 1), true);
  }

  // ── Quests und Orte ──
  onQuest(m) {
    const Q = G.quests;
    if (m.a === 'accept' && Q.q(m.id) && Q.canOffer(m.id)) Q.accept(m.id);
    else if (m.a === 'talk' && Q.isActive(m.id)) { const s = Q.step(m.id); if (s?.k === 'talk') Q.finishTalk(m.id, s.choice?.[m.c]); }
    else if (m.a === 'pick') { const o = G.interact.pick.find(x => x.qid === m.q); if (o) G.interact.use(o); }
    this.lastQuests = ''; this.tQuests = 0;
  }
  hostMoved(id) { if (this.isHost && this.remote) { this.known.clear(); this.send({ t: 'area', d: id || null }); } }
  onHostArea(id) {
    if (G.mode === 'menu') return;
    if (id) { if (G.house) G.game.exitDungeon(true); const poi = POI[id]; if (poi && G.inDungeon !== id) { if (G.inDungeon) G.game.exitDungeon(true, true); G.game.enterDungeon(poi, true); G.ui.toast(`${this.remote?.name || 'Der Gastgeber'} führt euch hinein`, 'quest'); } } else if (G.inDungeon && !G.house) { G.game.exitDungeon(false, true); G.player.place(G.player.x + 3, G.player.z + 2); }
  }
  onCut(id) {
    if (G.mode === 'menu' || G.mode === 'dead' || G.mode === 'panel' || G.mode === 'dialog') return;
    if (G.cut.active) G.cut.finish();
    G.cut.play(id, null, { stay: !!G.inDungeon });
  }
  teleport() {
    const R = this.remote, P = G.player;
    if (!R || P.dead) return;
    const A = this.area(), B = R.area;
    if (B !== A && B.startsWith('h:')) { G.ui.toast(`${R.name} ist gerade in einem Haus`, 'warn'); G.audio?.deny(); return; }
    if (B === 'w' && A.startsWith('d:')) { G.ui.toast('Verlasst zuerst gemeinsam den Dungeon', 'warn'); G.audio?.deny(); return; }
    if (B.startsWith('d:') && B !== A) { G.ui.toast(`${R.name} ist in einem Dungeon`, 'warn'); G.audio?.deny(); return; }
    if (A.startsWith('h:') && B === 'w') G.game.exitDungeon(true);
    const o = { x: R.tx + 2.4, z: R.tz + 1.6 }; resolve(o, 1.1);
    G.ui.fadeFlash(); P.place(o.x, o.z); if (G.mount.riding) { G.mount.x = P.x; G.mount.y = P.y; G.mount.z = P.z; }
    if (!G.inDungeon) G.game.stream(true);
    G.audio?.lantern();
    if (G.mode === 'panel') G.ui.closePanel();
  }
  saveChar() { if (this.isGuest && this.ws?.readyState === 1 && G.mode !== 'menu') this.send({ t: 'saveChar', data: G.game.guestSave() }); }

  // ── Wiederbeleben ──
  goDown() {
    const R = this.remote, P = G.player;
    if (!R || R.area !== this.area() || R.dead) { if (R) this.send({ t: 'wipe' }); return false; }
    P.downed = true; P.downT = DOWN_TIME;
    G.ui.subtitle(`Du liegst am Boden. ${R.name} kann dich wiederbeleben.`, 6);
    this.tP = 0;
    return true;
  }
  tickDown(dt) {
    const P = G.player;
    if (!P.downed) return;
    P.downT -= dt;
    if (P.downT <= 0 || !this.remote) this.downExpired();
  }
  checkWipe() { const P = G.player, R = this.remote; if (P.downed && R?.dead && R.area === this.area()) this.downExpired(); }
  downExpired() {
    const P = G.player;
    if (!P.downed) return;
    P.downed = false; P.downT = 0;
    if (P.dead && G.mode !== 'dead') G.game.onDeath();
  }
  canRevive() {
    const R = this.remote, P = G.player;
    return !!R && R.down && R.area === this.area() && !P.dead && G.mode === 'play' && Math.hypot(R.x - P.x, R.z - P.z) < 4.6;
  }
  holdRevive(dt, held) {
    if (!held) { this.reviveT = 0; return; }
    this.reviveT += dt;
    if (Math.random() < dt * 14) G.fx.burst(this.remote.x, this.remote.y + 1, this.remote.z, 0xffd070, 2, 3, .16, .5, -2);
    if (this.reviveT >= REVIVE_TIME) { this.reviveT = 0; this.send({ t: 'revive' }); this.remote.flags &= ~(F.down | F.dead); this.remote.dead = false; G.audio?.chime(); G.ui.toast(`${this.remote.name} steht wieder`, 'quest'); }
  }
  reviveLabel() { return `Halten: ${this.remote.name} wiederbeleben (${Math.round(this.reviveT / REVIVE_TIME * 100)}%)`; }
  onRevived() {
    const P = G.player;
    if (!P.dead || !P.downed) return;
    P.dead = false; P.downed = false; P.downT = 0; P.hp = Math.round(P.maxHp * .45); P.invuln = 2.5; P.deadT = 0;
    setFlash(P.model, false);
    G.fx.ring(P.x, P.y, P.z, 7, 0xffd070, 36); G.fx.burst(P.x, P.y + 1.5, P.z, 0xffd070, 28, 6, .22, .9, -2); G.audio?.lantern();
    G.ui.banner('Wieder auf den Beinen', `${this.remote?.name || 'Dein Mitspieler'} hat dich gerettet`);
  }

  // ── Tauschen ──
  giveItem(id) {
    const P = G.player, it = ITEMS[id];
    if (!this.remote || !it || it.t === 'quest' || !P.inv[id] || (P.isEquipped(id) && P.inv[id] <= 1)) { G.audio?.deny(); return; }
    P.removeItem(id); this.send({ t: 'give', id, n: 1 }); G.audio?.item(it); G.ui.toast(`${it.n} an ${this.remote.name} gegeben`, 'item'); this.afterTrade();
  }
  giveGold(n) {
    const P = G.player; n = Math.min(n, P.gold);
    if (!this.remote || n <= 0) { G.audio?.deny(); return; }
    P.gold -= n; this.send({ t: 'give', gold: n }); G.audio?.coins(n); G.ui.toast(`${n} Gold an ${this.remote.name} gegeben`, 'gold'); this.afterTrade();
  }
  onGive(m) {
    const P = G.player, name = this.remote?.name || 'Mitspieler';
    if (m.gold) { const n = num(m.gold, 0, 1e7) | 0; if (n > 0) { P.gold += n; G.audio?.coins(n); G.ui.toast(`${name} gibt dir ${n} Gold`, 'gold'); } } else if (ITEMS[m.id] && ITEMS[m.id].t !== 'quest') { P.addItem(m.id, 1, true); G.audio?.item(ITEMS[m.id]); G.ui.toast(`${name} gibt dir: ${ITEMS[m.id].n}`, 'item'); }
    this.afterTrade();
  }
  afterTrade() { if (this.isGuest) this.saveChar(); else G.game.autosave(); this.refresh(); }

  // ── Duell ──
  askDuel() {
    const R = this.remote;
    if (!R || this.duel || R.area !== this.area() || G.player.dead || R.dead) { G.audio?.deny(); return; }
    this.duel = { state: 'asked' }; this.send({ t: 'duel', a: 'ask' }); G.ui.toast(`Duell-Anfrage an ${R.name} gesendet`, 'quest'); this.refresh();
  }
  answerDuel(yes) {
    if (this.duel?.state !== 'incoming') return;
    this.send({ t: 'duel', a: yes ? 'yes' : 'no' });
    if (yes) this.startDuel(); else { this.duel = null; G.netui.ask(null); this.refresh(); }
  }
  startDuel() { this.duel = { state: 'count', t: 3 }; G.netui.ask(null); G.ui.banner('Duell', 'Beginnt in 3 Sekunden'); G.audio?.roar(); this.refresh(); }
  onDuel(m) {
    const R = this.remote; if (!R) return;
    if (m.a === 'ask') {
      if (this.duel) { this.send({ t: 'duel', a: 'no' }); return; }
      this.duel = { state: 'incoming', t: 20 }; G.netui.ask(`${R.name} fordert dich zum Duell`); G.audio?.quest(); this.refresh();
    } else if (m.a === 'yes' && this.duel?.state === 'asked') this.startDuel();
    else if (m.a === 'no') { if (this.duel?.state === 'asked') G.ui.toast(`${R.name} hat das Duell abgelehnt`, 'warn'); this.duel = null; G.netui.ask(null); this.refresh(); } else if (m.a === 'lost') this.endDuel(true);
    else if (m.a === 'end') this.endDuel(null);
  }
  updateDuel(dt) {
    const D = this.duel, R = this.remote;
    if (!D || !R) return;
    if (D.state === 'incoming') { D.t -= dt; if (D.t <= 0) this.answerDuel(false); return; }
    if (D.state === 'count') { D.t -= dt; if (D.t <= 0) { D.state = 'run'; G.ui.banner('Kämpft!', ''); G.audio?.boom(); this.refresh(); } return; }
    if (D.state === 'run' && (R.area !== this.area() || Math.hypot(R.x - G.player.x, R.z - G.player.z) > DUEL_RANGE || G.player.dead || R.dead)) { this.send({ t: 'duel', a: 'end' }); this.endDuel(null); }
  }
  duelLost() { if (!this.duelOn) return; this.send({ t: 'duel', a: 'lost' }); this.endDuel(false); }
  endDuel(won) {
    if (!this.duel) return;
    const P = G.player, name = this.remote?.name || 'Mitspieler', ran = this.duel.state === 'run';
    this.duel = null; G.netui.ask(null);
    if (ran && won !== null) { G.ui.banner(won ? 'Sieg' : 'Niederlage', won ? `Du hast ${name} besiegt` : `${name} hat dich besiegt`); G.audio?.[won ? 'victory' : 'deny'](); }
    else if (ran) G.ui.toast('Duell abgebrochen', 'warn');
    if (ran && !P.dead) { P.hp = P.maxHp; P.mp = P.maxMp; P.st = P.maxSt; P.invuln = 1.5; }
    this.refresh();
  }
  pvpMelee(P, fx, fz, R, arc, dmg) {
    const T = this.remote;
    if (!this.duelOn || !T || T.dead) return false;
    const dx = T.x - P.x, dz = T.z - P.z, d = Math.hypot(dx, dz);
    if (d > R + .7 || (d > .4 && Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)) > arc)) return false;
    this.pvp(dmg);
    return true;
  }
  pvpArea(x, z, r, dmg) { const T = this.remote; if (this.duelOn && T && !T.dead && Math.hypot(T.x - x, T.z - z) < r + .7) this.pvp(dmg); }
  pvpBolt(b) {
    const T = this.remote;
    if (!this.duelOn || !T || T.dead || b.hitPeer) return false;
    if (Math.hypot(b.x - T.x, b.z - T.z) > 1.3 || Math.abs(b.y - (T.y + 1.4)) > 2.4) return false;
    b.hitPeer = true; this.pvp(b.dmg);
    return true;
  }
  pvp(dmg) {
    const P = G.player;
    this.send({ t: 'pvp', d: Math.max(1, Math.round(dmg * .55)), x: r1(P.x), z: r1(P.z) });
    if (this.remote) G.fx.burst(this.remote.x, this.remote.y + 1.6, this.remote.z, 0xff3a2a, 10, 6, .2, .45);
    G.audio?.hit();
  }
}
export { groundY };
