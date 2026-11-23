// Live komponierte Musik: Jede Situation hat ihr eigenes Thema, der Kampf eine eigene orchestrale Ebene.
import { RNG } from '../core/util.js';

const MIDI = m => 440 * Math.pow(2, (m - 69) / 12);
const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], hijaz: [0, 1, 4, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
};
const th = (root, sc, tempo, prog, o) => ({ root, scale: SCALES[sc], tempo, prog, ...o });
const P = (A, B, C) => ({ A, B, C });

const WILD = [
  th(50, 'dorian', 76, P([0, 5, 3, 4], [3, 0, 6, 4], [5, 3, 0, 4]), { lead: 'flute', night: 'harp', alt: 'harp', pad: 'pad', arp: 'wave', seed: 11 }),
  th(45, 'aeolian', 68, P([0, 3, 5, 4], [5, 3, 0, 6], [3, 0, 4, 0]), { lead: 'strings', night: 'flute', alt: 'lute', pad: 'strings', arp: 'slow', seed: 23 }),
  th(43, 'phrygian', 58, P([0, 1, 5, 0], [3, 1, 0, 6], [5, 1, 3, 0]), { lead: 'choir', night: 'bell', alt: 'bell', pad: 'choir', arp: 'sparse', seed: 37 }),
  th(47, 'hijaz', 80, P([0, 1, 0, 6], [3, 1, 0, 1], [5, 3, 1, 0]), { lead: 'reed', night: 'flute', alt: 'lute', pad: 'pad', arp: 'wave', perc: 'hand', seed: 41 }),
  th(48, 'harm', 54, P([0, 5, 2, 4], [3, 0, 5, 4], [2, 5, 3, 4]), { lead: 'bell', night: 'choir', alt: 'harp', pad: 'strings', arp: 'slow', seed: 53 }),
  th(46, 'lydian', 92, P([0, 4, 1, 5], [3, 0, 4, 1], [5, 1, 4, 0]), { lead: 'glock', night: 'bell', alt: 'pizz', pad: 'pad', arp: 'gear', perc: 'tick', seed: 67 }),
  th(41, 'locrian', 62, P([0, 6, 1, 4], [3, 1, 0, 6], [5, 6, 1, 0]), { lead: 'reed', night: 'choir', alt: 'pizz', pad: 'choir', arp: 'sparse', perc: 'heart', seed: 79 }),
];
const TOWN_SCALE = ['ionian', 'dorian', 'aeolian', 'mixo', 'dorian', 'lydian', 'aeolian'];
const TOWNS = WILD.map((w, i) => ({ ...w, scale: SCALES[TOWN_SCALE[i]], tempo: w.tempo + 14, prog: P([0, 3, 4, 0], [5, 3, 0, 4], [3, 4, 5, 0]), lead: 'lute', night: 'flute', alt: 'pizz', pad: 'pad', arp: 'town', perc: 'hand', seed: w.seed + 100 }));
const HOUSE = {
  inn: th(52, 'mixo', 118, P([0, 3, 4, 0], [0, 6, 3, 4], [5, 3, 4, 0]), { lead: 'lute', night: 'lute', alt: 'pizz', pad: 'pad', arp: 'strum', perc: 'tavern', seed: 211, form: ['A', 'A', 'B', 'A2', 'C', 'A'] }),
  smith: th(40, 'aeolian', 84, P([0, 0, 3, 4], [5, 3, 0, 4], [0, 5, 6, 4]), { lead: null, alt: 'pizz', pad: 'strings', arp: 'sparse', perc: 'anvil', seed: 223 }),
  magic: th(57, 'lydian', 60, P([0, 1, 4, 0], [3, 1, 5, 4], [5, 4, 1, 0]), { lead: 'bell', night: 'bell', alt: 'harp', pad: 'choir', arp: 'slow', seed: 239 }),
  shop: th(53, 'ionian', 92, P([0, 3, 1, 4], [5, 1, 4, 0], [3, 4, 0, 5]), { lead: 'pizz', night: 'pizz', alt: 'harp', pad: 'pad', arp: 'town', seed: 251 }),
  home: th(55, 'ionian', 66, P([0, 3, 5, 4], [3, 0, 1, 4], [5, 3, 4, 0]), { lead: 'harp', night: 'harp', alt: 'lute', pad: 'pad', arp: 'slow', seed: 263 }),
};
const HOUSE_KIND = { inn: 'inn', smith: 'smith', magic: 'magic', study: 'magic', observatory: 'magic', hollow: 'magic', shop: 'shop', workshop: 'shop', home: 'home', family: 'home' };
const DARK = ['R', 'A', 'R', 'B'];
const DUNGEON = {
  cave: th(40, 'aeolian', 54, P([0, 5, 0, 4], [3, 0, 5, 4], [0, 1, 0, 4]), { lead: 'bell', alt: 'harp', pad: 'pad', arp: 'sparse', perc: 'drip', seed: 307, form: DARK }),
  root: th(38, 'dorian', 60, P([0, 3, 0, 6], [5, 3, 0, 4], [0, 6, 3, 4]), { lead: 'reed', alt: 'pizz', pad: 'strings', arp: 'sparse', perc: 'heart', seed: 311, form: DARK }),
  goblin: th(41, 'phrygian', 88, P([0, 1, 0, 6], [0, 5, 1, 0], [3, 1, 0, 6]), { lead: 'reed', alt: 'pizz', pad: 'pad', arp: 'gear', perc: 'war', seed: 317, form: ['A', 'R', 'B', 'A'] }),
  bone: th(39, 'phrygian', 50, P([0, 1, 0, 5], [3, 1, 5, 0], [0, 5, 1, 0]), { lead: 'choir', alt: 'bell', pad: 'choir', arp: 'sparse', perc: 'heart', seed: 331, form: DARK }),
  sun: th(44, 'hijaz', 66, P([0, 1, 6, 0], [3, 1, 0, 6], [5, 1, 0, 1]), { lead: 'reed', alt: 'lute', pad: 'choir', arp: 'sparse', perc: 'hand', seed: 337, form: DARK }),
  ice: th(47, 'harm', 48, P([0, 5, 2, 4], [3, 5, 0, 4], [2, 0, 5, 4]), { lead: 'glock', alt: 'bell', pad: 'strings', arp: 'sparse', perc: 'drip', seed: 347, form: DARK }),
  clock: th(45, 'locrian', 96, P([0, 4, 1, 6], [3, 1, 0, 4], [5, 1, 6, 0]), { lead: 'glock', alt: 'pizz', pad: 'pad', arp: 'gear', perc: 'tick', seed: 349, form: ['A', 'R', 'B', 'R'] }),
  shadow: th(37, 'locrian', 46, P([0, 1, 0, 4], [6, 1, 0, 4], [3, 1, 6, 0]), { lead: 'choir', alt: 'bell', pad: 'choir', arp: 'sparse', perc: 'heart', seed: 353, form: DARK }),
};
const SPECIAL = {
  title: th(50, 'aeolian', 62, P([0, 5, 3, 4], [3, 0, 6, 4], [5, 3, 0, 4]), { lead: 'choir', alt: 'harp', pad: 'strings', arp: 'slow', seed: 401, motif: true, form: ['A', 'R', 'B', 'A2', 'C', 'R'] }),
  story: th(48, 'aeolian', 58, P([0, 5, 3, 4], [5, 3, 0, 4], [3, 0, 6, 4]), { lead: 'strings', alt: 'harp', pad: 'choir', arp: 'slow', seed: 409, motif: true, form: ['A', 'B', 'A2', 'C'] }),
  moon: th(42, 'locrian', 50, P([0, 1, 0, 4], [6, 1, 3, 0], [0, 6, 1, 4]), { lead: 'choir', alt: 'bell', pad: 'choir', arp: 'sparse', perc: 'heart', seed: 419, form: ['A', 'R', 'B', 'R'] }),
};
function themeFor(key) {
  const [type, a, b] = key.split(':');
  if (type === 'wild') return { T: WILD[+a] || WILD[0], night: b === '1' };
  if (type === 'town') return { T: TOWNS[+a] || TOWNS[0], night: b === '1' };
  if (type === 'house') return { T: HOUSE[HOUSE_KIND[a] || 'home'], night: false };
  if (type === 'dungeon') return { T: DUNGEON[a] || DUNGEON.cave, night: false };
  return { T: SPECIAL[type] || SPECIAL.title, night: false };
}

