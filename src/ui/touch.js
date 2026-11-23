// Touch-Steuerung für Handy und Tablet. Maus und Tastatur bleiben davon unberührt.
import { G } from '../game/state.js';
import { Input as I } from '../core/input.js';

const $ = id => document.getElementById(id);
const STICK = 58, CAM_X = 3.2, CAM_Y = 2.2, SPRINT_AT = .93, HOTKEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'KeyR', 'KeyT'];

export class Touch {
  constructor(canvas) {
    this.canvas = canvas;
    this.coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches);
    Object.assign(this, { stickId: null, camId: null, ox: 0, oy: 0, camX: 0, camY: 0, atk: false, block: false, sprint: false, perfT: 0, perfSum: 0, perfN: 0, slow: 0 });
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `<div id="tBase"><i id="tKnob"></i></div>
      <div id="tTop"><button id="tMenu">Menü</button><button id="tChat">Chat</button><button id="tFull">Vollbild</button></div>
      <button id="tAtk" class="tb">Schlag</button><button id="tRoll" class="tb">Rolle</button><button id="tJump" class="tb">Sprung</button><button id="tBlock" class="tb">Block</button><button id="tLock" class="tb">Ziel</button><button id="tMount" class="tb">Elch</button>`;
    $('ui').appendChild(root);
    const turn = document.createElement('div');
    turn.id = 'tRotate'; turn.innerHTML = '<h2>Bitte quer halten</h2><p>Das Spiel läuft auf dem Handy nur im Querformat.</p>';
    $('ui').appendChild(turn);
    this.base = $('tBase'); this.knob = $('tKnob');
    this.bind();
    if (this.coarse) this.enable();
  }
  get on() { return I.touch; }
  enable() {
    if (I.touch) return;
    I.touch = true;
    I.unlock();
    document.body.classList.add('touch');
    $('cutHint').textContent = 'Tippen: weiter · Hier: überspringen';
    G.ui.promptT = undefined; G.ui.hotKey = null;
  }
  disable() {
    if (!I.touch) return;
    this.release();
    I.touch = false;
    document.body.classList.remove('touch', 'tplay', 'ingame');
    $('cutHint').textContent = 'Leertaste: weiter · Esc: überspringen';
    G.ui.promptT = undefined; G.ui.hotKey = null;
  }
  tap(code) { I.pressed.add(code); I.keys.add(code); }
  hold(el, down, up) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* optional */ }
      el.classList.add('held');
      down(e);
    });
    const end = () => { if (!el.classList.contains('held')) return; el.classList.remove('held'); up?.(); };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, end);
  }
  key(id, code) { this.hold($(id), () => this.tap(code), () => I.keys.delete(code)); }
  bind() {
    addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') this.enable();
      else if (e.pointerType === 'mouse' && I.touch && !this.coarse) this.disable();
      const ctx = G.audio?.ctx;
      if (ctx && ctx.state !== 'running') ctx.resume?.();
    }, true);
    addEventListener('gesturestart', e => e.preventDefault());
    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) c.addEventListener(t, e => this.up(e));

    this.hold($('tAtk'), () => { this.atk = true; I.lmbP = true; }, () => { this.atk = false; });
    this.hold($('tBlock'), () => { this.block = true; I.rmb = true; }, () => { this.block = false; I.rmb = false; });
    this.key('tRoll', 'KeyC'); this.key('tJump', 'Space'); this.key('tLock', 'KeyF'); this.key('tMount', 'KeyQ');
    this.key('prompt', 'KeyE');
    $('tMenu').onclick = () => { if (G.mode === 'play') G.ui.openPanel('inv'); };
    $('tChat').onclick = () => { if (G.mode === 'play') G.netui.openChat(); };
    $('tFull').onclick = () => this.fullscreen();
    if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $('tFull').style.display = 'none';
    $('mini').addEventListener('click', () => { if (I.touch && G.mode === 'play') G.ui.openPanel('map'); });
    $('tracker').addEventListener('click', () => { if (I.touch && G.mode === 'play') G.ui.openPanel('quest'); });
    $('hotbar').addEventListener('pointerdown', e => {
      const slot = e.target.closest('.slot'); if (!slot || !I.touch) return;
      e.preventDefault();
      const code = HOTKEYS[[...slot.parentNode.children].indexOf(slot)];
      if (code) { I.pressed.add(code); slot.classList.add('held'); setTimeout(() => slot.classList.remove('held'), 140); }
    });
    $('cutHint').addEventListener('pointerdown', e => { if (I.touch) { e.stopPropagation(); I.pressed.add('Escape'); } });
    $('dlgText').addEventListener('click', () => G.ui.finishType());
  }
  fullscreen() {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else { const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); p?.catch?.(() => {}); }
  }
  down(e) {
    if (e.pointerType === 'mouse' || !I.touch) return;
    if (G.mode === 'cutscene') { I.pressed.add('Space'); return; }
    if (G.mode !== 'play') return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* optional */ }
    if (e.clientX < innerWidth * .44 && this.stickId === null) {
      this.stickId = e.pointerId; this.ox = e.clientX; this.oy = e.clientY;
      this.base.classList.add('live');
      this.base.style.left = `${e.clientX}px`; this.base.style.top = `${e.clientY}px`;
      this.setStick(0, 0);
    } else if (this.camId === null) {
      this.camId = e.pointerId; this.camX = e.clientX; this.camY = e.clientY; I.camDrag = true;
    }
  }
  move(e) {
    if (e.pointerId === this.stickId) this.setStick((e.clientX - this.ox) / STICK, (e.clientY - this.oy) / STICK);
    else if (e.pointerId === this.camId && G.mode === 'play') {
      I.mdx += (e.clientX - this.camX) * CAM_X; I.mdy += (e.clientY - this.camY) * CAM_Y;
      this.camX = e.clientX; this.camY = e.clientY;
    }
  }
  up(e) {
    if (e.pointerId === this.stickId) this.endStick();
    else if (e.pointerId === this.camId) { this.camId = null; I.camDrag = false; }
  }
  setStick(x, y) {
    const l = Math.hypot(x, y), k = l > 1 ? 1 / l : 1, nx = x * k, ny = y * k, m = Math.min(1, l), S = I.stick;
    this.knob.style.transform = `translate(calc(-50% + ${nx * STICK}px), calc(-50% + ${ny * STICK}px))`;
    if (m < .14) { S.on = false; S.x = S.y = S.m = 0; } else { S.on = true; S.x = nx; S.y = ny; S.m = m; }
    const run = m >= SPRINT_AT;
    if (run !== this.sprint) { this.sprint = run; if (run) I.keys.add('ShiftLeft'); else I.keys.delete('ShiftLeft'); }
    this.base.classList.toggle('run', run);
  }
  endStick() {
    this.stickId = null;
    this.setStick(0, 0);
    this.base.classList.remove('live', 'run');
    this.base.style.left = ''; this.base.style.top = '';
    this.knob.style.transform = '';
  }
  release() {
    if (this.stickId !== null) this.endStick();
    this.camId = null; I.camDrag = false;
    if (this.block) I.rmb = false;
    this.atk = false; this.block = false;
    for (const el of document.querySelectorAll('#touch .held, #prompt.held')) el.classList.remove('held');
    for (const code of ['KeyC', 'Space', 'KeyF', 'KeyQ', 'KeyE']) I.keys.delete(code);
  }
  update() {
    if (!I.touch) return;
    const play = G.mode === 'play', body = document.body;
    body.classList.toggle('tplay', play);
    body.classList.toggle('ingame', G.mode !== 'menu' && G.mode !== 'boot');
    if (!play) { if (this.live) { this.release(); this.live = false; } return; }
    this.live = true;
    if (this.atk && G.player.atkT < 0) I.lmbP = true;
    if (this.block) I.rmb = true;
    const M = G.mount, showMount = !!M?.owned && !G.inDungeon, label = !showMount ? '' : M.riding ? 'Ab' : M.state !== 'flee' && M.dist() < 6.5 ? 'Auf' : 'Elch';
    if (label !== this.mountLabel) { this.mountLabel = label; $('tMount').style.display = showMount ? 'block' : 'none'; $('tMount').textContent = label; }
    const chat = !!G.net?.active;
    if (chat !== this.chatShown) { this.chatShown = chat; $('tChat').style.display = chat ? 'block' : 'none'; }
  }
  /** Läuft es dauerhaft zu langsam, schaltet das Spiel einmal in den Sparmodus. */
  perf(dt) {
    if (!I.touch || G.settings.low || G.mode !== 'play' || document.hidden) { this.perfT = 0; this.perfSum = 0; this.perfN = 0; return; }
    this.perfT += dt; this.perfSum += dt; this.perfN++;
    if (this.perfT < 4) return;
    const avg = this.perfSum / this.perfN;
    this.perfT = 0; this.perfSum = 0; this.perfN = 0;
    this.slow = avg > .03 ? this.slow + 1 : 0;
    if (this.slow >= 2) {
      this.slow = 0; G.settings.low = true;
      if (G.settings.lines > 540) { G.settings.lines = 540; G.retro.lines = 540; G.retro.resize(G.camera); }
      G.game.applyQuality(); G.game.saveSettings();
      G.ui.toast('Sparmodus aktiviert, damit es flüssiger läuft', 'quest');
    }
  }
}
