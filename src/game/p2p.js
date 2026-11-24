// Direkte Verbindung zwischen zwei Browsern. Ein öffentlicher Vermittler stellt nur den Kontakt her.
// Das Skript wird erst geladen, wenn jemand wirklich einen Raum öffnet oder beitritt.
import { G } from './state.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', PART = 14000, MAX_MSG = 2000000, NAME = /^[\p{L}\p{N} _-]{1,16}$/u;
const ROOM = c => `die-letzte-laterne-${c.toLowerCase()}`;
const FROM_HOST = new Set(['hosting', 'opened', 'peer', 'peerLeft']), FROM_GUEST = new Set(['hosting', 'opened', 'joined', 'peer', 'peerLeft', 'hostLeft', 'denied']);
const MSG = {
  'peer-unavailable': 'Diesen Raum gibt es nicht. Prüf den Code, oder der Gastgeber hat ihn geschlossen.',
  network: 'Der Vermittlungsserver ist nicht erreichbar. Manche Netzwerke, etwa in Schulen, blockieren das.',
  'server-error': 'Der Vermittlungsserver ist gerade nicht erreichbar. Versuch es gleich noch einmal.',
  'socket-error': 'Der Vermittlungsserver ist nicht erreichbar. Manche Netzwerke, etwa in Schulen, blockieren das.',
  'socket-closed': 'Die Verbindung zum Vermittlungsserver wurde getrennt.',
  'browser-incompatible': 'Dieser Browser unterstützt keinen Multiplayer.',
  'webrtc': 'Eure Geräte erreichen sich nicht. Bei Hotspot oder mobilen Daten passiert das oft. Tipps stehen unter „Verbindungshilfe“.',
};
const why = e => MSG[e?.type] ?? 'Die Verbindung hat nicht geklappt. Probiert ein anderes WLAN.';

let lib = null;
function loadPeer() {
  if (window.peerjs?.Peer) return Promise.resolve(window.peerjs.Peer);
  lib ??= new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = new URL('../../vendor/peerjs.min.js?v=1.5.4', import.meta.url).href;
    s.onload = () => ok(window.peerjs?.Peer ?? window.Peer);
    s.onerror = () => { lib = null; no(new Error('peer')); };
    document.head.appendChild(s);
  });
  return lib;
}
const RELAY = 'letzte-laterne-relay';
/** Eigener Relay-Server (TURN). Er bleibt nur in diesem Browser gespeichert. */
export const relay = {
  get() { try { const d = JSON.parse(localStorage.getItem(RELAY)); return d && typeof d.urls === 'string' && /^turns?:/i.test(d.urls) ? d : null; } catch { return null; } },
  set(urls, username, credential) {
    const list = String(urls || '').split(/[\s,]+/).filter(u => /^turns?:[\w.:?=&\-[\]]+$/i.test(u)).slice(0, 4);
    if (!list.length) return false;
    try { localStorage.setItem(RELAY, JSON.stringify({ urls: list.join(' '), username: String(username || '').slice(0, 200), credential: String(credential || '').slice(0, 300) })); return true; } catch { return false; }
  },
  clear() { try { localStorage.removeItem(RELAY); } catch { /* egal */ } },
};
const iceServers = () => {
  const r = relay.get(), list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  if (r) list.push({ urls: r.urls.split(' '), username: r.username, credential: r.credential });
  return list;
};
const newCode = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return [...a].map(v => ALPHA[v % ALPHA.length]).join(''); };
const charKey = () => `letzte-laterne-net-${G.profiles?.cur?.id ?? 'gast'}`;
export const cleanName = s => { const n = String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, 16); return NAME.test(n) ? n : ''; };

/** Verhält sich für das Spiel wie die frühere Server-Verbindung. */
export class Link {
  constructor(hello) { Object.assign(this, { hello, role: hello.role, readyState: 0, peer: null, conn: null, pending: null, parts: new Map(), seq: 0, dead: false, timer: 0 }); }
  start() {
    if (this.role === 'host') { this.readyState = 1; this.up({ t: 'hosting' }); } else this.joinRoom().catch(() => this.fail(MSG.network));
  }
  up(m) { queueMicrotask(() => { if (!this.dead) this.onmessage?.(m); }); }
  fail(text) {
    if (this.dead) return;
    this.onerror?.(text);
    const done = this.onclose;
    this.close();
    done?.();
  }
  send(o) {
    if (o.t === 'ping') return;
    if (o.t === 'open') { this.openRoom().catch(() => this.up({ t: 'opened', code: this.code ?? '', url: null, error: MSG.network })); return; }
    if (o.t === 'saveChar') { if (!G.test) try { localStorage.setItem(charKey(), JSON.stringify(o.data)); } catch { /* Speicher voll */ } return; }
    if (this.conn?.open) this.tx(this.conn, o);
  }
  tx(c, o) {
    const s = JSON.stringify(o);
    if (s.length <= PART) { c.send(s); return; }
    const id = ++this.seq, n = Math.ceil(s.length / PART);
    for (let i = 0; i < n; i++) c.send(JSON.stringify({ _c: id, i, n, d: s.slice(i * PART, (i + 1) * PART) }));
  }
  /** Prüft alles, was vom anderen Browser kommt, bevor das Spiel es sieht. */
  rx(raw) {
    if (typeof raw !== 'string' || raw.length > PART * 3) return null;
    let m; try { m = JSON.parse(raw); } catch { return null; }
    if (m?._c !== undefined) {
      if (!Number.isInteger(m.n) || m.n < 2 || m.n > MAX_MSG / PART || !Number.isInteger(m.i) || m.i < 0 || m.i >= m.n || typeof m.d !== 'string') return null;
      if (this.parts.size > 8) this.parts.clear();
      const b = this.parts.get(m._c) ?? { n: m.n, got: 0, a: [] };
      if (b.n !== m.n) return null;
      if (b.a[m.i] === undefined) b.got++;
      b.a[m.i] = m.d; this.parts.set(m._c, b);
      if (b.got < b.n) return null;
      this.parts.delete(m._c); raw = b.a.join('');
      try { m = JSON.parse(raw); } catch { return null; }
    }
    if (typeof m?.t !== 'string') return null;
    if (m.t !== 'chat' && /[<>]/.test(raw)) return null;
    return (this.role === 'host' ? FROM_GUEST : FROM_HOST).has(m.t) ? null : m;
  }

