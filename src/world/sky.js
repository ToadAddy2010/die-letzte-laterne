import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT, GFX } from '../core/gfx.js';
import { clamp, damp, lerp, smooth, TAU } from '../core/util.js';
import { G } from '../game/state.js';

class Face {
  constructor(kind) {
    this.kind = kind;
    this.group = new THREE.Group();
    this.open = 0;
    const moon = kind === 'moon', skin = moon ? 0x6f7380 : 0xe8a860, skin2 = moon ? 0xc9ccd4 : 0xfff0cc, lip = moon ? 0x3c3e4a : 0xb8703a, line = moon ? 0x2c2e38 : 0x9a5a30;
    const k = new Kit(moon ? 11 : 22);
    k.blob(30, 0, 0, 0, skin, { c2: skin2, j: .13 });
    k.ball(29.6, 0, 0, 0, skin, { c2: skin2, seg: 14, j: .1 });
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, r = 8 + i * .85, x = Math.cos(a) * r, y = Math.sin(a) * r;
      k.ball(1 + (i % 4) * .55, x, y, Math.sqrt(Math.max(1, 880 - x * x - y * y)), moon ? 0x565a66 : 0xd89650, { seg: 5, sz: .35 });
    }
    k.ball(4.8, 0, -2.5, 29, skin, { c2: skin2, sy: 1.25, seg: 8 });
    k.ball(6, -14, -8, 24, skin, { c2: skin2, sz: .55, seg: 7 });
    k.ball(6, 14, -8, 24, skin, { c2: skin2, sz: .55, seg: 7 });
    k.torus(9, 1.5, 0, -8, 27.2, lip, { arc: Math.PI, rz: Math.PI, sy: .4, seg: 10 });
    k.box(16, .9, 1, 0, -12.2, 27, line, {});
    if (moon) {
      k.torus(7.4, .55, -24, 15, 12, 0x8a8e9a, { ry: -1.1 });
      k.torus(4.4, .4, 20, -19, 13, 0x8a8e9a, { ry: 1.1 });
    } else {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU, long = i % 2 === 0, L = long ? 11 : 7, R = 30 + L / 2 - 2;
        k.cone(long ? 6.2 : 4.3, L, Math.cos(a) * R, Math.sin(a) * R, -3, long ? 0xf0b060 : 0xffd890, { rz: a - Math.PI / 2, seg: 4, c2: 0xfff0d0 });
      }
    }
    this.group.add(new THREE.Mesh(k.build(), MAT.glow));

    this.eyeMat = new THREE.MeshBasicMaterial({ color: moon ? 0xe8d8a0 : 0xfff6dc, fog: false });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x120c34, fog: false });
    const lidMat = new THREE.MeshBasicMaterial({ color: moon ? 0x7c808e : 0xecb46c, fog: false });
    const lashMat = new THREE.MeshBasicMaterial({ color: line, fog: false });
    this.lids = []; this.pupils = []; this.lashes = []; this.brows = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 11.5, 7, 24.5);
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), this.eyeMat));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), pupilMat);
      pupil.scale.set(.6, moon ? 1.3 : .9, .35); pupil.position.z = 5.6;
      const lid = new THREE.Mesh(new THREE.SphereGeometry(6.4, 14, 8, 0, TAU, 0, Math.PI / 2), lidMat);
      const lash = new THREE.Mesh(new THREE.TorusGeometry(4.5, .5, 5, 12, Math.PI), lashMat);
      lash.rotation.z = Math.PI; lash.position.set(0, 1.2, 5.3);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(12, 1.7, 1.5), lashMat);
      brow.position.set(0, 8.2, 2.8);
      eye.add(pupil, lid, lash, brow);
      this.lids.push(lid); this.pupils.push(pupil); this.lashes.push(lash); this.brows.push({ m: brow, side });
      this.group.add(eye);
    }
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), rad = g.createRadialGradient(64, 64, 18, 64, 64, 64);
    rad.addColorStop(0, moon ? 'rgba(170,180,205,.34)' : 'rgba(255,214,150,.5)');
    rad.addColorStop(1, moon ? 'rgba(60,70,110,0)' : 'rgba(255,150,70,0)');
    g.fillStyle = rad; g.fillRect(0, 0, 128, 128);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.scale.setScalar(moon ? 130 : 170);
    this.halo.position.z = -12;
    this.group.add(this.halo);
    this.group.scale.setScalar(moon ? 4.4 : 3.6);
    this.group.traverse(o => { o.renderOrder = -5; });
    this.setOpen(0);
  }
  setOpen(v) {
    this.open = v;
    for (const l of this.lids) l.rotation.x = lerp(Math.PI * .5, -.42, v);
    for (const p of this.pupils) p.visible = v > .16;
    for (const l of this.lashes) l.visible = v <= .16;
    for (const b of this.brows) b.m.rotation.z = b.side * lerp(-.14, .34, v);
  }
  update(dt, t, pos, cam, goal, angry) {
    this.setOpen(damp(this.open, goal, goal > this.open ? 7 : 3, dt));
    this.group.position.copy(pos);
    this.group.lookAt(cam.position);
    this.group.rotateZ(Math.sin(t * .22) * .05);
    if (this.kind === 'moon') this.eyeMat.color.lerp(new THREE.Color(angry ? 0xff4a2a : 0xe8d8a0), 1 - Math.exp(-5 * dt));
    const lx = Math.sin(t * .9) * .9;
    for (const p of this.pupils) p.position.x = lx;
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
