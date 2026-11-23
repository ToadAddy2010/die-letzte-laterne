import * as THREE from '../vendor/three.module.js';
import { G } from './game/state.js';
import { Retro, GFX, Kit } from './core/gfx.js';
import { Input } from './core/input.js';
import { UI } from './ui/ui.js';
import { H, buildTerrain, Terrain, roadLines, regionAt, heightAt } from './world/terrain.js';
import { Props } from './world/props.js';
import { Sky } from './world/sky.js';
import { buildStructures } from './world/buildings.js';
import { Dungeon, THEMES } from './world/dungeon.js';
import { Player } from './actors/player.js';
import { Mount } from './actors/mount.js';
import { Enemies } from './actors/enemies.js';
import { NPCs } from './actors/npc.js';
import { FX, groundY } from './game/fx.js';
import { Quests } from './game/quests.js';
import { Dialog } from './game/dialog.js';
import { Cutscene } from './game/cutscene.js';
import { Interact } from './game/interact.js';
import { Audio2 } from './game/audio.js';
import { Net } from './game/net.js';
import { NetUI } from './ui/netui.js';
import { Touch } from './ui/touch.js';
import { Explore } from './game/explore.js';
import { Tutorial } from './game/tutorial.js';
import { POIS, POI } from './data/world.js';
import { QUESTS } from './data/quests.js';
import { ITEMS } from './data/items.js';
import { nextFrame } from './core/util.js';

const outdoorFog = () => (G.settings.low ? .0062 : .0034);
const SAVE = i => `letzte-laterne-save-${i}`;
const SETTINGS = 'letzte-laterne-settings';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

