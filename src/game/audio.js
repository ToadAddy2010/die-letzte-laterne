// Komplett live erzeugte Musik, Stimmen und Soundeffekte.
import { Music } from './music.js';
import { strHash } from '../core/util.js';

const VOWELS = { a: [820, 1240], e: [480, 2050], i: [320, 2450], o: [530, 900], u: [360, 760], ä: [660, 1800], ö: [460, 1520], ü: [320, 1720] };
const OLD = /Älteste|Großmutter|Totengräber|Fährmann/;

export class Audio2 {
  constructor(settings) { this.s = settings; this.ctx = null; this.muted = false; this.voices = new Map(); this.stackT = 0; this.stackN = 0; }
  init(offline) {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC && !offline) return;
    const c = this.ctx = offline || new AC();
    this.master = c.createGain(); this.master.gain.value = this.s.volume;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .18;
    this.master.connect(comp); comp.connect(c.destination);
    const rev = c.createConvolver(); rev.buffer = this.impulse(2.6); rev.connect(this.master);
    const len = c.sampleRate * .4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.s.music * .95;
    this.duckBus = c.createGain(); this.musicBus.connect(this.duckBus); this.duckBus.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 2.4; this.sfx.connect(this.master);
    const sfxRev = c.createGain(); sfxRev.gain.value = .12; this.sfx.connect(sfxRev); sfxRev.connect(rev);
    this.voice = c.createGain(); this.voice.gain.value = 18; this.voice.connect(this.master);
    this.voiceRev = c.createGain(); this.voiceRev.gain.value = .5; this.voiceRev.connect(rev);
    this.music = new Music(c, this.musicBus, rev, buf);
    if (this.scene) this.music.setScene(this.scene, true);
    if (!offline) this.timer = setInterval(() => this.schedule(), 70);
  }
  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const x = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3.2) * (i < 300 ? i / 300 : 1); } }
    return b;
  }
  applyVolume() { if (!this.ctx) return; this.master.gain.value = this.muted ? 0 : this.s.volume; this.musicBus.gain.value = this.s.music * .95; }
  toggleMute() { this.muted = !this.muted; this.applyVolume(); return this.muted; }
  setScene(key) { this.scene = key; this.music?.setScene(key); }
  setBattle(v) { this.music?.setBattle(v === true ? 1 : v || 0); }
  setDuck(v) { if (!this.ctx || this.duck === v) return; this.duck = v; this.duckBus.gain.setTargetAtTime(v, this.ctx.currentTime, .18); }
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running' || this.muted) return;
    this.music.pump(c.currentTime, c.currentTime + .3);
  }
  // Mehrere Gegenstände auf einmal klingen nacheinander statt übereinander.
  queue() {
    const now = this.ctx.currentTime;
    if (now - this.stackT > .32) this.stackN = 0;
    this.stackT = now;
    return this.stackN++ * .13;
  }
  tone(f, dur, type = 'sine', vol = .1, at = 0, slide = 0, bus = this.sfx) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .03);
  }
  noise(dur, vol = .1, freq = 1200, type = 'bandpass', at = 0, q = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol * 2.4, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random() * .3); s.stop(t + dur + .02);
  }

  // ── Stimmen: Jede Figur plappert mit eigener Tonhöhe und Klangfarbe ──
  voiceFor(n) {
    const id = typeof n === 'string' ? n : n?.id || 'stimme';
    let v = this.voices.get(id);
    if (v) { v.n = 0; return v; }
    const h = Math.abs(strHash(id)), u = (h % 251) / 251, w = (h % 241) / 241, d = n?.d, look = d?.look || {};
    v = { base: 145 + u * 125, wave: w < .55 ? 'triangle' : 'sawtooth', every: u > .6 ? 3 : 2, vol: .075, shift: .9 + w * .24, seed: u * 6.28, wobble: 0, airy: false, n: 0 };
    if ((look.scale ?? 1) < .8) { v.base *= 1.75; v.shift *= 1.14; }
    if ((look.wide ?? 1) > 1.15) v.base *= .72;
    if (look.beard) v.base *= .84;
    if (OLD.test(d?.role || '')) { v.base *= .9; v.wobble = 1.1; }
    if (look.kind === 'ghost') { v.base *= 1.4; v.wave = 'sine'; v.airy = true; v.wobble = .8; }
    if (look.tusks) { v.base *= .78; v.wave = 'sawtooth'; }
    if (id === 'erzaehler') { v.base = 118; v.wave = 'triangle'; v.vol = .032; v.every = 3; }
    this.voices.set(id, v);
    return v;
  }
  speak(text, i, v) {
    const c = this.ctx; if (!c || !v || this.muted) return;
    const ch = text[i]?.toLowerCase() || ' ';
    if (!/[a-zäöüß]/.test(ch)) { v.n = 0; return; }
    if (v.n++ % v.every) return;
    const near = text.slice(i, i + 7), vowel = [...near.toLowerCase()].find(x => VOWELS[x]) || 'a', [f1, f2] = VOWELS[vowel];
    const up = near.includes('?') ? 5 : 0, loud = near.includes('!'), down = near.includes('.') ? 3 : 0;
    const semi = Math.sin(i * .55 + v.seed) * 2.6 + (ch.charCodeAt(0) * 7) % 5 - 2 + up + (loud ? 2 : 0) - down + (v.wobble ? Math.sin(i * 2.3) * v.wobble : 0);
    const t = c.currentTime + .004, dur = v.airy ? .1 : .068, f = v.base * Math.pow(2, semi / 12), vol = v.vol * (loud ? 1.2 : 1);
    const o = c.createOscillator(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), g = c.createGain();
    o.type = v.wave; o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f, t + dur * .6);
    a.type = b.type = 'bandpass'; a.frequency.value = f1 * v.shift; b.frequency.value = f2 * v.shift; a.Q.value = 3.2; b.Q.value = 4.5;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol * (v.wave === 'sawtooth' ? 2 : 3.2), t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(a); o.connect(b); a.connect(g); b.connect(g); g.connect(this.voice); if (v.airy) g.connect(this.voiceRev);
    o.start(t); o.stop(t + dur + .02);
  }

  // ── Materialien ──
  metal(f, vol = .05, at = 0, dur = .35) { for (const [m, k] of [[1, 1], [1.51, .55], [2.76, .34], [4.1, .16]]) this.tone(f * m, dur / Math.sqrt(m), 'sine', vol * k, at); }
  blade(at = 0) { this.noise(.13, .07, 5200, 'highpass', at); this.tone(1700, .24, 'sine', .035, at, 1.75); this.metal(2350, .032, at + .05, .42); }
  heavy(at = 0) { this.noise(.09, .12, 700, 'bandpass', at); this.metal(310, .08, at, .36); this.tone(90, .16, 'sine', .13, at, .7); }
  wood(at = 0) { this.tone(310, .08, 'triangle', .1, at, .72); this.tone(190, .11, 'sine', .09, at + .012); this.noise(.04, .06, 1400, 'bandpass', at); }
  twang(at = 0) { this.tone(210, .34, 'sawtooth', .035, at, .97); this.tone(420, .22, 'triangle', .03, at); this.wood(at); }
  cloth(at = 0) { this.noise(.17, .055, 1300, 'bandpass', at, .5); this.noise(.13, .04, 2100, 'bandpass', at + .09, .5); }
  leather(at = 0) { this.noise(.12, .07, 620, 'bandpass', at, .7); this.tone(150, .07, 'triangle', .05, at + .06); }
  plate(at = 0) { this.cloth(at); this.metal(780, .05, at + .03, .28); this.metal(1040, .04, at + .13, .24); }
  glass(at = 0) { this.tone(2650, .14, 'sine', .05, at); this.tone(3980, .09, 'sine', .028, at + .018); }
  sparkle(base, at = 0, n = 5) { for (let i = 0; i < n; i++) this.tone(base * Math.pow(2, i * 3 / 12 + (i % 2) * .08), .22, 'sine', .034, at + i * .045); }
  coin(at = 0, k = 1) { const f = 2900 * k + Math.random() * 900; this.tone(f, .1, 'sine', .04, at); this.tone(f * 1.47, .075, 'sine', .026, at + .004); this.noise(.012, .04, 7200, 'highpass', at); }
  coins(n = 1) { if (!this.ctx) return; const at = this.queue(), c = Math.min(6, 1 + Math.ceil(Math.log10(Math.max(1, n)) * 1.6)); for (let i = 0; i < c; i++) this.coin(at + i * (.045 + Math.random() * .025), .9 + Math.random() * .25); }

  // ── Gegenstände ──
  item(it) {
    if (!this.ctx || !it) return;
    const at = this.queue();
    switch (it.t) {
      case 'weapon': this.weapon(it, at); break;
      case 'armor': (it.look?.armor ? this.plate(at) : it.look?.robe ? this.cloth(at) : this.leather(at)); break;
      case 'trinket': this.sparkle(1320, at, 4); this.coin(at, 1.2); break;
      case 'potion': this.glass(at); this.glass(at + .08); this.tone(420, .1, 'sine', .05, at + .13, 1.5); break;
      case 'quest': [587, 880, 1175].forEach((f, i) => this.tone(f, .55, 'triangle', .055, at + i * .09)); this.sparkle(1760, at + .22, 3); break;
      default: this.leather(at); this.tone(260, .08, 'triangle', .04, at + .05);
    }
  }
  weapon(it, at = 0) {
    switch (it.w) {
      case 'hammer': case 'mace': case 'club': this.heavy(at); break;
      case 'axe': case 'great': this.heavy(at); this.blade(at + .06); break;
      case 'bow': this.twang(at); break;
      case 'staff': this.wood(at); this.tone(330, .6, 'sine', .05, at + .05, 2); this.sparkle(1100, at + .12, 4); break;
      case 'spear': case 'scythe': this.wood(at); this.blade(at + .05); break;
      default: this.blade(at);
    }
  }
  equip(it) { if (!this.ctx) return; if (!it) { this.cloth(); return; } this.item(it); this.tone(760, .06, 'triangle', .03, .12); }
  drink(it) {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) { const at = i * .13; this.tone(240 + i * 26, .1, 'sine', .11, at, 1.65); this.noise(.05, .025, 900, 'bandpass', at + .02); }
    this.sparkle(it?.mana && !it?.heal ? 740 : 988, .42, 6);
  }
  buy(it) { if (!this.ctx) return; this.coins(30); this.tone(1046, .14, 'triangle', .05, .12); this.tone(1568, .24, 'triangle', .05, .2); if (it) this.item(it); }
  sell() { if (!this.ctx) return; this.coins(200); this.tone(784, .12, 'triangle', .04, .1); this.tone(587, .2, 'triangle', .04, .18); }
  panel(tab) {
    if (!this.ctx) return;
    if (tab === 'map' || tab === 'journal' || tab === 'quest') this.page();
    else if (tab === 'inv' || tab === 'shop') { this.leather(); this.coin(.08, .75); }
    else if (tab === 'char' || tab === 'spell') { this.cloth(); this.tone(660, .16, 'sine', .03, .05); }
    else this.tone(520, .09, 'triangle', .05);
  }
  panelClose() { if (!this.ctx) return; this.tone(440, .08, 'triangle', .04, 0, .7); this.noise(.06, .025, 1800); }

  // ── Kampf und Welt ──
  swing() { this.noise(.13, .09, 2400); this.noise(.09, .03, 5200, 'highpass', .03); }
  hit() { this.noise(.1, .17, 800); this.tone(150, .1, 'square', .09, 0, .5); this.tone(70, .13, 'sine', .15, 0, .7); }
  enemyHit() { this.noise(.07, .08, 1500); }
  enemyDie() { this.tone(240, .32, 'sawtooth', .07, 0, .25); this.noise(.2, .05, 400, 'lowpass'); }
  enemyShot() { this.tone(720, .18, 'triangle', .05, 0, .45); }
  hurt() { this.tone(170, .2, 'sawtooth', .13, 0, .45); this.noise(.1, .1, 500); }
  block() { this.metal(1320, .07, 0, .24); this.noise(.06, .12, 3200); }
  dodge() { this.noise(.1, .05, 3400); }
  roll() { this.noise(.26, .07, 500, 'lowpass'); }
  jump() { this.tone(280, .13, 'triangle', .05, 0, 1.6); }
  /** Regen als leises Dauerrauschen. */
  setRain(v) {
    if (!this.ctx) return;
    if (!this.rainG) {
      const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), h = this.ctx.createBiquadFilter(); this.rainG = this.ctx.createGain(); this.rainG.gain.value = 0;
      s.buffer = this.noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 5200; h.type = 'highpass'; h.frequency.value = 620;
      s.connect(h); h.connect(f); f.connect(this.rainG); this.rainG.connect(this.sfx); s.start();
    }
    if (Math.abs(v - (this.rainV ?? 0)) > .01) { this.rainV = v; this.rainG.gain.setTargetAtTime(v * .052, this.ctx.currentTime, .9); }
  }
  thunder() { if (!this.ctx) return; this.noise(2.3, .22, 150, 'lowpass'); this.noise(.5, .16, 620, 'lowpass'); this.noise(1.2, .11, 300, 'lowpass', .34); this.tone(44, 1.9, 'sine', .2, 0, .6); }
  deny() { this.tone(120, .13, 'square', .06); }
  tick() { this.tone(1300, .035, 'triangle', .045); }
  page() { this.noise(.18, .05, 3800); this.noise(.1, .03, 1800, 'bandpass', .1); }
  door() { this.noise(.22, .09, 420, 'lowpass'); this.tone(150, .2, 'triangle', .08, 0, .7); this.tone(95, .16, 'square', .05, .17); }
  hoof(g = 0) { this.noise(.07, .05 + g * .025, 190, 'lowpass'); this.tone(72 + g * 18, .06, 'triangle', .03 + g * .015); }
  elk() { this.tone(170, .6, 'sawtooth', .04, 0, 1.42); this.tone(255, .75, 'triangle', .05, .12, .66); this.noise(.45, .02, 620, 'bandpass', .04); }
  talk() { this.tone(660, .05, 'triangle', .06); }
  pickup() { this.tone(880, .09, 'sine', .08); this.tone(1320, .15, 'sine', .08, .08); }
  chest() { this.wood(); this.tone(120, .34, 'sawtooth', .025, .03, 1.5); [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, .3, 'triangle', .07, .16 + i * .07)); this.sparkle(1568, .5, 4); }
  chime() { [659, 880, 1109].forEach((f, i) => this.tone(f, .6, 'sine', .08, i * .09)); }
  shard() { [1319, 1760, 2217, 2637].forEach((f, i) => this.tone(f, .9, 'sine', .05, i * .07)); this.tone(330, 1.1, 'triangle', .05); }
  stone() { this.noise(.18, .08, 360, 'lowpass'); this.tone(95, .14, 'sine', .09); this.page(); }
  lantern() { [262, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 1, 'sine', .08, i * .12)); }
  quest() { [523, 659, 784].forEach((f, i) => this.tone(f, .34, 'triangle', .09, i * .11)); }
  questDone() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, .6, 'triangle', .09, i * .1)); this.tone(131, .9, 'sine', .1, .3); }
  levelup() { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, .7, 'triangle', .09, i * .08)); this.sparkle(2093, .6, 5); }
  victory() { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 1.3, 'triangle', .1, i * .13)); this.tone(65, 1.6, 'sine', .18, .05); }
  death() { [294, 277, 233, 196, 147].forEach((f, i) => this.tone(f, 1.1, 'triangle', .07, i * .24)); this.tone(55, 2.2, 'sine', .18, .1, .7); }
  roar() { this.tone(90, .9, 'sawtooth', .18, 0, .5); this.tone(135, .8, 'square', .06, 0, .55); this.noise(.7, .14, 300, 'lowpass'); }
  boom() { this.tone(110, .4, 'sine', .22, 0, .3); this.noise(.3, .17, 500, 'lowpass'); }
  cast(id) {
    switch (id) {
      case 'feuerball': this.tone(300, .3, 'sawtooth', .07, 0, 2.2); this.noise(.3, .09, 1500); this.noise(.34, .05, 420, 'lowpass', .04); break;
      case 'frostlanze': this.tone(2400, .24, 'sine', .05, 0, .5); this.glass(.03); this.glass(.1); this.noise(.14, .05, 6200, 'highpass'); break;
      case 'heilung': this.sparkle(659, 0, 7); this.tone(330, .8, 'sine', .06, 0, 1.5); break;
      case 'mondblitz': this.tone(1800, .36, 'sawtooth', .025, 0, .18); this.sparkle(1760, .02, 4); break;
      case 'sonnenring': this.tone(190, .55, 'sawtooth', .06, 0, 3); this.tone(380, .55, 'triangle', .05, .05, 2.4); this.noise(.45, .07, 900); break;
      case 'schattenschritt': this.tone(1600, .2, 'sine', .07, 0, .22); this.noise(.2, .06, 500, 'bandpass', .03); break;
      default: this.tone(1500, .22, 'sine', .08, 0, .45);
    }
  }
}
