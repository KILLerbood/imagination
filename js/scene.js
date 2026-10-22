/* Imagination — WebGL scene: a living iridescent core with orbiting AI modules */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const canvas = document.getElementById('webgl');
const ready = () => window.dispatchEvent(new Event('scene-ready'));
const isMobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  ready();
  throw e;
}

// quality tiers: 2 = high (desktop), 1 = medium, 0 = low
let tier = isMobile ? 1 : 2;
const dprFor = t => Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][t]);
renderer.setPixelRatio(dprFor(tier));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 6.2);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ---------- noise (Ashima simplex 3D) ---------- */
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* ---------- core ---------- */
const coreUniforms = {
  uTime: { value: 0 }, uAmp: { value: 0.22 }, uFreq: { value: 1.25 }, uPulse: { value: 0 },
  uHue: { value: 0 }, uAlpha: { value: 1 },
  uC1: { value: new THREE.Color('#2a1a7a') }, uC2: { value: new THREE.Color('#40e6ff') }, uC3: { value: new THREE.Color('#ff5fb0') }
};
const coreMat = new THREE.ShaderMaterial({
  uniforms: coreUniforms, transparent: true,
  vertexShader: NOISE + `
    uniform float uTime, uAmp, uFreq, uPulse;
    varying float vNoise; varying vec3 vNormal; varying vec3 vView;
    void main(){
      vec3 p = position;
      float n = snoise(p * uFreq + vec3(uTime * 0.22));
      float n2 = snoise(p * uFreq * 2.4 - vec3(uTime * 0.17)) * 0.35;
      float pulse = uPulse * (0.32 * snoise(p * 3.0 + uTime * 2.0));
      float d = (n + n2) * uAmp + pulse;
      vNoise = n + n2 * 0.5;
      vec4 mv = modelViewMatrix * vec4(p + normal * d, 1.0);
      vView = normalize(-mv.xyz);
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uTime, uHue, uAlpha, uPulse;
    uniform vec3 uC1, uC2, uC3;
    varying float vNoise; varying vec3 vNormal; varying vec3 vView;
    vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
    void main(){
      float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
      float t = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(uC1, uC2, smoothstep(0.25, 0.85, t));
      vec3 irid = pal(t * 0.8 + fres * 0.7 + uTime * 0.03 + uHue);
      col = mix(col, irid, 0.32);
      col = mix(col, uC3, fres * 0.55);
      col += fres * 0.75 * mix(uC2, uC3, t);
      col *= 0.45 + 0.75 * t;
      col += uPulse * 0.35 * uC2;
      gl_FragColor = vec4(col, uAlpha);
    }`
});
const detail = tier === 2 ? 72 : 36;
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), coreMat);

const shell = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.55, 1)),
  new THREE.LineBasicMaterial({ color: 0x8b6cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
);

// round sprite for points
const sprite = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.35, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

function ring(count, radius, spread, color, size) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = radius + (Math.random() - .5) * spread;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - .5) * spread * .25;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
}
const ringA = ring(tier === 2 ? 1400 : 700, 2.25, .55, 0x40e6ff, .045);
const ringB = ring(tier === 2 ? 900 : 450, 2.85, .35, 0xff5fb0, .04);
ringA.rotation.x = 1.25; ringB.rotation.x = 1.9; ringB.rotation.z = .5;

// orbiting tool modules (one per demo)
const moduleDefs = [
  [new THREE.TorusGeometry(.17, .065, 24, 64), '#ffb547'],
  [new RoundedBoxGeometry(.3, .3, .3, 4, .07), '#8b6cff'],
  [new THREE.OctahedronGeometry(.2), '#40e6ff'],
  [new THREE.TorusKnotGeometry(.12, .042, 96, 12), '#7dff9b'],
  [new THREE.CapsuleGeometry(.09, .18, 8, 16), '#ff5fb0'],
  [new THREE.IcosahedronGeometry(.18, 0), '#c4b2ff'],
  [new THREE.ConeGeometry(.15, .3, 32), '#40e6ff']
];
const modules = moduleDefs.map(([geo, col], i) => {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, metalness: .75, roughness: .18, emissive: col, emissiveIntensity: .12 }));
  m.userData = { r: 2.05 + (i % 3) * .26, speed: .16 + i * .025, phase: i / moduleDefs.length * Math.PI * 2, tilt: (i % 2 ? .45 : -.35) + i * .05, spin: .4 + Math.random() };
  return m;
});

const rig = new THREE.Group();
rig.add(core, shell, ringA, ringB, ...modules);
scene.add(rig);

// starfield
const starCount = tier === 2 ? 2200 : 900;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 9 + Math.random() * 18, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(ph) * Math.cos(th); starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); starPos[i * 3 + 2] = r * Math.cos(ph) - 6;
}
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc9c4ff, size: .07, map: sprite, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(stars);