const FORM = ['A', 'A', 'B', 'R', 'A2', 'C', 'R', 'B'];
const OCT = { flute: 12, harp: 12, bell: 12, glock: 24, lute: 12, pizz: 12, reed: 12, strings: 12, choir: 0, brass: 0 };
const MIX = { flute: .062, harp: .075, bell: .04, glock: .04, lute: .07, pizz: .07, reed: .03, strings: .03, choir: .04, brass: .04 };
const PADV = { pad: .03, strings: .014, choir: .018 };
const ARPS = {
  wave: [[0, 0], [2, 2], [4, 4], [6, 7], [8, 4], [10, 2], [12, 0], [14, 2]], slow: [[0, 0], [4, 4], [8, 7], [12, 4]], sparse: [[0, 7], [10, 4]],
  gear: [[0, 0], [2, 4], [4, 7], [6, 4], [8, 2], [10, 4], [12, 7], [14, 9]], town: [[0, 0], [3, 4], [6, 7], [8, 2], [11, 4], [14, 7]], strum: [[0, 0], [2, 4], [4, 7], [6, 4], [8, 0], [10, 4], [12, 7], [14, 4]],
};
const RHYTHMS = [[0, 4, 8, 12], [0, 3, 6, 8, 12], [0, 6, 8, 12, 14], [0, 2, 4, 8, 12], [0, 8, 12], [0, 4, 6, 8, 10, 12], [0, 3, 8, 11]];
const M = (s, len, d) => ({ s, len, d });
const MOTIF = [[M(0, 8, 7), M(8, 4, 9), M(12, 4, 10)], [M(0, 8, 9), M(8, 8, 7)], [M(0, 4, 6), M(4, 4, 7), M(8, 8, 9)], [M(0, 16, 4)], [M(0, 8, 7), M(8, 4, 9), M(12, 4, 11)], [M(0, 8, 10), M(8, 8, 9)], [M(0, 4, 8), M(4, 4, 6), M(8, 8, 5)], [M(0, 16, 7)]];