  // ── Gastgeber ──
  async openRoom(tries = 0) {
    if (this.peer && this.opened) { this.up({ t: 'opened', code: this.code, url: this.url() }); return; }
    const Peer = await loadPeer();
    if (this.dead) return;
    try { this.peer?.destroy(); } catch { /* schon zu */ }
    const code = this.code = newCode(), p = this.peer = new Peer(ROOM(code), { debug: 0, config: { iceServers: iceServers() } });
    p.on('open', () => { if (this.peer === p) { this.opened = true; this.up({ t: 'opened', code, url: this.url() }); } });
    p.on('connection', c => this.incoming(c));
    p.on('disconnected', () => { if (this.peer === p && !this.dead && !p.destroyed) try { p.reconnect(); } catch { /* neuer Versuch beim nächsten Öffnen */ } });
    p.on('error', e => {
      if (this.peer !== p || this.dead) return;
      if (e.type === 'unavailable-id' && tries < 4) { this.openRoom(tries + 1); return; }
      if (!this.opened) this.up({ t: 'opened', code, url: null, error: why(e) });
    });
  }
  url() { return `${location.origin}${location.pathname}`.replace(/\/(index\.html)?$/, ''); }
  incoming(c) {
    if (this.conn || this.pending) {
      c.on('open', () => { this.tx(c, { t: 'denied', why: 'Dieser Raum ist gerade voll.' }); setTimeout(() => c.close(), 500); });
      return;
    }
    this.pending = c;
    let asked = false;
    const stop = setTimeout(() => { if (this.pending === c && !asked) { this.pending = null; c.close(); } }, 20000);
    c.on('data', raw => {
      const m = this.rx(raw); if (!m) return;
      if (c === this.conn) { this.up(m); return; }
      if (c !== this.pending || asked || m.t !== 'hello') return;
      const name = cleanName(m.name);
      if (!name) { this.pending = null; this.tx(c, { t: 'denied', why: 'Der Name enthält ungültige Zeichen.' }); setTimeout(() => c.close(), 500); return; }
      asked = true; clearTimeout(stop);
      this.onask?.(name, yes => {
        if (this.pending !== c) return;
        this.pending = null;
        if (!yes || !c.open) { if (c.open) { this.tx(c, { t: 'denied', why: 'Der Gastgeber hat abgelehnt.' }); setTimeout(() => c.close(), 500); } return; }
        this.conn = c; this.tx(c, { t: 'joined', name }); this.up({ t: 'peer', name });
      });
    });
    const gone = () => {
      clearTimeout(stop);
      if (this.pending === c) { this.pending = null; this.onask?.(null); }
      if (this.conn === c) { this.conn = null; this.up({ t: 'peerLeft' }); }
    };
    c.on('close', gone); c.on('error', gone);
  }

  // ── Mitspieler ──
  async joinRoom() {
    const code = String(this.hello.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), Peer = await loadPeer();
    if (this.dead) return;
    const p = this.peer = new Peer({ debug: 0, config: { iceServers: iceServers() } });
    this.timer = setTimeout(() => this.fail(MSG.webrtc), 20000);
    p.on('error', e => { if (this.peer === p) this.fail(why(e)); });
    p.on('open', () => {
      const c = p.connect(ROOM(code), { serialization: 'raw', reliable: true });
      c.on('iceStateChanged', st => { if (st === 'failed' && !this.conn) this.fail(MSG.webrtc); });
      c.on('open', () => { clearTimeout(this.timer); this.timer = setTimeout(() => this.fail('Der Gastgeber hat nicht geantwortet.'), 45000); this.conn = c; this.readyState = 1; this.tx(c, { t: 'hello', role: 'guest', name: this.hello.name }); });
      c.on('data', raw => {
        const m = this.rx(raw); if (!m) return;
        if (m.t === 'joined' || m.t === 'denied') clearTimeout(this.timer);
        if (m.t === 'joined') { m.name = cleanName(m.name) || 'Gast'; m.save = this.loadChar(); }
        this.up(m);
      });
      c.on('close', () => { if (!this.dead) this.fail(''); });
      c.on('error', e => this.fail(why(e)));
    });
  }
  loadChar() {
    try { const d = JSON.parse(localStorage.getItem(charKey())); return d?.v === 1 && Number.isFinite(d.p?.level) ? d : null; } catch { return null; }
  }
  close() {
    if (this.dead) return;
    if (this.role === 'host' && this.conn?.open) try { this.tx(this.conn, { t: 'hostLeft' }); } catch { /* schon zu */ }
    this.dead = true; this.readyState = 3; clearTimeout(this.timer); this.onask?.(null);
    const p = this.peer; this.peer = null; this.conn = null; this.pending = null;
    setTimeout(() => { try { p?.destroy(); } catch { /* schon zu */ } }, 250);
  }
}
