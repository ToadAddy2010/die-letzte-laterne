import * as THREE from '../../vendor/three.module.js';
import { G } from '../game/state.js';
import { Input } from '../core/input.js';
import { TALENTS, TREES, FEATS } from '../data/extras.js';
import { LANGS, tr, setLang, currentLang } from '../i18n/i18n.js';
import { ITEMS, SPELLS, SHOPS, TOWN_TIER } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { POIS, POI, REGIONS, REGION_INFO, WORLD } from '../data/world.js';
import { ENEMIES, BOSSES } from '../data/enemies.js';
import { LORE, TIPS } from '../data/story.js';
import { COL, N, N1, regionAt } from '../world/terrain.js';
import { xpFor } from '../actors/player.js';
import { fmtTime, angDiff, clamp } from '../core/util.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ICON = { weapon: '/', armor: 'A', trinket: 'o', potion: '+', quest: '!', junk: '.' };
const TYPE = { weapon: 'Waffe', armor: 'Rüstung', trinket: 'Schmuck', potion: 'Trank', quest: 'Questgegenstand', junk: 'Beute' };
const POI_MARK = { town: ['■', '#ffd070'], dungeon: ['▼', '#ff7a5a'], shrine: ['♦', '#7fd8ff'], landmark: ['●', '#dcc0ff'], camp: ['x', '#ff5a4f'] };
const FOG = 160;
const v3 = new THREE.Vector3();

export class UI {
  constructor() {
    $('ui').innerHTML = `
    <div id="hud">
      <div id="bars"><div id="lvl"><b>Stufe <span id="lvN">1</span></b><span id="regName"></span></div>
        <div class="bar hp"><i id="hpI"></i><span id="hpT"></span></div><div class="bar mp"><i id="mpI"></i><span id="mpT"></span></div><div class="bar st"><i id="stI"></i></div>
        <div id="xp"><i id="xpI"></i></div><div id="gold"></div></div>
      <div id="compass"></div><div id="clock"></div><canvas id="mini" width="158" height="158"></canvas>
      <div id="tracker"></div><div id="hotbar"></div><div id="prompt"></div><div id="toasts"></div>
      <div id="boss"><b id="bossN"></b><div class="bar"><i id="bossI"></i></div><div id="bossP"><i></i></div></div>
      <div id="banner"><h1></h1><p></p></div><div id="qpop" class="frame"><small></small><h3></h3></div><div id="subtitle"></div><div id="whisper" class="frame"><small>Stimme aus der Laterne</small><b></b><span></span></div>
      <div id="click">Klicken, um weiterzuspielen</div><div id="floats"></div><div id="ehps"></div><div id="lockmark"></div>
    </div>
    <div id="dialog" class="frame"><h3 id="dlgN"></h3><small id="dlgR"></small><div id="dlgText"></div><div id="dlgOpts"></div></div>
    <div id="lore" class="frame"><h2></h2><p></p><button id="loreX">Schließen</button></div>
    <div id="panel" class="frame"><div id="tabs"></div><div id="pbody"></div></div>
    <div class="lb" id="lbT"></div><div class="lb" id="lbB"></div><div id="cutLine"></div><div id="cutHint">Leertaste: weiter · Esc: überspringen</div>
    <div id="ending" class="frame"></div>
    <div id="dead"><h1>Das Licht erlischt</h1><p id="deadTip"></p><button id="respawn">Wieder aufstehen</button></div>
    <div id="credits"></div>
    <div id="title"><h1>Die Letzte<br>Laterne</h1><p>Der Mond schläft seit tausend Jahren nicht mehr.</p><div id="menuBtns"></div><div id="titleFoot">Ein Dark-Fantasy-Abenteuer · Maus und Tastatur</div></div>
    <div id="titlePane" class="frame"></div>
    <div id="fadeflash"></div>
    <div id="loading"><h1>Die Letzte Laterne</h1><div id="loadBar"><i></i></div><div id="loadMsg">Die Laterne wird entzündet</div><div id="loadTip"></div></div>`;
    this.tab = 'inv'; this.sel = null; this.filter = 'all'; this.floats = []; this.ehps = []; this.miniT = 0; this.hud = { };
    this.typing = null; this.cut = null; this.opts = [];
    $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    $('respawn').onclick = () => G.game.respawn();
    $('loreX').onclick = () => this.closeLore();
    for (let i = 0; i < 14; i++) { const d = document.createElement('div'); d.className = 'ehp'; d.innerHTML = '<i></i><u></u>'; d.style.display = 'none'; $('ehps').appendChild(d); this.ehps.push(d); }
    this.compass();
    this.fog = new Uint8Array(FOG * FOG);
  }
  loading(p, msg) { $('loadBar').firstElementChild.style.width = `${p * 100}%`; if (msg) $('loadMsg').textContent = msg; }
  doneLoading() { $('loading').style.display = 'none'; this.buildMapBase(); }
  buildMapBase() {
    const c = this.mapBase = document.createElement('canvas'); c.width = c.height = N1;
    const g = c.getContext('2d'), img = g.createImageData(N1, N1), T = G.heights;
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i, a = k * 4, h = T[k];
      if (h < .1) { const d = clamp(-h / 14); img.data[a] = 30 - d * 14; img.data[a + 1] = 58 - d * 28; img.data[a + 2] = 150 - d * 54; }
      else { const l = T[Math.max(0, k - 1)] - T[Math.min(k + 1, T.length - 1)], s = 1 + clamp(l * .18, -.3, .3); img.data[a] = COL[k * 3] * s; img.data[a + 1] = COL[k * 3 + 1] * s; img.data[a + 2] = COL[k * 3 + 2] * s; }
      img.data[a + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = '#e8d8b0aa'; g.lineWidth = 1.4;
    for (const l of G.roadLines) { g.beginPath(); l.forEach((q, i) => { const x = (q.x + WORLD / 2) / 4, y = (q.z + WORLD / 2) / 4; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    this.fogC = document.createElement('canvas'); this.fogC.width = this.fogC.height = FOG;
  }
  reveal(x, z) {
    const R = 7, ci = Math.floor((x + WORLD / 2) / WORLD * FOG), cj = Math.floor((z + WORLD / 2) / WORLD * FOG);
    for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) if (i >= 0 && j >= 0 && i < FOG && j < FOG && Math.hypot(i - ci, j - cj) <= R) this.fog[j * FOG + i] = 1;
  }
  fogOut() { let s = ''; for (let i = 0; i < this.fog.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) b |= (this.fog[i + k] || 0) << k; s += String.fromCharCode(b); } return btoa(s); }
  fogIn(str) { this.fog.fill(0); if (!str) return; const s = atob(str); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); for (let k = 0; k < 8; k++) if (i * 8 + k < this.fog.length) this.fog[i * 8 + k] = (b >> k) & 1; } }

