import { G } from '../game/state.js';
import { Profiles } from '../game/profiles.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOCAL = 'Profile liegen nur in diesem Browser auf diesem Gerät. Über „Verwalten“ kannst du sie als Datei auf ein anderes Gerät mitnehmen.';

export class ProfileUI {
  pane(html, bind) {
    const p = $('titlePane');
    $('menuBtns').style.display = 'none';
    p.style.display = 'block'; p.innerHTML = html;
    for (const i of p.querySelectorAll('input')) for (const ev of ['keydown', 'keyup', 'keypress']) i.addEventListener(ev, e => e.stopPropagation());
    bind?.(p);
    p.querySelector('input:not([type=file])')?.focus();
  }
  done() { $('titlePane').style.display = 'none'; $('menuBtns').style.display = ''; G.game.refreshTitle(); }
  back() { if (G.profiles.cur) this.done(); else this.pick(); }
  /** Beim Start: direkt weiter, wenn das letzte Profil keine PIN hat. */
  gate() { if (G.profiles.autoLogin()) G.game.refreshTitle(); else this.pick(); }
  pick() {
    const P = G.profiles;
    if (!P.list.length) return this.create(true);
    const rows = P.list.map(q => `<div class="profRow"><button class="profMain" data-p="${q.id}"><b>${esc(q.name)}${q.hash ? ' <small>PIN</small>' : ''}${P.cur === q ? ' <small>aktiv</small>' : ''}</b><small>${esc(P.info(q))}</small></button><button data-m="${q.id}">Verwalten</button></div>`).join('');
    this.pane(`<h2>Wer spielt?</h2>${rows}<div class="acts"><button id="pfNew">Neues Profil</button><button id="pfGuest">Als Gast spielen</button>${P.cur ? '<button id="pfBack">Zurück</button>' : ''}</div><p class="pfNote">${LOCAL}</p>`, r => {
      for (const b of r.querySelectorAll('[data-p]')) b.onclick = () => this.enter(P.byId(b.dataset.p), q => { P.select(q); this.done(); });
      for (const b of r.querySelectorAll('[data-m]')) b.onclick = () => this.enter(P.byId(b.dataset.m), q => this.manage(q), true);
      $('pfNew').onclick = () => this.create(false);
      $('pfGuest').onclick = () => { P.guest(); this.done(); G.ui.toast('Gastmodus: Der Spielstand bleibt auf diesem Gerät', 'quest'); };
      if ($('pfBack')) $('pfBack').onclick = () => this.done();
    });
  }
  create(first) {
    const P = G.profiles, pinField = P.canPin ? '<label class="pfLabel">PIN, optional (4 bis 8 Ziffern)<input id="pfPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><label class="pfLabel">PIN wiederholen<input id="pfPin2" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label>' : '';
    this.pane(`<h2>${first ? 'Willkommen' : 'Neues Profil'}</h2><label class="pfLabel">Spielername<input id="pfName" maxlength="16" autocomplete="off" spellcheck="false"></label>${pinField}<p class="pfNote">Nimm keinen echten Namen und kein Passwort, das du woanders benutzt. Eine vergessene PIN lässt sich nicht zurückholen.</p><p id="pfErr" class="pfErr"></p><div class="acts"><button id="pfMake">Profil erstellen</button>${first ? '<button id="pfGuest">Als Gast spielen</button>' : '<button id="pfBack">Zurück</button>'}</div>`, () => {
      const go = async () => {
        const pin = $('pfPin')?.value || '', pin2 = $('pfPin2')?.value || '';
        if (pin !== pin2) return this.err('Die beiden PINs sind nicht gleich.');
        if (pin && !Profiles.pinOk(pin)) return this.err('Die PIN braucht 4 bis 8 Ziffern.');
        $('pfMake').disabled = true;
        const r = await P.create($('pfName').value, pin);
        $('pfMake').disabled = false;
        if (r.error) return this.err(r.error);
        P.select(r.profile); this.done(); G.ui.toast(`Willkommen, ${r.profile.name}`, 'quest');
      };
      $('pfMake').onclick = go;
      for (const id of ['pfName', 'pfPin', 'pfPin2']) $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      if ($('pfGuest')) $('pfGuest').onclick = () => { P.guest(); this.done(); };
      if ($('pfBack')) $('pfBack').onclick = () => this.pick();
    });
  }
  err(t) { const e = $('pfErr'); if (e) e.textContent = t; G.audio?.deny?.(); }
  /** Fragt die PIN ab, wenn das Profil eine hat. */
  enter(q, then, keepOpen) {
    const P = G.profiles;
    if (!q) return this.pick();
    if (!q.hash || (keepOpen && P.cur === q)) return then(q);
    this.pane(`<h2>${esc(q.name)}</h2><label class="pfLabel">PIN<input id="pfPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><p id="pfErr" class="pfErr"></p><div class="acts"><button id="pfGo">Anmelden</button><button id="pfBack">Zurück</button><button id="pfLost">PIN vergessen</button></div>`, () => {
      const go = async () => {
        const w = P.waitFor(q); if (w) return this.err(`Zu viele Versuche. Warte noch ${w} Sekunden.`);
        $('pfGo').disabled = true;
        const ok = await P.check(q, $('pfPin').value);
        if ($('pfGo')) $('pfGo').disabled = false;
        if (ok) return then(q);
        $('pfPin').value = ''; const t = P.waitFor(q);
        this.err(t ? `Zu viele Versuche. Warte ${t} Sekunden.` : 'Diese PIN stimmt nicht.');
      };
      $('pfGo').onclick = go;
      $('pfPin').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      $('pfBack').onclick = () => this.pick();
      $('pfLost').onclick = () => this.remove(q, true);
    });
  }
  manage(q) {
    const P = G.profiles;
    const pin = P.canPin ? `<label class="pfLabel">${q.hash ? 'Neue PIN (leer lassen entfernt sie)' : 'PIN setzen (4 bis 8 Ziffern)'}<input id="pfPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><div class="acts"><button id="pfSet">${q.hash ? 'PIN ändern' : 'PIN speichern'}</button></div>` : '';
    this.pane(`<h2>${esc(q.name)}</h2><p class="pfNote">${esc(P.info(q))}</p><label class="pfLabel">Name<input id="pfName" maxlength="16" value="${esc(q.name)}" autocomplete="off" spellcheck="false"></label><div class="acts"><button id="pfRen">Umbenennen</button></div>${pin}<p id="pfErr" class="pfErr"></p><h3>Auf ein anderes Gerät</h3><div class="acts"><button id="pfOut">Als Datei speichern</button><button id="pfIn">Datei importieren</button><input id="pfFile" type="file" accept=".json,application/json" style="display:none"></div><div class="acts"><button id="pfDel">Profil löschen</button><button id="pfBack">Zurück</button></div>`, () => {
      $('pfRen').onclick = () => { const c = P.checkName($('pfName').value, q); if (c.error) return this.err(c.error); q.name = c.name; P.persist(); this.manage(q); G.ui.toast('Name geändert', 'quest'); };
      if ($('pfSet')) $('pfSet').onclick = async () => {
        const v = $('pfPin').value;
        if (v && !Profiles.pinOk(v)) return this.err('Die PIN braucht 4 bis 8 Ziffern.');
        await P.setPin(q, v); this.manage(q); G.ui.toast(v ? 'PIN gespeichert' : 'PIN entfernt', 'quest');
      };
      $('pfOut').onclick = () => {
        const url = URL.createObjectURL(new Blob([P.exportText(q)], { type: 'application/json' })), a = document.createElement('a');
        a.href = url; a.download = `Laterne-${q.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      $('pfIn').onclick = () => $('pfFile').click();
      $('pfFile').onchange = async e => {
        const f = e.target.files?.[0]; if (!f) return;
        if (f.size > 3500000) return this.err('Die Datei ist zu groß.');
        const r = await P.importText(await f.text());
        if (r.error) return this.err(r.error);
        G.ui.toast(`Als Profil „${r.profile.name}“ importiert`, 'quest'); this.pick();
      };
      $('pfDel').onclick = () => this.remove(q, false);
      $('pfBack').onclick = () => this.pick();
    });
  }
  remove(q, lost) {
    const P = G.profiles;
    this.pane(`<h2>Profil löschen</h2><p>${lost ? 'Eine vergessene PIN lässt sich nicht zurückholen. Du kannst nur das ganze Profil löschen.' : ''} Alle Spielstände von <b>${esc(q.name)}</b> werden endgültig gelöscht.</p><label class="pfLabel">Zum Bestätigen den Namen eingeben<input id="pfConfirm" maxlength="16" autocomplete="off" spellcheck="false"></label><p id="pfErr" class="pfErr"></p><div class="acts"><button id="pfKill">Endgültig löschen</button><button id="pfBack">Abbrechen</button></div>`, () => {
      $('pfKill').onclick = () => { if ($('pfConfirm').value.trim() !== q.name) return this.err('Der Name stimmt nicht.'); P.remove(q); G.ui.toast('Profil gelöscht', 'warn'); this.pick(); };
      $('pfBack').onclick = () => this.pick();
    });
  }
}
