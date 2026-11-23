// Spielerprofile auf diesem Gerät. Es gibt keinen Server, deshalb verlässt nichts den Browser.
const KEY = 'letzte-laterne-profiles', OLD = i => `letzte-laterne-save-${i}`, SLOTS = [0, 1, 2, 3], NAME = /^[\p{L}\p{N} _-]{1,16}$/u, MAX = 8, ROUNDS = 120000;
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const drop = k => { try { localStorage.removeItem(k); } catch { /* optional */ } };
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const newId = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };

async function derive(pin, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ROUNDS }, k, 256));
}

/** Prüft fremde Spielstände, bevor sie ins Spiel kommen. */
export function validSave(text) {
  if (typeof text !== 'string' || text.length > 900000) return false;
  let d; try { d = JSON.parse(text); } catch { return false; }
  if (d?.v !== 1 || typeof d.p !== 'object' || !d.p || !Number.isFinite(d.p.level) || d.p.level < 1 || d.p.level > 999 || !Number.isFinite(d.p.x) || !Number.isFinite(d.p.z)) return false;
  const safe = (x, depth) => {
    if (depth > 14) return false;
    if (typeof x === 'string') return x.length < 2000 ? !/[<>]/.test(x) : /^[\w+/=,.-]*$/.test(x);
    if (Array.isArray(x)) return x.length < 200000 && x.every(v => safe(v, depth + 1));
    if (x && typeof x === 'object') return Object.entries(x).every(([k, v]) => !['__proto__', 'constructor', 'prototype'].includes(k) && !/[<>]/.test(k) && safe(v, depth + 1));
    return x === null || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x));
  };
  return safe(d, 0);
}