function phrase(seed, prog) {
  const r = RNG(seed), a = RHYTHMS[r() * RHYTHMS.length | 0], b = RHYTHMS[r() * RHYTHMS.length | 0], bars = [];
  let cur = 7 + (r() * 3 | 0);
  for (let i = 0; i < 8; i++) {
    const rh = i % 4 === 3 ? [0, 8] : i % 2 ? b : a, ch = prog[i % prog.length], notes = [];
    rh.forEach((s, k) => {
      if (s === 0 || s === 8) {
        let best = cur, bd = 99;
        for (let o = 0; o <= 2; o++) for (const q of [0, 2, 4]) { const d = ch + q + o * 7, x = Math.abs(d - cur); if (x < bd) { bd = x; best = d; } }
        cur = best;
      } else cur += [-2, -1, -1, 1, 1, 2][r() * 6 | 0];
      cur = Math.max(3, Math.min(13, cur));
      notes.push(M(s, (rh[k + 1] ?? 16) - s, cur));
    });
    bars.push(notes);
  }
  return bars;
}

const CALM_LEVEL = 1.75, WAR_LEVEL = 3;
const WAR_FORM = ['intro', 'drive', 'drive', 'climax', 'break', 'drive', 'climax', 'climax'];
const OST = [0, null, 0, 4, null, 0, 2, null, 0, null, 0, 4, null, 7, 4, null];
const TAIKO = { intro: [0, 8], drive: [0, 3, 6, 8, 12, 14], climax: [0, 2, 3, 6, 8, 10, 11, 14], break: [0, 8] };
const HITS = { intro: [], drive: [0, 3, 6], climax: [0, 3, 6, 10, 12], break: [] };
const WAR_PROG = { intro: [0, 0, 0, 0], drive: [0, 5, 3, 4], climax: [0, 3, 5, 4], break: [5, 5, 3, 4] };
const BOSS_PROG = { intro: [0, 0, 1, 0], drive: [0, 1, 5, 4], climax: [0, 6, 1, 4], break: [3, 3, 1, 4] };

