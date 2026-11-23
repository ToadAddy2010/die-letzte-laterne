// Wetter und Blutmond. Beides ändert Licht, Nebel und Geräusche der offenen Welt.
import * as THREE from '../../vendor/three.module.js';
import { G } from '../game/state.js';

export const KINDS = ['klar', 'regen', 'gewitter', 'nebel', 'schnee', 'sturm', 'asche', 'sand'];
const INFO = {
  klar: { amt: 0, dim: 0, fog: 1, cover: 0 },
  regen: { rain: 1, amt: .75, dim: .4, fog: 1.45, cover: .24, sound: .55, label: 'Es beginnt zu regnen' },
  gewitter: { rain: 1, amt: 1, dim: .62, fog: 1.75, cover: .36, sound: .9, bolt: 1, wind: 7, label: 'Ein Gewitter zieht auf' },
  nebel: { amt: 0, dim: .22, fog: 3.1, cover: .16, label: 'Dichter Nebel zieht auf' },
  schnee: { flake: 1, amt: .75, dim: .18, fog: 1.6, cover: .22, fall: 4.2, tint: 0xffffff, size: 1, label: 'Es fängt an zu schneien' },
  sturm: { flake: 1, amt: 1, dim: .34, fog: 3, cover: .34, fall: 7, wind: 19, tint: 0xf0f6ff, size: 1.15, sound: .34, label: 'Ein Schneesturm kommt auf' },
  asche: { flake: 1, amt: .8, dim: .3, fog: 1.9, cover: .28, fall: 1.9, wind: 3, tint: 0xff9a5a, size: .8, label: 'Asche rieselt vom Himmel' },
  sand: { flake: 1, amt: 1, dim: .26, fog: 2.5, cover: .1, fall: .9, wind: 22, tint: 0xe0b878, size: .62, sound: .26, label: 'Ein Sandsturm fegt heran' },
};
const TABLE = {
  pilz: [['klar', 56], ['regen', 24], ['gewitter', 8], ['nebel', 12]], forest: [['klar', 48], ['regen', 28], ['gewitter', 12], ['nebel', 12]],
  moor: [['nebel', 44], ['regen', 30], ['gewitter', 16], ['klar', 10]], desert: [['klar', 68], ['sand', 32]],
  frost: [['schnee', 56], ['sturm', 18], ['klar', 26]], clock: [['klar', 54], ['regen', 22], ['nebel', 24]], ash: [['asche', 72], ['gewitter', 18], ['klar', 10]],
};
const BOX = 74, RED = new THREE.Color(0xc21a24), DEEP = new THREE.Color(0x3a0a12), T = new THREE.Color();

const VS = `attribute vec3 seed; attribute float tip; uniform vec3 uCam, uDrift; uniform float uAmt, uLen, uSize, uBox; varying float vA;
void main(){ vec3 p = seed * uBox + uDrift; p = mod(p - uCam + uBox * .5, vec3(uBox)) - uBox * .5 + uCam;
  vec3 dir = normalize(uDrift + vec3(0., -.001, 0.)); p -= dir * tip * uLen * (.7 + seed.y * .6);
  vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(uSize * (70. / max(1., -mv.z)) * (.6 + seed.z * .8), uSize * 2.6);
  float d = length(p - uCam); vA = smoothstep(uBox * .5, uBox * .3, d) * smoothstep(1., 4., d) * (1. - tip * .75);
  if (fract(seed.x * 13.7 + seed.z * 7.3) > uAmt) gl_Position = vec4(2., 2., 2., 1.); }`;