export class Profiles {
  constructor() { this.list = []; this.last = null; this.cur = null; this.migrated = false; this.fails = {}; }
  get canPin() { return !!globalThis.crypto?.subtle; }
  init(test) {
    this.test = test;
    if (test) return;
    try { const d = JSON.parse(read(KEY) || '{}'); this.list = Array.isArray(d.list) ? d.list.filter(p => p && /^[0-9a-f]{12}$/.test(p.id) && NAME.test(p.name)) : []; this.last = d.last ?? null; this.migrated = !!d.migrated; } catch { /* neu anlegen */ }
    // Alte Spielstände gehören einmalig dem ersten Profil, neue Profile starten immer leer.
    if (!this.migrated) {
      if (SLOTS.some(i => read(OLD(i)))) {
        const p = { id: newId(), name: 'Spieler 1', made: Date.now() };
        let ok = true;
        for (const i of SLOTS) { const s = read(OLD(i)); if (s && !write(this.keyOf(p, i), s)) ok = false; }
        if (ok) { for (const i of SLOTS) drop(OLD(i)); this.list.push(p); this.last = p.id; this.migrated = true; this.persist(); }
      } else { this.migrated = true; this.persist(); }
    }
  }
  persist() { return write(KEY, JSON.stringify({ v: 1, list: this.list, last: this.last, migrated: this.migrated })); }
  keyOf(p, i) { return `letzte-laterne-p-${p.id}-save-${i}`; }
  key(i) { return this.cur ? this.keyOf(this.cur, i) : OLD(i); }
  byId(id) { return this.list.find(p => p.id === id) ?? null; }
  checkName(name, skip) {
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (!NAME.test(n)) return { error: 'Der Name braucht 1 bis 16 Zeichen, nur Buchstaben, Zahlen, Leerzeichen, _ und -.' };
    if (n.toLowerCase() === 'gast') return { error: 'Dieser Name ist für den Gastmodus reserviert.' };
    if (this.list.some(p => p !== skip && p.name.toLowerCase() === n.toLowerCase())) return { error: 'Diesen Namen gibt es auf diesem Gerät schon.' };
    return { name: n };
  }
  static pinOk(pin) { return /^\d{4,8}$/.test(pin); }
  async setPin(p, pin) {
    if (!pin) { delete p.salt; delete p.hash; } else { const salt = crypto.getRandomValues(new Uint8Array(16)); p.hash = await derive(pin, salt); p.salt = b64(salt); }
    delete this.fails[p.id];
    return this.persist();
  }
  async create(name, pin) {
    if (this.list.length >= MAX) return { error: `Mehr als ${MAX} Profile passen nicht auf ein Gerät.` };
    const c = this.checkName(name); if (c.error) return c;
    if (pin && (!Profiles.pinOk(pin) || !this.canPin)) return { error: 'Die PIN braucht 4 bis 8 Ziffern.' };
    const p = { id: newId(), name: c.name, made: Date.now() };
    if (pin) { const salt = crypto.getRandomValues(new Uint8Array(16)); p.hash = await derive(pin, salt); p.salt = b64(salt); }
    this.list.push(p);
    if (!this.persist()) { this.list.pop(); return { error: 'Der Browser-Speicher ist voll oder gesperrt.' }; }
    return { profile: p };
  }
  /** Nach fünf falschen Versuchen wartet die Eingabe kurz. */
  waitFor(p) { const f = this.fails[p.id]; return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
  async check(p, pin) {
    if (!p.hash) return true;
    if (this.waitFor(p) || !this.canPin) return false;
    let same = false;
    try { const h = await derive(pin, unb64(p.salt)); let diff = h.length ^ p.hash.length; for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ p.hash.charCodeAt(i); same = diff === 0; } catch { same = false; }
    const f = this.fails[p.id] ??= { n: 0, until: 0 };
    if (same) { delete this.fails[p.id]; return true; }
    if (++f.n >= 5) { f.n = 0; f.until = Date.now() + 30000; }
    return false;
  }
  select(p) { this.cur = p; this.last = p.id; this.persist(); }
  guest() { this.cur = { id: 'gast', name: 'Gast', guest: true }; }
  autoLogin() { const p = this.byId(this.last); if (p && !p.hash) { this.cur = p; return true; } return false; }
  remove(p) {
    for (const i of SLOTS) drop(this.keyOf(p, i));
    this.list = this.list.filter(q => q !== p);
    if (this.last === p.id) this.last = null;
    if (this.cur === p) this.cur = null;
    delete this.fails[p.id];
    this.persist();
  }
  info(p) {
    try { const d = JSON.parse(read(this.keyOf(p, 0))); return `Stufe ${d.p.level} · ${new Date(d.when).toLocaleDateString('de-DE')}`; } catch { return 'Noch kein Spielstand'; }
  }
  exportText(p) {
    const saves = {};
    for (const i of SLOTS) { const s = read(this.keyOf(p, i)); if (s) saves[i] = s; }
    return JSON.stringify({ type: 'die-letzte-laterne', v: 1, name: p.name, when: Date.now(), saves });
  }
  /** Ein Import legt immer ein neues Profil an und überschreibt nichts. */
  async importText(text) {
    if (typeof text !== 'string' || text.length > 3500000) return { error: 'Die Datei ist zu groß.' };
    let d; try { d = JSON.parse(text); } catch { return { error: 'Das ist keine Spielstand-Datei.' }; }
    if (d?.type !== 'die-letzte-laterne' || d.v !== 1 || !d.saves || typeof d.saves !== 'object') return { error: 'Das ist keine Spielstand-Datei.' };
    const entries = Object.entries(d.saves).filter(([i]) => SLOTS.includes(+i) && /^\d$/.test(i));
    if (!entries.length || !entries.every(([, s]) => validSave(s))) return { error: 'Der Spielstand ist beschädigt oder ungültig.' };
    const base = String(d.name || 'Import').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 12) || 'Import';
    let name = base, n = 2;
    while (this.checkName(name).error) { name = `${base} ${n++}`; if (n > 20) return { error: 'Es gibt schon zu viele ähnliche Namen.' }; }
    const made = await this.create(name, ''); if (made.error) return made;
    for (const [i, s] of entries) if (!write(this.keyOf(made.profile, +i), s)) { this.remove(made.profile); return { error: 'Der Browser-Speicher ist voll.' }; }
    return made;
  }
}