const game = G.game = {
  saveSettings() { store.set(SETTINGS, JSON.stringify(G.settings)); },
  /** Sparmodus: weniger Pflanzen und kürzere Sichtweite für schwächere Geräte. */
  applyQuality() {
    const low = !!G.settings.low, f = G.focus || G.player || { x: 0, z: 180 }, T = G.terrain;
    G.props.radius = low ? 2 : 3; G.props.grassRadius = low ? 1 : 2; G.props.thin = low; if (G.sky) G.sky.dir.castShadow = !low;
    T.baseRadius ??= T.radius;
    T.radius = low ? Math.max(3, T.baseRadius - 2) : T.baseRadius;
    if (!G.inDungeon) { G.scene.fog.density = outdoorFog(); T.flush(f.x, f.z); G.props.update(f.x, f.z, true); G.structures?.update(f.x, f.z); }
  },
  resumeLock() { if (G.mode === 'play' && !G.test) Input.lock(); },
  snapshot() {
    const P = G.player, w = G.inDungeon ? G.worldPos : P;
    return {
      v: 1, when: Date.now(), hour: G.hour, day: G.day, t: G.t, flags: G.flags, discovered: G.discovered, opened: G.opened, shards: G.shards, tablets: G.tablets, killed: G.killed, bossDead: G.bossDead, seen: G.seen, stats: G.stats, fog: G.ui.fogOut(), quests: G.quests.toJSON(),
      p: { x: w.x, z: w.z, yaw: P.yaw, camYaw: P.camYaw, level: P.level, xp: P.xp, pts: P.pts, kraft: P.kraft, geist: P.geist, ausdauer: P.ausdauer, hp: P.hp, mp: P.mp, gold: P.gold, inv: P.inv, equip: P.equip, spells: P.spells, lastShrine: P.lastShrine, flame: P.flame },
    };
  },
  save(i) { if (G.net?.isGuest) { G.net.saveChar(); return; } store.set(SAVE(i), JSON.stringify(this.snapshot())); },
  autosave() { if (G.mode !== 'menu' && G.player && !G.player.dead) this.save(0); },
  slotInfo(i) {
    const s = store.get(SAVE(i)); if (!s) return null;
    try { const d = JSON.parse(s), q = d.quests?.tracked ? QUESTS[d.quests.tracked]?.title : ''; return `Stufe ${d.p.level} · ${new Date(d.when).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}${q ? ` · ${q}` : ''}`; } catch { return null; }
  },
  resetWorld() {
    G.tutorial?.stop(); G.explore?.reset();
    G.mount.reset();
    G.fx.clear(); G.enemies.clear(); G.interact.clearAllPickups(); G.interact.clearDungeon();
    if (G.inDungeon) { G.dungeon.leave(); G.inDungeon = null; G.worldGroup.visible = true; G.scene.background = null; G.scene.fog.density = outdoorFog(); }
    G.enemies.camps = {};
    for (const id in G.shrineFlames) G.shrineFlames[id].visible = false;
    Object.assign(G, { t: G.t, flags: {}, discovered: {}, opened: {}, shards: {}, tablets: {}, killed: {}, bossDead: {}, seen: {}, moonGaze: 0, moonGazeT: 170, focus: null, forceMoonOpen: undefined, hitstop: 0, shake: 0, stats: { kills: 0, deaths: 0, played: 0, gold: 0, quests: 0, chests: 0 } });
    G.ui.fog.fill(0);
    G.quests.reset();
  },
  newGame(tutorial = false) {
    G.audio.init();
    this.resetWorld();
    G.player.reset(); G.player.rebuild();
    G.hour = 21; G.day = 1;
    G.player.place(5, 186); G.player.yaw = Math.PI; G.player.camYaw = 0; G.player.dead = false;
    G.ui.title(false);
    G.currentRegion = null;
    this.stream(true);
    G.quests.accept('m01', true);
    G.mode = 'play'; G.ui.show(true); G.ui.refreshTracker();
    G.cut.play('intro', () => { G.ui.banner('Morgenkappe', 'Die Pilzmark'); if (tutorial) G.tutorial.start(); else G.ui.subtitle(G.touch.on ? 'Links wischen zum Laufen, rechts für die Kamera. Tippe auf die Anzeige, um zu sprechen.' : 'W A S D zum Laufen, Maus für die Kamera, E zum Sprechen.', 8); game.autosave(); });
  },
  load(i) {
    const s = store.get(SAVE(i)); if (!s) return;
    let d; try { d = JSON.parse(s); } catch { G.ui.toast('Spielstand beschädigt', 'warn'); return; }
    G.audio.init();
    this.resetWorld();
    for (const k of ['flags', 'discovered', 'opened', 'shards', 'tablets', 'killed', 'bossDead', 'seen', 'stats']) G[k] = d[k] || G[k];
    G.hour = d.hour; G.day = d.day; G.t = d.t || 0;
    G.ui.fogIn(d.fog);
    const P = G.player; P.reset();
    Object.assign(P, { level: d.p.level, xp: d.p.xp, pts: d.p.pts, kraft: d.p.kraft, geist: d.p.geist, ausdauer: d.p.ausdauer, gold: d.p.gold, inv: d.p.inv, equip: d.p.equip, spells: d.p.spells, lastShrine: d.p.lastShrine, flame: d.p.flame ?? null, yaw: d.p.yaw, camYaw: d.p.camYaw, dead: false });
    P.recalc(); P.hp = Math.max(1, Math.min(d.p.hp, P.maxHp)); P.mp = Math.min(d.p.mp, P.maxMp); P.st = P.maxSt; P.rebuild();
    P.place(d.p.x, d.p.z);
    G.quests.load(d.quests);
    G.interact.refreshOpened();
    G.ui.title(false); G.ui.deadScreen(false);
    G.currentRegion = null; G.mode = 'play'; G.ui.show(true); G.ui.refreshTracker();
    this.stream(true); this.resumeLock();
    G.ui.toast('Spielstand geladen', 'quest');
    if (!G.flags.borke && G.quests.isDone('m02') && !G.quests.state.s_borke) G.ui.toast('Hirtin Wenke in Morgenkappe vermisst ihren Elch', 'quest');
  },
  guestSave() {
    const P = G.player;
    return { v: 1, when: Date.now(), discovered: G.discovered, opened: G.opened, shards: G.shards, tablets: G.tablets, killed: G.killed, seen: G.seen, stats: G.stats, fog: G.ui.fogOut(), borke: G.flags.borke || 0, p: { level: P.level, xp: P.xp, pts: P.pts, kraft: P.kraft, geist: P.geist, ausdauer: P.ausdauer, hp: P.hp, mp: P.mp, gold: P.gold, inv: P.inv, equip: P.equip, spells: P.spells, lastShrine: P.lastShrine, flame: P.flame } };
  },
  /** Der Mitspieler betritt die Welt des Gastgebers mit seiner eigenen Figur. */
  startGuest(save, w) {
    G.audio.init();
    this.resetWorld();
    const P = G.player, s = save?.p; P.reset();
    if (s && ITEMS[s.equip?.weapon] && ITEMS[s.equip?.armor]) {
      for (const k of ['discovered', 'opened', 'shards', 'tablets', 'killed', 'seen']) if (save[k] && typeof save[k] === 'object') G[k] = save[k];
      if (save.stats) G.stats = save.stats;
      Object.assign(P, { level: s.level, xp: s.xp, pts: s.pts, kraft: s.kraft, geist: s.geist, ausdauer: s.ausdauer, gold: s.gold, inv: s.inv, equip: s.equip, spells: s.spells, lastShrine: POI[s.lastShrine] ? s.lastShrine : 's_hutdorf', flame: s.flame ?? null });
      if (save.fog) G.ui.fogIn(save.fog);
    }
    P.recalc(); P.hp = s ? Math.max(1, Math.min(s.hp, P.maxHp)) : P.maxHp; P.mp = s ? Math.min(s.mp, P.maxMp) : P.maxMp; P.st = P.maxSt; P.dead = false; P.rebuild();
    G.hour = w.h; G.day = w.day; G.moonGaze = w.g || 0; G.bossDead = w.bossDead || {};
    if (w.borke || save?.borke) G.flags.borke = 1;
    G.interact.refreshOpened();
    G.ui.title(false); G.ui.deadScreen(false); $titlePaneHide();
    G.currentRegion = null; G.mode = 'play'; G.ui.show(true);
    if (w.dungeon && POI[w.dungeon]) this.enterDungeon(POI[w.dungeon], true);
    else { const q = w.door ? { x: w.door[0], z: w.door[1] } : { x: w.x, z: w.z }; P.place(q.x + 2.4, q.z + 1.6); this.stream(true); }
    G.quests.mirror(w.q?.state, w.q?.tracked);
    G.ui.refreshTracker(); this.resumeLock();
    G.ui.banner('Willkommen', 'Du spielst jetzt gemeinsam');
  },
  toMenu() {
    if (G.net?.role) G.net.leave();
    G.tutorial?.stop(); G.explore?.reset();
    G.mount.reset();
    G.fx.clear(); G.enemies.clear();
    if (G.inDungeon) { G.dungeon.leave(); G.interact.clearDungeon(); G.inDungeon = null; G.worldGroup.visible = true; G.scene.background = null; G.scene.fog.density = outdoorFog(); }
    G.mode = 'menu'; Input.unlock();
    G.ui.dialog(null); G.ui.deadScreen(false); G.ui.show(false);
    G.hour = 21;
    G.player.place(5, 186); G.terrain.flush(0, 180); G.props.update(0, 180, true);
    G.ui.title(true, !!store.get(SAVE(0)));
    if (G.net.isInvited) G.netui.joinPane(G.net.lastCode);
  },
  stream(force) {
    const f = G.focus || G.player;
    if (force) { G.terrain.flush(f.x, f.z); G.props.update(f.x, f.z, true); }
    G.structures.update(f.x, f.z);
  },
  fastTravel(p) {
    if (G.house) this.exitDungeon(true);
    G.ui.fadeFlash(); G.fx.clear(); if (!G.net?.active) G.enemies.clear();
    const P = G.player, a = Math.random() * 6.28;
    P.place(p.x + Math.cos(a) * 6, p.z + Math.sin(a) * 6);
    this.stream(true); G.audio?.lantern();
  },
  enterDungeon(poi, fromHost = false) {
    if (G.net?.isGuest && !fromHost) { G.ui.toast('Der Gastgeber öffnet die Dungeons, ihr geht dann gemeinsam rein', 'warn'); G.audio?.deny(); return; }
    if (!fromHost && poi.id === 'zitadelle' && (G.quests.flames() < 4 || !G.player.count('zeitfeder'))) { G.ui.toast(G.quests.flames() < 4 ? `Das Tor reagiert nur auf vier Flammen (${G.quests.flames()} von 4)` : 'Das Tor bleibt verschlossen. Du brauchst die Zeitfeder.', 'warn'); G.audio?.deny(); return; }
    G.mount.dismount();
    G.ui.fadeFlash(); G.fx.clear();
    G.worldPos = { x: G.player.x, z: G.player.z };
    G.enemies.clear();
    const a = G.dungeon.enter(poi);
    G.inDungeon = poi.id; G.worldGroup.visible = false;
    G.scene.background = new THREE.Color(THEMES[poi.theme].fog);
    G.scene.fog.color.set(THEMES[poi.theme].fog); G.scene.fog.density = .017;
    if (!G.net?.isGuest) G.enemies.enterDungeon(a);
    G.interact.enterDungeon(a);
    G.player.lock = null; G.player.place(a.start.x, a.start.z, 0); G.player.yaw = Math.PI; G.player.camYaw = 0;
    G.ui.banner(poi.name, `Empfohlen ab Stufe ${poi.lvl}`);
    this.save(0);
    G.net?.hostMoved(poi.id);
  },
  enterHouse(h) {
    G.mount.dismount();
    G.ui.fadeFlash(); G.fx.clear(); G.audio?.door();
    G.worldPos = { x: h.doorX, z: h.doorZ };
    G.enemies.clear();
    const a = G.dungeon.enterHouse(h);
    G.house = h; G.inDungeon = h.id; G.worldGroup.visible = false;
    G.scene.background = new THREE.Color(0x07060c);
    G.scene.fog.color.set(0x1a1218); G.scene.fog.density = .006;
    G.interact.enterHouse(a); G.npcs.enterHouse(h, a);
    const P = G.player;
    P.lock = null; P.place(a.start.x, a.start.z, 0); P.yaw = Math.PI; P.camYaw = 0; P.camPitch = Math.min(P.camPitch, .3); P.camY = undefined;
    G.ui.subtitle(h.name, 2.6);
  },
  exitDungeon(quiet, fromHost = false) {
    if (!G.inDungeon) return;
    if (G.net?.isGuest && !G.house && !fromHost) { G.ui.toast('Der Gastgeber führt die Gruppe aus dem Dungeon', 'warn'); G.audio?.deny(); return; }
    const house = G.house, poi = house ? null : POI[G.inDungeon];
    if (!quiet) G.ui.fadeFlash();
    G.fx.clear(); G.enemies.clear(); G.dungeon.leave(); G.interact.clearDungeon();
    G.inDungeon = null; G.worldGroup.visible = true; G.scene.background = null; G.scene.fog.density = outdoorFog();
    G.player.lock = null; G.player.camY = undefined; G.player.model.root.visible = true;
    if (house) { G.audio?.door(); G.player.place(house.doorX, house.doorZ); G.player.yaw = house.yaw; G.player.camYaw = house.yaw + Math.PI; }
    else { G.player.place(poi.x, poi.z + 12); G.player.yaw = 0; G.player.camYaw = Math.PI; G.currentRegion = null; }
    G.skySnap = true;
    this.stream(true);
    if (!house) G.net?.hostMoved(null);
  },
  onDeath() { G.mode = 'dead'; Input.unlock(); G.audio?.setBattle(0); G.audio?.death(); setTimeout(() => { if (G.mode === 'dead') G.ui.deadScreen(true); }, 1300); },
  respawn() {
    const P = G.player;
    G.ui.deadScreen(false); G.fx.clear();
    const team = G.net?.active && !G.net.remote.dead;
    P.dead = false; P.downed = false; P.downT = 0; P.gold = Math.floor(P.gold * .9); P.hp = P.maxHp; P.mp = P.maxMp; P.st = P.maxSt; P.lock = null; P.invuln = 2; P.vy = 0;
    if (G.house) P.place(G.dungeon.active.start.x, G.dungeon.active.start.z, 0);
    else if (G.inDungeon) { const a = G.dungeon.active; if (!team && !G.net?.isGuest) G.enemies.enterDungeon(a); P.place(a.start.x, a.start.z, 0); }
    else { if (!team && !G.net?.isGuest) G.enemies.clear(); const s = POI[P.lastShrine]; P.place(s.x + 5, s.z + 4); this.stream(true); }
    G.mode = 'play'; G.ui.show(true); G.ui.refreshTracker(); this.resumeLock();
  },
  showEnding(e) {
    G.mode = 'end'; Input.unlock(); G.ui.show(false); G.audio?.victory();
    G.ui.credits(e, () => { G.mode = 'play'; G.ui.show(true); game.autosave(); game.resumeLock(); });
    this.save(0);
  },
};
const $titlePaneHide = () => { document.getElementById('titlePane').style.display = 'none'; };
const TOWNS = POIS.filter(p => p.type === 'town');
let inTown = null;
/** Welche Musik gerade passt: Ort, Gebäude, Dungeon, Tageszeit oder Mondereignis. */
function musicScene() {
  if (G.mode === 'menu') return 'title';
  if (G.cut.active) return 'story';
  if (G.house) return `house:${G.house.kind}`;
  if (G.inDungeon) return `dungeon:${POI[G.inDungeon]?.theme}`;
  if (G.moonGaze > 0) return 'moon';
  const P = G.player, reg = regionAt(P.x, P.z), night = G.sky.day < .3 ? 1 : 0;
  if (inTown && Math.hypot(inTown.x - P.x, inTown.z - P.z) > inTown.r + 26) inTown = null;
  if (!inTown) inTown = TOWNS.find(t => Math.hypot(t.x - P.x, t.z - P.z) < t.r) || null;
  return `${inTown ? 'town' : 'wild'}:${reg.music}:${night}`;
}

