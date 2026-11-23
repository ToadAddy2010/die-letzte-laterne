// Chat, Teammenü und Beitrittsfenster für den Multiplayer.
import { G } from '../game/state.js';
import { Input } from '../core/input.js';
import { ITEMS } from '../data/items.js';
import { POI } from '../data/world.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const areaName = a => (a === 'w' ? 'Offene Welt' : a?.startsWith('d:') ? (POI[a.slice(2)]?.name || 'Dungeon') : 'In einem Haus');

export class NetUI {
  constructor() {
    const root = document.createElement('div');
    root.id = 'netLayer';
    root.innerHTML = '<div id="chat"><div id="chatLog"></div><input id="chatIn" maxlength="160" autocomplete="off" spellcheck="false" enterkeyhint="send" placeholder="Nachricht schreiben"></div><div id="netAsk" class="frame"></div>';
    $('ui').appendChild(root);
    const input = $('chatIn');
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const s = input.value.trim(); if (s) { G.net.send({ t: 'chat', s }); this.line(G.net.myName || 'Du', s, true); } this.closeChat(); }
      else if (e.key === 'Escape') this.closeChat();
    });
    input.addEventListener('keyup', e => e.stopPropagation());
    input.addEventListener('blur', () => { if (Input.typing) this.closeChat(); });
  }
  get chatOpen() { return document.activeElement === $('chatIn'); }
  openChat() {
    if (!G.net.active) return;
    Input.clear(); Input.typing = true;
    $('chat').classList.add('open');
    const input = $('chatIn'); input.value = ''; input.focus();
  }
  closeChat() {
    Input.typing = false; Input.clear();
    $('chat').classList.remove('open');
    const input = $('chatIn'); input.value = ''; input.blur();
    if (G.mode === 'play') G.game.resumeLock();
  }
  line(name, text, mine = false) {
    const box = $('chatLog'), d = document.createElement('div');
    d.className = name ? (mine ? 'me' : 'them') : 'sys';
    if (name) { const b = document.createElement('b'); b.textContent = `${name}: `; d.appendChild(b); }
    d.appendChild(document.createTextNode(text));
    box.appendChild(d);
    while (box.children.length > 7) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('old'), 12000);
  }
  ask(text) {
    const a = $('netAsk');
    if (!text) { a.style.display = 'none'; return; }
    a.style.display = 'block';
    a.innerHTML = `<b>${esc(text)}</b><div class="acts" style="justify-content:center"><button id="askY">Annehmen (B)</button><button id="askN">Ablehnen (V)</button></div>`;
    $('askY').onclick = () => G.net.answerDuel(true); $('askN').onclick = () => G.net.answerDuel(false);
  }

  // ── Teammenü ──
  panel(el) {
    const N = G.net, P = G.player;
    if (!N.role) {
      el.innerHTML = `<div class="col"><h2>Mit Freund spielen</h2><p>Öffne einen Raum. Du bekommst einen Link, den du deinem Freund schickst. Ihr spielt dann gemeinsam in deiner Welt.</p>${N.error ? `<p class="neterr">${esc(N.error)}</p>` : ''}<div class="acts"><button id="nOpen">Raum öffnen</button></div></div><div class="col narrow"><h3>So läuft es</h3><p style="color:var(--dim)">Dein PC ist der Gastgeber und muss anbleiben. Der Link gilt nur, solange der Raum offen ist, und ändert sich bei jedem Öffnen.</p></div>`;
      $('nOpen').onclick = () => { G.audio?.tick(); N.host(); };
      return;
    }
    if (N.isHost && !N.active) {
      const R = N.room || {}, link = N.inviteLink();
      el.innerHTML = `<div class="col"><h2>Warte auf deinen Freund</h2>${R.state !== 'open' ? '<p>Der Internet-Link wird erstellt. Das dauert ein paar Sekunden.</p>' : link ? `<p>Schick deinem Freund diesen Link:</p><input id="nLink" class="netfield" readonly value="${esc(link)}"><div class="acts"><button id="nCopy">Link kopieren</button></div><p style="color:var(--dim)">Teile ihn nur mit Leuten, die mitspielen sollen.</p>` : `<p class="neterr">${esc(N.error || 'Der Internet-Link fehlt.')}</p><p>Meist blockiert das aktuelle Netzwerk den Link, zum Beispiel in Schulen. Probier es in einem anderen WLAN, etwa zu Hause.</p><div class="acts"><button id="nRetry">Nochmal versuchen</button></div>`}<div class="acts"><button id="nClose">Raum schließen</button></div></div><div class="col narrow"><h3>Raumcode</h3><p class="netcode">${esc(R.code || '······')}</p></div>`;
      if ($('nCopy')) $('nCopy').onclick = async () => { const f = $('nLink'); try { await navigator.clipboard.writeText(link); } catch { f.select(); document.execCommand('copy'); } $('nCopy').textContent = 'Kopiert'; G.audio?.tick(); };
      if ($('nRetry')) $('nRetry').onclick = () => { N.error = ''; N.room = { state: 'opening' }; N.send({ t: 'open' }); G.ui.drawPanel(); };
      $('nClose').onclick = () => { N.leave(); G.ui.drawPanel(); };
      return;
    }
    if (!N.active) { el.innerHTML = '<div class="col"><h2>Verbinde</h2><p>Einen Moment.</p></div>'; return; }
    const R = N.remote, D = N.duel, items = Object.keys(P.inv).filter(id => ITEMS[id] && ITEMS[id].t !== 'quest' && !(P.isEquipped(id) && P.inv[id] <= 1));
    const duel = !D ? '<button id="nDuel">Zum Duell fordern</button>' : D.state === 'incoming' ? '<button id="nYes">Duell annehmen</button><button id="nNo">Ablehnen</button>' : D.state === 'asked' ? '<button disabled>Warte auf Antwort</button>' : '<button disabled>Duell läuft</button>';
    el.innerHTML = `<div class="col"><h2>${esc(R.name)}</h2><div class="stat">Stufe<b>${R.level}</b></div><div class="stat">Leben<b>${Math.ceil(R.hp)} / ${R.maxHp}${R.down ? ' · am Boden' : ''}</b></div><div class="stat">Ort<b>${esc(areaName(R.area))}</b></div><div class="acts"><button id="nTp">Zu ${esc(R.name)} reisen</button>${duel}<button id="nLeave">${N.isHost ? 'Raum schließen' : 'Spiel verlassen'}</button></div><h3 style="margin-top:14px">Gold geben · du hast ${P.gold}</h3><div class="acts"><button data-g="10">10</button><button data-g="100">100</button><button data-g="1000">1000</button></div></div><div class="col"><h3>Gegenstand geben</h3>${items.map(id => `<div class="stat" style="align-items:center"><span>${esc(ITEMS[id].n)}${P.inv[id] > 1 ? ` ×${P.inv[id]}` : ''}</span><b><button data-i="${esc(id)}">Geben</button></b></div>`).join('') || '<p style="color:var(--dim)">Nichts zum Tauschen.</p>'}</div>`;
    $('nTp').onclick = () => N.teleport();
    $('nLeave').onclick = () => { if (N.isGuest) G.game.toMenu(); else { N.leave(); G.ui.drawPanel(); } };
    if ($('nDuel')) $('nDuel').onclick = () => N.askDuel();
    if ($('nYes')) $('nYes').onclick = () => N.answerDuel(true);
    if ($('nNo')) $('nNo').onclick = () => N.answerDuel(false);
    for (const b of el.querySelectorAll('[data-g]')) b.onclick = () => N.giveGold(+b.dataset.g);
    for (const b of el.querySelectorAll('[data-i]')) b.onclick = () => N.giveItem(b.dataset.i);
  }

  // ── Beitreten ──
  invite() { const m = /join=([A-Za-z0-9]{4,10})/.exec(location.hash); return m ? m[1].toUpperCase() : ''; }
  joinPane(code = this.invite(), error = '') {
    G.net.lastCode = code;
    let saved = '';
    try { saved = localStorage.getItem('letzte-laterne-name') || ''; } catch { /* optional */ }
    G.ui.titlePane(`<h2>Spiel beitreten</h2><p style="color:var(--dim)">Deine Figur wird beim Gastgeber gespeichert. Nimm beim nächsten Mal denselben Namen.</p>${error ? `<p class="neterr">${esc(error)}</p>` : ''}<label class="netlabel">Dein Name<input id="jName" class="netfield" maxlength="16" value="${esc(saved)}" autocomplete="off"></label><label class="netlabel">Raumcode<input id="jCode" class="netfield" maxlength="10" value="${esc(code)}" autocomplete="off"></label><div class="acts"><button id="jGo">Beitreten</button></div>`);
    const go = () => {
      const name = $('jName').value.trim(), c = $('jCode').value.trim().toUpperCase();
      if (!name || !c) { G.audio?.deny?.(); return; }
      try { localStorage.setItem('letzte-laterne-name', name); } catch { /* optional */ }
      G.net.lastCode = c; G.audio.init(); $('jGo').textContent = 'Verbinde …'; $('jGo').disabled = true;
      G.net.join(c, name);
    };
    $('jGo').onclick = go;
    for (const id of ['jName', 'jCode']) $(id).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    const back = $('paneX'); if (back && G.net.isInvited) back.style.display = 'none';
    ($('jName').value ? $('jGo') : $('jName')).focus();
  }
}
