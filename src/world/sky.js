import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT, GFX } from '../core/gfx.js';
import { clamp, damp, lerp, smooth, TAU } from '../core/util.js';
import { G } from '../game/state.js';

// Sonne und Mond: echte Himmelskörper statt Comic-Gesichtern. Schaut der Mond zu, öffnet sich ein einziges Auge.
const BODY_VS = 'varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const NOISE = `
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1., 0.)), f.x), mix(hh(i + vec2(0., 1.)), hh(i + vec2(1., 1.)), f.x), f.y); }
float fb(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * nn(p); p = p * 2.03 + 1.7; a *= .5; } return v; }`;
const MOON_FS = `
uniform float open, t, angry, look;
varying vec2 vUv;
${NOISE}
float crater(vec2 p, float s, float seed){
  vec2 g = floor(p * s), f = fract(p * s); float best = 9.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)), id = g + o + seed;
    if (hh(id + 9.1) < .5) continue;
    vec2 c = o + vec2(hh(id), hh(id + 7.3));
    best = min(best, length(f - c) / (.16 + .3 * hh(id + 3.1)));
  }
  return best;
}
void main(){
  vec2 p = vUv * 1.3; float r = length(p);
  vec3 col = vec3(0.); float a = 0.;
  if (r < 1.) {
    float z = sqrt(1. - r * r); vec3 N = vec3(p, z);
    vec2 q = p / (.55 + z * .45);
    float mare = smoothstep(.44, .7, fb(q * 1.5 + 4.2));
    float alb = mix(.8, .44, mare) * (.84 + .3 * fb(q * 7.3));
    for (int k = 0; k < 3; k++) {
      float d = crater(q + float(k) * 1.7, 3. + float(k) * 4.6, float(k) * 11.);
      alb *= mix(.7, 1., smoothstep(.5, .9, d));
      alb += .17 * smoothstep(.84, .98, d) * (1. - smoothstep(.98, 1.14, d));
    }
    float lit = .2 + .8 * max(dot(N, normalize(vec3(-.42, .34, .84))), 0.);
    col = vec3(.79, .81, .87) * alb * lit * 1.4 * (.55 + .45 * pow(z, .45));
    vec2 e = vec2(p.x / .62, p.y + .03);
    float w = max(0., 1. - e.x * e.x), up = .3 * w * open, lo = -.16 * w * open;
    float seam = (1. - smoothstep(0., .014, abs(e.y - .022 * w))) * step(abs(e.x), .97) * (1. - open);
    float scars = smoothstep(.6, .66, fb(p * 9. + 3.)) * smoothstep(.75, .15, length(p * vec2(.8, 1.5)));
    float socket = smoothstep(.55, .0, length(vec2(e.x * .9, (e.y - .01) * 2.2))) * open;
    col *= 1. - seam * .62 - scars * .22 * (.35 + open) - socket * .42;
    if (abs(e.x) < 1. && e.y < up && e.y > lo && open > .02) {
      vec2 ip = vec2(p.x - look, e.y - .04 * open);
      float ir = length(ip);
      float vein = smoothstep(.58, .64, fb(vec2(e.x * 9., e.y * 30.) + 5.)) * smoothstep(.15, .9, abs(e.x));
      vec3 scl = mix(vec3(.26, .2, .14), vec3(.3, .07, .05), angry) * (.42 + .58 * smoothstep(lo, up, e.y)) * + vec3(.5, .08, .05) * vein * .55;
      vec3 irisC = mix(vec3(1., .68, .22), vec3(1., .3, .08), angry);
      float streak = .55 + .45 * fb(vec2(atan(ip.y, ip.x) * 3.2, ir * 15. - t * .3));
      vec3 ec = mix(scl, irisC * streak * 1.45, smoothstep(.205, .185, ir));
      ec = mix(ec, irisC * .12, smoothstep(.215, .2, ir) * smoothstep(.17, .2, ir));
      float slit = smoothstep(.05 - .02 * open, .025, abs(ip.x)) * smoothstep(.17, .15, abs(ip.y));
      ec = mix(ec, vec3(.015, 0., .02), slit);
      float shade = smoothstep(0., .09, up - e.y) * smoothstep(0., .06, e.y - lo);
      col = ec * (.18 + .82 * shade) * (.75 + .25 * smoothstep(1., .4, abs(e.x)));
    }
    col += vec3(.5, .55, .72) * pow(1. - z, 3.) * .28;
    a = 1.;
  }
  float halo = exp(-max(r - 1., 0.) * 4.) * step(1., r) * smoothstep(1.3, 1.02, r);
  vec3 hc = mix(vec3(.42, .48, .68), vec3(.62, .16, .1), angry * open);
  col += hc * halo * (.32 + open * .28);
  gl_FragColor = vec4(col, a);
}`;
const SUN_FS = `
uniform float t;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 1.3; float r = length(p), core = smoothstep(1., .965, r), limb = pow(max(1. - r * r, 0.), .35), ang = atan(p.y, p.x);
  vec3 col = vec3(1., .9, .7) * (1.05 + limb * .65) * core;
  float rays = .55 + .45 * sin(ang * 13. + t * .25) * sin(ang * 7. - t * .17);
  float cor = exp(-max(r - 1., 0.) * 3.) * (1. - core) * (.65 + .35 * rays) * smoothstep(1.3, 1.02, r);
  col += vec3(1., .66, .36) * cor * .45;
  gl_FragColor = vec4(col, core);
}`;

class Face {
  constructor(kind) {
    this.kind = kind; this.open = 0;
    this.group = new THREE.Group();
    this.u = { open: { value: 0 }, t: { value: 0 }, angry: { value: 0 }, look: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: BODY_VS, fragmentShader: kind === 'moon' ? MOON_FS : SUN_FS, transparent: true, premultipliedAlpha: true, depthWrite: false, fog: false, toneMapped: false }));
    m.renderOrder = -5; m.frustumCulled = false;
    this.group.add(m);
    this.group.scale.setScalar(kind === 'moon' ? 132 : 108);
  }
  setOpen(v) { this.open = v; this.u.open.value = v; }
  update(dt, t, pos, cam, goal, angry) {
    if (this.kind === 'moon') this.setOpen(damp(this.open, goal, goal > this.open ? 1.6 : 2.6, dt));
    this.group.position.copy(pos);
    this.group.lookAt(cam.position);
    this.u.t.value = t;
    this.u.angry.value = damp(this.u.angry.value, angry ? 1 : 0, 2.5, dt);
    this.u.look.value = Math.sin(t * .37) * .07;
  }
}

const skyFrag = /* glsl */`
varying vec3 d;
uniform vec3 top, mid, horizon, sunV, sunC, clL, clS;
uniform float night, time, cover;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, v = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { v += a * n(p); p = m * p + 3.1; a *= .5; } return v; }
void main(){
  vec3 v = normalize(d);
  float y = clamp(v.y, -.12, 1.), mu = max(dot(v, sunV), 0.);
  vec3 c = mix(horizon, mid, smoothstep(.0, .2, y));
  c = mix(c, top, smoothstep(.1, .68, y));
  c += sunC * (pow(mu, 5.) * .1 + pow(mu, 40.) * .22 + pow(mu, 420.) * .9);
  float st = night * smoothstep(.03, .24, y);
  if (st > .01) {
    vec3 g = floor(v * 190.), q = fract(v * 190.) - .5; float r = h3(g);
    c += smoothstep(.34, .02, length(q)) * step(.9925, r) * st * (.45 + .55 * sin(time * 1.6 + r * 90.)) * mix(vec3(1., .86, .66), vec3(.72, .82, 1.), h3(g + 2.)) * 1.5;
    float band = exp(-pow(dot(v, normalize(vec3(.42, .3, .86))) * 3.4, 2.));
    c += vec3(.05, .055, .08) * band * fbm(v.xz * 7. + v.y * 3.) * st;
  }
  if (v.y > .006) {
    vec2 p = v.xz / (v.y + .14) * .78 + vec2(time * .0042, time * .0017);
    float f = fbm(p), den = smoothstep(cover, cover + .3, f);
    if (den > .002) {
      float f2 = fbm(p + sunV.xz * .16), lit = clamp((f - f2) * 3.4 + .58, 0., 1.), edge = smoothstep(cover + .3, cover, f);
      vec3 cc = mix(clS, clL, lit) + sunC * pow(mu, 7.) * edge * .55;
      c = mix(c, cc, den * smoothstep(.006, .15, v.y) * .94);
    }
  }
  gl_FragColor = vec4(c, 1.);
}`;

const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
const col = { nTop: new THREE.Color(0x05070f), nMid: new THREE.Color(0x10151f), dTop: new THREE.Color(0x3f6a94), dMid: new THREE.Color(0x98b2c4), dusk: new THREE.Color(0xd8824a) };

export class Sky {
  constructor(scene, group) {
    this.uni = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, night: { value: 1 }, time: { value: 0 }, sunV: { value: new THREE.Vector3(0, 1, 0) }, sunC: { value: new THREE.Color() }, clL: { value: new THREE.Color() }, clS: { value: new THREE.Color() }, cover: { value: .5 } };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2300, 28, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.uni, fragmentShader: skyFrag,
      vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    }));
    this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    this.sun = new Face('sun'); this.moon = new Face('moon');
    group.add(this.dome, this.sun.group, this.moon.group);
    this.hemi = new THREE.HemisphereLight(0x9fb0c4, 0x2a261e, 1.6);
    this.dir = new THREE.DirectionalLight(0xc4cce0, 2);
    scene.add(this.hemi, this.dir, this.dir.target);
    this.dir.castShadow = !G.settings.low;
    this.dir.shadow.mapSize.set(2048, 2048);
    Object.assign(this.dir.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 10, far: 900 });
    this.dir.shadow.camera.updateProjectionMatrix();
    this.dir.shadow.bias = -.0006; this.dir.shadow.normalBias = .24; this.dir.shadow.radius = 2.2;
    scene.fog = new THREE.FogExp2(0x151650, .0034);
    this.fogTarget = new THREE.Color(0x151650);
    this.day = 0; this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
  }
  dir3(hour, v, sign = 1) {
    const a = (hour - 6) / 24 * TAU;
    return v.set(Math.cos(a) * sign, Math.sin(a) * sign * .66, -.62).normalize();
  }
  update(dt, hour, cam, region, target, snap) {
    this.dir3(hour, this.sunDir); this.dir3(hour, this.moonDir, -1);
    const s = this.sunDir.y, day = smooth(-.1, .26, s), dusk = smooth(.42, .02, Math.abs(s)) * (1 - smooth(.3, .5, s));
    this.day = day;
    const u = this.uni;
    u.top.value.copy(col.nTop).lerp(col.dTop, day);
    u.mid.value.copy(col.nMid).lerp(col.dMid, day);
    u.night.value = 1 - day;
    u.time.value = G.t;
    const fogN = new THREE.Color(region.fogN), fogD = new THREE.Color(region.fogD), f = fogN.lerp(fogD, day).lerp(col.dusk, dusk * .32);
    const k = snap ? 1 : 1 - Math.exp(-1.2 * dt);
    this.fogTarget.lerp(f, k);
    if (!G.inDungeon) G.scene.fog.color.copy(this.fogTarget);
    u.horizon.value.copy(this.fogTarget);
    u.mid.value.lerp(col.dusk, dusk * .4);
    this.dome.position.copy(cam.position);
    const P = this.tmp;
    this.sun.group.visible = s > -.34; this.moon.group.visible = s < .34;
    if (this.sun.group.visible) this.sun.update(dt, G.t, P.copy(cam.position).addScaledVector(this.sunDir, 1700), cam, day > .1 ? .85 : 0, false);
    const gaze = G.moonGaze > 0;
    if (this.moon.group.visible) this.moon.update(dt, G.t, P.copy(cam.position).addScaledVector(this.moonDir, 1500), cam, gaze ? 1 : G.forceMoonOpen ?? .0, gaze);
    this.hemi.color.set(0x56647e).lerp(new THREE.Color(0xb4c6d8), day).lerp(col.dusk, dusk * .25);
    this.hemi.groundColor.set(0x12141a).lerp(new THREE.Color(0x4a4234), day);
    this.hemi.intensity = lerp(1.75, 2.35, day);
    const main = s > 0 ? this.sunDir : this.moonDir;
    this.dir.color.set(0x8c9cc0).lerp(new THREE.Color(0xfff0d8), day).lerp(tmpC.set(0xff9a55), dusk * .75);
    this.dir.intensity = lerp(1.15, 3.05, day);
    // Das Schattenraster rastet ein, damit Schattenkanten beim Laufen nicht flimmern.
    const snapG = 170 / 2048;
    this.dir.target.position.set(Math.round(target.x / snapG) * snapG, Math.round(target.y / snapG) * snapG, Math.round(target.z / snapG) * snapG);
    this.dir.position.copy(this.dir.target.position).addScaledVector(main, 400);
    const R0 = G.retro.u; R0.warm.value = day;
    const W = MAT.water.uniforms;
    W.uSky.value.copy(this.fogTarget).lerp(u.top.value, .35); W.uDeep.value.set(0x0a1f64).lerp(tmpC.set(0x1250b4), day);
    W.uSun.value.copy(main); W.uGlint.value.set(0xc8d4ff).lerp(tmpC.set(0xffdca0), day);
    GFX.rimColor.value.copy(this.fogTarget).lerp(u.top.value, .4).multiplyScalar(1.5); GFX.rim.value = G.inDungeon ? .12 : lerp(.26, .14, day);
    GFX.skyC.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * .55); GFX.gndC.value.copy(this.hemi.groundColor).multiplyScalar(this.hemi.intensity * .5);
    u.sunV.value.copy(main); u.sunC.value.copy(this.dir.color).multiplyScalar(s > 0 ? lerp(.5, 1.05, day) : .16);
    u.clL.value.set(0x79849c).lerp(tmpC.set(0xfaf6ee), day).lerp(tmpC.set(0xf4a874), dusk * .7); u.clS.value.set(0x12161f).lerp(tmpC.set(0x8d9aa8), day).lerp(tmpC.set(0x6a4a5a), dusk * .7); u.cover.value = .47 + Math.sin(G.t * .012) * .05;
    R0.hazeK.value = G.inDungeon || G.settings.low ? 0 : .00125 + (region.id === 'moor' || region.id === 'forest' ? .00065 : 0); R0.hazeC.value.copy(this.fogTarget); R0.sunC.value.copy(this.dir.color).multiplyScalar(s > 0 ? lerp(.35, .6, day) : .1); R0.sunW.value.copy(main);
    const R = G.retro.u, shaftDir = s > -.05 ? this.sunDir : this.moonDir;
    P.copy(cam.position).addScaledVector(shaftDir, 1000).project(cam);
    const front = cam.getWorldDirection(tmpV).dot(shaftDir), onScreen = Math.abs(P.x) < 1.35 && Math.abs(P.y) < 1.35 && P.z < 1;
    R.sunPos.value.set(P.x * .5 + .5, P.y * .5 + .5);
    R.shaft.value = !G.inDungeon && front > .15 && onScreen ? smooth(.15, .6, front) * (s > -.05 ? lerp(.55, 1, day) : .42) : 0;
    R.shaftC.value.set(0xaab8ff).lerp(tmpC.set(0xffd2a0), s > -.05 ? 1 : 0);
  }
}
