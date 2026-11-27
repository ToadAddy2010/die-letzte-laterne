// Sprachen: Das Spiel schreibt seine Texte auf Deutsch, angezeigt wird die gewählte Sprache.
// Ein Beobachter übersetzt jeden Text, der im Bildschirm landet. Die Spiel-Logik bleibt unberührt.
import { S } from './source.js';

export const LANGS = [['de', 'Deutsch'], ['en', 'English'], ['es', 'Español'], ['hi', 'हिन्दी']];
const LOAD = { en: () => import('./en.js'), es: () => import('./es.js'), hi: () => import('./hi.js') };
let lang = 'de', map = new Map(), pats = [], terms = [], cache = new Map(), observer = null;

export const currentLang = () => lang;
export function detectLang() {
  for (const l of navigator.languages || [navigator.language || 'de']) { const c = String(l).slice(0, 2).toLowerCase(); if (LANGS.some(x => x[0] === c)) return c; }
  return 'de';
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function compile(de, to) {
  const n = (de.match(/\{\d\}/g) || []).length;
  const re = new RegExp(`^${esc(de).replace(/\\\{(\d)\\\}/g, '(.+?)')}$`, 's');
  return { re, to, n, w: de.replace(/\{\d\}/g, '').length };
}

export async function setLang(code) {
  if (!LANGS.some(l => l[0] === code)) code = 'de';
  let D = null;
  if (code !== 'de') { try { D = (await LOAD[code]()).default; } catch (e) { console.warn('Sprache nicht geladen', e); code = 'de'; } }
  lang = code; cache.clear(); map = new Map(); pats = []; terms = [];
  if (D) {
    for (const [id, de] of Object.entries(S)) {
      const t = D[id]; if (!t) continue;
      if (/\{\d\}/.test(de)) pats.push(compile(de, t)); else map.set(de, t);
    }
    pats.sort((a, b) => b.w - a.w);
    terms = [...map.entries()].filter(([de]) => de.length >= 4 && !/\s/.test(de)).sort((a, b) => b[0].length - a[0].length).map(([de, to]) => [new RegExp(`(^|[^\\p{L}])${esc(de)}(?=$|[^\\p{L}])`, 'gu'), to, de]);
  }
  document.documentElement.lang = code;
  document.body?.classList.toggle('lang-hi', code === 'hi');
  document.title = tr('Die Letzte Laterne');
  retranslate();
  return code;
}

function swap(t) {
  let out = t;
  for (const [re, to, de] of terms) if (out.includes(de)) out = out.replace(re, (_, a) => a + to);
  return out;
}
function one(t, depth) {
  const n = t.replace(/\s+/g, ' ').trim();
  if (!n) return t;
  const hit = map.get(n); if (hit) return hit;
  if (/^[\d\s.,:;%+\-–×/()·|#]*$/.test(n)) return t;
  if (depth > 4) return swap(n);
  for (const p of pats) {
    const m = p.re.exec(n);
    if (m) return p.to.replace(/\{(\d)\}/g, (_, i) => (m[+i + 1] !== undefined ? one(m[+i + 1], depth + 1) : ''));
  }
  for (const sep of [' · ', ' – ', ' — ', ': ', ' | ', ', ']) {
    if (!n.includes(sep)) continue;
    const parts = n.split(sep), out = parts.map(q => one(q, depth + 1));
    if (out.some((q, i) => q !== parts[i])) return out.join(sep);
  }
  let m = /^(\d+\.)\s+(.+)$/.exec(n); if (m) return `${m[1]} ${one(m[2], depth + 1)}`;
  m = /^([^\p{L}\p{N}„"'(]+)(\p{L}.*)$/u.exec(n); if (m) return m[1] + one(m[2], depth + 1);
  m = /^(.*\p{L}[.!?…]?)([^\p{L}\p{N}.!?…)“"']+)$/u.exec(n); if (m) return one(m[1], depth + 1) + m[2];
  m = /^(.*\S)\s*\(([^()]+)\)$/.exec(n); if (m) return `${one(m[1], depth + 1)} (${one(m[2], depth + 1)})`;
  m = /^([+\-]?[\d.,]+%?)\s+(.+)$/.exec(n); if (m) return `${m[1]} ${one(m[2], depth + 1)}`;
  m = /^(.+?)\s+([+\-]?[\d.,]+%?|×\d+)$/.exec(n); if (m) return `${one(m[1], depth + 1)} ${m[2]}`;
  m = /^(.+?)([.!?…]+)$/.exec(n); if (m && map.has(m[1])) return map.get(m[1]) + m[2];
  return swap(n);
}
/** Übersetzt einen Text. Unbekanntes bleibt Deutsch. */
export function tr(s) {
  if (lang === 'de' || typeof s !== 'string' || !s) return s;
  const c = cache.get(s); if (c !== undefined) return c;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  const out = m[1] + (m[2].length > 900 ? m[2] : one(m[2], 0)) + m[3];
  if (cache.size > 8000) cache.clear();
  cache.set(s, out);
  return out;
}

const ATTRS = ['placeholder', 'title', 'aria-label'];
function fixNode(n) {
  const p = n.parentElement;
  if (!p || p.closest('[data-notr],script,style,textarea')) return;
  const cur = n.data;
  if (n.__out === cur) return;
  n.__src = cur;
  const t = tr(cur);
  n.__out = t;
  if (t !== cur) n.data = t;
}
function fixAttr(el, a) {
  if (el.closest('[data-notr]')) return;
  const cur = el.getAttribute(a); if (cur == null) return;
  el.__a ??= {};
  const st = el.__a[a];
  if (st && st.out === cur) return;
  const t = tr(cur);
  el.__a[a] = { src: cur, out: t };
  if (t !== cur) el.setAttribute(a, t);
}
function walk(root) {
  if (root.nodeType === 3) { fixNode(root); return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) fixNode(n);
  for (const a of ATTRS) { if (root.hasAttribute?.(a)) fixAttr(root, a); for (const el of root.querySelectorAll(`[${a}]`)) fixAttr(el, a); }
}
/** Bei einem Sprachwechsel bekommt jeder sichtbare Text wieder seine deutsche Quelle als Grundlage. */
function retranslate() {
  if (!document.body) return;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.__src !== undefined && n.__out === n.data) { n.__out = undefined; n.data = n.__src; } fixNode(n); }
  for (const a of ATTRS) for (const el of document.querySelectorAll(`[${a}]`)) { const st = el.__a?.[a]; if (st && st.out === el.getAttribute(a)) { el.__a[a] = null; el.setAttribute(a, st.src); } fixAttr(el, a); }
}
export function watchDom() {
  if (observer || !document.body) return;
  observer = new MutationObserver(list => {
    if (lang === 'de') return;
    for (const m of list) {
      if (m.type === 'characterData') fixNode(m.target);
      else if (m.type === 'childList') for (const a of m.addedNodes) walk(a);
      else if (m.type === 'attributes') fixAttr(m.target, m.attributeName);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