  // ── HUD ──
  show(on) { $('hud').classList.toggle('on', on); }
  compass() {
    const c = $('compass'); this.marks = [];
    for (const [t, a] of [['N', 0], ['NO', -.785], ['O', -1.57], ['SO', -2.356], ['S', 3.14], ['SW', 2.356], ['W', 1.57], ['NW', .785]]) {
      const s = document.createElement('span'); s.textContent = t; s.className = t.length === 1 ? 'card' : 'tick'; c.appendChild(s); this.marks.push({ s, a });
    }
    this.qm = document.createElement('span'); this.qm.className = 'qm'; this.qm.textContent = '◆'; c.appendChild(this.qm);
  }
  updateCompass(P) {
    const span = 1.45;
    for (const m of this.marks) { const d = angDiff(P.camYaw, m.a); m.s.style.display = Math.abs(d) < span ? '' : 'none'; m.s.style.left = `${50 - d / span * 50}%`; }
    const t = G.quests.trackedTarget();
    if (t && !G.inDungeon) { const a = Math.atan2(P.x - t.x, P.z - t.z), d = angDiff(P.camYaw, a); this.qm.style.display = ''; this.qm.style.left = `${clamp(50 - d / span * 50, 2, 98)}%`; } else this.qm.style.display = 'none';
  }
  update(dt) {
    this.updateType(dt);
    this.updateWhisper(dt);
    const P = G.player; if (!P) return;
    if (G.mode === 'play' || G.mode === 'dialog') this.updateHud(dt, P);
    if (G.mode === 'dialog') this.dialogKeys();
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subtitle').classList.remove('on'); }
    $('click').style.display = G.mode === 'play' && !Input.locked && !G.test && !Input.touch ? 'block' : 'none';
  }
  updateHud(dt, P) {
    $('hpI').style.width = `${P.hp / P.maxHp * 100}%`; $('mpI').style.width = `${P.mp / P.maxMp * 100}%`; $('stI').style.width = `${P.st / P.maxSt * 100}%`;
    $('hpT').textContent = `${Math.ceil(P.hp)} / ${P.maxHp}`; $('mpT').textContent = `${Math.floor(P.mp)} / ${P.maxMp}`;
    $('lvN').textContent = P.level; $('xpI').style.width = `${P.xp / xpFor(P.level) * 100}%`;
    $('gold').textContent = `${P.gold} Gold${P.pts ? `   ·   ${P.pts} Punkte frei${Input.touch ? '' : ' (K)'}` : ''}`;
    $('regName').textContent = G.house ? G.house.name : G.inDungeon ? POI[G.inDungeon].name : regionAt(P.x, P.z).name;
    const h = G.hour, cl = $('clock'), g = G.moonGaze > 0;
    cl.textContent = `Tag ${G.day} · ${fmtTime(h)}${g ? ' · DER MOND SCHAUT ZU' : ''}`; cl.classList.toggle('gaze', g);
    this.updateCompass(P);
    this.updateHot(P);
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = .12; this.drawMini(P); }
    this.updateEnemyBars(P);
    G.retro.u.hurt.value = Math.max(G.moonGaze > 0 ? .14 : 0, G.retro.u.hurt.value - dt * 1.7);
  }
  updateHot(P) {
    const root = $('hotbar'), key = P.spells.join();
    if (key !== this.hotKey) {
      this.hotKey = key;
      root.innerHTML = Array.from({ length: 6 }, (_, i) => { const s = SPELLS[P.spells[i]]; return `<div class="slot${s ? '' : ' none'}" title="${s ? esc(s.n) : ''}"><u>${i + 1}</u><b style="color:#${s ? s.color.toString(16).padStart(6, '0') : '444'}">${s ? s.n[0] : ''}</b><em></em><small>${s ? s.cost : ''}</small></div>`; }).join('') +
        '<div class="slot" id="slotH"><u>R</u><b style="color:#6dff8a">+</b><small></small></div><div class="slot" id="slotM"><u>T</u><b style="color:#5a9fff">+</b><small></small></div>';
    }
    const slots = root.children;
    for (let i = 0; i < 6; i++) { const id = P.spells[i]; if (!id) continue; const c = P.cds[id] || 0, s = SPELLS[id]; slots[i].firstElementChild.nextElementSibling.nextElementSibling.style.height = `${clamp(c / s.cd) * 100}%`; slots[i].classList.toggle('off', P.mp < s.cost); }
    const count = key => Object.entries(P.inv).reduce((a, [id, n]) => a + (ITEMS[id]?.t === 'potion' && ITEMS[id][key] ? n : 0), 0);
    if (slots[6]) slots[6].lastElementChild.textContent = count('heal');
    if (slots[7]) slots[7].lastElementChild.textContent = count('mana');
  }
  project(x, y, z) { v3.set(x, y, z).project(G.camera); return v3.z < 1 ? [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight] : null; }
  updateEnemyBars(P) {
    let n = 0;
    for (const e of G.enemies.list) {
      if (e.dead || e.boss || (e.hp >= e.maxHp && !e.elite) || n >= this.ehps.length) continue;
      if (Math.hypot(e.x - P.x, e.z - P.z) > 42) continue;
      const q = this.project(e.x, e.y + e.model.height + .5, e.z); if (!q) continue;
      const d = this.ehps[n++], w = e.elite ? 84 : 48; d.dataset.n = e.title || ''; d.classList.toggle('elite', !!e.elite); d.classList.toggle('stun', e.stun > 0); d.children[1].style.width = `${e.stun > 0 ? 100 : clamp((e.posture || 0) / (e.pMax || 1)) * 100}%`; d.style.display = 'block'; d.style.left = `${q[0]}px`; d.style.top = `${q[1]}px`; d.style.width = `${w}px`; d.firstChild.style.width = `${e.hp / e.maxHp * 100}%`;
    }
    for (; n < this.ehps.length; n++) this.ehps[n].style.display = 'none';
    const L = $('lockmark');
    if (P.lock && !P.lock.dead) { const q = this.project(P.lock.x, P.lock.y + P.lock.model.height * .6, P.lock.z); if (q) { L.style.display = 'block'; L.style.left = `${q[0]}px`; L.style.top = `${q[1]}px`; } else L.style.display = 'none'; } else L.style.display = 'none';
  }
  drawMini(P) {
    if (!this.mapBase) return;
    const c = $('mini'), g = c.getContext('2d'), S = 158;
    if (G.inDungeon) {
      const a = G.dungeon.active; g.fillStyle = '#05051a'; g.fillRect(0, 0, S, S); if (!a) return;
      const cs = G.house ? 5.5 : 2.2, ox = S / 2 - P.x / 5 * cs, oz = S / 2 - P.z / 5 * cs;
      g.fillStyle = '#6a68a8';
      for (let j = 0; j < 72; j++) for (let i = 0; i < 72; i++) if (G.dungeon.grid[j * 72 + i]) g.fillRect(ox + i * cs, oz + j * cs, cs, cs);
      g.fillStyle = '#7fd8ff'; g.fillRect(ox + a.exit.x / 5 * cs - 2, oz + a.exit.z / 5 * cs - 2, 4, 4);
      if (G.house) { g.fillStyle = '#ffd070'; for (const n of G.npcs.list) if (n.model && n.house === G.house) g.fillRect(ox + n.x / 5 * cs - 2, oz + n.z / 5 * cs - 2, 4, 4); }
    } else {
      const span = 110, sx = (P.x + WORLD / 2) / 4 - span / 2, sy = (P.z + WORLD / 2) / 4 - span / 2;
      g.imageSmoothingEnabled = false; g.fillStyle = '#10143c'; g.fillRect(0, 0, S, S);
      g.drawImage(this.mapBase, sx, sy, span, span, 0, 0, S, S);
      const k = S / (span * 4), mx = x => S / 2 + (x - P.x) * k, my = z => S / 2 + (z - P.z) * k;
      g.font = '12px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const p of POIS) { if (p.type === 'camp' || (!G.seen?.[p.id] && p.type !== 'town')) continue; const x = mx(p.x), y = my(p.z); if (x < -6 || y < -6 || x > S + 6 || y > S + 6) continue; const [ch, col] = POI_MARK[p.type]; g.fillStyle = '#000'; g.fillText(ch, x + 1, y + 1); g.fillStyle = p.type === 'shrine' && !G.discovered[p.id] ? '#667' : col; g.fillText(ch, x, y); }
      const b = G.mount;
      if (b?.owned && b.placed && !b.riding) { const x = clamp(mx(b.x), 5, S - 5), y = clamp(my(b.z), 5, S - 5); g.fillStyle = '#000'; g.fillRect(x - 3, y - 3, 7, 7); g.fillStyle = '#7fe08a'; g.fillRect(x - 2, y - 2, 5, 5); }
      for (const t of G.explore?.trials || []) { if (!G.seen?.[t.id]) continue; const x = mx(t.x), y = my(t.z); if (x < 0 || y < 0 || x > S || y > S) continue; g.fillStyle = '#000'; g.fillText('✦', x + 1, y + 1); g.fillStyle = G.shards[t.id] ? '#667' : '#bfd0ff'; g.fillText('✦', x, y); }
      const friend = G.net?.remote;
      if (friend?.area === 'w') { const x = clamp(mx(friend.x), 5, S - 5), y = clamp(my(friend.z), 5, S - 5); g.fillStyle = '#000'; g.fillRect(x - 4, y - 4, 9, 9); g.fillStyle = '#ffe9a8'; g.fillRect(x - 3, y - 3, 7, 7); }
      const t = G.quests.trackedTarget();
      if (t) { const x = clamp(mx(t.x), 6, S - 6), y = clamp(my(t.z), 6, S - 6); g.fillStyle = '#000'; g.font = 'bold 16px monospace'; g.fillText('◆', x + 1, y + 1); g.fillStyle = '#ffd24a'; g.fillText('◆', x, y); }
    }
    g.save(); g.translate(S / 2, S / 2); g.rotate(-P.camYaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  toast(text, cls = '') {
    const box = $('toasts'); const d = document.createElement('div');
    d.className = `toast ${cls}`; d.textContent = text; box.appendChild(d);
    while (box.children.length > 7) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), 3400);
  }
  floatText(x, y, z, text, cls) {
    if (!G.camera) return;
    const q = this.project(x, y, z); if (!q) return;
    const box = $('floats'); if (box.children.length > 26) box.removeChild(box.firstChild);
    const d = document.createElement('div'); d.className = `float ${cls}`; d.textContent = text;
    d.style.left = `${q[0] + (Math.random() - .5) * 24}px`; d.style.top = `${q[1]}px`; box.appendChild(d);
    setTimeout(() => d.remove(), 850);
  }
  bossBar(e) {
    const b = $('boss');
    if (!e) { b.style.display = 'none'; return; }
    b.style.display = 'block'; $('bossN').textContent = e.d.n; $('bossI').style.width = `${clamp(e.hp / e.maxHp) * 100}%`; { const q = $('bossP'); q.classList.toggle('stun', e.stun > 0); q.firstChild.style.width = `${e.stun > 0 ? 100 : clamp((e.posture || 0) / (e.pMax || 1)) * 100}%`; }
  }
  banner(t, s) { const b = $('banner'); b.querySelector('h1').textContent = t; b.querySelector('p').textContent = s || ''; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  questPop(h, t) { const b = $('qpop'); b.querySelector('small').textContent = h; b.querySelector('h3').textContent = t; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  levelUp(l) { this.banner(`Stufe ${l}`, Input.touch ? 'Du hast 2 Punkte erhalten. Verteile sie im Menü.' : 'Du hast 2 Punkte erhalten. Verteile sie mit K.'); }
  subtitle(t, dur = 5) { $('subtitle').textContent = t; $('subtitle').classList.add('on'); this.subT = dur; }
  prompt(t) { const p = $('prompt'); if (t === this.promptT) return; this.promptT = t; p.style.display = t ? 'block' : 'none'; if (t) p.innerHTML = `<kbd>${Input.touch ? 'Tippen' : 'E'}</kbd>  ${esc(t)}`; }
  refreshTracker() {
    const Q = G.quests; if (!Q) return;
    const id = Q.tracked, box = $('tracker');
    if (id) box.innerHTML = `<small>${QUESTS[id].type === 'main' ? 'Hauptquest' : 'Nebenquest'}</small><h3>${esc(QUESTS[id].title)}</h3><p>${esc(Q.stepText(id))}</p>`;
    else { const t = Q.trackedTarget(); box.innerHTML = t?.hint ? `<small>Hauptquest</small><p>${esc(t.hint)}</p>` : ''; }
  }
  fadeFlash() { const f = $('fadeflash'); f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 520); }
  letterbox(on) { G.audio?.setDuck(on ? .62 : 1); document.body.classList.toggle('cut', on); $('cutHint').style.display = on ? 'block' : 'none'; this.show(!on); if (!on) $('ending').style.display = 'none'; }

  // ── Stimmen aus der Laterne ──
  whisper(name, lines) { (this.wq ??= []).push(...lines.map(t => ({ name, t: tr(t) }))); }
  updateWhisper(dt) {
    const box = $('whisper');
    if (!this.wCur) {
      if (!this.wq?.length || G.mode !== 'play') { if (box.style.display === 'block' && !this.wCur) box.style.display = 'none'; return; }
      const w = this.wCur = this.wq.shift();
      w.i = 0; w.spoken = 0; w.hold = 1.5 + w.t.length * .045; w.voice = G.audio?.voiceFor(w.name);
      if (w.voice) w.voice.n = 0;
      box.style.display = 'block'; box.querySelector('b').textContent = w.name; box.querySelector('span').dataset.notr = '1'; box.querySelector('span').textContent = '';
    }
    const w = this.wCur;
    if (G.mode !== 'play') return;
    if (w.i < w.t.length) {
      w.i = Math.min(w.t.length, w.i + dt * 44);
      const n = Math.floor(w.i);
      if (w.voice) for (; w.spoken < n; w.spoken++) G.audio?.speak(w.t, w.spoken, w.voice);
      box.querySelector('span').textContent = w.t.slice(0, n);
    } else { w.hold -= dt; if (w.hold <= 0) this.wCur = null; }
  }

  // ── Text ──
  type(el, text, onDone, voice) { if (voice) voice.n = 0; text = tr(text); el.dataset.notr = '1'; this.typing = { el, text, i: 0, spoken: 0, onDone, voice }; el.textContent = ''; }
  updateType(dt) {
    const t = this.typing; if (!t) return;
    t.i += dt * 44;
    const n = Math.min(t.text.length, Math.floor(t.i));
    if (t.voice) for (; t.spoken < n; t.spoken++) G.audio?.speak(t.text, t.spoken, t.voice);
    t.el.textContent = t.text.slice(0, n);
    if (n >= t.text.length) { this.typing = null; t.onDone?.(); }
  }
  finishType() { const t = this.typing; if (!t) return; t.el.textContent = t.text; this.typing = null; t.onDone?.(); }
  cutLine(who, text) {
    const c = $('cutLine');
    if (!text) { c.style.display = 'none'; this.typing = null; return; }
    c.style.display = 'block'; c.innerHTML = `${who ? `<b>${esc(who)}</b>` : ''}<span></span>`;
    this.type(c.querySelector('span'), text, null, G.audio?.voiceFor(who || 'erzaehler'));
  }
  cutDone() { return !this.typing; }
  cutFinish() { this.finishType(); }
  dialog(name, role, text, opts, voice) {
    const d = $('dialog');
    if (!name) { d.style.display = 'none'; this.typing = null; this.opts = []; G.audio?.setDuck(1); return; }
    G.audio?.setDuck(.42);
    d.style.display = 'block'; $('dlgN').textContent = name; $('dlgR').textContent = role || '';
    this.opts = opts; const box = $('dlgOpts'); box.innerHTML = '';
    opts.forEach((o, i) => { const b = document.createElement('button'); b.className = o.cls || ''; b.textContent = opts.length > 1 ? `${i + 1}. ${tr(o.t)}` : tr(o.t); b.onclick = () => this.pick(i); box.appendChild(b); });
    this.type($('dlgText'), text, null, voice);
  }
  pick(i) { const o = this.opts[i]; if (!o) return; G.audio?.tick(); o.fn(); }
  dialogKeys() {
    if (Input.hit('Escape')) { G.dialog.close(); return; }
    if (this.typing && (Input.hit('Space') || Input.hit('Enter') || Input.hit('KeyE'))) { this.finishType(); return; }
    for (let i = 0; i < 9; i++) if (Input.hit(`Digit${i + 1}`)) { this.finishType(); this.pick(i); return; }
    if (this.opts.length === 1 && (Input.hit('Space') || Input.hit('Enter') || Input.hit('KeyE'))) this.pick(0);
  }
  endingChoice(list, cb) {
    const e = $('ending'); e.style.display = 'flex'; e.innerHTML = '<h2>Was tust du?</h2>';
    for (const x of list) { const b = document.createElement('button'); b.textContent = x.t; b.onclick = () => { e.style.display = 'none'; cb(x); }; e.appendChild(b); }
  }
  loreBox(l) { const d = $('lore'); d.querySelector('h2').textContent = l[0]; d.querySelector('p').textContent = l[1]; d.style.display = 'block'; G.mode = 'panel'; this.loreOpen = true; Input.unlock(); }
  closeLore() { $('lore').style.display = 'none'; this.loreOpen = false; G.mode = 'play'; G.game.resumeLock(); }

  // ── Panels ──
  openPanel(tab = 'inv') { this.tab = tab; this.sel = null; G.mode = 'panel'; Input.unlock(); Input.clear(); $('panel').style.display = 'flex'; this.show(false); this.drawPanel(); G.audio?.panel(tab); }
  closePanel() { G.audio?.panelClose(); $('panel').style.display = 'none'; this.shop = null; G.mode = 'play'; this.show(true); this.refreshTracker(); G.game.resumeLock(); }
  openShop(n) { this.shop = n; this.shopMode = 'buy'; this.sel = null; this.tab = 'shop'; G.mode = 'panel'; Input.unlock(); Input.clear(); $('panel').style.display = 'flex'; this.show(false); this.drawPanel(); G.audio?.panel('shop'); }
  drawPanel() {
    const tabs = this.shop ? [['shop', `Handel: ${this.shop.d.n}`]] : [['inv', 'Inventar'], ['char', 'Charakter'], ['talent', G.player.talentPts > 0 ? `Talente (${G.player.talentPts})` : 'Talente'], ['spell', 'Zauber'], ['quest', 'Quests'], ['map', 'Weltkarte'], ['journal', 'Journal'], ['feat', `Erfolge ${G.feats.count()}/${FEATS.length}`], ...(G.net?.available ? [['party', G.net.active ? `Team: ${G.net.remote.name}` : 'Multiplayer']] : []), ['sys', 'System']];
    $('tabs').innerHTML = tabs.map(([k, t]) => `<button data-t="${k}" class="${this.tab === k ? 'on' : ''}">${esc(t)}</button>`).join('') + `<button class="x" data-x="1">${Input.touch ? 'Schließen' : 'Schließen (Esc)'}</button>`;
    for (const b of $('tabs').querySelectorAll('button')) b.onclick = () => { if (b.dataset.x) this.closePanel(); else { this.tab = b.dataset.t; this.sel = null; this.drawPanel(); G.audio?.panel(this.tab); } };
    ({ inv: () => this.pInv(), char: () => this.pChar(), talent: () => this.pTalent(), feat: () => this.pFeat(), spell: () => this.pSpell(), quest: () => this.pQuest(), map: () => this.pMap(), journal: () => this.pJournal(), party: () => G.netui.panel($('pbody')), sys: () => this.pSys(), shop: () => this.pShop() })[this.tab]();
  }
  itemDetail(it, extra = '') {
    if (!it) return '<div class="detail"><p style="color:var(--dim)">Wähle einen Gegenstand.</p></div>';
    const P = G.player; let s = '';
    if (it.t === 'weapon') { const c = ITEMS[P.equip.weapon]; s += this.cmp('Schaden', it.dmg, c?.dmg); if (it.sp || c?.sp) s += this.cmp('Zauberkraft', it.sp || 0, c?.sp || 0); }
    if (it.t === 'armor') { const c = ITEMS[P.equip.armor]; s += this.cmp('Rüstung', it.def, c?.def); if (it.hp) s += `<div class="stat">Leben<b>+${it.hp}</b></div>`; if (it.mp) s += `<div class="stat">Mana<b>+${it.mp}</b></div>`; }
    if (it.heal) s += `<div class="stat">Heilt<b>${it.heal}</b></div>`;
    if (it.mana) s += `<div class="stat">Mana<b>${it.mana}</b></div>`;
    if (it.price) s += `<div class="stat">Wert<b>${it.price} Gold</b></div>`;
    return `<div class="detail"><h2 class="t-${it.t}${it.rare ? ' legend' : ''}">${esc(it.n)}</h2><small style="color:var(--dim)">${it.rare ? '<span class="legend">Legendär</span> · ' : ''}${TYPE[it.t]}</small><p>${esc(it.d || '')}</p>${s}${extra}</div>`;
  }
  cmp(l, a, b = 0) { const d = a - b; return `<div class="stat">${l}<b>${a} ${d ? `<span class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${d})</span>` : ''}</b></div>`; }
  pInv() {
    const P = G.player, ids = Object.keys(P.inv).filter(id => ITEMS[id] && (this.filter === 'all' || ITEMS[id].t === this.filter));
    const order = { weapon: 0, armor: 1, trinket: 2, potion: 3, quest: 4, junk: 5 };
    ids.sort((a, b) => order[ITEMS[a].t] - order[ITEMS[b].t] || (ITEMS[b].price - ITEMS[a].price));
    for (const id of Object.values(P.equip)) if (id && !ids.includes(id) && (this.filter === 'all' || ITEMS[id].t === this.filter)) ids.unshift(id);
    const sel = this.sel && (P.inv[this.sel] || P.isEquipped(this.sel)) ? this.sel : ids[0]; this.sel = sel;
    const it = ITEMS[sel];
    let acts = '';
    if (it) {
      if (['weapon', 'armor', 'trinket'].includes(it.t)) acts += P.isEquipped(sel) ? (it.t === 'trinket' ? '<button id="unq">Ablegen</button>' : '<button disabled>Angelegt</button>') : '<button id="eq">Anlegen</button>';
      if (it.t === 'potion') acts += '<button id="use">Trinken</button>';
    }
    const fb = [['all', 'Alles'], ['weapon', 'Waffen'], ['armor', 'Rüstung'], ['trinket', 'Schmuck'], ['potion', 'Tränke'], ['quest', 'Quest'], ['junk', 'Beute']];
    $('pbody').innerHTML = `<div class="col"><div class="filter">${fb.map(([k, t]) => `<button data-f="${k}" class="${this.filter === k ? 'on' : ''}">${t}</button>`).join('')}</div>${ids.map(id => this.itemRow(id, sel, P.inv[id] || 1, P.isEquipped(id))).join('') || '<p style="color:var(--dim)">Nichts hier.</p>'}</div><div class="col narrow">${this.itemDetail(it, acts ? `<div class="acts">${acts}</div>` : '')}<p style="color:var(--gold);margin-top:14px">${P.gold} Gold</p></div>`;
    for (const b of $('pbody').querySelectorAll('[data-f]')) b.onclick = () => { this.filter = b.dataset.f; this.sel = null; this.drawPanel(); };
    this.bindRows();
    if ($('eq')) $('eq').onclick = () => { P.equipItem(sel); this.drawPanel(); };
    if ($('unq')) $('unq').onclick = () => { for (const s of ['trinket1', 'trinket2']) if (P.equip[s] === sel) P.unequip(s); this.drawPanel(); };
    if ($('use')) $('use').onclick = () => { P.potionCd = 0; P.drink(sel); this.drawPanel(); };
  }
  itemRow(id, sel, n, eq, right = '') { const it = ITEMS[id]; return `<button class="row ${id === sel ? 'sel' : ''} ${eq ? 'eq' : ''}" data-id="${id}"><span class="icon t-${it.t}">${ICON[it.t]}</span><span class="nm t-${it.t}${it.rare ? ' legend' : ''}">${esc(it.n)}</span><span class="ct">${right || (n > 1 ? `×${n}` : '')}</span></button>`; }
  bindRows() { for (const b of $('pbody').querySelectorAll('.row[data-id]')) b.onclick = () => { this.sel = b.dataset.id; this.drawPanel(); G.audio?.tick(); }; }
  pTalent() {
    const P = G.player, pts = P.talentPts;
    const col = i => `<div class="col"><h3>${TREES[i]}</h3>${TALENTS.filter(t => t.tree === i).map(t => { const has = P.talents[t.id], can = P.canLearn(t.id); return `<button class="talent ${has ? 'have' : can ? 'can' : ''}" data-tl="${t.id}" ${has || !can ? 'disabled' : ''}><b>${esc(t.n)}</b><small>${esc(t.d)}</small></button>`; }).join('')}</div>`;
    $('pbody').innerHTML = `<div class="talentWrap"><p class="talHead">Freie Talentpunkte: <b>${Math.max(0, pts)}</b> · Alle zwei Stufen gibt es einen Punkt.${Object.keys(P.talents).length ? ' <button id="talReset">Neu verteilen</button>' : ''}</p><div class="talCols">${[0, 1, 2].map(col).join('')}</div></div>`;
    for (const b of $('pbody').querySelectorAll('[data-tl]')) b.onclick = () => { if (P.learn(b.dataset.tl)) this.drawPanel(); };
    if ($('talReset')) $('talReset').onclick = () => { P.talents = {}; P.recalc(); G.audio?.tick(); this.drawPanel(); };
  }
  pFeat() {
    const F = G.feats;
    $('pbody').innerHTML = `<div class="featGrid">${FEATS.map(f => { const has = F.has(f), v = Math.min(f.need, F.value(f)); return `<div class="feat ${has ? 'have' : ''}"><b>${esc(f.n)}</b><small>${esc(f.d)}</small><span class="featBar"><i style="width:${v / f.need * 100}%"></i></span><em>${v} / ${f.need}</em></div>`; }).join('')}</div>`;
  }
  pChar() {
    const P = G.player, st = (l, v) => `<div class="stat">${l}<b>${v}</b></div>`;
    const attr = (k, l, d) => `<div class="stat" style="align-items:center"><span>${l}<br><small style="color:var(--dim)">${d}</small></span><b>${P[k]} <button data-a="${k}" ${P.pts ? '' : 'disabled'}>+</button></b></div>`;
    const slot = (s, l) => `<div class="stat">${l}<b>${ITEMS[P.equip[s]]?.n || '-'}</b></div>`;
    $('pbody').innerHTML = `<div class="col"><h2>Laternenträger</h2><p>Stufe ${P.level} · ${P.xp} / ${xpFor(P.level)} EP</p><h3 style="margin-top:8px">Attribute · ${P.pts} frei</h3>${attr('kraft', 'Kraft', 'Waffenschaden')}${attr('geist', 'Geist', 'Mana und Zauberkraft')}${attr('ausdauer', 'Ausdauer', 'Leben und Stamina')}<h3 style="margin-top:10px">Ausrüstung</h3>${slot('weapon', 'Waffe')}${slot('armor', 'Rüstung')}${slot('trinket1', 'Schmuck 1')}${slot('trinket2', 'Schmuck 2')}</div>
    <div class="col"><h3>Werte</h3>${st('Leben', `${Math.ceil(P.hp)} / ${P.maxHp}`)}${st('Mana', `${Math.floor(P.mp)} / ${P.maxMp}`)}${st('Stamina', P.maxSt)}${st('Angriff', Math.round(P.atk))}${st('Zauberkraft', Math.round(P.sp))}${st('Rüstung', P.def)}${st('Kritisch', `${Math.round(P.crit * 100)} %`)}${st('Tempo', `${Math.round(P.speedMul * 100)} %`)}<h3 style="margin-top:10px">Reise</h3>${st('Spielzeit', `${Math.floor(G.stats.played / 3600)} h ${Math.floor(G.stats.played / 60) % 60} min`)}${st('Besiegte Feinde', G.stats.kills)}${st('Gefallen', G.stats.deaths)}${st('Quests', `${G.quests.doneIds().length} / ${Object.keys(QUESTS).length}`)}${st('Mondsplitter', `${Object.keys(G.shards).length} / ${G.interact.shardTotal}`)}${st('Laternen', `${Object.keys(G.discovered).length} / ${POIS.filter(p => p.type === 'shrine').length}`)}${st('Truhen', G.stats.chests || 0)}</div>`;
    for (const b of $('pbody').querySelectorAll('[data-a]')) b.onclick = () => { if (!P.pts) return; P[b.dataset.a]++; P.pts--; P.recalc(); G.audio?.tick(); this.drawPanel(); };
  }
  pSpell() {
    const P = G.player, list = Object.entries(SPELLS);
    $('pbody').innerHTML = `<div class="col"><h2>Zauber der Laterne</h2><p style="color:var(--dim)">Neue Zauber lernst du durch die Hauptgeschichte. ${Input.touch ? 'Tippe sie unten in der Leiste an.' : 'Die Tasten 1 bis 6 wirken sie.'}</p>${list.map(([id, s]) => { const i = P.spells.indexOf(id); return `<div class="stat" style="opacity:${i < 0 ? .4 : 1};padding:6px 3px"><span><b style="color:#${s.color.toString(16).padStart(6, '0')}">${i >= 0 ? `[${i + 1}] ` : ''}${esc(s.n)}</b><br><small>${i >= 0 ? esc(s.d) : 'Noch unbekannt'}</small></span><b>${s.cost} Mana</b></div>`; }).join('')}</div>`;
  }
  pQuest() {
    const Q = G.quests, act = Q.activeIds(), done = Q.doneIds();
    act.sort((a, b) => (QUESTS[a].type === 'main' ? -1 : 1) - (QUESTS[b].type === 'main' ? -1 : 1));
    const sel = this.sel && QUESTS[this.sel] ? this.sel : (Q.tracked || act[0] || done[0]); this.sel = sel;
    const row = id => `<button class="row ${id === sel ? 'sel' : ''}" data-q="${id}"><span class="icon" style="color:${QUESTS[id].type === 'main' ? '#ff9a6a' : '#ffd24a'}">${QUESTS[id].type === 'main' ? '★' : '!'}</span><span class="nm">${esc(QUESTS[id].title)}</span>${Q.tracked === id ? '<span class="ct">◆</span>' : ''}</button>`;
    let d = '<p style="color:var(--dim)">Noch keine Aufträge.</p>';
    if (sel) {
      const q = QUESTS[sel], st = Q.state[sel];
      if (st) {
        const steps = q.steps.map((s, i) => (s.hint ? `<div class="stat" style="${i > st.s && !st.done ? 'display:none' : ''}"><span style="color:${i < st.s || st.done ? 'var(--dim)' : '#fff'}">${i < st.s || st.done ? '✓ ' : '› '}${esc(i === st.s && !st.done ? Q.stepText(sel) : s.hint)}</span></div>` : '')).join('');
        const R = q.reward || {};
        d = `<div class="detail"><h2>${esc(q.title)}</h2><small style="color:var(--dim)">${q.type === 'main' ? 'Hauptquest' : 'Nebenquest'}${st.done ? ' · Abgeschlossen' : ''}</small><p>${esc(q.desc || q.offer?.[0] || '')}</p>${steps}<p style="color:var(--gold)">Belohnung: ${R.xp || 0} EP, ${R.gold || 0} Gold${(R.items || []).map(i => `, ${esc(ITEMS[i].n)}`).join('')}${R.spell ? `, ${esc(SPELLS[R.spell].n)}` : ''}</p>${!st.done && Q.tracked !== sel ? '<div class="acts"><button id="track">Verfolgen</button></div>' : ''}</div>`;
      }
    }
    $('pbody').innerHTML = `<div class="col narrow"><h3>Aktiv (${act.length})</h3>${act.map(row).join('')}<h3 style="margin-top:10px">Erledigt (${done.length})</h3>${done.map(row).join('')}</div><div class="col">${d}</div>`;
    for (const b of $('pbody').querySelectorAll('[data-q]')) b.onclick = () => { this.sel = b.dataset.q; this.drawPanel(); G.audio?.tick(); };
    if ($('track')) $('track').onclick = () => { Q.tracked = sel; this.refreshTracker(); this.drawPanel(); };
  }
  pMap() {
    $('pbody').innerHTML = `<div id="mapwrap"><div id="mapBox"><canvas id="mapC" width="800" height="800"></canvas></div><div id="mapInfo"><h3 id="mapN">Das Reich</h3><p id="mapD" style="margin:5px 0;color:var(--dim)">Wähle einen Ort. Entzündete Laternen ♦ erlauben die Schnellreise.</p><div id="mapA"></div><div class="legend"><span style="color:#ffd070">■</span>Stadt<span style="color:#7fd8ff">♦</span>Laterne<span style="color:#ff7a5a">▼</span>Dungeon<span style="color:#dcc0ff">●</span>Sehenswürdigkeit<span style="color:#bfd0ff">✦</span>Mondprüfung<span style="color:#ff5a4f">x</span>Feindlager<span style="color:#ffd24a">◆</span>Questziel<span style="color:#fff">▲</span>Du</div></div></div>`;
    const c = $('mapC'), box = $('mapBox'), S = Math.max(240, Math.min(box.clientWidth, box.clientHeight) - 6); c.style.width = c.style.height = `${S}px`;
    this.drawMap();
    const pick = e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * WORLD - WORLD / 2, z = (e.clientY - r.top) / r.height * WORLD - WORLD / 2;
      let best = null, bd = Input.touch ? 170 : 56;
      for (const p of POIS) { if (!(G.seen[p.id] || G.discovered[p.id] || p.type === 'town')) continue; const d = Math.hypot(p.x - x, p.z - z) - (p.type === 'shrine' ? 10 : 0); if (d < bd) { bd = d; best = p; } }
      return best;
    };
    c.onclick = e => this.mapSelect(pick(e));
    this.mapSelect(null);
  }
  mapSelect(p) {
    this.mapSel = p; this.drawMap();
    if (!p) { $('mapA').innerHTML = ''; return; }
    $('mapN').textContent = p.name;
    const reg = regionAt(p.x, p.z);
    $('mapD').textContent = `${reg.name}. ${{ town: 'Eine Siedlung.', dungeon: `Ein Dungeon, empfohlen ab Stufe ${p.lvl}.`, shrine: G.discovered[p.id] ? 'Diese Laterne brennt.' : 'Noch nicht entzündet.', landmark: 'Ein Ort mit Geschichte.', camp: 'Ein Feindlager.' }[p.type]} ${REGION_INFO[reg.id]}`;
    const can = p.type === 'shrine' && G.discovered[p.id] && (!G.inDungeon || G.house);
    $('mapA').innerHTML = can ? '<div class="acts"><button id="ft">Hierher reisen</button></div>' : '';
    if ($('ft')) $('ft').onclick = () => { this.closePanel(); G.game.fastTravel(p); };
  }
  drawMap() {
    const c = $('mapC'); if (!c || !this.mapBase) return;
    const g = c.getContext('2d'), S = 800, k = S / WORLD, X = x => (x + WORLD / 2) * k, Y = z => (z + WORLD / 2) * k, P = G.player;
    g.imageSmoothingEnabled = false; g.drawImage(this.mapBase, 0, 0, S, S);
    const fc = this.fogC.getContext('2d'), img = fc.createImageData(FOG, FOG);
    for (let i = 0; i < this.fog.length; i++) { img.data[i * 4] = 10; img.data[i * 4 + 1] = 10; img.data[i * 4 + 2] = 34; img.data[i * 4 + 3] = this.fog[i] ? 0 : 214; }
    fc.putImageData(img, 0, 0); g.drawImage(this.fogC, 0, 0, S, S);
    g.font = 'bold 21px Term, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of REGIONS) { g.fillStyle = '#0008'; g.fillText(tr(r.name).toUpperCase(), X(r.c[0]) + 2, Y(r.c[1]) - 42); g.fillStyle = '#f2e6c8c0'; g.fillText(tr(r.name).toUpperCase(), X(r.c[0]), Y(r.c[1]) - 44); }
    g.font = '20px monospace';
    for (const p of POIS) {
      const seen = G.seen[p.id] || G.discovered[p.id]; if (!seen && p.type !== 'town') continue;
      const [ch, col] = POI_MARK[p.type], x = X(p.x), y = Y(p.z);
      g.fillStyle = '#000'; g.fillText(ch, x + 1.5, y + 1.5); g.fillStyle = p.type === 'shrine' && !G.discovered[p.id] ? '#778' : col; g.fillText(ch, x, y);
      if (p.type === 'town') { g.font = '19px Term, monospace'; g.fillStyle = '#000'; g.fillText(tr(p.name), x + 1, y + 17); g.fillStyle = '#ffe9b8'; g.fillText(tr(p.name), x, y + 16); g.font = '20px monospace'; }
      if (p === this.mapSel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x - 12, y - 12, 24, 24); }
    }
    g.font = '22px monospace';
    for (const q of G.explore?.trials || []) { if (!G.seen?.[q.id]) continue; g.fillStyle = '#000'; g.fillText('✦', X(q.x) + 1.5, Y(q.z) + 1.5); g.fillStyle = G.shards[q.id] ? '#778' : '#bfd0ff'; g.fillText('✦', X(q.x), Y(q.z)); }
    const t = G.quests.trackedTarget();
    if (t) { g.font = 'bold 26px monospace'; g.fillStyle = '#000'; g.fillText('◆', X(t.x) + 2, Y(t.z) + 2); g.fillStyle = '#ffd24a'; g.fillText('◆', X(t.x), Y(t.z)); }
    const wx = G.inDungeon ? G.worldPos.x : P.x, wz = G.inDungeon ? G.worldPos.z : P.z;
    g.save(); g.translate(X(wx), Y(wz)); g.rotate(-P.camYaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  pJournal() {
    const tabs = [['lore', 'Überlieferungen'], ['best', 'Bestiarium']], mode = this.jMode || 'lore';
    let body = '';
    if (mode === 'lore') body = Object.entries(LORE).map(([id, l]) => (G.tablets[id] ? `<div style="margin-bottom:9px"><h3>${esc(l[0])}</h3><span>${esc(l[1])}</span></div>` : '')).join('') || '<p style="color:var(--dim)">Lies Steintafeln in der Welt, um sie hier zu sammeln.</p>';
    else {
      const all = { ...ENEMIES, ...BOSSES };
      body = Object.entries(all).filter(([, e]) => e.ai !== 'dummy').map(([id, e]) => { const n = G.killed[id] || 0; return `<div class="stat" style="opacity:${n ? 1 : .35}"><span>${n ? esc(e.n) : '???'}${BOSSES[id] && n ? ` <small style="color:var(--gold)">${esc(e.title)}</small>` : ''}</span><b>${n ? `${n} besiegt` : ''}</b></div>`; }).join('');
    }
    $('pbody').innerHTML = `<div class="col"><div class="filter">${tabs.map(([k, t]) => `<button data-j="${k}" class="${mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>${body}</div>`;
    for (const b of $('pbody').querySelectorAll('[data-j]')) b.onclick = () => { this.jMode = b.dataset.j; this.drawPanel(); };
  }
  settingsHtml() {
    const s = G.settings;
    return `<div class="opt"><label data-notr="1">Sprache · Language · Idioma · भाषा</label><select id="oLang" data-notr="1">${LANGS.map(([k, n]) => `<option value="${k}" ${currentLang() === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="opt"><label>Lautstärke</label><input id="oV" type="range" min="0" max="1" step=".05" value="${s.volume}"></div><div class="opt"><label>Musik</label><input id="oM" type="range" min="0" max="1" step=".05" value="${s.music}"></div><div class="opt"><label>${Input.touch ? 'Kameratempo' : 'Mausempfindlichkeit'}</label><input id="oS" type="range" min=".3" max="2.5" step=".05" value="${s.sens}"></div><div class="opt"><label>Auflösung</label><select id="oL">${[[540, 'Niedrig (540p)'], [720, 'Mittel (720p)'], [900, 'Hoch (900p)'], [1080, 'Voll (1080p)'], [1440, 'Ultra (1440p)']].map(([v, t]) => `<option value="${v}" ${s.lines === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="opt"><label>Retro-Pixelfilter</label><input id="oRetro" type="checkbox" ${s.retro ? 'checked' : ''} style="flex:0 0 auto"></div><div class="opt"><label>Sparmodus</label><input id="oLow" type="checkbox" ${s.low ? 'checked' : ''} style="flex:0 0 auto"></div><div class="opt"><label>${Input.touch ? 'Kamera Y umkehren' : 'Maus Y umkehren'}</label><input id="oI" type="checkbox" ${s.invertY ? 'checked' : ''} style="flex:0 0 auto"></div><div class="opt"><label>Kamerawackeln</label><input id="oK" type="checkbox" ${s.shake ? 'checked' : ''} style="flex:0 0 auto"></div>`;
  }
  bindSettings() {
    const s = G.settings, save = () => G.game.saveSettings();
    $('oLang').onchange = async e => { s.lang = e.target.value; save(); await setLang(s.lang); G.audio?.tick(); };
    $('oV').oninput = e => { s.volume = +e.target.value; G.audio.applyVolume(); save(); };
    $('oM').oninput = e => { s.music = +e.target.value; G.audio.applyVolume(); save(); };
    $('oS').oninput = e => { s.sens = +e.target.value; save(); };
    $('oL').onchange = e => { s.lines = +e.target.value; G.retro.lines = s.lines; G.retro.resize(G.camera); save(); };
    $('oRetro').onchange = e => { s.retro = e.target.checked; G.retro.setStyle(s.retro); G.retro.resize(G.camera); save(); };
    $('oLow').onchange = e => { s.low = e.target.checked; G.game.applyQuality(); save(); };
    $('oI').onchange = e => { s.invertY = e.target.checked; save(); };
    $('oK').onchange = e => { s.shake = e.target.checked; save(); };
  }
  keysHtml() { if (Input.touch) return '<div class="keys"><b>Links wischen</b><span>Laufen, ganz drücken zum Rennen</span><b>Rechts wischen</b><span>Kamera</span><b>Schlag</b><span>Angriff, halten für Kombo</span><b>Block</b><span>Halten zum Blocken</span><b>Rolle</b><span>Ausweichen</span><b>Sprung</b><span>Springen</span><b>Ziel</b><span>Gegner fixieren</span><b>Elch</b><span>Reittier rufen, auf- und absitzen</span><b>Anzeige unten</b><span>Sprechen, öffnen, benutzen</span><b>Leiste unten</b><span>Zauber und Tränke</span><b>Minikarte</b><span>Weltkarte</span><b>Questtext</b><span>Quests</span><b>Menü</b><span>Inventar und alles andere</span></div>'; return `<div class="keys"><b>Rechtsklick genau beim Treffer</b><span>Parieren, bricht die Haltung</span><b>C genau beim Treffer</b><span>Perfektes Ausweichen, lädt Konter auf</span><b>G oder Linksklick halten</b><span>Wuchtschlag aufladen</span><b>Angriff auf taumelnden Gegner</b><span>Todesstoß</span><b>O</b><span>Fotomodus</span><b>W A S D</b><span>Laufen</span><b>Maus</b><span>Kamera</span><b>Linksklick / X</b><span>Angriff (3er-Kombo)</span><b>Rechtsklick</b><span>Blocken</span><b>C</b><span>Ausweichrolle</span><b>Leertaste</b><span>Springen</span><b>Shift</b><span>Rennen: antippen oder halten</span><b>E</b><span>Interagieren</span><b>Q</b><span>Reittier rufen, auf- und absitzen</span><b>F</b><span>Ziel fixieren</span><b>1 bis 6</b><span>Zauber</span><b>R / T</b><span>Heil- / Manatrank</span><b>I</b><span>Inventar</span><b>K</b><span>Charakter</span><b>J</b><span>Quests</span><b>M</b><span>Weltkarte</span>${G.net?.available ? '<b>P</b><span>Multiplayer und Team</span><b>Enter</b><span>Chat (zu zweit)</span>' : ''}<b>N</b><span>Ton aus / an</span><b>Esc</b><span>Menü</span></div>`; }
  pSys() {
    const slots = [1, 2, 3].map(i => { const m = G.game.slotInfo(i); return `<div class="stat" style="align-items:center"><span>Spielstand ${i}<br><small style="color:var(--dim)">${m ? esc(m) : 'leer'}</small></span><b><button data-s="${i}">Speichern</button> <button data-l="${i}" ${m ? '' : 'disabled'}>Laden</button></b></div>`; }).join('');
    const auto = G.game.slotInfo(0);
    const who = G.profiles?.cur && !G.net?.isGuest ? `<div class="stat" style="align-items:center"><span>Angemeldet als <b>${esc(G.profiles.cur.name)}</b></span><b><button id="toProfile">Profil wechseln</button></b></div>` : '';
    $('pbody').innerHTML = `<div class="col">${who}<h3>Spielstände</h3><div class="stat" style="align-items:center"><span>Automatisch<br><small style="color:var(--dim)">${auto ? esc(auto) : 'leer'}</small></span><b><button data-l="0" ${auto ? '' : 'disabled'}>Laden</button></b></div>${slots}<h3 style="margin-top:12px">Einstellungen</h3>${this.settingsHtml()}<div class="acts"><button id="toMenu">Zum Hauptmenü</button></div></div><div class="col"><h3>Steuerung</h3>${this.keysHtml()}</div>`;
    this.bindSettings();
    for (const b of $('pbody').querySelectorAll('[data-s]')) b.onclick = () => { G.game.save(+b.dataset.s); this.toast('Gespeichert', 'quest'); this.drawPanel(); };
    for (const b of $('pbody').querySelectorAll('[data-l]')) b.onclick = () => { this.closePanelSilent(); G.game.load(+b.dataset.l); };
    $('toMenu').onclick = () => { G.game.autosave(); this.closePanelSilent(); G.game.toMenu(); };
    if ($('toProfile')) $('toProfile').onclick = () => { G.game.autosave(); this.closePanelSilent(); G.game.toMenu(); G.profileUI.pick(); };
  }
  closePanelSilent() { $('panel').style.display = 'none'; this.shop = null; }
  pShop() {
    const P = G.player, n = this.shop, tier = n.d.town ? TOWN_TIER[n.d.town] : 3, stock = SHOPS[n.d.shop].filter(id => ITEMS[id].tier <= tier);
    const mode = this.shopMode, sellP = it => Math.max(1, Math.floor(it.price * (it.t === 'junk' ? .75 : .4)));
    const ids = mode === 'buy' ? stock : Object.keys(P.inv).filter(id => ITEMS[id]?.t !== 'quest' && ITEMS[id]?.price > 0 && !(P.isEquipped(id) && P.inv[id] <= 1));
    const sel = ids.includes(this.sel) ? this.sel : ids[0]; this.sel = sel; const it = ITEMS[sel];
    let act = '';
    if (it) act = mode === 'buy' ? `<div class="acts"><button id="doB" ${P.gold < it.price ? 'disabled' : ''}>Kaufen (${it.price} Gold)</button></div>` : `<div class="acts"><button id="doS">Verkaufen (${sellP(it)} Gold)</button>${P.inv[sel] > 1 ? `<button id="doSA">Alle (${sellP(it) * P.inv[sel]} Gold)</button>` : ''}</div>`;
    $('pbody').innerHTML = `<div class="col"><div class="filter"><button id="mB" class="${mode === 'buy' ? 'on' : ''}">Kaufen</button><button id="mS" class="${mode === 'sell' ? 'on' : ''}">Verkaufen</button></div>${ids.map(id => this.itemRow(id, sel, P.inv[id] || 1, false, mode === 'buy' ? `${ITEMS[id].price} G${P.inv[id] ? ` · ${P.inv[id]}` : ''}` : `${sellP(ITEMS[id])} G${P.inv[id] > 1 ? ` · ×${P.inv[id]}` : ''}`)).join('') || '<p style="color:var(--dim)">Nichts zu handeln.</p>'}</div><div class="col narrow">${this.itemDetail(it, act)}<p style="color:var(--gold);margin-top:14px">${P.gold} Gold</p></div>`;
    $('mB').onclick = () => { this.shopMode = 'buy'; this.sel = null; this.drawPanel(); };
    $('mS').onclick = () => { this.shopMode = 'sell'; this.sel = null; this.drawPanel(); };
    this.bindRows();
    if ($('doB')) $('doB').onclick = () => { P.gold -= it.price; P.addItem(sel, 1, true); G.audio?.buy(it); this.drawPanel(); };
    if ($('doS')) $('doS').onclick = () => { P.removeItem(sel); P.gold += sellP(it); G.audio?.sell(); this.drawPanel(); };
    if ($('doSA')) $('doSA').onclick = () => { const c = P.inv[sel]; P.removeItem(sel, c); P.gold += sellP(it) * c; G.audio?.sell(); this.drawPanel(); };
  }
  panelKeys() {
    if (this.loreOpen) { if (Input.hit('Escape') || Input.hit('KeyE') || Input.hit('Enter')) this.closeLore(); return; }
    if (Input.hit('Escape')) { this.closePanel(); return; }
    const map = { KeyI: 'inv', Tab: 'inv', KeyK: 'char', KeyJ: 'quest', KeyM: 'map', ...(G.net?.available ? { KeyP: 'party' } : {}) };
    for (const [k, t] of Object.entries(map)) if (Input.hit(k) && !this.shop) { if (this.tab === t) this.closePanel(); else { this.tab = t; this.sel = null; this.drawPanel(); G.audio?.panel(t); } return; }
  }

  // ── Bildschirme ──
  title(on, hasSave) {
    $('title').style.display = on ? 'flex' : 'none'; $('titlePane').style.display = 'none'; this.show(false);
    if (!on) return;
    const items = [];
    if (hasSave) items.push(['Weiterspielen', () => G.game.load(0)]);
    items.push(['Neues Spiel', () => this.titlePane('<h2>Neues Spiel</h2><p>Möchtest du am Anfang kurz die Steuerung lernen? Das dauert etwa zwei Minuten.</p><div class="acts"><button id="ngT">Mit Tutorial</button><button id="ngN">Ohne Tutorial</button></div>', () => { $('ngT').onclick = () => { $('titlePane').style.display = 'none'; G.game.newGame(true); }; $('ngN').onclick = () => { $('titlePane').style.display = 'none'; G.game.newGame(false); }; })]);
    if (G.net?.available) items.push(['Mit Freund spielen', () => { if (hasSave) G.game.load(0); else G.game.newGame(); G.net.host(); G.ui.toast(Input.touch ? 'Raum wird geöffnet. Den Link findest du im Menü.' : 'Raum wird geöffnet. Drück P für den Link.', 'quest'); }]);
    if (G.net?.available) items.push(['Raum beitreten', () => G.netui.joinPane('')]);
    if ([1, 2, 3].some(i => G.game.slotInfo(i))) items.push(['Spielstand laden', () => this.titleLoad()]);
    items.push(['Einstellungen', () => this.titleSettings()], ['Steuerung', () => this.titlePane(`<h2>Steuerung</h2>${this.keysHtml()}`)], ['Über das Spiel', () => this.titlePane(`<h2>Die Letzte Laterne</h2><p>Ein eigenes Dark-Fantasy-Open-World-RPG, inspiriert von der Stimmung früher 3D-Spiele. Musik und Sounds werden live im Browser erzeugt.</p><p style="color:var(--dim)">Three.js und PeerJS (MIT). Fotoscans von Poly Haven, Figuren und Animationen von Quaternius (CC0). Goblin und Dämon aus dem Bestiary von Quaternius (Quaternius Asset License).</p><p style="color:var(--dim)">Profile und Spielstände bleiben in deinem Browser. Das Spiel schickt sie an keinen Server. Nur im Multiplayer verbinden sich zwei Browser über einen öffentlichen Vermittler.</p>`)]);
    if (G.net?.isInvited) items.length = 0;
    else if (G.profiles?.cur) items.splice(items.findIndex(x => x[0] === 'Einstellungen'), 0, ['Profil wechseln', () => G.profileUI.pick()]);
    const box = $('menuBtns'); box.innerHTML = ''; box.style.display = '';
    if (G.profiles?.cur) { const u = document.createElement('div'); u.className = 'pfUser'; u.textContent = `Angemeldet als ${G.profiles.cur.name}`; box.appendChild(u); }
    { const L = document.createElement('div'); L.className = 'langPick'; L.dataset.notr = '1'; for (const [k, n] of LANGS) { const b = document.createElement('button'); b.textContent = n; b.className = currentLang() === k ? 'on' : ''; b.onclick = async () => { G.settings.lang = k; G.game.saveSettings(); await setLang(k); G.audio?.tick(); for (const q of L.children) q.className = q === b ? 'on' : ''; }; L.appendChild(b); } box.appendChild(L); }
    for (const [t, fn] of items) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { G.audio.init(); G.audio.tick(); fn(); }; box.appendChild(b); }
  }
  titlePane(html, bind) { const p = $('titlePane'); p.style.display = 'block'; p.innerHTML = `${html}<div class="acts"><button id="paneX">Zurück</button></div>`; $('paneX').onclick = () => { p.style.display = 'none'; }; bind?.(); }
  titleSettings() { this.titlePane(`<h2>Einstellungen</h2>${this.settingsHtml()}`, () => this.bindSettings()); }
  titleLoad() {
    this.titlePane(`<h2>Spielstand laden</h2>${[0, 1, 2, 3].map(i => { const m = G.game.slotInfo(i); return `<div class="stat" style="align-items:center"><span>${i ? `Spielstand ${i}` : 'Automatisch'}<br><small style="color:var(--dim)">${m ? esc(m) : 'leer'}</small></span><b><button data-l="${i}" ${m ? '' : 'disabled'}>Laden</button></b></div>`; }).join('')}`, () => {
      for (const b of $('titlePane').querySelectorAll('[data-l]')) b.onclick = () => { $('titlePane').style.display = 'none'; G.game.load(+b.dataset.l); };
    });
  }
  deadScreen(on) { $('dead').style.display = on ? 'flex' : 'none'; if (on) { $('deadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; this.show(false); } }
  credits(e, onClose) {
    const c = $('credits'), s = G.stats;
    c.style.display = 'flex';
    c.innerHTML = `<h3>Ende: ${esc(e.title)}</h3><h1>Die Letzte Laterne</h1><p>Spielzeit ${Math.floor(s.played / 3600)} h ${Math.floor(s.played / 60) % 60} min · ${s.kills} Feinde · ${G.quests.doneIds().length} Quests · ${Object.keys(G.shards).length} Mondsplitter</p><p style="color:var(--dim);max-width:600px">Die Welt bleibt offen. Es warten vielleicht noch Quests, Splitter und alte Feinde auf dich.</p><button id="credX">Weiterspielen</button>`;
    $('credX').onclick = () => { c.style.display = 'none'; onClose(); };
  }
}