/* ---------- section states ---------- */
const wide = () => innerWidth > 900;
const STATES = {
  hero: () => wide() ? { x: 1.75, y: -.05, s: 1.05, hue: 0, dim: 1, amp: .22 } : { x: 0, y: 1.05, s: .78, hue: 0, dim: 1, amp: .22 },
  caps: () => wide() ? { x: -2.4, y: .55, s: .62, hue: .15, dim: .85, amp: .3 } : { x: 0, y: 1.35, s: .5, hue: .15, dim: .55, amp: .3 },
  demo: () => wide() ? { x: 3.1, y: -1.2, s: .55, hue: .32, dim: .4, amp: .18 } : { x: 0, y: 0, s: .7, hue: .32, dim: .16, amp: .18 },
  testi: () => wide() ? { x: -2.7, y: .5, s: .6, hue: .5, dim: .65, amp: .26 } : { x: 0, y: 1.2, s: .55, hue: .5, dim: .3, amp: .26 },
  cta: () => wide() ? { x: 0, y: 0, s: 1.2, hue: .66, dim: 1, amp: .32 } : { x: 0, y: .2, s: .85, hue: .66, dim: .8, amp: .32 }
};
let stateName = 'hero';
const cur = { ...STATES.hero() };
const target = () => STATES[stateName]();

function bindSections() {
  const ST = window.ScrollTrigger;
  if (!ST) return;
  document.querySelectorAll('[data-scene]').forEach(el => {
    ST.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onToggle: self => { if (self.isActive) stateName = el.dataset.scene; } });
  });
  ST.create({ start: 0, end: 'max', onUpdate: self => { velocity = self.getVelocity(); } });
}
let velocity = 0;

/* ---------- interaction ---------- */
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { pointer.tx = e.clientX / innerWidth * 2 - 1; pointer.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
let pulse = 0, spinBoost = 0;
function wake() { pulse = 1; spinBoost = 3.5; }
window.IMAGINATION_SCENE = { wake };
document.getElementById('coreHint')?.addEventListener('click', wake);
document.querySelector('.hero')?.addEventListener('pointerdown', e => {
  if (e.target.closest('a,button,input')) return;
  wake();
});

/* ---------- resize ---------- */
let lastW = 0, lastH = 0;
function resize(force) {
  const w = innerWidth, h = canvas.clientHeight || innerHeight;
  if (!force && w === lastW && Math.abs(h - lastH) < 140) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < .8 ? 52 : 40;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => resize(false));
resize(true);

/* ---------- adaptive quality ---------- */
let frames = 0, acc = 0, checks = 0;
function adapt(dt) {
  if (checks > 2) return;
  frames++; acc += dt;
  if (frames >= 90) {
    const avg = acc / frames;
    if (avg > 1 / 42 && tier > 0) {
      tier--;
      renderer.setPixelRatio(dprFor(tier));
      resize(true);
      starGeo.setDrawRange(0, Math.floor(starCount * (tier ? .6 : .35)));
      if (tier === 0) { ringB.visible = false; }
    }
    frames = 0; acc = 0; checks++;
  }
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let first = true, t = 0;
const lerp = (a, b, k) => a + (b - a) * k;
function tick() {
  const dt = Math.min(clock.getDelta(), .1);
  const speed = reduce ? .25 : 1;
  t += dt * speed;
  const tg = target();
  const k = 1 - Math.pow(.0025, dt);
  for (const key in tg) cur[key] = lerp(cur[key], tg[key], k);

  pointer.x = lerp(pointer.x, pointer.tx, .05); pointer.y = lerp(pointer.y, pointer.ty, .05);
  pulse = Math.max(0, pulse - dt * 1.1);
  spinBoost = lerp(spinBoost, 0, 1 - Math.pow(.2, dt));
  const v = Math.min(Math.abs(velocity) / 3000, 1.5);

  rig.position.set(cur.x + pointer.x * .18, cur.y - pointer.y * .12 + Math.sin(t * .6) * .05, 0);
  rig.scale.setScalar(cur.s * (1 + pulse * .08));
  rig.rotation.y += dt * (.12 + v * .6 + spinBoost) * speed;
  rig.rotation.x = lerp(rig.rotation.x, pointer.y * .25, .05);

  coreUniforms.uTime.value = t;
  coreUniforms.uAmp.value = cur.amp + v * .12;
  coreUniforms.uPulse.value = pulse;
  coreUniforms.uHue.value = cur.hue;
  core.rotation.y = t * .1;
  shell.rotation.y = -t * .08; shell.rotation.z = t * .05;
  shell.material.opacity = .18 + pulse * .4;
  ringA.rotation.z = t * .07; ringB.rotation.y = -t * .05;

  modules.forEach(m => {
    const u = m.userData, a = t * u.speed * (1 + spinBoost * .3) + u.phase;
    m.position.set(Math.cos(a) * u.r, Math.sin(a * 1.3) * .35 + Math.sin(a) * u.tilt, Math.sin(a) * u.r);
    m.rotation.x = t * u.spin; m.rotation.y = t * u.spin * .7;
  });
  stars.rotation.y = t * .01 + pointer.x * .04;
  stars.rotation.x = pointer.y * .03;

  canvas.style.opacity = cur.dim.toFixed(3);
  renderer.render(scene, camera);
  adapt(dt);
  if (first) { first = false; ready(); }
  requestAnimationFrame(tick);
}

bindSections();
requestAnimationFrame(tick);