export class Weather {
  constructor(scene) {
    const low = G.settings.low, rainN = low ? 450 : 1100, flakeN = low ? 350 : 950;
    const make = (n, line) => {
      const k = line ? 2 : 1, s = new Float32Array(n * k * 3), t = new Float32Array(n * k), pos = new Float32Array(n * k * 3);
      for (let i = 0; i < n; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); for (let j = 0; j < k; j++) { const q = i * k + j; s[q * 3] = a; s[q * 3 + 1] = b; s[q * 3 + 2] = c; t[q] = j; } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 3)); g.setAttribute('tip', new THREE.BufferAttribute(t, 1));
      const u = { uCam: { value: new THREE.Vector3() }, uDrift: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uLen: { value: line ? 1.5 : 0 }, uSize: { value: 2.6 }, uBox: { value: BOX }, uC: { value: new THREE.Color(line ? 0xbcd0e8 : 0xffffff) }, uO: { value: line ? .44 : .78 } };
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: u, vertexShader: VS, fragmentShader: line ? 'uniform vec3 uC; uniform float uO; varying float vA; void main(){ gl_FragColor = vec4(uC, vA * uO); }' : 'uniform vec3 uC; uniform float uO; varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float r = dot(q, q); if (r > .25) discard; gl_FragColor = vec4(uC, vA * uO * (1. - r * 4.)); }' });
      const o = line ? new THREE.LineSegments(g, m) : new THREE.Points(g, m); o.frustumCulled = false; o.visible = false; o.renderOrder = 8; scene.add(o); return o;
    };
    this.rain = make(rainN, true); this.flakes = make(flakeN, false);
    this.kind = 'klar'; this.next = 90; this.k = 0; this.from = INFO.klar; this.to = INFO.klar; this.drift = 0; this.bolt = 8; this.flash = 0; this.red = 0; this.lastRegion = null; this.fixed = false;
  }
  get id() { return KINDS.indexOf(this.kind); }
  /** Beim Mitspieler gibt der Gastgeber das Wetter vor. */
  set(kind, quiet) {
    if (!INFO[kind] || kind === this.kind) return;
    this.from = this.cur(); this.to = INFO[kind]; this.kind = kind; this.k = 0;
    if (!quiet && INFO[kind].label && G.mode === 'play') G.ui.toast(INFO[kind].label, 'quest');
  }
  cur() { const a = this.from, b = this.to, m = Math.min(1, this.k), L = (x, y) => x + (y - x) * m; return { rain: L(a.rain || 0, b.rain || 0), flake: L(a.flake || 0, b.flake || 0), amt: L(a.amt, b.amt), dim: L(a.dim, b.dim), fog: L(a.fog, b.fog), cover: L(a.cover, b.cover), sound: L(a.sound || 0, b.sound || 0), wind: L(a.wind || 0, b.wind || 0), fall: b.fall ?? a.fall ?? 4, tint: b.tint ?? a.tint, size: b.size ?? a.size ?? 1, bolt: b.bolt && m > .6 }; }
  pick(region) {
    const list = TABLE[region] ?? TABLE.pilz; let r = Math.random() * list.reduce((s, x) => s + x[1], 0);
    for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
    return 'klar';
  }
  reset() { this.kind = 'klar'; this.from = this.to = INFO.klar; this.k = 1; this.next = 70 + Math.random() * 60; G.bloodMoon = false; G.bmDay = 0; this.red = 0; this.rain.visible = this.flakes.visible = false; G.audio?.setRain?.(0); }
  moonCheck() {
    if (G.net?.isGuest) return;
    const h = G.hour, night = h >= 20.5 || h < 4.6;
    if (G.bloodMoon && !night) { G.bloodMoon = false; G.ui.toast('Der Blutmond verblasst', 'quest'); }
    if (!G.bloodMoon && h >= 20.5 && h < 22.5 && G.bmDay !== G.day) {
      G.bmDay = G.day;
      if (G.day >= 2 && Math.random() < .24) { G.bloodMoon = true; G.ui.banner('Blutmond', 'Elite-Monster streifen durch die Nacht'); G.audio?.roar(); }
    }
  }
  /** Läuft direkt nach dem Himmel und färbt dessen Werte um. */
  update(dt, cam, region) {
    const outside = !G.inDungeon && !G.house && G.mode !== 'menu';
    if (G.mode === 'play') {
      if (!G.net?.isGuest && !this.fixed) {
        this.next -= dt;
        if (this.next <= 0) { this.next = 110 + Math.random() * 170; this.set(this.pick(region.id)); }
        else if (this.lastRegion && this.lastRegion !== region.id && !(TABLE[region.id] ?? []).some(x => x[0] === this.kind)) this.set(this.pick(region.id));
      }
      this.lastRegion = region.id; this.moonCheck();
    }
    this.k = Math.min(1, this.k + dt / 9);
    const W = this.cur(), S = G.sky, R = G.retro.u;
    const on = outside ? 1 : 0;
    this.drift += dt;
    const fall = W.rain > .5 ? 44 : W.fall, wx = W.wind, wz = W.wind * .45;
    for (const [o, amt] of [[this.rain, W.rain * W.amt * on], [this.flakes, W.flake * W.amt * on]]) {
      o.visible = amt > .01;
      if (!o.visible) continue;
      const u = o.material.uniforms; u.uCam.value.copy(cam.position); u.uAmt.value = amt;
      u.uDrift.value.set(wx * this.drift + (o === this.flakes ? Math.sin(this.drift * .7) * 1.6 : 0), -fall * this.drift, wz * this.drift);
      if (o === this.flakes) { if (W.tint != null) u.uC.value.set(W.tint); u.uSize.value = 3.2 * W.size * (innerHeight / 720); }
    }
    G.audio?.setRain?.(W.sound * on);
    if (!outside) { if (G.mode === 'menu') G.scene.fog.density = G.settings.low ? .0056 : .0021; return; }
    S.dir.intensity *= 1 - W.dim; S.hemi.intensity *= 1 - W.dim * .34;
    S.uni.cover.value += W.cover;
    S.uni.clL.value.multiplyScalar(1 - W.dim * .62); S.uni.sunC.value.multiplyScalar(1 - W.dim * .8);
    G.scene.fog.density = (G.settings.low ? .0056 : .0021) * W.fog; R.hazeK.value *= W.fog;
    if (W.dim > .15) { T.copy(G.scene.fog.color).lerp(T.clone().setRGB(.34, .36, .4), W.dim * .42 * S.day); G.scene.fog.color.copy(T); S.uni.horizon.value.copy(T); R.hazeC.value.copy(T); }
    R.shaft.value *= 1 - W.dim;
    if (W.bolt) {
      this.bolt -= dt;
      if (this.bolt <= 0) { this.bolt = 5 + Math.random() * 13; this.flash = 1; const delay = .25 + Math.random() * 1.4; setTimeout(() => G.audio?.thunder?.(), delay * 1000); }
    }
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4.2); const f = this.flash * (.6 + Math.sin(this.flash * 26) * .4); S.hemi.intensity += f * 3.4; S.uni.clL.value.addScalar(f * .8); S.uni.horizon.value.addScalar(f * .18); }
    this.red += ((G.bloodMoon ? 1 : 0) - this.red) * Math.min(1, dt * .9);
    if (this.red > .01) {
      const k = this.red * (1 - S.day);
      S.uni.top.value.lerp(DEEP, k * .8); S.uni.mid.value.lerp(RED, k * .5); S.uni.horizon.value.lerp(RED, k * .34); G.scene.fog.color.lerp(DEEP, k * .62); R.hazeC.value.lerp(RED, k * .4);
      S.hemi.color.lerp(RED, k * .3); S.hemi.intensity *= 1 + k * .34; S.dir.color.lerp(RED, k * .72); S.dir.intensity *= 1 + k * .55;
      S.uni.clL.value.lerp(RED, k * .5);
    }
  }
}