async function boot() {
  try { Object.assign(G.settings, JSON.parse(store.get(SETTINGS) || '{}')); } catch { /* optional */ }
  const oldGfx = JSON.parse(store.get(SETTINGS) || '{}').gfx === undefined && store.get(SETTINGS);
  if (oldGfx || (G.settings.gfx ?? 0) < 3) { if (!matchMedia('(pointer: coarse)').matches) G.settings.lines = 1080; else G.settings.lines = Math.max(G.settings.lines, 540); G.settings.gfx = 3; G.settings.retro = false; if (store.get(SETTINGS)) store.set(SETTINGS, JSON.stringify(G.settings)); }
  if (!store.get(SETTINGS) && matchMedia('(pointer: coarse)').matches) { const short = Math.min(innerWidth, innerHeight); G.settings.lines = short < 560 ? 540 : 720; G.settings.low = short < 560; }
  G.test = new URLSearchParams(location.search).has('test');
  G.ui = new UI();
  G.ui.loading(.02);
  await nextFrame();
  G.retro = new Retro(document.getElementById('c')); G.retro.lines = G.settings.lines; G.retro.setStyle(G.settings.retro);
  Kit.detail = G.settings.low || matchMedia('(pointer: coarse)').matches ? 0 : 1;
  G.retro.onSlow = () => { if (G.settings.low || G.mode !== 'play') return; G.settings.low = true; game.applyQuality(); game.saveSettings(); G.ui.toast('Sparmodus aktiviert, damit es flüssiger läuft', 'quest'); };
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, 1, .25, 4200);
  G.retro.resize(G.camera);
  addEventListener('resize', () => G.retro.resize(G.camera));
  G.worldGroup = new THREE.Group(); G.scene.add(G.worldGroup);
  const mark = (n, t = performance.now()) => { (G.bootLog ??= {})[n] = Math.round(t - (G.bootT ?? t)); G.bootT = t; };
  mark('start');
  await buildTerrain(G.ui.loading.bind(G.ui));
  mark('terrain');
  G.heights = H; G.roadLines = roadLines;
  G.ui.loading(.64, 'Häuser werden gebaut'); await nextFrame();
  G.terrain = new Terrain(G.worldGroup);
  mark('meshes');
  G.structures = buildStructures(G.worldGroup);
  mark('structures');
  G.ui.loading(.8, 'Pilze wachsen'); await nextFrame();
  G.props = new Props(G.worldGroup);
  mark('props');
  G.sky = new Sky(G.scene, G.worldGroup);
  if (G.settings.low) game.applyQuality();
  G.dungeon = new Dungeon(G.scene);
  G.fx = new FX(G.scene);
  G.audio = new Audio2(G.settings);
  G.seen = {};
  G.ui.loading(.9, 'Die Bewohner erwachen'); await nextFrame();
  G.quests = new Quests();
  G.enemies = new Enemies();
  G.npcs = new NPCs(G.scene);
  G.interact = new Interact(G.scene);
  G.player = new Player(G.scene);
  G.mount = new Mount(G.scene);
  G.net = new Net(G.scene);
  G.netui = new NetUI();
  G.explore = new Explore(G.scene);
  G.tutorial = new Tutorial();
  G.dialog = new Dialog();
  G.cut = new Cutscene();
  Input.init(document.getElementById('c'), () => { if (G.mode === 'play') G.ui.openPanel('sys'); });
  G.touch = new Touch(document.getElementById('c'));
  document.getElementById('c').addEventListener('click', () => { if (G.mode === 'play' && !Input.locked) Input.lock(); });
  mark('actors');
  G.ui.loading(1, 'Bereit');
  G.player.place(5, 186);
  G.terrain.flush(0, 180); G.props.update(0, 180, true); G.structures.update(0, 180);
  mark('stream');
  G.skySnap = true;
  await nextFrame();
  G.ui.doneLoading();
  G.mode = 'menu';
  G.ui.title(true, !!store.get(SAVE(0)));
  if (G.net.available && (G.net.isInvited || G.netui.invite())) G.netui.joinPane();
  if (G.test) window.__ll = { G, Input, game, QUESTS, POI, POIS, frame: step };
  last = performance.now();
  requestAnimationFrame(loop);
}