export class Music {
  constructor(ctx, out, rev, noise) {
    this.c = ctx; this.noiseBuf = noise; this.t = ctx.currentTime;
    this.bus = this.gain(out, 1); this.bus.connect(this.gain(rev, .3));
    this.calmOut = this.gain(this.bus, CALM_LEVEL); this.warOut = this.gain(this.bus, 0);
    const { T, night } = themeFor('title');
    this.calm = { on: true, key: 'title', T, night, step: 0, next: ctx.currentTime + .1, dur: 60 / T.tempo / 4 };
    this.war = { on: false, step: 0, next: 0, dur: .12, level: 0, root: 40 };
    this.pendingKey = null; this.wantAt = 0; this.switchAt = 0; this.level = 0; this.lastFight = -1e9;
  }
  setScene(key, now = false) {
    if (now) { this.applyScene(key); this.pendingKey = null; this.switchAt = 0; return; }
    if (key === this.pendingKey) return;
    if (key === this.calm.key) {
      if (this.switchAt) this.fade(this.calmOut, CALM_LEVEL, .5);
      this.pendingKey = null; this.switchAt = 0; return;
    }
    this.pendingKey = key; this.wantAt = this.t + 1; this.switchAt = 0;
  }
  setBattle(level) { this.level = level; }
  applyScene(key) {
    const c = this.calm, { T, night } = themeFor(key);
    Object.assign(c, { key, T, night, step: 0, dur: 60 / (T.tempo * (night ? .92 : 1)) / 4 });
    if (c.next < this.t) c.next = this.t + .05;
  }
  fade(node, v, tau, at = this.t) { node.gain.cancelScheduledValues(at); node.gain.setTargetAtTime(v, at, tau); }
  update(now) {
    this.t = now;
    if (this.pendingKey) {
      if (this.war.on) { this.applyScene(this.pendingKey); this.pendingKey = null; this.switchAt = 0; }
      else if (!this.switchAt && now >= this.wantAt) { this.fade(this.calmOut, 0, .3); this.switchAt = now + .95; }
      else if (this.switchAt && now >= this.switchAt) { this.applyScene(this.pendingKey); this.pendingKey = null; this.switchAt = 0; this.fade(this.calmOut, CALM_LEVEL, .7); }
    }
    const W = this.war;
    if (this.level > 0) {
      this.lastFight = now;
      if (!W.on) this.startWar(now);
    } else if (W.on && now - this.lastFight > 2.6) this.endWar(now);
  }
  startWar(now) {
    const W = this.war, t = now + .08;
    W.on = true; W.step = 0; W.level = this.level; W.next = t + .16;
    W.root = 38 + (((this.calm.T.root - 38) % 12) + 12) % 12; W.dur = 60 / (W.level === 3 ? 142 : 128) / 4;
    this.calm.on = false; this.fade(this.calmOut, 0, .09); this.fade(this.warOut, WAR_LEVEL, .03);
    this.taiko(t, .3, this.warOut); this.crash(t, .09, this.warOut);
    for (const q of [0, 7, 12, 15]) this.note('brass', W.root + q + 12, t, .62, .045, this.warOut);
  }
  endWar(now) {
    const W = this.war, C = this.calm, t = now + .06, s = SCALES.aeolian;
    W.on = false;
    for (const q of [0, 4, 7]) this.note('brass', W.root + s[q % 7] + (q === 7 ? 12 : 0) + 12, t, 1.7, .038, this.warOut);
    this.timpani(MIDI(W.root), t, .22, this.warOut);
    this.fade(this.warOut, 0, .4, now + .9);
    C.on = true; C.step = ((C.step >> 7) + 1) << 7; C.next = now + 1.5;
    this.fade(this.calmOut, CALM_LEVEL, .8, now + 1.3);
  }
  pump(now, until) {
    this.update(now);
    for (const [st, fn] of [[this.calm, this.calmStep], [this.war, this.warStep]]) {
      if (!st.on) continue;
      if (st.next < now - .4) st.next = now + .04;
      while (st.next < until) { fn.call(this, st.next); st.next += st.dur; }
    }
  }
  /** Nur für Tests und Anzeige: welche Situation gerade läuft. */
  get state() { return { scene: this.calm.key, pending: this.pendingKey, war: this.war.on, level: this.war.level, tempo: Math.round(60 / (this.war.on ? this.war.dur : this.calm.dur) / 4) }; }

