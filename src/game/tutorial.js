// Optionales Tutorial direkt im Dorf. Jeder Schritt endet, sobald man ihn wirklich gemacht hat.
import { G } from './state.js';
import { Input as I } from '../core/input.js';
import { angDiff } from '../core/util.js';
import { resolve } from '../world/collision.js';

const STEPS = [
  { id: 'walk', t: 'Laufen', k: 'Lauf mit W A S D ein Stück.', m: 'Wische auf der linken Seite, um zu laufen.' },
  { id: 'cam', t: 'Umsehen', k: 'Beweg die Maus und schau dich um.', m: 'Wische auf der rechten Seite, um dich umzusehen.' },
  { id: 'run', t: 'Rennen', k: 'Tippe beim Laufen auf Shift. Du rennst dann weiter, ohne die Taste zu halten.', m: 'Drück den Joystick ganz durch, um zu rennen.' },
  { id: 'jump', t: 'Springen', k: 'Spring mit der Leertaste.', m: 'Tippe auf Sprung.' },
  { id: 'roll', t: 'Ausweichen', k: 'Rolle mit C. Beim Rollen treffen dich Angriffe nicht.', m: 'Tippe auf Rolle. Beim Rollen treffen dich Angriffe nicht.' },
  { id: 'hit', t: 'Angreifen', k: 'Schlag die Strohpuppe dreimal mit Linksklick oder X.', m: 'Schlag die Strohpuppe dreimal mit Schlag.' },
  { id: 'block', t: 'Blocken', k: 'Halte die rechte Maustaste, um zu blocken.', m: 'Halte Block gedrückt.' },
  { id: 'map', t: 'Weltkarte', k: 'Öffne die Weltkarte mit M und schließ sie wieder.', m: 'Tippe auf die Minikarte und schließ sie wieder.' },
  { id: 'free', t: 'Die Welt gehört dir', k: 'Der Kompass zeigt dein Ziel, aber du darfst überall hin. Sprich jetzt mit Mirel.', m: 'Der Kompass zeigt dein Ziel, aber du darfst überall hin. Sprich jetzt mit Mirel.' },
];

export class Tutorial {
  constructor() {
    const d = this.el = document.createElement('div');
    d.id = 'tut'; d.className = 'frame';
    d.innerHTML = '<small id="tutN"></small><h3 id="tutT"></h3><p id="tutK"></p><button id="tutX"></button>';
    document.getElementById('hud').appendChild(d);
    d.querySelector('#tutX').onclick = () => this.stop();
    this.on = false; this.dummy = null;
  }
  start() { this.on = true; this.i = -1; this.next(); this.el.style.display = 'block'; }
  next() {
    this.i++;
    const s = this.s = STEPS[this.i];
    if (!s) { this.stop(true); return; }
    Object.assign(this, { acc: 0, hits: 0, wasOpen: false, lx: G.player.x, lz: G.player.z, ly: G.player.camYaw, endT: s.id === 'free' ? 9 : 0 });
    if (this.i > 0) G.audio?.tick();
    if (s.id === 'hit') this.spawnDummy();
    this.draw();
  }
  draw() {
    const s = this.s;
    this.el.querySelector('#tutN').textContent = `Tutorial ${this.i + 1} von ${STEPS.length}`;
    this.el.querySelector('#tutT').textContent = s.t;
    this.el.querySelector('#tutK').textContent = I.touch ? s.m : s.k;
    this.el.querySelector('#tutX').textContent = I.touch ? 'Überspringen' : 'Überspringen (H)';
    this.touch = I.touch;
  }
  spawnDummy() {
    const P = G.player, o = { x: P.x + Math.sin(P.yaw) * 5.5, z: P.z + Math.cos(P.yaw) * 5.5 };
    resolve(o, 1.2);
    this.dummy = G.enemies.spawn('strohpuppe', o.x, o.z);
    this.dummy.yaw = Math.atan2(P.x - o.x, P.z - o.z);
    G.fx.burst(o.x, this.dummy.y + 1.5, o.z, 0xffd070, 18, 4, .2, .6);
  }
  onHit() { if (this.on && this.s?.id === 'hit') { this.hits++; this.el.querySelector('#tutK').textContent = `Treffer ${this.hits} von 3`; } }
  removeDummy() { if (this.dummy && G.enemies.list.includes(this.dummy)) G.enemies.removeEnemy(this.dummy); this.dummy = null; }
  stop(done = false) {
    if (!this.on) return;
    this.on = false; this.el.style.display = 'none'; this.removeDummy();
    if (done) G.audio?.quest();
  }
  update(dt) {
    if (!this.on) return;
    if (I.touch !== this.touch) this.draw();
    if (G.mode === 'menu') { this.stop(); return; }
    if (I.hit('KeyH') && G.mode === 'play') { this.stop(); return; }
    const P = G.player, s = this.s;
    if (s.id === 'map') {
      if (G.mode === 'panel' && G.ui.tab === 'map') this.wasOpen = true;
      else if (this.wasOpen && G.mode === 'play') this.next();
      return;
    }
    if (G.mode !== 'play') return;
    switch (s.id) {
      case 'walk': this.acc += Math.hypot(P.x - this.lx, P.z - this.lz); this.lx = P.x; this.lz = P.z; if (this.acc > 9) this.next(); break;
      case 'cam': this.acc += Math.abs(angDiff(this.ly, P.camYaw)); this.ly = P.camYaw; if (this.acc > 1.1) this.next(); break;
      case 'run': if (P.sprintOn && Math.hypot(P.vx, P.vz) > 11) this.acc += dt; if (this.acc > .8) this.next(); break;
      case 'jump': if (!P.onGround && P.vy > 2) this.next(); break;
      case 'roll': if (P.rolling > 0) this.next(); break;
      case 'hit': if (this.hits >= 3) { this.removeDummy(); this.next(); } else if (!this.dummy || !G.enemies.list.includes(this.dummy)) this.spawnDummy(); break;
      case 'block': if (P.blocking) this.acc += dt; if (this.acc > .55) this.next(); break;
      case 'free': this.endT -= dt; if (this.endT <= 0 || G.quests.state.m01?.s > 0) this.stop(true); break;
    }
  }
}
