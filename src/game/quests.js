import { G, on } from './state.js';
import { QUESTS } from '../data/quests.js';
import { NPCS } from '../data/npcs.js';
import { ITEMS } from '../data/items.js';
import { POI, POIS } from '../data/world.js';
import { PACKS, BOSSES, WORLD_BOSSES } from '../data/enemies.js';

const FLAMES = ['m05', 'm07', 'm09', 'm11'];

const CAMPS = POIS.filter(p => p.type === 'camp');
const bossPoi = id => POIS.find(p => p.type === 'dungeon' && p.boss === id) || POI[Object.keys(WORLD_BOSSES).find(k => WORLD_BOSSES[k] === id)];

export class Quests {
  constructor() {
    this.state = {}; this.tracked = null; this.pendingScene = null;
    on('kill', t => this.onKill(t));
    on('boss', id => this.onBoss(id));
    on('item', id => this.onItem(id));
  }
  reset() { this.state = {}; this.tracked = null; this.pendingScene = null; }
  q(id) { return QUESTS[id]; }
  isDone(id) { return this.state[id]?.done === true; }
  isActive(id) { return !!this.state[id] && !this.state[id].done; }
  activeIds() { return Object.keys(this.state).filter(id => !this.state[id].done); }
  doneIds() { return Object.keys(this.state).filter(id => this.state[id].done); }
  step(id) { const st = this.state[id]; return st && !st.done ? QUESTS[id].steps[st.s] : null; }
  canOffer(id) {
    const Q = QUESTS[id];
    if (this.state[id] || Q.auto) return false;
    return (Q.req || []).every(r => this.isDone(r));
  }
  offers(npc) { return Object.values(QUESTS).filter(Q => Q.giver === npc && this.canOffer(Q.id)); }
  talkSteps(npc) { return this.activeIds().filter(id => { const s = this.step(id); return s?.k === 'talk' && s.npc === npc; }); }
  markerFor(npc) {
    if (this.talkSteps(npc).length) return 'talk';
    const o = this.offers(npc);
    if (o.some(Q => Q.type === 'main')) return 'main';
    return o.length ? 'offer' : null;
  }
  /** Der Mitspieler sieht die Quests des Gastgebers und schickt seine Aktionen an ihn. */
  mirror(state, tracked) {
    this.state = state && typeof state === 'object' ? state : {}; this.tracked = tracked || null; this.pendingScene = null;
    G.interact.clearAllPickups();
    for (const id of this.activeIds()) { const s = this.step(id); if (s?.k === 'get') G.interact.spawnPickups(id, s); }
    G.ui.refreshTracker();
  }
  accept(id, quiet) {
    if (this.state[id]) return;
    if (G.net?.isGuest) { G.net.send({ t: 'q', a: 'accept', id }); this.state[id] = { s: 0, c: 0, done: false }; G.ui.questPop('Neuer Auftrag', QUESTS[id].title); G.audio?.quest(); G.ui.refreshTracker(); return; }
    this.state[id] = { s: 0, c: 0, done: false };
    const Q0 = QUESTS[id], cur = this.tracked && QUESTS[this.tracked];
    if (!quiet) {
      G.ui.questPop('Neuer Auftrag', Q0.title); G.audio?.quest();
      if (Q0.intro) G.ui.whisper(Q0.intro.n, Q0.intro.lines);
      if (Q0.outro && Q0.type === 'side' && !G.flags.tipVoice) { G.flags.tipVoice = 1; G.ui.subtitle('Du musst danach nicht zurückkommen. Die Laterne trägt die Antwort zu dir.', 7); }
    }
    if (!cur || this.isDone(this.tracked) || (Q0.type === 'main' && cur.type !== 'main')) this.tracked = id;
    this.enterStep(id);
  }
  enterStep(id) {
    const st = this.state[id], s = QUESTS[id].steps[st.s]; st.c = 0;
    if (!s) return this.complete(id);
    if (s.k === 'talk' && s.takeAfter && s.give && !G.player.count(s.give)) G.player.addItem(s.give);
    if (s.k === 'get') { st.c = Math.min(s.n, G.player.count(s.item)); G.interact.spawnPickups(id, s); if (st.c >= s.n) return this.advance(id); }
    if (s.k === 'drop') { st.c = Math.min(s.n, G.player.count(s.item)); if (st.c >= s.n) return this.advance(id); }
    if (s.k === 'boss' && G.bossDead[s.id]) return this.advance(id);
    if (s.k === 'scene') this.pendingScene = { id, scene: s.id, now: !!s.now };
    G.ui.refreshTracker();
  }
  /** Startet alle Hauptaufträge, deren Voraussetzungen erfüllt sind. */
  autoStart() {
    if (G.net?.isGuest) return;
    for (const Q of Object.values(QUESTS)) if (Q.auto && Q.id !== 'm01' && !this.state[Q.id] && (Q.req || []).every(r => this.isDone(r))) this.accept(Q.id);
  }
  flames() { return FLAMES.filter(id => this.isDone(id)).length; }
  advance(id) {
    if (G.net?.isGuest) return;
    const st = this.state[id]; if (!st || st.done) return;
    G.interact.clearPickups(id);
    st.s++;
    if (st.s >= QUESTS[id].steps.length) this.complete(id);
    else { G.audio?.tick(); this.enterStep(id); }
    G.ui.refreshTracker();
  }
  complete(id) {
    const st = this.state[id], Q = QUESTS[id], R = Q.reward || {}, P = G.player;
    if (st.done) return;
    st.done = true; G.stats.quests++;
    G.net?.sendReward(R, Q.title);
    G.ui.questPop('Auftrag abgeschlossen', Q.title); G.audio?.questDone();
    if (R.gold) P.addGold(R.gold);
    if (R.xp) { P.addXp(R.xp); G.ui.toast(`+${R.xp} EP`, 'xp'); }
    for (const it of R.items || []) P.addItem(it);
    if (R.spell) P.knowSpell(R.spell);
    const O = Q.outro;
    if (O) {
      if (O.take) P.removeItem(O.take[0], O.take[1]);
      if (O.give) P.addItem(O.give);
      G.ui.whisper(O.n || NPCS[O.npc]?.n || 'Stimme', O.lines);
    }
    if (Q.weaken) { G.flags[`weak_${Q.weaken}`] = 1; G.ui.toast(`${BOSSES[Q.weaken].n} ist jetzt geschwächt`, 'spell'); }
    if (this.tracked === id) this.tracked = this.activeIds().find(i => QUESTS[i].type === 'main') || this.activeIds()[0] || null;
    this.autoStart();
    G.game?.autosave();
    G.ui.refreshTracker();
  }
  finishTalk(id, choice) {
    const s = this.step(id), P = G.player;
    if (!s) return;
    if (G.net?.isGuest) {
      const st = this.state[id], next = st.s + 1;
      G.net.send({ t: 'q', a: 'talk', id, c: s.choice ? s.choice.indexOf(choice) : -1 });
      if (next >= QUESTS[id].steps.length) st.done = true; else { st.s = next; st.c = 0; }
      G.ui.refreshTracker();
      return;
    }
    if (s.take) P.removeItem(s.take[0], s.take[1]);
    if (s.takeAfter) P.removeItem(s.takeAfter, P.count(s.takeAfter));
    else if (s.give) P.addItem(s.give);
    if (choice?.flag) G.flags[choice.flag] = 1;
    this.advance(id);
  }
  onKill(type) {
    if (G.net?.isGuest) return;
    for (const id of this.activeIds()) {
      const s = this.step(id), st = this.state[id];
      if (s?.k === 'kill' && s.what.includes(type)) {
        st.c++;
        G.ui.toast(`${QUESTS[id].title}: ${Math.min(st.c, s.n)}/${s.n}`, 'quest');
        if (st.c >= s.n) this.advance(id); else G.ui.refreshTracker();
      } else if (s?.k === 'drop' && s.from.includes(type) && G.player.count(s.item) < s.n && Math.random() < s.chance) G.player.addItem(s.item);
    }
  }
  onBoss(bid) { if (G.net?.isGuest) return; for (const id of this.activeIds()) { const s = this.step(id); if (s?.k === 'boss' && s.id === bid) this.advance(id); } }
  onItem(item) {
    if (G.net?.isGuest) return;
    for (const id of this.activeIds()) {
      const s = this.step(id), st = this.state[id];
      if ((s?.k === 'get' || s?.k === 'drop') && s.item === item) {
        st.c = Math.min(s.n, G.player.count(item));
        if (st.c >= s.n) this.advance(id); else G.ui.refreshTracker();
      }
    }
  }
  reachCheck(P) {
    if (G.net?.isGuest) return;
    const R = G.net?.remote?.area === 'w' ? G.net.remote : null;
    for (const id of this.activeIds()) {
      const s = this.step(id);
      if (s?.k !== 'go' || G.inDungeon) continue;
      const p = POI[s.poi];
      if (p.type === 'shrine' && !G.discovered[p.id]) continue;
      const reach = Math.max(14, p.r + 6);
      if (Math.hypot(p.x - P.x, p.z - P.z) < reach || (R && Math.hypot(p.x - R.x, p.z - R.z) < reach)) {
        if (s.lines) G.ui.subtitle(s.lines[0], 6);
        this.advance(id);
      }
    }
    // Nach einem Boss darf man erst in Ruhe aus dem Dungeon gehen. Dann läuft die Szene.
    if (this.pendingScene && G.mode === 'play' && (!G.inDungeon || this.pendingScene.now)) {
      const { id, scene } = this.pendingScene; this.pendingScene = null;
      G.cut.play(scene, () => { const s = this.step(id); if (s?.k === 'scene') { if (s.mount) G.mount.unlock(); this.advance(id); } });
    }
  }
  stepText(id) {
    const s = this.step(id), st = this.state[id];
    if (!s) return '';
    if (s.k === 'kill' || s.k === 'get' || s.k === 'drop') return `${s.hint} (${Math.min(st.c, s.n)}/${s.n})`;
    return s.hint;
  }
  target(id) {
    const s = this.step(id); if (!s) return null;
    if (s.k === 'talk') { const p = G.npcs.pos(s.npc); return p && { ...p, n: NPCS[s.npc].n }; }
    if (s.k === 'go') { const p = POI[s.poi]; return { x: p.x, z: p.z, n: p.name }; }
    if (s.k === 'get') { const p = POI[s.at]; return { x: p.x, z: p.z, n: p.name }; }
    if (s.k === 'boss') { const p = bossPoi(s.id); return p && { x: p.x, z: p.z, n: BOSSES[s.id].n }; }
    if (s.k === 'kill' || s.k === 'drop') {
      if (s.at) { const p = POI[s.at]; return { x: p.x, z: p.z, n: p.name }; }
      const types = s.k === 'kill' ? s.what : s.from, P = G.player;
      let best = null, bd = 1e9;
      for (const c of CAMPS) { if (!PACKS[c.pack].some(t => types.includes(t))) continue; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; best = c; } }
      return best && { x: best.x, z: best.z, n: best.name };
    }
    return null;
  }
  trackedTarget() {
    if (this.tracked) { const t = this.target(this.tracked); if (t) return t; }
    const next = Object.values(QUESTS).find(Q => Q.type === 'main' && this.canOffer(Q.id));
    if (next) { const p = G.npcs.pos(next.giver); return p && { ...p, n: NPCS[next.giver].n, hint: `Sprich mit ${NPCS[next.giver].n}` }; }
    return null;
  }
  toJSON() { return { state: this.state, tracked: this.tracked }; }
  load(d) {
    this.state = d.state || {}; this.tracked = d.tracked || null; this.pendingScene = null;
    // Spielstände aus der Zeit vor der offenen Welt werden sanft übernommen.
    const old = !G.flags.questV;
    for (const id of Object.keys(this.state)) {
      const st = this.state[id];
      if (!QUESTS[id]) { delete this.state[id]; continue; }
      if (old && !st.done && /^m(0[5-9]|1[0-5])$/.test(id)) { st.s = 0; st.c = 0; }
    }
    G.flags.questV = 2;
    if (this.tracked && !this.state[this.tracked]) this.tracked = null;
    for (const id of Object.keys(this.state)) if (!this.state[id].done && this.state[id].s >= QUESTS[id].steps.length) this.complete(id);
    for (const id of this.activeIds()) {
      const s = this.step(id);
      if (s?.k === 'get') G.interact.spawnPickups(id, s);
      if (s?.k === 'scene') this.pendingScene = { id, scene: s.id, now: !!s.now };
      if (s?.k === 'boss' && G.bossDead[s.id]) this.advance(id);
    }
    this.autoStart();
  }
}
export { ITEMS };