  // ── Arrangement ──
  pitch(T, d) { return T.root + T.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7); }
  phraseOf(T, key) {
    if (T.motif && key === 'A') return MOTIF;
    T.ph ??= {};
    return (T.ph[key] ??= phrase(T.seed + { A: 0, B: 1, C: 2 }[key], T.prog[key]));
  }
  calmStep(t) {
    const st = this.calm, T = st.T, i = st.step++, b = i & 15, bar = i >> 4, form = T.form || FORM, secN = bar >> 3, sec = form[secN % form.length], key = sec[0], rest = key === 'R';
    const prog = T.prog[rest ? 'A' : key], ch = prog[bar % prog.length], D = st.dur, out = this.calmOut, night = st.night, n = d => this.pitch(T, d);
    const low = m => { while (m < 34) m += 12; return m; };
    if (b === 0) {
      for (const q of [0, 2, 4]) this.note(T.pad, n(ch + q) + 12, t, D * 15.7, PADV[T.pad] * (rest ? 1.15 : 1), out);
      this.note('bass', low(n(ch) - 12), t, D * 7.6, rest ? .07 : .1, out);
    }
    if (b === 8 && !rest) this.note('bass', low(n(ch + (bar % 2 ? 4 : 0)) - 12), t, D * 7.4, .075, out);
    for (const [s, q] of ARPS[rest ? 'sparse' : T.arp]) if (s === b) this.note(T.alt, n(ch + q) + OCT[T.alt], t, D * 3, MIX[T.alt] * (night ? .38 : .5), out);
    if (!rest && T.lead) {
      const cycle = Math.floor(secN / form.length), lead = cycle % 3 === 2 ? T.alt : (night && T.night) || T.lead, notes = this.phraseOf(T, key)[bar & 7];
      for (const x of notes) if (x.s === b) {
        this.note(lead, n(x.d) + OCT[lead], t, D * x.len * .94, MIX[lead] * (night ? .78 : 1), out);
        if (sec === 'A2') this.note(T.alt, n(x.d) + OCT[T.alt] + 7, t, D * x.len * .7, MIX[T.alt] * .32, out);
      }
    }
    this.perc(T.perc, t, b, bar, out);
  }
  perc(kind, t, b, bar, out) {
    switch (kind) {
      case 'hand': if ([0, 3, 6, 8, 11, 14].includes(b)) this.drum(b % 8 === 0 ? 150 : 215, t, b % 8 === 0 ? .1 : .05, out); break;
      case 'tavern': if (b === 0 || b === 8) this.drum(115, t, .13, out); if (b === 4 || b === 12) this.drum(235, t, .07, out); if (b % 2 === 0) this.shaker(t, b % 4 ? .018 : .03, out); break;
      case 'tick': if (b % 4 === 0) this.clack(t, b % 8 ? .025 : .045, out); break;
      case 'heart': if (bar % 2 === 0 && (b === 0 || b === 3)) this.taiko(t, b ? .07 : .11, out, 58); break;
      case 'anvil': if ([0, 6, 8].includes(b)) this.note('bell', b === 8 ? 91 : 88, t, .5, .03, out); if (b === 0) this.taiko(t, .1, out, 66); break;
      case 'drip': if (b % 4 === 0 && Math.random() < .16) this.note('bell', 84 + (Math.random() * 3 | 0) * 5, t, 1.1, .018, out); break;
      case 'war': if (b === 0 || b === 6) this.taiko(t, b ? .07 : .11, out, 72); break;
    }
  }
  warStep(t) {
    const st = this.war, i = st.step++, b = i & 15, bar = i >> 4;
    if (b === 0 && this.level > 0) st.level = this.level;
    const lv = st.level, boss = lv === 3, sec = WAR_FORM[(bar >> 2) % 8], sub = bar & 3, ch = (boss ? BOSS_PROG : WAR_PROG)[sec][sub], scale = ch === 4 ? SCALES.harm : boss && ch === 1 ? SCALES.phrygian : SCALES.aeolian;
    const n = d => st.root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7), D = st.dur, out = this.warOut, chord = [0, 2, 4];
    const q = OST[b];
    if (q !== null && (sec !== 'intro' || sub > 0)) {
      if (sec === 'break') this.note('pizz', n(ch + q) + 12, t, D * 2, .09, out);
      else this.note('strings', n(ch + q) + 12, t, D * 1.15, sec === 'intro' ? .03 : .04, out);
      if (sec === 'climax') this.note('strings', n(ch + q) + 24, t, D * 1.05, .02, out);
    }
    if ([0, 6, 10].includes(b) && sec !== 'intro') this.note('brass', n(ch), t, D * 2.2, b ? .05 : .07, out);
    if (b === 0) this.timpani(MIDI(n(ch)), t, sec === 'break' ? .13 : .2, out);
    if (TAIKO[sec].includes(b)) this.taiko(t, (b % 8 === 0 ? .24 : .13) * (lv > 1 ? 1 : .82), out);
    if (sub === 3 && b >= 12) this.snare(t, .03 + (b - 12) * .018, out);
    if (b === 0 && sub === 0 && sec !== 'break' && sec !== 'intro') this.crash(t, sec === 'climax' ? .07 : .04, out);
    if ((lv >= 2 || sec === 'climax') && HITS[sec].includes(b)) for (const c of chord) this.note('brass', n(ch + c) + 12, t, D * (b === 12 ? 3.8 : 1.9), lv >= 2 ? .03 : .022, out);
    if (b === 0 && (boss ? sec !== 'intro' : lv >= 2 && sec === 'climax')) for (const c of chord) this.note('choir', n(ch + c) + 24, t, D * 15.6, boss ? .034 : .026, out);
    if (boss && sec === 'drive' && b % 4 === 2) this.note('choir', n(ch + 7) + 12, t, D * 1.6, .035, out);
    if (sec === 'climax') for (const x of MOTIF[(sub + ((bar >> 2) & 1) * 4) & 7]) if (x.s === b) {
      this.note('brass', n(x.d) + 12, t, D * x.len * .94, .05, out);
      if (lv >= 2) this.note('brass', n(x.d) + 24, t, D * x.len * .9, .022, out);
    }
  }

  // ── Bausteine ──
  gain(to, v = 1) { const g = this.c.createGain(); g.gain.value = v; g.connect(to); return g; }
  filter(to, type, freq, q = .7) { const f = this.c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(to); return f; }
  osc(type, f, t, end, to, det = 0) { const o = this.c.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.connect(to); o.start(t); o.stop(end + .03); return o; }
  sus(g, t, a, v, dur, rel) {
    const p = g.gain, end = t + dur, top = Math.min(t + a, end - .012), off = Math.max(top, end - rel), V = Math.max(.0002, v);
    p.setValueAtTime(.0001, t); p.exponentialRampToValueAtTime(V, top); p.setValueAtTime(V, off); p.exponentialRampToValueAtTime(.0001, end);
  }
  dec(g, t, v, dur) { const p = g.gain; p.setValueAtTime(.0001, t); p.exponentialRampToValueAtTime(Math.max(.0002, v), t + .006); p.exponentialRampToValueAtTime(.0001, t + dur); }
  vibrato(o, depth, rate, t, end) { const l = this.c.createOscillator(), g = this.c.createGain(); l.frequency.value = rate; g.gain.value = depth; l.connect(g); g.connect(o.frequency); l.start(t); l.stop(end + .03); }
  note(kind, m, t, dur, vol, out) {
    const f = MIDI(m), end = t + dur;
    switch (kind) {
      case 'flute': { const g = this.gain(out); this.sus(g, t, Math.min(.09, dur * .35), vol, dur, .1); const o = this.osc('sine', f, t, end, g); this.osc('triangle', f * 2, t, end, this.gain(g, .12)); if (dur > .45) this.vibrato(o, f * .007, 5.2, t + .18, end); break; }
      case 'harp': { const d = Math.max(.9, dur), g = this.gain(out); this.dec(g, t, vol, d); this.osc('sine', f, t, t + d, g); this.osc('triangle', f * 2, t, t + d, this.gain(g, .16)); break; }
      case 'lute': { const d = Math.max(.5, Math.min(1.1, dur)), g = this.gain(out), l = this.filter(g, 'lowpass', 2600); this.dec(g, t, vol, d); this.osc('triangle', f, t, t + d, l); this.osc('sawtooth', f, t, t + d, this.gain(l, .24)); break; }
      case 'pizz': { const d = Math.min(.42, Math.max(.2, dur)), g = this.gain(out), l = this.filter(g, 'lowpass', 1250); this.dec(g, t, vol, d); this.osc('triangle', f, t, t + d, l); break; }
      case 'bell': { const d = Math.max(1.4, dur), g = this.gain(out); this.dec(g, t, vol, d); this.osc('sine', f, t, t + d, g); this.osc('sine', f * 2.76, t, t + d * .6, this.gain(g, .3)); this.osc('sine', f * 5.4, t, t + d * .3, this.gain(g, .1)); break; }
      case 'glock': { const d = Math.max(.8, dur * .8), g = this.gain(out); this.dec(g, t, vol, d); this.osc('sine', f, t, t + d, g); this.osc('sine', f * 4, t, t + d * .4, this.gain(g, .16)); break; }
      case 'strings': { const g = this.gain(out), l = this.filter(g, 'lowpass', Math.min(4200, f * 4.2 + 400)); this.sus(g, t, Math.min(.09, dur * .3), vol, dur, Math.min(.14, dur * .35)); const o = this.osc('sawtooth', f, t, end, l, -7); this.osc('sawtooth', f, t, end, l, 7); if (dur > .7) this.vibrato(o, f * .004, 5, t + .3, end); break; }
      case 'pad': { const g = this.gain(out), l = this.filter(g, 'lowpass', 1150); this.sus(g, t, dur * .25, vol, dur, dur * .3); this.osc('triangle', f, t, end, l, -8); this.osc('triangle', f, t, end, l, 8); break; }
      case 'reed': { const g = this.gain(out), l = this.filter(g, 'bandpass', Math.min(3600, f * 2.2), 1.1); this.sus(g, t, Math.min(.07, dur * .3), vol * 2.2, dur, .09); const o = this.osc('sawtooth', f, t, end, l); if (dur > .4) this.vibrato(o, f * .009, 5.6, t + .15, end); break; }
      case 'brass': {
        const g = this.gain(out), l = this.filter(g, 'lowpass', 400, 1.1), top = Math.min(4200, f * 5 + 600);
        l.frequency.setValueAtTime(380, t); l.frequency.exponentialRampToValueAtTime(top, t + Math.min(.08, dur * .4)); l.frequency.exponentialRampToValueAtTime(Math.max(500, top * .55), end);
        this.sus(g, t, Math.min(.035, dur * .25), vol, dur, Math.min(.12, dur * .35));
        this.osc('sawtooth', f, t, end, l, -5); this.osc('sawtooth', f, t, end, l, 5); break;
      }
      case 'choir': {
        const g = this.gain(out), a = this.filter(g, 'bandpass', 720, 5), b = this.filter(g, 'bandpass', 1120, 7), c = this.filter(this.gain(g, .5), 'bandpass', 2500, 8), mix = this.gain(a, 1);
        mix.connect(b); mix.connect(c); this.sus(g, t, Math.min(.42, dur * .3), vol * 3.2, dur, Math.min(.5, dur * .35));
        const o = this.osc('sawtooth', f, t, end, mix, -9); this.osc('sawtooth', f, t, end, mix, 9); if (dur > .8) this.vibrato(o, f * .006, 4.7, t + .35, end); break;
      }
      case 'bass': { const g = this.gain(out); this.sus(g, t, .03, vol, dur, Math.min(.3, dur * .4)); this.osc('sine', f, t, end, g); this.osc('triangle', f, t, end, this.gain(g, .3)); break; }
    }
  }
  noise(t, dur, vol, type, freq, out, q = .7) {
    const s = this.c.createBufferSource(), g = this.gain(out), l = this.filter(g, type, freq, q);
    s.buffer = this.noiseBuf; s.loop = true; s.connect(l); this.dec(g, t, vol, dur); s.start(t, Math.random() * .3); s.stop(t + dur + .02);
  }
  taiko(t, vol, out, f = 88) {
    const g = this.gain(out), o = this.osc('sine', f, t, t + .5, g);
    o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f * .55, t + .16); this.dec(g, t, vol, .48); this.noise(t, .07, vol * .42, 'lowpass', 900, out);
  }
  timpani(f, t, vol, out) {
    const g = this.gain(out), o = this.osc('sine', f, t, t + .9, g); o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f, t + .06);
    this.osc('sine', f * 1.5, t, t + .4, this.gain(g, .25)); this.dec(g, t, vol, .85);
  }
  drum(f, t, vol, out) { const g = this.gain(out), o = this.osc('sine', f, t, t + .2, g); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f * .8, t + .06); this.dec(g, t, vol, .18); }
  shaker(t, vol, out) { this.noise(t, .05, vol, 'highpass', 6000, out); }
  clack(t, vol, out) { this.noise(t, .025, vol * 2, 'bandpass', 3200, out, 4); }
  snare(t, vol, out) { this.noise(t, .09, vol, 'bandpass', 2100, out, .8); }
  crash(t, vol, out) { this.noise(t, 1.5, vol, 'highpass', 5200, out); }
}