let last = 0, tick = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  step(dt);
}
const skyTarget = new THREE.Vector3();
function step(rawDt) {
  let dt = rawDt;
  if (G.hitstop > 0) { G.hitstop -= rawDt; dt = rawDt * .15; }
  G.dt = dt;
  G.touch.update(); G.touch.perf(rawDt);
  const mode = G.mode, cam = G.camera, P = G.player;
  const live = !!G.net?.active;
  if (mode !== 'panel' || live) G.t += dt;
  if (mode === 'menu') {
    G.hour = 21.4;
    const a = G.t * .045, r = 86;
    cam.position.set(Math.cos(a) * r, heightAt(Math.cos(a) * r, 180 + Math.sin(a) * r) + 24, 180 + Math.sin(a) * r);
    cam.lookAt(0, 22, 180);
  }
  if (mode === 'play') {
    if (G.house) { G.hour += dt / 60; if (G.hour >= 24) { G.hour -= 24; G.day++; } }
    if (!G.inDungeon) {
      G.hour += dt / 60;
      if (G.hour >= 24) { G.hour -= 24; G.day++; }
      if (G.moonGaze > 0) { G.moonGaze -= dt; if (G.moonGaze <= 0) G.ui.toast('Der Mond wendet den Blick ab', 'spell'); }
      else if (G.sky.day < .3 && !G.net?.isGuest) { G.moonGazeT -= dt; if (G.moonGazeT <= 0) { G.moonGazeT = 170 + Math.random() * 110; G.moonGaze = 28; G.ui.banner('Der Mond schaut zu', 'Alle Feinde sind jetzt stärker'); G.audio?.roar(); } }
      const reg = regionAt(P.x, P.z);
      if (reg !== G.currentRegion) { G.currentRegion = reg; G.ui.banner(reg.name, `Stufe ${reg.lvl}`); }
    }
    G.stats.played += rawDt;
    if (!G.inDungeon && G.sky.day < .55 && Math.random() < dt * 11) {
      const a = Math.random() * 6.283, r = 5 + Math.random() * 30, id = G.currentRegion?.id;
      const c = id === 'ash' ? 0xff7a28 : id === 'frost' ? 0xdff0ff : id === 'desert' ? 0xffd070 : id === 'moor' ? 0x7ff2c8 : Math.random() < .5 ? 0xfff0a0 : 0x7fd8ff;
      G.fx.burst(P.x + Math.cos(a) * r, P.y + .8 + Math.random() * 5, P.z + Math.sin(a) * r, c, 1, .55, .14, 2.8, -.12);
    }
    tick -= dt;
    if (tick <= 0) {
      tick = .4;
      if (!G.inDungeon) {
        G.ui.reveal(P.x, P.z);
        for (const p of POIS) if (!G.seen[p.id] && Math.hypot(p.x - P.x, p.z - P.z) < Math.max(38, p.r + 16)) {
          G.seen[p.id] = 1;
          if (p.type !== 'shrine' && p.type !== 'camp') { G.ui.toast(`Entdeckt: ${p.name}`, 'quest'); P.addXp(p.type === 'town' ? 30 : 15); }
        }
      }
      G.quests.reachCheck(P);
    }
    if (Input.hit('Tab') || Input.hit('KeyI')) G.ui.openPanel('inv');
    else if (Input.hit('KeyK')) G.ui.openPanel('char');
    else if (Input.hit('KeyJ')) G.ui.openPanel('quest');
    else if (Input.hit('KeyM')) G.ui.openPanel('map');
    else if (Input.hit('Escape')) G.ui.openPanel('sys');
    else if (Input.hit('KeyP') && G.net.available) G.ui.openPanel('party');
    else if (Input.hit('Enter') && G.net.active) G.netui.openChat();
    if (G.net.duel?.state === 'incoming') { if (Input.hit('KeyB')) G.net.answerDuel(true); else if (Input.hit('KeyV')) G.net.answerDuel(false); }
    if (Input.hit('KeyN')) G.ui.toast(G.audio.toggleMute() ? 'Ton aus' : 'Ton an', 'quest');
  } else if (mode === 'panel') G.ui.panelKeys();
  else if (mode === 'dead' && Input.hit('Enter') && document.getElementById('dead').style.display === 'flex') game.respawn();

  if ((G.mode !== 'panel' || live) && G.mode !== 'menu') {
    P.update(dt);
    G.mount.update(dt);
    if (G.mode === 'play' || G.mode === 'dialog' || G.mode === 'dead') P.updateCamera(cam, dt);
    G.enemies.update(dt);
    G.npcs.update(dt);
    G.interact.update(dt);
    G.fx.update(dt);
    if (G.cut.active) G.cut.update(dt, cam);
  }
  const f = G.mode === 'menu' ? { x: 0, z: 180 } : (G.focus || P);
  if (!G.inDungeon) { G.terrain.update(f.x, f.z, G.t); G.props.update(f.x, f.z); G.structures.update(f.x, f.z); }
  skyTarget.set(f.x, G.inDungeon ? 0 : groundY(f.x, f.z), f.z);
  G.sky.update(dt, G.hour, cam, regionAt(f.x, f.z), skyTarget, G.skySnap);
  G.skySnap = false;
  if (G.house) { G.sky.hemi.intensity = 2.5; G.sky.hemi.color.set(0xffe0c0); G.sky.hemi.groundColor.set(0x6a4a3a); G.sky.dir.intensity = .55; G.sky.dir.color.set(0xffd8b0); G.sky.dir.position.set(G.player.x + 60, 160, G.player.z + 90); G.sky.dir.target.position.set(G.player.x, 0, G.player.z); }
  else if (G.inDungeon) { G.sky.hemi.intensity = 1.5; G.sky.hemi.color.set(0xb8b8e8); G.sky.dir.intensity = .9; }
  G.net.update(rawDt);
  G.explore.update(dt); G.tutorial.update(rawDt);
  G.audio.setScene(musicScene());
  G.ui.update(rawDt);
  G.retro.u.time.value = G.t; GFX.time.value = G.t;
  G.retro.u.fade.value = Math.max(0, G.retro.u.fade.value - rawDt * 1.3);
  if (!G.test) G.retro.adapt(rawDt * 1000);
  G.retro.render(G.scene, cam);
  Input.endFrame();
}

boot().catch(err => {
  console.error(err);
  const l = document.getElementById('loadMsg');
  if (l) l.textContent = `Fehler beim Start: ${err.message}`;
});
