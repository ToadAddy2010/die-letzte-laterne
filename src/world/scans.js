import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/addons/GLTFLoader.js';
import { GFX } from '../core/gfx.js';

// Fotoscans von Poly Haven (CC0), in tools/bake_scans.py auf Spielgröße gebracht.
const IDS = ['boulder_01', 'rock_07', 'namaqualand_boulder_04', 'tree_stump_01', 'dead_tree_trunk', 'fern_02', 'shrub_02', 'nettle_plant', 'treasure_chest'];
const PLANTS = new Set(['fern_02', 'shrub_02', 'nettle_plant']), V = 1;
export const SCANS = {};
const CARDS = {};

/** Zweige aus echten Pflanzenscans, mit Transparenz, Wind und durchscheinendem Gegenlicht. */
export function cardMat(name) {
  if (CARDS[name].mat) return CARDS[name].mat;
  const m = new THREE.MeshLambertMaterial({ map: CARDS[name].tex, alphaTest: .42, side: THREE.DoubleSide, vertexColors: true });
  m.onBeforeCompile = s => {
    s.uniforms.uTime = GFX.time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wP = instanceMatrix[3].xyz; float wH = max(position.y, 0.) * .012 + length(position.xz) * .008;
        transformed.x += (sin(uTime * 1.3 + wP.x * .21 + position.y * .5) + .45 * sin(uTime * 3.4 + position.x * 1.7 + position.z)) * wH;
        transformed.y += sin(uTime * 2.1 + position.x * 1.2 + wP.z) * wH * .45;
        transformed.z += cos(uTime * 1.05 + wP.z * .19 + position.y * .4) * wH * .8;
      #endif`);
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `
      #if NUM_DIR_LIGHTS > 0
        outgoingLight += diffuseColor.rgb * vec3(1.1, 1.25, .6) * directionalLights[0].color * pow(max(dot(-normalize(vViewPosition), directionalLights[0].direction), 0.), 3.) * .62;
      #endif
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'scan-card';
  return CARDS[name].mat = m;
}

function windy(m) {
  m.onBeforeCompile = s => {
    s.uniforms.uTime = GFX.time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wP = instanceMatrix[3].xyz; float wH = max(position.y, 0.) * .07;
        transformed.x += (sin(uTime * 1.6 + wP.x * .31 + position.z * 1.8) + .4 * sin(uTime * 3.9 + position.x * 3.)) * wH;
        transformed.z += cos(uTime * 1.3 + wP.z * .27 + position.x * 1.6) * wH * .8;
      #endif`);
  };
  m.customProgramCacheKey = () => 'scan-wind';
}

export async function loadScans(progress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(IDS.map(async id => {
    const g = await loader.loadAsync(new URL(`../../assets/scans/${id}.glb?v=${V}`, import.meta.url).href);
    const find = n => { let r = null; g.scene.getObjectByName(n)?.traverse(o => { if (o.isMesh && !r) r = o; }); return r; };
    const a = find('lod0'), b = find('lod1'), mat = a.material;
    mat.metalness = 0; mat.metalnessMap = null;
    if (mat.map) mat.map.anisotropy = 4;
    if (PLANTS.has(id)) { mat.side = THREE.DoubleSide; mat.transparent = false; mat.alphaTest = .42; mat.roughness = .78; windy(mat); }
    SCANS[id] = { hi: a.geometry, lo: b.geometry, mat };
    progress?.(++done / IDS.length);
  }));
  const tl = new THREE.TextureLoader();
  for (const n of ['pine', 'leaf']) {
    const t = await tl.loadAsync(new URL(`../../assets/tex/card_${n}.webp?v=${V}`, import.meta.url).href);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; CARDS[n] = { tex: t };
  }
  SCANS.ready = true;
}

const tinted = new Map();
export function scanMat(id, tint) {
  const s = SCANS[id];
  if (tint === undefined) return s.mat;
  const key = `${id}_${tint}`;
  if (!tinted.has(key)) { const m = s.mat.clone(); m.color.set(tint); tinted.set(key, m); }
  return tinted.get(key);
}
