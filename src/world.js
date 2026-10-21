import * as THREE from '../vendor/three.module.js';
import { WEAPON_PROFILES } from './data.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

const THEMES = {
  downtown: {
    fog: 0x070b17, fogDensity: 0.017, skyTop: 0x03040a, skyBottom: 0x1b0e28,
    hemiSky: 0x6f78c9, hemiGround: 0x1a0e17, hemi: 1.02,
    sun: 0xffc6aa, sunIntensity: 2.1, accent: 0xff2f6d, accent2: 0x32d8ff,
    ambient: 0x120b1c, building: 0x151725, road: 0x090b12,
  },
  subway: {
    fog: 0x040806, fogDensity: 0.024, skyTop: 0x020403, skyBottom: 0x0b1712,
    hemiSky: 0x4d8c70, hemiGround: 0x120b08, hemi: 0.92,
    sun: 0xb8ffe3, sunIntensity: 1.5, accent: 0x9cff57, accent2: 0x42ddff,
    ambient: 0x07100c, building: 0x101713, road: 0x070a08,
  },
  rooftop: {
    fog: 0x090a18, fogDensity: 0.014, skyTop: 0x060618, skyBottom: 0x391735,
    hemiSky: 0x778cff, hemiGround: 0x24111d, hemi: 1.1,
    sun: 0xffb38b, sunIntensity: 2.3, accent: 0xff224f, accent2: 0xffc247,
    ambient: 0x100c20, building: 0x161b31, road: 0x0c0e18,
  },
  menu: {
    fog: 0x070b17, fogDensity: 0.015, skyTop: 0x03040a, skyBottom: 0x24102f,
    hemiSky: 0x7a79d9, hemiGround: 0x1d0c18, hemi: 1.08,
    sun: 0xffb6a3, sunIntensity: 2.0, accent: 0xff2f6d, accent2: 0x32d8ff,
    ambient: 0x140c22, building: 0x141725, road: 0x090b12,
  },
};

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  glowTexture = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,.8)');
    g.addColorStop(0.5, 'rgba(255,255,255,.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return glowTexture;
}

let fabricTex = null;
function fabricTexture() {
  if (fabricTex) return fabricTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 150 + (Math.random() - 0.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 128; i += 4) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, i, 128, 1);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(i, 0, 1, 128);
  }
  ctx.globalAlpha = 1;
  fabricTex = new THREE.CanvasTexture(c);
  fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
  fabricTex.repeat.set(3, 3);
  return fabricTex;
}

let asphaltTex = null;
function asphaltTexture() {
  if (asphaltTex) return asphaltTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = 70 + Math.random() * 120;
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#303030';
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  asphaltTex = new THREE.CanvasTexture(c);
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(14, 3);
  return asphaltTex;
}

function cssColor(n, fallback = '#1a1c33') {
  if (typeof n === 'string') return n;
  if (typeof n !== 'number') return fallback;
  return '#' + n.toString(16).padStart(6, '0');
}

function environmentTexture(th) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#04050d');
  g.addColorStop(0.38, cssColor(th.hemiSky));
  g.addColorStop(0.5, cssColor(th.accent2, '#56e1ff'));
  g.addColorStop(0.62, cssColor(th.hemiGround, '#0a0a12'));
  g.addColorStop(1, '#03040a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 140; i++) {
    const warm = Math.random() > 0.45;
    const a = 0.12 + Math.random() * 0.5;
    ctx.fillStyle = warm ? `rgba(255,196,130,${a})` : `rgba(130,210,255,${a})`;
    ctx.fillRect(Math.random() * 512, 112 + Math.random() * 46, 2 + Math.random() * 16, 2 + Math.random() * 7);
  }
  const kg = ctx.createRadialGradient(140, 62, 4, 140, 62, 120);
  kg.addColorStop(0, 'rgba(255,238,214,0.9)');
  kg.addColorStop(1, 'rgba(255,238,214,0)');
  ctx.fillStyle = kg; ctx.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(color, scale = 1, opacity = 0.8) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.68, metalness: opts.metalness ?? 0.18,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    map: opts.map ?? null, side: opts.side ?? THREE.FrontSide,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = opts.castShadow ?? true;
  m.receiveShadow = opts.receiveShadow ?? true;
  return m;
}

function cyl(rt, rb, h, color, seg = 8, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.55, metalness: opts.metalness ?? 0.3,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.55, metalness: opts.metalness ?? 0.2,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, opts.seg ?? 16, opts.seg ?? 12), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function add(parent, mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

function makeWindowTexture(base = '#10131d', warm = false) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 7, rows = 14;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = Math.random() < 0.34;
        if (!lit) continue;
        const hue = warm ? pick([34, 42, 190, 326]) : pick([195, 210, 280, 315, 45]);
        ctx.fillStyle = `hsla(${hue}, ${rand(45, 100)}%, ${rand(40, 70)}%, ${rand(0.35, 0.95)})`;
        ctx.fillRect(x * 18 + 3, y * 18 + 3, 11, 10);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * 18, 0); ctx.lineTo(x * 18, h); ctx.stroke(); }
    for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * 18); ctx.lineTo(w, y * 18); ctx.stroke(); }
  });
}

function makeSignTexture(text, color = '#ff2f6d', bg = 'rgba(5,6,14,.92)', vertical = false) {
  const w = vertical ? 256 : 512, h = vertical ? 512 : 160;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (vertical) {
      ctx.font = 'bold 62px Rajdhani, sans-serif';
      const chars = text.split('');
      chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 65 + i * (h - 100) / Math.max(1, chars.length - 1)));
    } else {
      ctx.font = `bold ${Math.min(84, 1200 / text.length)}px Rajdhani, sans-serif`;
      ctx.fillText(text, w / 2, h / 2 + 4);
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 2;
    for (let y = 10; y < h; y += 7) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  });
}

class FighterVisual {
  constructor(def, isEnemy = false, boss = false) {
    this.def = def;
    this.isEnemy = isEnemy;
    this.boss = boss;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.mats = [];
    this.t = Math.random() * 10;
    this.flash = 0;
    this.deadT = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.yaw = null;
    this.weaponProfile = WEAPON_PROFILES[def.weapon] || WEAPON_PROFILES.default;
    this.family = this.weaponProfile.family;
    this.baseScale = boss ? 1.55 : (def.scale || 1);
    this.root.scale.setScalar(this.baseScale);
    this.build();
  }

  mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0.25,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      map: opts.map ?? null, roughnessMap: opts.roughnessMap ?? null,
      envMapIntensity: opts.envMapIntensity ?? 1,
    });
    this.mats.push(m);
    return m;
  }

  mesh(geo, material, x, y, z, parent = this.body) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  build() {
    const c = this.def.colors || { suit: this.def.color || 0x242a3b, accent: this.def.accent || 0xff3d74, skin: this.def.skin || 0xb97856, hair: 0x141218, energy: this.def.accent || 0xff3d74 };
    const accent = c.accent ?? c.color ?? 0xff3d74;
    const energy = c.energy ?? accent;
    this.color = accent;
    this.energy = energy;
    const fabric = fabricTexture();
    const suitMat = this.mat(c.suit ?? 0x202638, { roughness: 0.78, metalness: 0.18, roughnessMap: fabric, envMapIntensity: 0.85 });
    const accentMat = this.mat(accent, { emissive: accent, emissiveIntensity: 1.5, roughness: 0.22, metalness: 0.55, envMapIntensity: 1.2 });
    const skinMat = this.mat(c.skin ?? 0xb97856, { roughness: 0.62, metalness: 0.02, envMapIntensity: 0.7 });
    const hairMat = this.mat(c.hair ?? 0x141218, { roughness: 0.66, metalness: 0.08, envMapIntensity: 0.8 });
    const darkMat = this.mat(0x101118, { roughness: 0.5, metalness: 0.42, envMapIntensity: 1.1 });
    const metalMat = this.mat(0x9aa6b8, { roughness: 0.24, metalness: 0.95, envMapIntensity: 1.5 });
    const glowMat = this.mat(energy, { emissive: energy, emissiveIntensity: 2.4, roughness: 0.2, transparent: true, opacity: 0.92 });
    this.matsForHit = [suitMat, skinMat, hairMat, darkMat];

    // Legs
    this.legL = new THREE.Group(); this.legL.position.set(-0.14, 0.94, 0); this.body.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.14, 0.94, 0); this.body.add(this.legR);
    for (const [g, side] of [[this.legL, -1], [this.legR, 1]]) {
      const thigh = this.mesh(new THREE.CapsuleGeometry(0.098, 0.26, 4, 10), suitMat, 0, -0.21, 0, g);
      thigh.geometry.translate(0, 0, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.42, 0); g.add(knee);
      g.userData.knee = knee;
      this.mesh(new THREE.CapsuleGeometry(0.086, 0.22, 4, 10), darkMat, 0, -0.2, 0, knee);
      this.mesh(new THREE.BoxGeometry(0.2, 0.13, 0.31), darkMat, 0, -0.4, 0.05, knee);
      this.mesh(new THREE.BoxGeometry(0.22, 0.05, 0.22), accentMat, 0, -0.33, 0, knee);
      const stripe = this.mesh(new THREE.BoxGeometry(0.022, 0.28, 0.005), accentMat, side * 0.09, -0.2, 0.1, knee);
      stripe.castShadow = false;
    }

    // Hips & torso
    const hips = this.mesh(new THREE.CapsuleGeometry(0.2, 0.1, 4, 12), darkMat, 0, 0.99, 0);
    hips.scale.set(1.2, 1, 0.72);
    this.mesh(new THREE.BoxGeometry(0.5, 0.06, 0.29), accentMat, 0, 1.09, 0);
    this.torso = new THREE.Group(); this.torso.position.set(0, 1.12, 0); this.body.add(this.torso);
    const chest = this.mesh(new THREE.CapsuleGeometry(0.235, 0.2, 5, 14), suitMat, 0, 0.26, 0, this.torso);
    chest.scale.set(1.16, 1, 0.7);
    this.mesh(new THREE.BoxGeometry(0.42, 0.2, 0.34), darkMat, 0, 0.47, 0.01, this.torso);
    const chestGlow = this.mesh(new THREE.BoxGeometry(0.16, 0.2, 0.012), glowMat, 0, 0.29, 0.168, this.torso);
    chestGlow.castShadow = false;
    this.mesh(new THREE.BoxGeometry(0.6, 0.05, 0.33), accentMat, 0, 0.08, 0, this.torso);
    this.mesh(new THREE.BoxGeometry(0.05, 0.5, 0.335), accentMat, -0.2, 0.26, 0, this.torso);
    this.mesh(new THREE.BoxGeometry(0.05, 0.5, 0.335), accentMat, 0.2, 0.26, 0, this.torso);

    // Head
    this.head = new THREE.Group(); this.head.position.set(0, 0.6, 0); this.torso.add(this.head);
    const skull = this.mesh(new THREE.SphereGeometry(0.152, 16, 12), skinMat, 0, 0.1, 0, this.head);
    skull.scale.set(1, 1.06, 0.95);
    const hair = this.mesh(new THREE.SphereGeometry(0.158, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), hairMat, 0, 0.115, -0.012, this.head);
    hair.scale.set(1, 1.08, 0.98);
    this.mesh(new THREE.BoxGeometry(0.2, 0.055, 0.04), glowMat, 0, 0.09, 0.142, this.head).castShadow = false;
    this.eyeGlow = glowSprite(energy, 0.5, 0.42);
    this.eyeGlow.position.set(0, 0.11, 0.15);
    this.head.add(this.eyeGlow);

    // Character silhouette details
    const id = this.def.id;
    if (id === 'rook') {
      this.mesh(new THREE.BoxGeometry(0.2, 0.2, 0.38), darkMat, -0.35, 0.42, 0, this.torso);
      this.mesh(new THREE.BoxGeometry(0.2, 0.2, 0.38), darkMat, 0.35, 0.42, 0, this.torso);
      this.mesh(new THREE.BoxGeometry(0.3, 0.28, 0.34), darkMat, 0, 0.15, -0.06, this.torso);
    } else if (id === 'vex') {
      // long white coat — it trails the movement
      const coatMat = this.mat(0xe4eaf6, { roughness: 0.52, metalness: 0.14 });
      const lining = this.mat(0x151b2c, { roughness: 0.72, metalness: 0.18 });
      this.coat = new THREE.Group();
      this.torso.add(this.coat);
      this.coat.position.set(0, 0.06, -0.16);
      const back = this.mesh(new THREE.BoxGeometry(0.56, 0.96, 0.09), coatMat, 0, -0.12, -0.04, this.coat);
      back.rotation.x = -0.04;
      const skirt = this.mesh(new THREE.BoxGeometry(0.66, 0.52, 0.1), coatMat, 0, -0.62, -0.08, this.coat);
      skirt.rotation.x = -0.1;
      const skirtLine = this.mesh(new THREE.BoxGeometry(0.68, 0.05, 0.11), lining, 0, -0.86, -0.09, this.coat);
      skirtLine.rotation.x = -0.1;
      for (const sx of [-1, 1]) {
        const panel = this.mesh(new THREE.BoxGeometry(0.15, 0.88, 0.06), coatMat, sx * 0.21, -0.14, 0.08, this.coat);
        panel.rotation.x = 0.04;
      }
      this.mesh(new THREE.BoxGeometry(0.4, 0.1, 0.28), lining, 0, 0.46, -0.01, this.torso);
      this.mesh(new THREE.BoxGeometry(0.07, 0.12, 0.09), accentMat, 0.16, 0.04, 0.17, this.torso);
      // Sparda's sword carried across the back
      const backup = new THREE.Group();
      const bblade = this.mesh(new THREE.BoxGeometry(0.12, 0.07, 0.92), darkMat, 0, 0, 0.34, backup);
      const bedge = this.mesh(new THREE.BoxGeometry(0.125, 0.02, 0.88), glowMat, 0, -0.03, 0.34, backup);
      bedge.castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.09, 0.2, 0.09), lining, 0, 0, -0.16, backup);
      backup.position.set(0.04, 0.14, -0.26);
      backup.rotation.set(0.08, 0, 0.62);
      this.torso.add(backup);
      this.backSword = backup;
    } else if (id === 'sable') {
      this.mesh(new THREE.BoxGeometry(0.62, 0.5, 0.06), accentMat, 0, 0.22, -0.2, this.torso);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.014, 6, 24), glowMat);
      halo.position.set(0, 0.95, -0.05); halo.rotation.x = Math.PI / 2; this.body.add(halo);
      this.halo = halo;
    } else if (id === 'jett') {
      this.mesh(new THREE.BoxGeometry(0.54, 0.07, 0.42), darkMat, 0, 0.53, 0.01, this.torso);
      this.mesh(new THREE.BoxGeometry(0.38, 0.045, 0.4), accentMat, 0, 0.565, 0.01, this.torso);
      this.mesh(new THREE.BoxGeometry(0.09, 0.34, 0.1), darkMat, 0.25, 0.15, 0.1, this.torso);
    } else if (id === 'nyx') {
      this.hood = this.mesh(new THREE.ConeGeometry(0.3, 0.48, 6, 1, true), darkMat, 0, 0.2, -0.03, this.head);
      this.mesh(new THREE.BoxGeometry(0.62, 0.78, 0.07), darkMat, 0, 0.1, -0.2, this.torso);
      this.mesh(new THREE.BoxGeometry(0.08, 0.56, 0.34), accentMat, 0.31, 0.26, 0, this.torso);
    } else if (id === 'grimm') {
      this.mesh(new THREE.BoxGeometry(0.26, 0.2, 0.42), metalMat, -0.39, 0.45, 0, this.torso);
      this.mesh(new THREE.BoxGeometry(0.26, 0.2, 0.42), metalMat, 0.39, 0.45, 0, this.torso);
      this.mesh(new THREE.BoxGeometry(0.28, 0.38, 0.36), darkMat, 0, 0.06, -0.02, this.torso);
      this.mesh(new THREE.BoxGeometry(0.12, 0.18, 0.06), accentMat, 0, 0.3, 0.18, this.torso);
    } else if (id === 'kira') {
      const scarf = this.mesh(new THREE.BoxGeometry(0.16, 0.66, 0.06), accentMat, -0.16, 0.22, -0.22, this.torso);
      scarf.rotation.z = 0.3;
      this.mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), darkMat, 0, 0.14, 0.02, this.torso);
    } else if (id === 'ash') {
      this.mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), glowMat, -0.32, 0.14, 0.18, this.torso).castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), glowMat, 0.32, 0.14, 0.18, this.torso).castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.12, 0.46, 0.06), darkMat, 0, 0.24, -0.2, this.torso);
    } else if (id === 'volt') {
      this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), accentMat, -0.09, 0.36, 0, this.head);
      this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 5), accentMat, 0.08, 0.34, 0, this.head);
      this.mesh(new THREE.BoxGeometry(0.66, 0.16, 0.1), darkMat, 0, 0.44, -0.13, this.torso);
    } else if (id === 'mara') {
      const horn1 = this.mesh(new THREE.ConeGeometry(0.05, 0.3, 5), accentMat, -0.13, 0.3, 0, this.head);
      horn1.rotation.z = 0.35;
      const horn2 = this.mesh(new THREE.ConeGeometry(0.05, 0.3, 5), accentMat, 0.13, 0.3, 0, this.head);
      horn2.rotation.z = -0.35;
      this.mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05), darkMat, 0, 0.1, -0.21, this.torso);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 5, 16), glowMat);
      crown.position.set(0, 0.94, 0); crown.rotation.x = Math.PI / 2; this.body.add(crown);
    }

    // Arms
    this.armL = new THREE.Group(); this.armL.position.set(-0.36, 0.45, 0); this.torso.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.36, 0.45, 0); this.torso.add(this.armR);
    for (const [g, side, isRight] of [[this.armL, -1, false], [this.armR, 1, true]]) {
      this.mesh(new THREE.CapsuleGeometry(0.082, 0.2, 4, 10), suitMat, 0, -0.17, 0, g);
      this.mesh(new THREE.CapsuleGeometry(0.092, 0.02, 3, 10), accentMat, 0, -0.33, 0, g);
      const elbow = new THREE.Group(); elbow.position.set(0, -0.34, 0); g.add(elbow);
      g.userData.elbow = elbow;
      this.mesh(new THREE.CapsuleGeometry(0.068, 0.17, 4, 10), skinMat, 0, -0.15, 0, elbow);
      const hand = this.mesh(new THREE.BoxGeometry(0.15, 0.15, 0.17), darkMat, 0, -0.32, 0, elbow);
      if (id === 'rook') {
        this.mesh(new THREE.BoxGeometry(0.23, 0.2, 0.26), metalMat, 0, -0.34, 0.03, elbow);
        this.mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), glowMat, 0, -0.36, 0.16, elbow).castShadow = false;
      }
      if (isRight) this.hand = hand; else this.handL = hand;
    }

    // Weapon
    this.weapon = new THREE.Group();
    this.hand.add(this.weapon);
    this.weapon.position.set(0, -0.1, 0.06);
    this.buildWeapon(id, { accentMat, glowMat, metalMat, darkMat, energy });

    // Secondary weapon (revolver) carried in the off hand
    this.secondaryGun = !!this.def.gun;
    if (this.secondaryGun && this.handL) {
      this.weapon2 = new THREE.Group();
      this.handL.add(this.weapon2);
      this.weapon2.position.set(0, -0.1, 0.06);
      this.buildSecondaryWeapon({ accentMat, glowMat, metalMat, darkMat, energy });
      this.weapon2.visible = false;
    }

    // Contact shadow keeps the fighter planted on the street
    this.contact = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 22),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })
    );
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = 0.03;
    this.contact.renderOrder = -1;
    this.root.add(this.contact);

    // Glow aura at feet
    this.footGlow = glowSprite(energy, 1.3, 0.18);
    this.footGlow.position.y = 0.04;
    this.root.add(this.footGlow);

    // Rev aura (Devil Trigger)
    this.revAura = glowSprite(energy, 1.6, 0.35);
    this.revAura.position.y = 1.05;
    this.revAura.visible = false;
    this.root.add(this.revAura);

    this.body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  buildSecondaryWeapon({ accentMat, glowMat, metalMat, darkMat }) {
    const w = this.weapon2;
    this.mesh(new THREE.BoxGeometry(0.042, 0.046, 0.36), darkMat, 0, 0.015, 0.16, w);
    this.mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), metalMat, 0, 0.015, 0.33, w);
    const cyl = this.mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 8), metalMat, 0, 0, 0.01, w);
    cyl.rotation.z = Math.PI / 2;
    this.mesh(new THREE.BoxGeometry(0.05, 0.026, 0.14), accentMat, 0, 0.045, 0.09, w);
    const grip = this.mesh(new THREE.BoxGeometry(0.048, 0.14, 0.08), darkMat, 0, -0.08, -0.05, w);
    grip.rotation.x = -0.26;
    this.mesh(new THREE.BoxGeometry(0.026, 0.03, 0.03), glowMat, 0, 0.04, 0.34, w).castShadow = false;
    this.muzzle2 = new THREE.Object3D();
    this.muzzle2.position.set(0, 0.015, 0.36);
    w.add(this.muzzle2);
  }

  buildWeapon(id, { accentMat, glowMat, metalMat, darkMat, energy }) {
    const w = this.weapon;
    if (id === 'vex') {
      // YAMATO — a long tachi with a wrapped hilt and a round tsuba
      const white = this.mat(0xe9eef8, { roughness: 0.48, metalness: 0.12 });
      const blade = this.mesh(new THREE.BoxGeometry(0.045, 0.085, 1.55), metalMat, 0, 0, 0.72, w);
      const edge = this.mesh(new THREE.BoxGeometry(0.012, 0.095, 1.5), glowMat, 0.031, 0, 0.74, w);
      edge.castShadow = false;
      const ridge = this.mesh(new THREE.BoxGeometry(0.014, 0.03, 1.45), accentMat, -0.03, 0.03, 0.74, w);
      ridge.castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.062, 0.22, 0.055), white, 0, 0, 0.02, w);
      this.mesh(new THREE.BoxGeometry(0.07, 0.03, 0.06), darkMat, 0, 0.09, 0.02, w);
      const tsuba = this.mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.028, 12), metalMat, 0, 0, -0.1, w);
      tsuba.rotation.x = Math.PI / 2;
      this.muzzleTip = new THREE.Object3D();
      this.muzzleTip.position.set(0, 0, 1.5);
      w.add(this.muzzleTip);
    } else if (id === 'sable') {
      // NEON EDGE — a red-hot katana
      const blade = this.mesh(new THREE.BoxGeometry(0.05, 0.1, 1.35), metalMat, 0, 0, 0.62, w);
      const edge = this.mesh(new THREE.BoxGeometry(0.016, 0.11, 1.3), glowMat, 0.032, 0, 0.64, w);
      edge.castShadow = false;
      const edge2 = this.mesh(new THREE.BoxGeometry(0.016, 0.06, 1.28), accentMat, -0.032, 0, 0.64, w);
      edge2.castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.09, 0.24, 0.06), darkMat, 0, 0, 0.02, w);
      this.mesh(new THREE.BoxGeometry(0.24, 0.045, 0.07), accentMat, 0, 0, -0.01, w);
      this.muzzleTip = new THREE.Object3D();
      this.muzzleTip.position.set(0, 0, 1.3);
      w.add(this.muzzleTip);
    } else if (id === 'jett') {
      // Desert Eagle: long slide, heavy barrel, gold furniture
      this.mesh(new THREE.BoxGeometry(0.075, 0.11, 0.4), metalMat, 0, 0.02, 0.14, w);
      this.mesh(new THREE.BoxGeometry(0.085, 0.085, 0.46), darkMat, 0, 0.09, 0.16, w);
      this.mesh(new THREE.BoxGeometry(0.06, 0.02, 0.44), accentMat, 0, 0.135, 0.16, w);
      const barrel = this.mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 8), metalMat, 0, 0.09, 0.42, w);
      barrel.rotation.x = Math.PI / 2;
      const grip = this.mesh(new THREE.BoxGeometry(0.065, 0.18, 0.1), darkMat, 0, -0.1, -0.02, w);
      grip.rotation.x = -0.3;
      this.mesh(new THREE.BoxGeometry(0.03, 0.045, 0.05), accentMat, 0, 0.16, 0.33, w);
      this.mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), accentMat, 0, 0.16, -0.02, w);
      this.mesh(new THREE.BoxGeometry(0.09, 0.035, 0.1), metalMat, 0, -0.03, 0.02, w);
      this.muzzleTip = new THREE.Object3D();
      this.muzzleTip.position.set(0, 0.09, 0.5);
      w.add(this.muzzleTip);
    } else if (id === 'nyx') {
      const shaft = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6), metalMat, 0, 0, 0.55, w);
      shaft.rotation.x = Math.PI / 2;
      const curved = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.032, 5, 18, Math.PI * 0.9), metalMat);
      curved.position.set(0, 0.1, 1.43); curved.rotation.set(0, Math.PI / 2, Math.PI * 0.72); w.add(curved);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.01, 4, 18, Math.PI * 0.9), glowMat);
      edge.position.copy(curved.position); edge.rotation.copy(curved.rotation); w.add(edge);
      this.mesh(new THREE.ConeGeometry(0.06, 0.55, 5), glowMat, 0, -0.34, 1.8, w).rotation.x = -0.4;
    } else if (id === 'grimm') {
      const shaft = this.mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.55, 7), darkMat, 0, 0, 0.5, w);
      shaft.rotation.x = Math.PI / 2;
      this.mesh(new THREE.BoxGeometry(0.5, 0.36, 0.5), metalMat, 0, 0, 1.32, w);
      this.mesh(new THREE.BoxGeometry(0.53, 0.07, 0.53), accentMat, 0, 0, 1.32, w);
      this.mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), glowMat, 0, 0, 1.32, w).castShadow = false;
    } else if (id === 'kira') {
      const d1 = this.mesh(new THREE.BoxGeometry(0.028, 0.09, 0.46), metalMat, 0, 0.02, 0.22, w);
      d1.rotation.x = 0.1;
      const d2 = this.mesh(new THREE.BoxGeometry(0.028, 0.09, 0.46), metalMat, 0, -0.1, 0.18, w);
      d2.rotation.x = -0.15;
      this.mesh(new THREE.BoxGeometry(0.012, 0.1, 0.44), glowMat, 0, 0.02, 0.24, w).castShadow = false;
    } else if (id === 'rook') {
      const knuckle = this.mesh(new THREE.BoxGeometry(0.2, 0.17, 0.24), metalMat, 0, -0.02, 0.08, w);
      knuckle.rotation.x = -0.12;
      this.mesh(new THREE.BoxGeometry(0.205, 0.045, 0.08), glowMat, 0, -0.04, 0.2, w).castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.08, 0.06, 0.26), accentMat, 0, 0.08, 0.08, w);
    } else if (id === 'ash') {
      this.mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22), darkMat, 0, 0, 0.06, w);
      const flame = glowSprite(0xff5a1a, 0.65, 0.75);
      flame.position.set(0, 0, 0.18); w.add(flame);
    } else if (id === 'volt') {
      const shaft = this.mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.75, 7), darkMat, 0, 0, 0.65, w);
      shaft.rotation.x = Math.PI / 2;
      this.mesh(new THREE.OctahedronGeometry(0.13, 0), accentMat, 0, 0, 1.56, w);
      this.mesh(new THREE.OctahedronGeometry(0.06, 0), glowMat, 0, 0, 1.56, w).castShadow = false;
    } else if (id === 'mara') {
      const blade = this.mesh(new THREE.BoxGeometry(0.05, 0.18, 1.25), darkMat, 0, 0, 0.56, w);
      blade.rotation.x = 0.04;
      this.mesh(new THREE.BoxGeometry(0.012, 0.2, 1.2), glowMat, 0, 0, 0.58, w).castShadow = false;
      this.mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), accentMat, 0, 0, 0.02, w);
      const wing = this.mesh(new THREE.ConeGeometry(0.09, 0.55, 4), accentMat, 0, -0.18, 0.32, w);
      wing.rotation.x = 0.8;
    } else {
      this.mesh(new THREE.BoxGeometry(0.12, 0.12, 0.2), darkMat, 0, 0, 0.05, w);
    }
  }

  update(dt, state, time) {
    this.t += dt;
    const t = this.t + time * 0.2;
    const p = state.actionProgress || 0;
    const act = state.action || 'none';
    const moving = state.moving;
    const spd = state.speed || 0;
    const y = state.y || 0;
    const launched = state.launched ? (state.launchedT || 0) : 0;
    const dead = state.dead;
    const family = this.family;
    const stage = state.stage || 0;
    const prev = {
      bodyY: this.body.position.y, bodyX: this.body.rotation.x, bodyZ: this.body.rotation.z,
      bodyZPos: this.body.position.z,
      torsoX: this.torso.rotation.x, torsoY: this.torso.rotation.y, torsoZ: this.torso.rotation.z,
      headX: this.head.rotation.x, headY: this.head.rotation.y, headZ: this.head.rotation.z,
      armLX: this.armL.rotation.x, armLY: this.armL.rotation.y, armLZ: this.armL.rotation.z,
      armRX: this.armR.rotation.x, armRY: this.armR.rotation.y, armRZ: this.armR.rotation.z,
      elbowLX: this.armL.userData.elbow.rotation.x, elbowRX: this.armR.userData.elbow.rotation.x,
      legLX: this.legL.rotation.x, legLZ: this.legL.rotation.z,
      legRX: this.legR.rotation.x, legRZ: this.legR.rotation.z,
      kneeLX: this.legL.userData.knee.rotation.x, kneeRX: this.legR.userData.knee.rotation.x,
      weaponX: this.weapon.rotation.x, weaponY: this.weapon.rotation.y, weaponZ: this.weapon.rotation.z,
    };
    this.weapon.visible = true;

    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.legL.userData.knee.rotation.set(0, 0, 0);
    this.legR.userData.knee.rotation.set(0, 0, 0);
    this.armL.userData.elbow.rotation.set(0, 0, 0);
    this.armR.userData.elbow.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.weapon.rotation.set(0, 0, 0);

    const bob = Math.sin(t * 2.1) * 0.012;
    const rev = !!state.rev;

    if (this.secondaryGun && this.weapon2) {
      this.weapon2.visible = act === 'shot' || rev;
      if (this.weapon2.visible && act !== 'shot') {
        this.weapon2.rotation.set(0.5, 0, 0.25);
      } else {
        this.weapon2.rotation.set(0, 0, 0);
      }
    }
    if (this.revAura) {
      this.revAura.visible = rev;
      if (rev) {
        this.revAura.material.opacity = 0.32 + Math.sin(t * 9) * 0.1;
        this.revAura.scale.setScalar(1.5 + Math.sin(t * 7) * 0.12);
        this.revAura.rotation.y += dt * 2.4;
      }
    }

    if (dead) {
      this.deadT += dt;
      this.body.rotation.z = Math.min(1.5, this.deadT * 4.2);
      this.body.position.y = -Math.min(0.65, this.deadT * 0.5);
      this.root.traverse(o => {
        if (o.isMesh && o.material && 'opacity' in o.material) {
          if (!o.material.userData.wasTransparent) { o.material.transparent = true; o.material.userData.wasTransparent = true; o.material.userData.baseOpacity = o.material.opacity; }
          o.material.opacity = Math.max(0, (o.material.userData.baseOpacity ?? 1) * (1 - this.deadT / 1.0));
        }
      });
    } else {
      this.body.position.y = bob;
      if (launched) {
        this.body.rotation.z = launched * 7;
        this.body.rotation.x = launched * 2;
        this.armL.rotation.z = -1.4;
        this.armR.rotation.z = 1.4;
        this.legL.rotation.z = 0.5;
        this.legR.rotation.z = -0.5;
      } else if (moving && y < 0.15) {
        const gait = Math.max(0, Math.min(1.35, spd > 0.05 ? spd / 5.5 : 0.82));
        if (this.coat) {
          this.coat.rotation.z = Math.sin(this.walkPhase || 0) * 0.09 * gait;
          this.coat.rotation.x = -0.05 - gait * 0.12;
          this.coat.position.z = -0.16 - gait * 0.05;
        }
        if (this.backSword) this.backSword.rotation.z = 0.62 + Math.sin(this.walkPhase || 0) * 0.05 * gait;
        this.walkPhase += dt * (5.2 + gait * 4.2) * (state.backward ? -1 : 1);
        const ph = this.walkPhase;
        const swing = Math.sin(ph) * (0.38 + gait * 0.42);
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
        this.legL.userData.knee.rotation.x = 0.16 + Math.max(0, -Math.sin(ph)) * (0.45 + gait * 0.35);
        this.legR.userData.knee.rotation.x = 0.16 + Math.max(0, Math.sin(ph)) * (0.45 + gait * 0.35);
        this.armL.rotation.x = -swing * 0.7;
        this.armR.rotation.x = swing * 0.55;
        this.armL.userData.elbow.rotation.x = 0.24 + Math.max(0, -swing) * 0.22;
        this.armR.userData.elbow.rotation.x = 0.2 + Math.max(0, swing) * 0.2;
        this.torso.rotation.x = 0.055 + gait * 0.075;
        this.torso.rotation.y = -Math.sin(ph) * 0.055 * gait;
        this.head.rotation.y = Math.sin(ph) * 0.025 * gait;
        this.body.rotation.z = Math.sin(ph) * 0.018 * gait;
        this.body.position.z = gait * 0.03;
        this.body.position.y += Math.abs(Math.sin(ph)) * (0.018 + gait * 0.022);
      } else {
        this.armL.rotation.x = Math.sin(t * 1.7) * 0.05;
        this.armR.rotation.x = Math.sin(t * 1.7 + 1) * 0.04;
        this.armL.rotation.z = 0.05;
        this.armR.rotation.z = -0.05;
        this.armL.userData.elbow.rotation.x = 0.22;
        this.armR.userData.elbow.rotation.x = 0.28;
        this.torso.rotation.y = Math.sin(t * 0.65) * 0.018;
        this.head.rotation.y = Math.sin(t * 0.5 + 0.7) * 0.035;
        this.body.rotation.z = Math.sin(t * 0.8) * 0.007;
        if (y > 0.15) {
          this.legL.rotation.x = -0.35; this.legR.rotation.x = 0.25;
          this.legL.userData.knee.rotation.x = 0.7; this.legR.userData.knee.rotation.x = 0.4;
          this.armL.rotation.x = -0.5; this.armR.rotation.x = -0.25;
        }
      }
      if (launched) {
        this.body.position.y = bob + y;
      } else {
        this.body.position.y = bob;
        this.root.position.y = y;
      }
    }

    if (!dead && act !== 'light' && act !== 'heavy' && act !== 'launch' && act !== 'special' && act !== 'shot' && act !== 'dodge') {
      if (family === 'blade') this.weapon.rotation.x = -0.14;
      else if (family === 'dagger') this.weapon.rotation.x = -0.08;
      else if (family === 'tonfa') this.weapon.rotation.z = 0.16;
      else if (family === 'gun') {
        this.weapon.rotation.x = 0.16;
        this.weapon.rotation.z = 0.04;
        this.armR.rotation.x = Math.min(this.armR.rotation.x, -0.1);
        this.armR.userData.elbow.rotation.x = Math.max(this.armR.userData.elbow.rotation.x, 0.4);
      }
      else if (family === 'pole') {
        this.weapon.rotation.x = 0.02;
        this.weapon.rotation.z = 0.08 + Math.sin(t * 1.4) * 0.025;
      } else if (family === 'hammer') {
        this.weapon.rotation.x = 0.24;
        this.weapon.rotation.z = Math.sin(t * 1.2) * 0.02;
      }
      if ((family === 'pole' || family === 'hammer') && !launched) {
        this.armL.rotation.x = Math.min(this.armL.rotation.x, -0.48);
        this.armL.userData.elbow.rotation.x = Math.max(this.armL.userData.elbow.rotation.x, 0.72);
      }
    }

    if (act === 'light' || act === 'heavy' || act === 'launch' || act === 'special') {
      const wind = 0.25 + 0.75 * Math.sin(Math.min(1, p / 0.22) * Math.PI * 0.5);
      const s = Math.sin(Math.min(1, p / 0.58) * Math.PI) * wind;
      const finisher = act === 'light' && stage === 3;
      const dir = stage % 2 === 0 ? 1 : -1;

      this.legL.rotation.x = -0.16 - s * 0.24;
      this.legR.rotation.x = 0.18 + s * 0.22;
      this.legL.userData.knee.rotation.x = 0.14 + s * 0.12;
      this.legR.userData.knee.rotation.x = 0.1 + s * 0.15;
      this.head.rotation.y = -s * 0.12;

      if (family === 'blunt' || family === 'tonfa') {
        this.armL.rotation.z = 0.12;
        this.armR.rotation.z = -0.12;
        if (act === 'heavy') {
          this.armL.rotation.x = -2.55 * s;
          this.armR.rotation.x = -2.55 * s;
          this.armL.userData.elbow.rotation.x = 0.15 + s * 0.45;
          this.armR.userData.elbow.rotation.x = 0.15 + s * 0.45;
          this.torso.rotation.x = -0.28 + s * 0.68;
          this.head.rotation.x = -0.08 + s * 0.2;
        } else if (act === 'launch') {
          this.armR.rotation.x = -2.75 * s;
          this.armR.rotation.z = -0.3 - s * 0.2;
          this.armL.rotation.x = -1.15 * s;
          this.armL.userData.elbow.rotation.x = 0.5;
          this.torso.rotation.x = 0.12 + s * 0.32;
          this.torso.rotation.y = -0.12 * dir;
        } else if (stage === 1) {
          this.armL.rotation.x = -1.85 * s;
          this.armL.rotation.z = 0.22 + s * 0.35;
          this.armL.userData.elbow.rotation.x = 0.65 + s * 0.25;
          this.armR.rotation.x = -0.9;
          this.armR.userData.elbow.rotation.x = 0.7;
          this.torso.rotation.y = 0.48 * s;
          this.torso.rotation.x = s * 0.12;
        } else if (stage === 2) {
          this.armR.rotation.x = -2.45 * s;
          this.armR.rotation.z = -0.18 - s * 0.18;
          this.armR.userData.elbow.rotation.x = 0.55 + s * 0.25;
          this.armL.rotation.x = -0.85;
          this.armL.userData.elbow.rotation.x = 0.75;
          this.torso.rotation.x = 0.18 + s * 0.22;
          this.torso.rotation.y = -0.3 * s;
        } else if (stage === 3) {
          this.armR.rotation.x = -2.2 * s;
          this.armR.rotation.z = -0.35;
          this.armL.rotation.x = -1.95 * s;
          this.armL.rotation.z = 0.35;
          this.torso.rotation.y = 0.72 * s;
          this.torso.rotation.x = s * 0.18;
          this.legR.rotation.x = 0.5 * s;
        } else {
          this.armR.rotation.x = -1.95 * s;
          this.armR.rotation.z = -0.08 - s * 0.1;
          this.armR.userData.elbow.rotation.x = 0.28 + s * 0.36;
          this.armL.rotation.x = -0.95;
          this.armL.rotation.z = 0.2;
          this.armL.userData.elbow.rotation.x = 0.8;
          this.torso.rotation.y = -0.4 * s;
          this.torso.rotation.x = s * 0.14;
        }
        if (family === 'tonfa') {
          this.weapon.rotation.x = -0.3 - s * 1.1;
          this.weapon.rotation.z = (stage % 2 ? -1 : 1) * (0.25 + s * 0.55);
        }
      } else if (family === 'blade') {
        this.armL.rotation.x = -0.55;
        this.armL.rotation.z = 0.42;
        this.armL.userData.elbow.rotation.x = 0.75;
        if (act === 'heavy') {
          this.armR.rotation.x = -2.85 + s * 3.2;
          this.armR.rotation.z = -0.38;
          this.armL.rotation.x = -2.5 + s * 2.15;
          this.armL.rotation.z = 0.36;
          this.armL.userData.elbow.rotation.x = 0.35 + (1 - s) * 0.55;
          this.armR.userData.elbow.rotation.x = 0.35 + (1 - s) * 0.5;
          this.torso.rotation.x = -0.38 + s * 0.85;
          this.torso.rotation.y = 0.28 - s * 0.52;
          this.weapon.rotation.x = -0.75 + s * 1.35;
          this.weapon.rotation.z = -0.16;
        } else if (act === 'launch') {
          this.armR.rotation.x = -2.65 * s;
          this.armR.rotation.z = -0.55;
          this.armL.rotation.x = -2.15 * s;
          this.torso.rotation.x = 0.2 + s * 0.16;
          this.torso.rotation.y = -0.42 * s;
          this.weapon.rotation.x = -0.35;
          this.weapon.rotation.z = 0.65 * s;
        } else if (act === 'special') {
          this.armR.rotation.x = -1.3 - s * 0.35;
          this.armR.rotation.z = -0.85 + s * 1.5;
          this.armL.rotation.x = -1.5;
          this.armL.rotation.z = 0.55;
          this.torso.rotation.y = -0.85 + s * 1.35;
          this.weapon.rotation.y = -1.25 + s * 2.3;
          this.weapon.rotation.z = 0.3;
        } else if (stage === 1) {
          this.armR.rotation.x = -1.28 - s * 0.2;
          this.armR.rotation.z = 0.9 - s * 1.8;
          this.armR.userData.elbow.rotation.x = 0.4 + s * 0.25;
          this.torso.rotation.y = -0.58 * s;
          this.weapon.rotation.y = 0.85 - s * 1.7;
          this.weapon.rotation.z = -0.42;
        } else if (stage === 2) {
          this.armR.rotation.x = -0.75 - s * 1.65;
          this.armR.rotation.z = -0.42;
          this.armR.userData.elbow.rotation.x = 0.25 + s * 0.35;
          this.torso.rotation.x = 0.22;
          this.torso.rotation.y = 0.26 * s;
          this.weapon.rotation.x = 0.5 - s * 1.05;
          this.weapon.rotation.z = -0.18;
        } else if (stage === 3) {
          if (state.blink) {
            // BLINK-THROUGH: a committed forward cut
            this.armR.rotation.x = -1.5 - s * 0.35;
            this.armR.rotation.z = -0.2;
            this.armR.userData.elbow.rotation.x = 0.1;
            this.armL.rotation.x = -0.9;
            this.armL.rotation.z = 0.55;
            this.armL.userData.elbow.rotation.x = 0.7;
            this.torso.rotation.x = 0.16 + s * 0.2;
            this.torso.rotation.y = -0.34 * s;
            this.head.rotation.x = 0.1;
            this.legL.rotation.x = -0.4 - s * 0.3;
            this.legR.rotation.x = 0.45 + s * 0.35;
            this.weapon.rotation.y = -0.2;
            this.weapon.rotation.z = 0.1;
            this.body.rotation.z = -0.05 * s;
          } else {
            this.armR.rotation.x = -1.65;
            this.armR.rotation.z = -0.28;
            this.armL.rotation.x = -1.45;
            this.torso.rotation.y = 1.1 * s * dir;
            this.weapon.rotation.y = -1.05 + s * 2.45;
            this.weapon.rotation.z = 0.22;
          }
        } else {
          this.armR.rotation.x = -2.2 + s * 1.45;
          this.armR.rotation.z = -0.72 + s * 0.5;
          this.armR.userData.elbow.rotation.x = 0.3 + s * 0.3;
          this.torso.rotation.y = 0.45 * s;
          this.weapon.rotation.x = -0.2;
          this.weapon.rotation.z = 0.8 - s * 0.4;
        }
      } else if (family === 'dagger') {
        if (act === 'heavy') {
          this.armR.rotation.x = -1.35;
          this.armR.rotation.z = -0.95 + s * 1.9;
          this.armL.rotation.x = -1.35;
          this.armL.rotation.z = 0.95 - s * 1.9;
          this.torso.rotation.y = -0.7 + s * 1.4;
          this.weapon.rotation.z = -0.8 + s * 1.6;
        } else if (act === 'launch') {
          this.armR.rotation.x = -2.5 * s;
          this.armL.rotation.x = -2.3 * s;
          this.armR.rotation.z = -0.25;
          this.armL.rotation.z = 0.25;
          this.torso.rotation.x = 0.2;
          this.weapon.rotation.z = 0.45 * s;
        } else if (act === 'special') {
          this.armR.rotation.x = -1.5;
          this.armL.rotation.x = -1.5;
          this.armR.rotation.z = -0.7 + s * 1.4;
          this.armL.rotation.z = 0.7 - s * 1.4;
          this.torso.rotation.y = 1.25 * s * dir;
          this.weapon.rotation.y = -1.1 + s * 2.2;
        } else if (stage === 0) {
          this.armR.rotation.x = -1.2 - s * 0.25;
          this.armR.rotation.z = 0.75 - s * 1.5;
          this.armR.userData.elbow.rotation.x = 0.18 + s * 0.2;
          this.armL.rotation.x = -0.72;
          this.armL.rotation.z = 0.28;
          this.armL.userData.elbow.rotation.x = 0.72;
          this.torso.rotation.y = -0.52 * s;
          this.torso.rotation.x = s * 0.08;
          this.head.rotation.y = 0.12 * s;
          this.weapon.rotation.x = -0.25;
          this.weapon.rotation.z = -0.55 + s * 1.1;
          this.legR.rotation.x = 0.15 * s;
        } else if (stage === 1) {
          this.armL.rotation.x = -1.25 - s * 0.3;
          this.armL.rotation.z = -0.7 + s * 1.45;
          this.armL.userData.elbow.rotation.x = 0.2 + s * 0.15;
          this.armR.rotation.x = -0.65;
          this.armR.rotation.z = -0.22;
          this.armR.userData.elbow.rotation.x = 0.7;
          this.torso.rotation.y = 0.55 * s;
          this.torso.rotation.x = s * 0.06;
          this.head.rotation.y = -0.12 * s;
          this.weapon.rotation.x = -0.1;
          this.weapon.rotation.z = 0.5 - s * 1.0;
          this.legL.rotation.x = -0.1 + s * 0.2;
        } else if (stage === 2) {
          this.armR.rotation.x = -1.35 - s * 0.15;
          this.armR.rotation.z = -0.12;
          this.armR.userData.elbow.rotation.x = 0.05 + s * 0.1;
          this.armL.rotation.x = -1.3 - s * 0.12;
          this.armL.rotation.z = 0.12;
          this.armL.userData.elbow.rotation.x = 0.05 + s * 0.1;
          this.torso.rotation.x = 0.08 + s * 0.16;
          this.torso.rotation.y = -0.16 * s;
          this.weapon.rotation.x = -0.15;
          this.body.position.z = s * 0.09;
          this.legL.rotation.x = -0.24 - s * 0.2;
          this.legR.rotation.x = 0.26 + s * 0.25;
        } else {
          this.armR.rotation.x = -1.1 - s * 0.3;
          this.armR.rotation.z = -0.85 + s * 1.7;
          this.armR.userData.elbow.rotation.x = 0.15 + s * 0.25;
          this.armL.rotation.x = -1.25;
          this.armL.rotation.z = 0.75;
          this.armL.userData.elbow.rotation.x = 0.55;
          this.torso.rotation.y = -0.95 + s * 1.9;
          this.torso.rotation.x = 0.06 + s * 0.1;
          this.head.rotation.y = 0.16 * s;
          this.weapon.rotation.y = -0.9 + s * 1.8;
          this.weapon.rotation.z = 0.15;
          this.legR.rotation.x = 0.5 * s;
          this.legR.rotation.z = -0.16 * s;
          this.body.position.z = s * 0.04;
        }
      } else if (family === 'pole') {
        const sweep = dir * (s * 1.2);
        this.armR.rotation.x = -1.25;
        this.armR.rotation.z = -0.62;
        this.armL.rotation.x = -1.15;
        this.armL.rotation.z = 0.58;
        this.armR.userData.elbow.rotation.x = 0.25;
        this.armL.userData.elbow.rotation.x = 0.55;
        if (act === 'heavy') {
          this.torso.rotation.y = -1.15 + s * 2.25;
          this.armR.rotation.x = -1.55;
          this.armL.rotation.x = -1.45;
          this.weapon.rotation.y = -1.75 + s * 3.35;
          this.weapon.rotation.z = 0.18;
          this.legR.rotation.x = 0.42 * s;
        } else if (act === 'launch') {
          this.armR.rotation.x = -2.35 * s;
          this.armL.rotation.x = -2.0 * s;
          this.torso.rotation.x = 0.18 + s * 0.22;
          this.torso.rotation.y = sweep * 0.55;
          this.weapon.rotation.x = -0.8 * s;
          this.weapon.rotation.y = 0.45 * s;
        } else if (act === 'special') {
          this.torso.rotation.y = -1.4 + s * 2.8;
          this.weapon.rotation.y = -1.85 + s * 3.6;
          this.weapon.rotation.z = 0.3;
        } else if (stage === 0) {
          this.armR.rotation.x = -1.34;
          this.armR.rotation.z = -0.42;
          this.armL.rotation.x = -1.28;
          this.armL.rotation.z = 0.38;
          this.armR.userData.elbow.rotation.x = 0.12;
          this.armL.userData.elbow.rotation.x = 0.24;
          this.torso.rotation.x = 0.04 + s * 0.14;
          this.torso.rotation.y = -0.12 * s;
          this.weapon.rotation.x = -0.06 - s * 0.28;
          this.weapon.rotation.y = 0.08 * s;
          this.weapon.rotation.z = 0.06;
          this.body.position.z = s * 0.1;
          this.legL.rotation.x = -0.28 * s;
          this.legR.rotation.x = 0.42 * s;
        } else if (stage === 1) {
          this.armR.rotation.x = -1.18;
          this.armR.rotation.z = -0.55;
          this.armL.rotation.x = -1.1;
          this.armL.rotation.z = 0.52;
          this.torso.rotation.y = -1.0 + s * 2.0;
          this.torso.rotation.x = 0.08 + s * 0.1;
          this.weapon.rotation.y = -1.45 + s * 2.9;
          this.weapon.rotation.z = 0.18;
          this.weapon.rotation.x = -0.12;
          this.body.position.y -= s * 0.04;
          this.legR.rotation.x = 0.28 * s;
          this.legR.rotation.z = -0.18 * s;
        } else if (stage === 2) {
          this.armR.rotation.x = -1.9 * s;
          this.armL.rotation.x = -1.55 * s;
          this.armR.rotation.z = -0.45;
          this.armL.rotation.z = 0.42;
          this.torso.rotation.x = 0.14 + s * 0.12;
          this.torso.rotation.y = 0.4 * s;
          this.weapon.rotation.x = -0.75 * s;
          this.weapon.rotation.y = -0.35 + s * 0.7;
          this.weapon.rotation.z = -0.3 * s;
          this.legL.rotation.x = -0.5 * s;
          this.head.rotation.y = -0.1 * s;
        } else {
          this.torso.rotation.y = -1.5 + s * 3.0;
          this.torso.rotation.x = 0.06 + s * 0.08;
          this.armR.rotation.x = -1.35;
          this.armL.rotation.x = -1.2;
          this.weapon.rotation.y = -1.65 + s * 3.3;
          this.weapon.rotation.z = 0.28;
          this.weapon.rotation.x = -0.05;
          this.legR.rotation.x = 0.55 * s;
          this.legR.rotation.z = -0.2 * s;
          this.body.rotation.z = -s * 0.06 * dir;
          this.head.rotation.y = -0.18 * s;
        }
      } else if (family === 'gun') {
        // Adam-style: the legs do the damage, the gun hand stays out for balance
        this.armR.rotation.x = 0.35;
        this.armR.rotation.z = -0.55;
        this.armR.userData.elbow.rotation.x = 0.55;
        this.armL.rotation.z = 0.32;
        this.armL.userData.elbow.rotation.x = 0.45;
        this.weapon.rotation.x = 0.12;
        if (act === 'heavy') {
          // AXE KICK — drops a body onto the floor
          this.legR.rotation.x = -0.35 - s * 2.05;
          this.legR.userData.knee.rotation.x = 0.1;
          this.legL.rotation.x = 0.2 + s * 0.45;
          this.legL.userData.knee.rotation.x = 0.25 + s * 0.3;
          this.body.position.y += s * 0.26;
          this.torso.rotation.x = -0.24 + s * 0.5;
          this.torso.rotation.y = -0.3 * s;
          this.armL.rotation.x = -1.3 * s;
          this.head.rotation.x = -0.2 * s;
        } else if (stage === 0) {
          // FRONT KICK — quick snap kick
          this.legR.rotation.x = -0.25 - s * 1.3;
          this.legR.userData.knee.rotation.x = 0.35 + (1 - s) * 0.45;
          this.legL.rotation.x = 0.12;
          this.legL.userData.knee.rotation.x = 0.2;
          this.torso.rotation.x = 0.04 + s * 0.14;
          this.torso.rotation.y = -0.26 * s;
          this.armL.rotation.x = -s * 0.75;
        } else if (stage === 1) {
          // ROUNDHOUSE — side kick
          this.legR.rotation.z = -0.35 - s * 0.75;
          this.legR.rotation.x = -0.2 - s * 0.75;
          this.legR.userData.knee.rotation.x = 0.12;
          this.legL.rotation.x = 0.1 + s * 0.2;
          this.torso.rotation.y = -0.3 - s * 0.6;
          this.torso.rotation.z = -0.12 * s;
          this.armL.rotation.x = -s * 0.5;
        } else if (stage === 2) {
          // RISING KICK — the juggle starter
          this.legR.rotation.x = -0.15 - s * 1.85;
          this.legR.userData.knee.rotation.x = 0.08;
          this.legL.rotation.x = 0.26;
          this.legL.userData.knee.rotation.x = 0.3;
          this.body.position.y += s * 0.14;
          this.torso.rotation.x = -0.2 * s;
          this.armL.rotation.x = -1.15 * s;
          this.armR.rotation.x = 0.35 + s * 0.25;
          this.head.rotation.x = -0.12 * s;
        } else {
          // SPINNING DOUBLE KICK — juggle finisher
          this.legR.rotation.x = -0.3 - s * 1.25;
          this.legL.rotation.x = -0.2 - s * 1.05;
          this.legR.userData.knee.rotation.x = 0.1;
          this.legL.userData.knee.rotation.x = 0.12;
          this.body.position.y += s * 0.17;
          this.torso.rotation.y = s * 1.25;
          this.torso.rotation.x = -0.14 * s;
          this.armL.rotation.x = -0.9 * s;
          this.armR.rotation.x = 0.55;
        }
      } else if (family === 'hammer') {
        this.armL.rotation.z = 0.3;
        this.armR.rotation.z = -0.3;
        if (act === 'heavy') {
          this.armR.rotation.x = -2.9 + s * 3.25;
          this.armL.rotation.x = -2.6 + s * 2.8;
          this.armR.userData.elbow.rotation.x = 0.35 + (1 - s) * 0.55;
          this.armL.userData.elbow.rotation.x = 0.35 + (1 - s) * 0.55;
          this.torso.rotation.x = -0.42 + s * 0.92;
          this.torso.rotation.y = 0.18 - s * 0.35;
          this.weapon.rotation.x = -0.9 + s * 1.5;
          this.body.position.y -= 0.06 * s;
        } else if (act === 'launch') {
          this.armR.rotation.x = -2.7 * s;
          this.armL.rotation.x = -2.35 * s;
          this.torso.rotation.x = 0.2 + s * 0.25;
          this.weapon.rotation.x = -0.95 * s;
        } else if (act === 'special') {
          this.armR.rotation.x = -1.5;
          this.armL.rotation.x = -1.35;
          this.torso.rotation.y = -1.3 + s * 2.6;
          this.weapon.rotation.y = -1.5 + s * 3.0;
          this.weapon.rotation.x = 0.25;
        } else if (stage === 0) {
          this.armR.rotation.x = -1.25;
          this.armL.rotation.x = -0.9;
          this.armR.rotation.z = -0.32;
          this.armL.rotation.z = 0.35;
          this.armR.userData.elbow.rotation.x = 0.4;
          this.torso.rotation.y = -0.55 + s * 1.1;
          this.torso.rotation.x = s * 0.08;
          this.weapon.rotation.y = -0.5 + s * 1.3;
          this.weapon.rotation.x = 0.2;
          this.legR.rotation.x = 0.2 * s;
        } else if (stage === 1) {
          this.armR.rotation.x = -1.1;
          this.armL.rotation.x = -1.25;
          this.armR.rotation.z = -0.2;
          this.armL.rotation.z = 0.5;
          this.armL.userData.elbow.rotation.x = 0.42;
          this.torso.rotation.y = 0.62 - s * 1.24;
          this.torso.rotation.x = s * 0.06;
          this.weapon.rotation.y = 0.45 - s * 1.2;
          this.weapon.rotation.x = 0.15;
          this.legL.rotation.x = -0.2 * s;
        } else if (stage === 2) {
          this.armR.rotation.x = -2.7 + s * 2.9;
          this.armL.rotation.x = -2.4 + s * 2.6;
          this.armR.userData.elbow.rotation.x = 0.3 + (1 - s) * 0.5;
          this.armL.userData.elbow.rotation.x = 0.3 + (1 - s) * 0.5;
          this.torso.rotation.x = -0.32 + s * 0.72;
          this.torso.rotation.y = 0.12 - s * 0.24;
          this.weapon.rotation.x = -0.95 + s * 1.55;
          this.weapon.rotation.y = 0.1;
          this.body.position.y -= s * 0.05;
          this.legL.rotation.x = -0.3 * s;
          this.legR.rotation.x = 0.35 * s;
        } else {
          this.armR.rotation.x = -2.45 + s * 2.6;
          this.armL.rotation.x = -2.15 + s * 2.3;
          this.armR.userData.elbow.rotation.x = 0.3 + (1 - s) * 0.4;
          this.armL.userData.elbow.rotation.x = 0.3 + (1 - s) * 0.4;
          this.torso.rotation.y = -1.1 + s * 2.2;
          this.torso.rotation.x = -0.2 + s * 0.5;
          this.weapon.rotation.y = -1.2 + s * 2.4;
          this.weapon.rotation.x = -0.4 + s * 0.75;
          this.body.position.y -= s * 0.07;
          this.legR.rotation.x = 0.5 * s;
          this.legR.rotation.z = -0.15 * s;
        }
      }

      const wid = this.def.weapon;
      if (wid === 'scythe') { this.weapon.rotation.z -= s * 0.28; this.torso.rotation.x += s * 0.12; }
      else if (wid === 'staff') this.weapon.rotation.y += s * 0.36;
      else if (wid === 'glaive') this.weapon.rotation.x -= s * 0.22;
      else if (wid === 'demonblade') { this.torso.rotation.y += s * 0.22; this.weapon.rotation.z += s * 0.18; }
      else if (wid === 'katana') this.weapon.rotation.x -= s * 0.18;
      else if (wid === 'fists') { this.weapon.rotation.z += s * 0.55; this.armL.rotation.z += s * 0.12; }
      else if (wid === 'gauntlets') this.armR.rotation.z -= s * 0.12;
      else if (wid === 'daggers') this.weapon.rotation.y += s * 0.45;
      else if (wid === 'tonfas') this.weapon.rotation.x -= s * 0.25;
      else if (wid === 'hammer') this.weapon.rotation.z += s * 0.12;
      else if (wid === 'deserteagle') { this.weapon.rotation.z += s * 0.14; this.torso.rotation.y += s * 0.08; }

      this.body.rotation.z = -s * 0.035 * dir;
      if (finisher) this.body.rotation.z -= s * 0.04;
      if (rev) {
        this.torso.rotation.y += s * 0.2 * dir;
        this.body.rotation.z -= s * 0.05;
        this.armR.rotation.z -= s * 0.14;
        this.armL.rotation.z += s * 0.1;
        this.body.position.y += s * 0.03;
      }
    }

    if (act === 'shot') {
      const recoil = Math.max(0, 1 - p / 0.34);
      if (this.secondaryGun) {
        // revolver in the off hand, katana cocked back
        this.armL.rotation.x = -1.42 + recoil * 0.3;
        this.armL.rotation.z = 0.14;
        this.armL.userData.elbow.rotation.x = 0.06;
        this.armR.rotation.x = 0.95;
        this.armR.rotation.z = -0.62;
        this.armR.userData.elbow.rotation.x = 0.85;
        this.torso.rotation.y = 0.22;
        this.torso.rotation.x = -0.06 * recoil;
        this.head.rotation.y = -0.05;
        this.legL.rotation.x = -0.16;
        this.legR.rotation.x = 0.22;
        this.legL.userData.knee.rotation.x = 0.24;
        this.legR.userData.knee.rotation.x = 0.12;
        this.weapon.rotation.x = 0.5;
        this.weapon.rotation.z = -0.5;
        this.body.rotation.z = 0.03 * recoil;
        this.body.position.y += 0.02;
      } else {
        this.armR.rotation.x = -1.44 + recoil * 0.3;
        this.armR.rotation.z = -0.12;
        this.armR.userData.elbow.rotation.x = 0.06;
        this.armL.rotation.x = -0.5;
        this.armL.rotation.z = 0.42;
        this.armL.userData.elbow.rotation.x = 0.85;
        this.torso.rotation.y = -0.2;
        this.torso.rotation.x = -0.07 * recoil;
        this.head.rotation.y = 0.06;
        this.legL.rotation.x = -0.14;
        this.legR.rotation.x = 0.2;
        this.legL.userData.knee.rotation.x = 0.22;
        this.legR.userData.knee.rotation.x = 0.12;
        this.weapon.rotation.x = -0.02;
        this.weapon.rotation.z = 0;
        this.body.rotation.z = -0.03 * recoil;
        this.body.position.y += 0.02;
      }
    }

    if (act === 'weave') {
      const swing = Math.sin(Math.min(1, p / 0.6) * Math.PI);
      this.armR.rotation.x = -1.15;
      this.armR.rotation.z = -0.55 - swing * 0.5;
      this.armR.userData.elbow.rotation.x = 0.18;
      this.armL.rotation.x = -0.7;
      this.armL.rotation.z = 0.75;
      this.armL.userData.elbow.rotation.x = 0.55;
      this.torso.rotation.y = -0.55 * swing;
      this.torso.rotation.x = 0.06;
      this.head.rotation.y = 0.2 * swing;
      this.legL.rotation.x = -0.28;
      this.legR.rotation.x = 0.32;
      this.weapon.rotation.y = -1.1 * swing;
      this.weapon.rotation.z = 0.25 * swing;
      this.body.rotation.z = -0.04 * swing;
    }

    if (act === 'dive') {
      const tuck = Math.min(1, p * 8);
      this.torso.rotation.x = 0.85 * tuck;
      this.head.rotation.x = -0.35 * tuck;
      this.armL.rotation.x = -1.5 * tuck;
      this.armR.rotation.x = -1.5 * tuck;
      this.armL.userData.elbow.rotation.x = 0.4;
      this.armR.userData.elbow.rotation.x = 0.4;
      this.legL.rotation.x = -0.9 * tuck;
      this.legR.rotation.x = -0.7 * tuck;
      this.legL.userData.knee.rotation.x = 1.1 * tuck;
      this.legR.userData.knee.rotation.x = 0.9 * tuck;
      this.body.rotation.x = -0.25 * tuck;
    }

    if (act === 'dodge') {
      this.torso.rotation.x = Math.sin(p * Math.PI) * 0.55;
      this.body.position.y += Math.sin(p * Math.PI) * 0.04;
      this.armL.rotation.x = -0.8;
      this.armR.rotation.x = -0.6;
      this.legL.rotation.x = 0.5;
      this.legR.rotation.x = -0.35;
    }

    if (act === 'hurt') {
      this.body.rotation.z = Math.sin(p * 22) * 0.08;
      this.torso.rotation.x = -0.15;
      this.armL.rotation.z = 0.45;
      this.armR.rotation.z = -0.35;
    }

    if (state.block) {
      this.armL.rotation.x = -1.2; this.armL.rotation.z = 0.5;
      this.armR.rotation.x = -1.2; this.armR.rotation.z = -0.5;
      this.armL.userData.elbow.rotation.x = 0.8;
      this.armR.userData.elbow.rotation.x = 0.8;
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 9);
      for (const m of this.matsForHit) {
        if (m.emissive) {
          m.emissive.setHex(0xffffff);
          m.emissiveIntensity = this.flash * 3.5;
        }
      }
      if (this.flash <= 0) {
        for (const m of this.matsForHit) {
          if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
        }
      }
    }

    if (this.eyeGlow) this.eyeGlow.material.opacity = 0.28 + Math.sin(t * 3) * 0.1;
    if (this.footGlow) this.footGlow.material.opacity = (state.dead ? 0 : 0.12 + Math.sin(t * 2) * 0.04);
    if (this.halo) this.halo.rotation.z += dt * 0.7;

    const k = 1 - Math.exp(-(dead ? 15 : 28) * Math.max(0.001, dt));
    const mix = (from, to) => from + (to - from) * k;
    this.body.position.y = mix(prev.bodyY, this.body.position.y);
    this.body.position.z = mix(prev.bodyZPos, this.body.position.z);
    this.body.rotation.x = mix(prev.bodyX, this.body.rotation.x);
    this.body.rotation.z = mix(prev.bodyZ, this.body.rotation.z);
    this.torso.rotation.x = mix(prev.torsoX, this.torso.rotation.x);
    this.torso.rotation.y = mix(prev.torsoY, this.torso.rotation.y);
    this.torso.rotation.z = mix(prev.torsoZ, this.torso.rotation.z);
    this.head.rotation.x = mix(prev.headX, this.head.rotation.x);
    this.head.rotation.y = mix(prev.headY, this.head.rotation.y);
    this.head.rotation.z = mix(prev.headZ, this.head.rotation.z);
    this.armL.rotation.x = mix(prev.armLX, this.armL.rotation.x);
    this.armL.rotation.y = mix(prev.armLY, this.armL.rotation.y);
    this.armL.rotation.z = mix(prev.armLZ, this.armL.rotation.z);
    this.armR.rotation.x = mix(prev.armRX, this.armR.rotation.x);
    this.armR.rotation.y = mix(prev.armRY, this.armR.rotation.y);
    this.armR.rotation.z = mix(prev.armRZ, this.armR.rotation.z);
    this.armL.userData.elbow.rotation.x = mix(prev.elbowLX, this.armL.userData.elbow.rotation.x);
    this.armR.userData.elbow.rotation.x = mix(prev.elbowRX, this.armR.userData.elbow.rotation.x);
    this.legL.rotation.x = mix(prev.legLX, this.legL.rotation.x);
    this.legL.rotation.z = mix(prev.legLZ, this.legL.rotation.z);
    this.legR.rotation.x = mix(prev.legRX, this.legR.rotation.x);
    this.legR.rotation.z = mix(prev.legRZ, this.legR.rotation.z);
    this.legL.userData.knee.rotation.x = mix(prev.kneeLX, this.legL.userData.knee.rotation.x);
    this.legR.userData.knee.rotation.x = mix(prev.kneeRX, this.legR.userData.knee.rotation.x);
    this.weapon.rotation.x = mix(prev.weaponX, this.weapon.rotation.x);
    this.weapon.rotation.y = mix(prev.weaponY, this.weapon.rotation.y);
    this.weapon.rotation.z = mix(prev.weaponZ, this.weapon.rotation.z);

    this.root.position.x = state.x;
    this.root.position.z = state.z;
    if (!launched) this.root.position.y = y;
    else this.root.position.y = 0;
    if (this.contact) {
      const air = Math.max(0, state.y || 0);
      this.contact.position.y = 0.03 - (state.y || 0);
      this.contact.scale.setScalar(1 + air * 0.3);
      this.contact.material.opacity = 0.42 / (1 + air * 0.85);
      this.contact.visible = !state.dead;
    }
    const targetYaw = state.facing < 0 ? -Math.PI / 2 : Math.PI / 2;
    if (this.yaw === null) this.yaw = targetYaw;
    this.yaw += (targetYaw - this.yaw) * (1 - Math.exp(-15 * Math.max(0.001, dt)));
    this.root.rotation.y = this.yaw;
  }

  hitFlash() {
    this.flash = 1;
  }
}

export class World {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.audio = audio;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 240);
    this.camera.position.set(0, 6.5, 23);
    this.baseCamera = new THREE.Vector3(0, 6.5, 23);
    this.lookAt = new THREE.Vector3(0, 1.6, 0);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraX = 0;
    this.cameraLookX = 0;
    this.shakeAmt = 0;
    this.shakeTime = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    this.theme = null;
    this.time = 0;
    this.fighters = new Set();
    this.effects = [];
    this.arena = 0;
    this.waveAnchors = [];
    this.gates = [];
    this.rain = null;
    this.dust = null;
    this.beacons = [];
    this.occluders = [];
    this.camVel = 0;
    this.lookVel = 0;
    this.zoomPunch = 0;
    this.screenFlash = 0;
    this.cameraMode = 'menu';
    this.menuAngle = 0;
    this.lights = [];
    this.pointLights = [];
    this.initParticles();
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  initParticles() {
    const count = 700;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 9999; pos[i * 3 + 1] = 9999; pos[i * 3 + 2] = 9999;
      col[i * 3] = 1; col[i * 3 + 1] = 0.4; col[i * 3 + 2] = 0.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, map: getGlowTexture(), sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.particleData = Array.from({ length: count }, () => ({ alive: false, vx: 0, vy: 0, vz: 0, life: 0, max: 1, gravity: -8 }));
    this.particleIndex = 0;
  }

  spawnParticle(x, y, z, color, speed = 4, life = 0.5, gravity = -7) {
    const i = this.particleIndex++ % this.particleData.length;
    const p = this.particleData[i];
    p.alive = true; p.life = life; p.max = life; p.gravity = gravity;
    const a = Math.random() * TAU, b = Math.random() * Math.PI;
    const s = speed * (0.35 + Math.random() * 0.8);
    p.vx = Math.cos(a) * Math.sin(b) * s;
    p.vy = Math.abs(Math.cos(b)) * s * (0.5 + Math.random());
    p.vz = Math.sin(a) * Math.sin(b) * s;
    const pos = this.particles.geometry.attributes.position.array;
    const col = this.particles.geometry.attributes.color.array;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const c = new THREE.Color(color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  burst(pos, color, count = 14, speed = 5, life = 0.5) {
    for (let i = 0; i < count; i++) this.spawnParticle(pos.x, pos.y, pos.z, color, speed, life * rand(0.6, 1.2), -9);
  }

  reset(themeName = 'downtown') {
    this.worldRoot.clear();
    this.clearFighters();
    this.fighters = new Set();
    this.effects.forEach(e => { if (e.mesh.parent) e.mesh.parent.remove(e.mesh); });
    this.effects = [];
    this.pointLights = [];
    this.gates = [];
    this.beacons = [];
    this.occluders = [];
    this.train = null;
    this.arena = 0;
    this.theme = THEMES[themeName] || THEMES.downtown;
    const th = this.theme;
    this.scene.background = new THREE.Color(th.fog);
    this.scene.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    this.buildEnvironment(th);
    this.buildLights(th);
    this.buildSky(th, themeName);
    this.buildStreet(th, themeName);
    this.buildGates();
    this.buildAtmosphere(th, themeName);
    this.cameraMode = 'menu';
  }

  buildEnvironment(th) {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const tex = environmentTexture(th);
    const rt = this.pmrem.fromEquirectangular(tex);
    tex.dispose();
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.55;
  }

  buildLights(th) {
    this.scene.children.filter(o => o.userData.lightRig).forEach(o => this.scene.remove(o));
    const rig = new THREE.Group(); rig.userData.lightRig = true; this.scene.add(rig);
    const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemi);
    rig.add(hemi);
    rig.add(new THREE.AmbientLight(0x2b2542, 0.85));
    const dir = new THREE.DirectionalLight(th.sun, th.sunIntensity);
    dir.position.set(-9, 18, 14);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -26; dir.shadow.camera.right = 26;
    dir.shadow.camera.top = 18; dir.shadow.camera.bottom = -12;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 60;
    dir.shadow.bias = -0.0008;
    this.sun = dir;
    rig.add(dir);
    const rim = new THREE.DirectionalLight(th.accent2, 0.72);
    rim.position.set(20, 8, -12); rig.add(rim);
    const front = new THREE.DirectionalLight(0xffe2ec, 1.7);
    front.position.set(4, 7, 22); rig.add(front);
    const fill = new THREE.PointLight(th.accent, 0.8, 30, 1.9);
    fill.position.set(0, 5, 12); rig.add(fill);
    this.fillLight = fill;
    // low back-light for silhouettes + a soft bounce from the wet street
    const back = new THREE.DirectionalLight(0x9fc6ff, 0.5);
    back.position.set(-6, 3, -14); rig.add(back);
    const bounce = new THREE.DirectionalLight(th.accent2, 0.34);
    bounce.position.set(2, -6, 6); rig.add(bounce);
    this.lights.push(rig);
  }

  buildSky(th, themeName) {
    const geo = new THREE.SphereGeometry(110, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(th.skyTop) }, bottom: { value: new THREE.Color(th.skyBottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.05,0.65,normalize(vP).y); gl_FragColor=vec4(mix(bottom,top,h),1.0); }',
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.position.set(0, 0, 0);
    this.worldRoot.add(sky);

    const starGeo = new THREE.BufferGeometry();
    const arr = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * TAU, r = rand(55, 90), y = rand(4, 48);
      arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 1] = y; arr[i * 3 + 2] = Math.sin(a) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.worldRoot.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbec9ff, size: 0.16, transparent: true, opacity: 0.7, depthWrite: false })));

    const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: themeName === 'rooftop' ? 0xffc5a1 : 0xb8c6ff, transparent: true, opacity: 0.62 }));
    moon.position.set(-32, 30, -78); this.worldRoot.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: themeName === 'rooftop' ? 0xff9a7a : 0x7d8fff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(moon.position); halo.position.z += 0.5; halo.scale.setScalar(28); this.worldRoot.add(halo);
  }

  registerOccluder(obj, x, z, radius, top) {
    const mats = [];
    obj.traverse(o => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        mats.push(o.material);
      }
    });
    this.occluders.push({ obj, x, z, radius, top, mats, fade: 0 });
    return obj;
  }

  makeBuilding(x, z, w, d, h, th, side) {
    const tex = makeWindowTexture(Math.random() < 0.25 ? '#12121d' : '#0c0f18', Math.random() < 0.4);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 8)));
    const mat = new THREE.MeshStandardMaterial({
      color: th.building, roughness: 0.74, metalness: 0.3,
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5,
      roughnessMap: fabricTexture(), envMapIntensity: 0.75,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true; b.receiveShadow = true;
    this.worldRoot.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4), new THREE.MeshStandardMaterial({ color: 0x090a10, roughness: 0.7, metalness: 0.5 }));
    roof.position.set(x, h + 0.1, z); this.worldRoot.add(roof);
    if (side > 0) {
      const grp = new THREE.Group();
      this.worldRoot.remove(b); this.worldRoot.remove(roof);
      grp.add(b); grp.add(roof);
      b.position.set(0, h / 2, 0); roof.position.set(0, h + 0.1, 0);
      grp.position.set(x, 0, z);
      this.worldRoot.add(grp);
      this.registerOccluder(grp, x, z, w * 0.5 + 1.2, h + 0.4);
    }
    if (h > 11 && Math.random() < 0.6) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, rand(2, 5), 5), new THREE.MeshStandardMaterial({ color: 0x333846, metalness: 0.8, roughness: 0.3 }));
      mast.position.set(x + rand(-w / 3, w / 3), h + 2, z); this.worldRoot.add(mast);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
      beacon.position.copy(mast.position); beacon.position.y += 2.4; this.worldRoot.add(beacon);
      this.beacons.push(beacon);
    }
    return b;
  }

  buildStreet(th, themeName) {
    const asphalt = asphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      color: th.road, roughness: 0.52, metalness: 0.34,
      roughnessMap: asphalt, envMapIntensity: 0.5,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(180, 34), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 0); road.receiveShadow = true;
    this.worldRoot.add(road);

    const walkMat = new THREE.MeshStandardMaterial({
      color: themeName === 'subway' ? 0x131713 : 0x171a22, roughness: 0.5, metalness: 0.38,
      roughnessMap: asphalt, envMapIntensity: 0.8,
    });
    for (const s of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(180, 0.24, 7), walkMat);
      walk.position.set(0, 0.12, s * 13.4); walk.receiveShadow = true; this.worldRoot.add(walk);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(180, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.35, metalness: 0.5 }));
      curb.position.set(0, 0.18, s * 10.05); curb.receiveShadow = true; this.worldRoot.add(curb);
    }

    const lineMat = new THREE.MeshStandardMaterial({ color: 0x9ba1aa, emissive: 0x2b303b, emissiveIntensity: 0.35, roughness: 0.5 });
    for (let x = -85; x < 85; x += 6) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.012, 0.16), lineMat);
      dash.position.set(x, 0.012, 0); dash.receiveShadow = true; this.worldRoot.add(dash);
    }
    for (const z of [-5.2, 5.2]) {
      const solid = new THREE.Mesh(new THREE.BoxGeometry(180, 0.01, 0.1), new THREE.MeshStandardMaterial({ color: 0x5e6675, roughness: 0.6 }));
      solid.position.set(0, 0.012, z); this.worldRoot.add(solid);
    }

    // Puddles with a cheap glossy sheen
    const puddleMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: 0.08, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, opacity: 0.86 });
    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(rand(1.2, 3.2), 20), puddleMat);
      p.rotation.x = -Math.PI / 2; p.scale.z = rand(0.35, 0.65);
      p.position.set(rand(-60, 60), 0.016, rand(-8.6, 8.6)); this.worldRoot.add(p);
    }

    // Side buildings
    let x = -74;
    while (x < 74) {
      const w = rand(6, 14);
      const h = rand(9, 30);
      this.makeBuilding(x + w / 2, -22 - rand(0, 3), w, rand(5, 11), h, th, -1);
      if (Math.random() < 0.65) this.makeBuilding(x + w / 2, 25 + rand(0, 5), w, rand(4, 8), h * rand(0.4, 0.8), th, 1);
      x += w + rand(1.5, 4);
    }

    // Background skyline
    for (let i = 0; i < 26; i++) {
      const w = rand(4, 12), h = rand(12, 46);
      this.makeBuilding(rand(-95, 95), rand(-58, -42), w, rand(4, 9), h, th, -1);
    }

    this.buildSigns(th, themeName);
    this.buildStreetProps(th, themeName);
    this.buildBillboards(th, themeName);
    this.buildForceLines(th, themeName);
  }

  buildSigns(th, themeName) {
    const words = ['RAMEN', 'NOODLE', 'CHROME', 'SYNDICATE', 'PAWN', 'AFTERLIFE', 'VOLT', 'LIVE', 'HOTEL', 'VOID', 'SUSHI', 'DATA', 'NEON', 'GIRLS', 'ARCADE', 'MOTEL'];
    const colors = [th.accent, th.accent2, 0xffc247, 0x9cff57, 0xff55d1];
    let pi = 0;
    for (let i = 0; i < 15; i++) {
      const vertical = Math.random() < 0.35;
      const word = pick(words);
      const color = colors[i % colors.length];
      const tex = makeSignTexture(word, '#' + new THREE.Color(color).getHexString(), 'rgba(4,5,12,.88)', vertical);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false });
      const w = vertical ? rand(1.4, 2.2) : rand(3.6, 7.2);
      const h = vertical ? rand(4, 7) : w / 3.2;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const side = Math.random() < 0.7 ? -1 : 1;
      sign.position.set(rand(-62, 62), rand(4.2, 11), side * (side < 0 ? -15.8 : 19.5));
      if (side > 0) this.registerOccluder(sign, sign.position.x, 19.5, 1.6, sign.position.y + h * 0.5);
      if (side > 0) sign.rotation.y = Math.PI;
      this.worldRoot.add(sign);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.copy(sign.position); halo.position.z += side * 0.2; halo.scale.set(w * 2.1, h * 2.5, 1); this.worldRoot.add(halo);
      if (pi < 4) {
        const pl = new THREE.PointLight(color, 2.2, 18, 2);
        pl.position.copy(sign.position); pl.position.z += side * 1.4; this.worldRoot.add(pl); this.pointLights.push(pl); pi++;
      }
    }
  }

  buildBillboards(th, themeName) {
    const titles = themeName === 'subway' ? ['MIND THE GAP', 'NEXT STOP: HELL', 'GHOST LINE'] : ['NO GODS', 'ONLY NEON', 'STAY HUMAN', 'CITY OF SINS', 'SYNDICATE'];
    for (let i = 0; i < 3; i++) {
      const tex = canvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = 'rgba(3,4,10,.95)'; ctx.fillRect(0, 0, w, h);
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, i % 2 ? '#ff224f' : '#32d8ff'); g.addColorStop(1, i % 2 ? '#37106a' : '#06334a');
        ctx.fillStyle = g; ctx.fillRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = 'rgba(3,4,10,.82)'; ctx.fillRect(16, 16, w - 32, h - 32);
        ctx.strokeStyle = i % 2 ? '#ff224f' : '#32d8ff'; ctx.lineWidth = 4; ctx.strokeRect(24, 24, w - 48, h - 48);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f7f7ff'; ctx.font = 'bold 58px Rajdhani, sans-serif';
        ctx.fillText(titles[i], w / 2, h / 2 - 12);
        ctx.fillStyle = i % 2 ? '#ff224f' : '#32d8ff'; ctx.font = 'bold 22px Rajdhani, sans-serif';
        ctx.fillText('SECTOR 07 // CURFEW ACTIVE', w / 2, h / 2 + 48);
        for (let y = 30; y < h; y += 6) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(24, y, w - 48, 2); }
      });
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 4.75), mat);
      board.position.set(-38 + i * 38, 15.5, -16.5);
      this.worldRoot.add(board);
      const frame = box(9.9, 5.1, 0.15, 0x151722, { metalness: 0.8, roughness: 0.3 });
      frame.position.copy(board.position); frame.position.z = -16.65; this.worldRoot.add(frame);
    }
  }

  buildForceLines(th, themeName) {
    const color = th.accent;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(180, 0.025, 0.025), mat);
      rail.position.set(0, 0.28, s * 10.4); this.worldRoot.add(rail);
    }
    const color2 = th.accent2;
    for (const x of [-46, -14, 18, 46]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.028, 4, 32), new THREE.MeshBasicMaterial({ color: color2, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.03, 0); this.worldRoot.add(ring);
    }
  }

  buildStreetProps(th, themeName) {
    // Lamps
    for (let x = -58; x <= 58; x += 19) {
      const g = new THREE.Group();
      const pole = cyl(0.07, 0.1, 5.6, 0x2b303b, 6, { metalness: 0.85, roughness: 0.3 });
      pole.position.y = 2.8; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: 0x2b303b, metalness: 0.8, roughness: 0.3 }));
      arm.position.set(-0.8, 5.55, 0); g.add(arm);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.22), new THREE.MeshBasicMaterial({ color: th.accent2, toneMapped: false }));
      bar.position.set(-1.5, 5.48, 0); g.add(bar);
      const light = new THREE.PointLight(th.accent2, 1.5, 12, 2);
      light.position.set(-1.5, 5.2, 0); g.add(light);
      g.position.set(x, 0, 11.2); this.worldRoot.add(g);
      this.registerOccluder(g, x, 11.2, 1.1, 5.7);
    }
    // Cars
    for (const [x, z, color] of [[-30, -7.8, 0x1a2f45], [9, 7.9, 0x3b1b28], [42, -7.7, 0x1c332a]]) {
      const car = new THREE.Group();
      const body = box(3.6, 0.65, 1.55, color, { metalness: 0.75, roughness: 0.28 });
      body.position.y = 0.55; car.add(body);
      const cabin = box(1.8, 0.55, 1.35, 0x07090d, { metalness: 0.8, roughness: 0.15 });
      cabin.position.set(-0.1, 1.05, 0); car.add(cabin);
      for (const sx of [-1.15, 1.15]) for (const sz of [-0.7, 0.7]) {
        const wheel = cyl(0.32, 0.32, 0.22, 0x050607, 12, { roughness: 0.9 });
        wheel.rotation.x = Math.PI / 2; wheel.position.set(sx, 0.34, sz); car.add(wheel);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xdff6ff, toneMapped: false }));
      head.position.set(1.82, 0.58, 0.5); car.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.38), new THREE.MeshBasicMaterial({ color: 0xff2244, toneMapped: false }));
      tail.position.set(-1.82, 0.58, 0.5); car.add(tail);
      car.position.set(x, 0, z); this.worldRoot.add(car);
    }
    // Dumpsters, barriers, crates
    for (let i = 0; i < 12; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = rand(-55, 55);
      if (i % 3 === 0) {
        const d = box(1.6, 1.1, 1.1, 0x1a2a22, { metalness: 0.6, roughness: 0.5 });
        d.position.set(x, 0.7, side * 12.2); this.worldRoot.add(d);
        if (side > 0) this.registerOccluder(d, x, 12.2, 1.1, 1.3);
      } else if (i % 3 === 1) {
        const c = box(0.75, 0.75, 0.75, 0x2b2118, { metalness: 0.2, roughness: 0.8 });
        c.position.set(x, 0.5, side * 11.8); c.rotation.y = rand(0, 1); this.worldRoot.add(c);
        if (side > 0) this.registerOccluder(c, x, 11.8, 0.7, 0.9);
      } else {
        const bar = box(1.8, 0.18, 0.18, 0x2c3038, { metalness: 0.7, roughness: 0.35 });
        bar.position.set(x, 0.6, side * 10.8); bar.rotation.y = rand(-0.3, 0.3); this.worldRoot.add(bar);
        for (const s of [-0.7, 0.7]) {
          const leg = box(0.14, 0.6, 0.14, 0x2c3038, { metalness: 0.7, roughness: 0.35 });
          leg.position.set(x + s, 0.3, side * 10.8); this.worldRoot.add(leg);
        }
      }
    }
    if (themeName === 'subway') {
      // Platform edge and rails
      for (const z of [-4.4, 4.4]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(180, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.9, roughness: 0.2 }));
        rail.position.set(0, 0.04, z); this.worldRoot.add(rail);
      }
      const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x0a0d0b, roughness: 0.7 });
      for (let x = -70; x < 70; x += 12) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(8.4, 0.32, 6, 16, Math.PI), tunnelMat);
        arch.position.set(x, 0, -9); arch.rotation.y = Math.PI / 2; this.worldRoot.add(arch);
      }
    }
    if (themeName === 'rooftop') {
      const glass = new THREE.MeshStandardMaterial({ color: 0x0d1620, metalness: 0.7, roughness: 0.1 });
      for (const s of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(180, 1.1, 0.22), glass);
        edge.position.set(0, 0.55, s * 15.5); this.worldRoot.add(edge);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(180, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: th.accent2, toneMapped: false }));
        rail.position.set(0, 1.2, s * 15.5); this.worldRoot.add(rail);
      }
      // Helipad at center
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0x111521, roughness: 0.5, metalness: 0.6 }));
      pad.position.set(0, 0.04, 2); this.worldRoot.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.05, 4, 48), new THREE.MeshBasicMaterial({ color: th.accent, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.1, 2); this.worldRoot.add(ring);
    }
    // Cable wires
    const wireMat = new THREE.LineBasicMaterial({ color: 0x232836, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 8; i++) {
      const pts = [];
      for (let j = 0; j <= 14; j++) {
        const t = j / 14;
        pts.push(new THREE.Vector3(-75 + t * 150, 8 + Math.sin(t * Math.PI) * 2.2 + rand(-0.2, 0.2), -17 + Math.sin(t * 10 + i) * 1.5));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.worldRoot.add(new THREE.Line(geo, wireMat));
    }
    // Distant train
    if (themeName !== 'subway') {
      const train = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const car = box(7, 1.4, 2.3, 0x161d2b, { metalness: 0.7, roughness: 0.35 });
        car.position.set(i * 7.4, 10.4, -31); train.add(car);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: th.accent2, toneMapped: false }));
        strip.position.set(i * 7.4, 10.6, -29.8); train.add(strip);
      }
      this.worldRoot.add(train);
      this.train = train;
    }
  }

  buildAtmosphere(th, themeName) {
    if (themeName === 'rooftop') {
      const count = 240;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { pos[i * 3] = rand(-60, 60); pos[i * 3 + 1] = rand(0, 18); pos[i * 3 + 2] = rand(-20, 8); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb28a, size: 0.06, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.worldRoot.add(this.rain);
      this.rainKind = 'ember';
    } else {
      const count = 900;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { pos[i * 3] = rand(-65, 65); pos[i * 3 + 1] = rand(0, 26); pos[i * 3 + 2] = rand(-25, 14); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fc9ff, size: 0.045, transparent: true, opacity: 0.34, depthWrite: false }));
      this.worldRoot.add(this.rain);
      this.rainKind = 'rain';
    }
    // Floating dust
    const dCount = 180;
    const dGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(dCount * 3);
    for (let i = 0; i < dCount; i++) { dPos[i * 3] = rand(-60, 60); dPos[i * 3 + 1] = rand(0, 14); dPos[i * 3 + 2] = rand(-12, 10); }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    this.dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: th.accent2, size: 0.035, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.worldRoot.add(this.dust);
  }

  buildGates() {
    for (const x of [0, 0, 0, 0]) {
      const gate = new THREE.Group();
      const fieldMat = new THREE.MeshBasicMaterial({ color: this.theme.accent, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const field = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.2), fieldMat);
      field.position.y = 2.1; gate.add(field);
      for (const s of [-1, 1]) {
        const post = box(0.18, 4.4, 0.18, 0x171b24, { metalness: 0.8, roughness: 0.3 });
        post.position.set(s * 7.5, 2.2, 0); gate.add(post);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.19, 3.8, 0.19), new THREE.MeshBasicMaterial({ color: this.theme.accent2, toneMapped: false }));
        strip.position.set(s * 7.5, 2.2, 0); gate.add(strip);
      }
      gate.position.set(0, 0, 10.4);
      gate.visible = false;
      this.worldRoot.add(gate);
      this.gates.push({ group: gate, field: fieldMat });
    }
  }

  setGates(active, x = 0, color) {
    for (const g of this.gates) {
      g.group.visible = active;
      g.group.position.x = x;
      if (color) { g.group.children.forEach(c => { if (c.material && c.material.color) c.material.color.setHex(color); }); }
      g.field.opacity = active ? 0.18 : 0;
    }
  }

  createFighter(def, isEnemy = false, boss = false) {
    const f = new FighterVisual(def, isEnemy, boss);
    this.fighters.add(f);
    this.worldRoot.add(f.root);
    return f;
  }

  removeFighter(f) {
    this.fighters.delete(f);
    if (f.root.parent) f.root.parent.remove(f.root);
  }

  clearFighters() {
    for (const f of this.fighters) if (f.root.parent) f.root.parent.remove(f.root);
    this.fighters.clear();
  }

  showShowcase(def) {
    this.clearShowcase();
    if (!def) return;
    this.showcase = this.createFighter(def, false, false);
    this.showcase.root.position.set(7.8, 0, 0.8);
    this.showcase.root.rotation.y = 0.18;
    this.showcase.root.scale.setScalar(1.44);
    this.showcaseState = { x: 7.8, z: 0.8, y: 0, facing: 1, action: 'none', actionProgress: 0, moving: false, speed: 0, dead: false };
    this.showcaseLights = [];
    const key = new THREE.PointLight(0xffd6e2, 42, 17, 2);
    key.position.set(7.1, 3.7, 5.2);
    const rim = new THREE.PointLight(def.colors?.energy || 0x32d8ff, 34, 15, 2);
    rim.position.set(9.2, 3.2, 1.6);
    this.scene.add(key, rim);
    this.showcaseLights.push(key, rim);
    this.cameraMode = 'menu';
  }

  clearShowcase() {
    if (this.showcase) { this.removeFighter(this.showcase); this.showcase = null; }
    for (const l of this.showcaseLights || []) this.scene.remove(l);
    this.showcaseLights = [];
  }

  setCameraMode(mode) { this.cameraMode = mode; }

  punchZoom(amount = 0.12) {
    this.zoomPunch = Math.max(this.zoomPunch, amount);
  }

  updateOccluders(camX, camZ, lookX, dt) {
    for (const o of this.occluders) {
      const t = (camZ - o.z) / Math.max(0.001, camZ);
      const lineX = camX + (lookX - camX) * t;
      const lineY = 5.2 + (1.5 - 5.2) * t;
      const blocked = o.z > 2.5 && o.z < camZ + 0.5 && Math.abs(o.x - lineX) < o.radius && o.top > lineY;
      o.fade += ((blocked ? 1 : 0) - o.fade) * Math.min(1, Math.max(0.001, dt) * 9);
      const op = 1 - o.fade * 0.95;
      o.obj.visible = op > 0.04;
      for (const m of o.mats) {
        m.transparent = true;
        m.opacity = op;
        m.depthWrite = op > 0.85;
      }
    }
  }

  updateCamera(dt, focusX, focusLookX, arenaX = 0) {
    if (this.cameraMode === 'menu') {
      this.menuAngle += dt * 0.12;
      const targetX = 5.0 + Math.sin(this.menuAngle) * 0.35;
      const targetZ = 9.8 + Math.cos(this.menuAngle) * 0.35;
      this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 1.5);
      this.camera.position.y += (2.55 - this.camera.position.y) * Math.min(1, dt * 1.5);
      this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 1.5);
      this.camera.lookAt(6.9, 1.32, 0.6);
      this.camera.fov += (40 - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
      if (this.showcase) {
        this.showcaseState.moving = false; this.showcaseState.speed = 0;
        this.showcase.update(dt, this.showcaseState, this.time);
        this.showcase.root.position.x = 7.8;
        this.showcase.root.position.z = 0.8;
        this.showcase.root.rotation.y = 0.18 + Math.sin(this.time * 0.4) * 0.06;
      }
    } else {
      // critically damped follow — the camera trails the fight instead of snapping to it
      const step = (cur, vel, target, w) => {
        const d = Math.min(dt, 0.05);
        vel += (w * w * (target - cur) - 2 * w * vel) * d;
        return [cur + vel * d, vel];
      };
      [this.cameraX, this.camVel] = step(this.cameraX, this.camVel, focusX, 9);
      [this.cameraLookX, this.lookVel] = step(this.cameraLookX, this.lookVel, focusLookX, 11);
      this.zoomPunch *= Math.pow(0.0015, dt);
      const zoomTarget = Math.max(0.55, this.targetZoom - this.zoomPunch);
      this.zoom += (zoomTarget - this.zoom) * Math.min(1, dt * 5.5);
      this.shakeTime += dt;
      this.shakeAmt *= Math.pow(0.0025, dt);
      const sx = (Math.random() - 0.5) * this.shakeAmt;
      const sy = (Math.random() - 0.5) * this.shakeAmt;
      const camX = this.cameraX + sx;
      const camZ = 16.2 / this.zoom;
      this.camera.position.x = camX;
      this.camera.position.y = 5.2 + sy + this.zoom * 0.7;
      this.camera.position.z = camZ;
      this.camera.lookAt(this.cameraLookX + sx * 0.4, 1.5 + sy * 0.4, 0);
      this.updateOccluders(camX, camZ, this.cameraLookX, dt);
      this.camera.fov += (42 / Math.sqrt(this.zoom) - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
      if (this.fillLight) { this.fillLight.position.x = camX; this.fillLight.position.z = 10; }
      if (this.sun) { this.sun.position.x = camX - 9; this.sun.target.position.set(camX, 0, 0); this.sun.target.updateMatrixWorld(); }
    }
  }

  setArena(x) { this.arena = x; }

  shake(amount) { this.shakeAmt = Math.max(this.shakeAmt, amount); }

  addEffect(mesh, life, update, opts = {}) {
    this.worldRoot.add(mesh);
    const e = { mesh, life, max: life, update, opts };
    this.effects.push(e);
    return e;
  }

  hitSparks(pos, color = 0xffc247, amount = 10, power = 1) {
    this.burst(pos, color, amount, 4 + power * 3, 0.32 + power * 0.1);
    const s = glowSprite(color, 1.0 + power * 0.5, 0.9);
    s.position.copy(pos); this.addEffect(s, 0.16, (e, t) => { e.mesh.material.opacity = (1 - t) * 0.9; e.mesh.scale.setScalar(1.2 + t * 1.8); });
  }

  slash(pos, facing, color, heavy = false, scale = 1) {
    const geo = new THREE.RingGeometry(heavy ? 0.9 : 0.55, heavy ? 1.8 : 1.2, 24, 1, facing > 0 ? -Math.PI * 0.72 : Math.PI * 0.28, Math.PI * 0.85);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos); m.position.z += facing * 0.45;
    m.rotation.z = rand(-0.2, 0.2);
    m.scale.set(facing > 0 ? scale : -scale, scale, scale);
    this.addEffect(m, 0.18, (e, t, d) => { e.mesh.material.opacity = (1 - t) * 0.9; e.mesh.scale.multiplyScalar(1 + d * 3); e.mesh.rotation.z += d * 2; });
  }

  lightningArc(from, to, color = 0x72a6ff) {
    const pts = [];
    const segs = 7;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const jitter = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 0.9;
      pts.push(new THREE.Vector3(
        from.x + (to.x - from.x) * t + jitter * 0.5,
        from.y + (to.y - from.y) * t + jitter,
        from.z + (to.z - from.z) * t + jitter * 0.5
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const line = new THREE.Line(geo, mat);
    this.worldRoot.add(line);
    this.addEffect(line, 0.22, (e, t) => {
      e.mesh.material.opacity = (1 - t) * 0.9;
      if (e.mesh.geometry) e.mesh.geometry.setFromPoints(pts.map(pt => pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2))));
    });
    for (const p of [from, to]) {
      const s = glowSprite(color, 0.9, 0.85);
      s.position.copy(p);
      this.addEffect(s, 0.2, (e, t) => { e.mesh.material.opacity = (1 - t) * 0.8; e.mesh.scale.setScalar(0.9 + t * 1.2); });
    }
  }

  muzzleFlash(pos, dirX = 1, dirZ = 0, color = 0xffc247) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff4cf, toneMapped: false, transparent: true }));
    g.add(core);
    const bloom = glowSprite(color, 1.25, 0.95);
    g.add(bloom);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = 0.3;
    g.add(cone);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(dirX, dirZ);
    this.worldRoot.add(g);
    this.addEffect(g, 0.11, (e, t, d) => {
      e.mesh.scale.setScalar(1 + t * 1.6);
      e.mesh.children.forEach(c => { if (c.material) c.material.opacity = (1 - t) * 0.85; });
      e.mesh.position.x += dirX * d * 0.6;
      e.mesh.position.z += dirZ * d * 0.6;
    });
  }

  ring(pos, color, scale = 1, life = 0.4, vertical = false) {
    const geo = new THREE.RingGeometry(0.4, 0.55, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos); m.position.y = Math.max(0.06, pos.y);
    m.rotation.x = vertical ? 0 : -Math.PI / 2;
    m.scale.setScalar(scale);
    this.addEffect(m, life, (e, t) => { e.mesh.material.opacity = (1 - t) * 0.75; e.mesh.scale.setScalar(scale * (1 + t * 7)); });
  }

  explosion(pos, color, power = 1) {
    this.ring(pos, color, 0.8 * power, 0.55);
    this.burst(pos, color, 24 + power * 12, 7 + power * 4, 0.7);
    const s = glowSprite(color, 3.4 * power, 0.9);
    s.position.copy(pos); s.position.y += 0.3;
    this.addEffect(s, 0.4, (e, t) => { e.mesh.material.opacity = (1 - t) * 0.8; e.mesh.scale.setScalar(3.4 * power * (1 + t * 2)); });
    this.shake(0.18 * power);
  }

  dashTrail(pos, color) {
    for (let i = 0; i < 5; i++) {
      const s = glowSprite(color, 0.8, 0.28);
      s.position.set(pos.x + rand(-0.2, 0.2), pos.y + rand(0.2, 1.5), pos.z + rand(-0.1, 0.1));
      this.addEffect(s, 0.3 + i * 0.04, (e, t, d) => { e.mesh.material.opacity = (1 - t) * 0.3; e.mesh.position.y += d * 0.5; });
    }
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.train) this.train.position.x = ((t * 9) % 130) - 65;

    if (this.rain) {
      const pos = this.rain.geometry.attributes.position.array;
      const kind = this.rainKind;
      for (let i = 0; i < pos.length; i += 3) {
        if (kind === 'rain') {
          pos[i + 1] -= dt * (11 + (i % 7));
          pos[i] -= dt * 1.6;
          if (pos[i + 1] < 0) { pos[i + 1] = rand(18, 26); pos[i] = this.cameraX + rand(-40, 40); pos[i + 2] = rand(-22, 12); }
        } else {
          pos[i + 1] += dt * (0.7 + (i % 5) * 0.2);
          pos[i] += dt * 0.2;
          if (pos[i + 1] > 20) { pos[i + 1] = 0; pos[i] = this.cameraX + rand(-40, 40); pos[i + 2] = rand(-20, 8); }
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.x = 0;
    }
    if (this.dust) {
      const pos = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] += dt * 0.08;
        pos[i] += Math.sin(t * 0.2 + i) * dt * 0.05;
        if (pos[i + 1] > 14) pos[i + 1] = 0;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    // particles
    const pos = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < this.particleData.length; i++) {
      const p = this.particleData[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; pos[i * 3] = 9999; pos[i * 3 + 1] = 9999; pos[i * 3 + 2] = 9999; continue; }
      p.vy += p.gravity * dt;
      pos[i * 3] += p.vx * dt; pos[i * 3 + 1] += p.vy * dt; pos[i * 3 + 2] += p.vz * dt;
      if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = 0; p.vy *= -0.28; p.vx *= 0.72; p.vz *= 0.72; }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const prog = 1 - Math.max(0, e.life) / e.max;
      if (e.update) e.update(e, prog, dt);
      if (e.life <= 0) {
        if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
        if (e.mesh.geometry) e.mesh.geometry.dispose();
        if (e.mesh.material) e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }

    for (const f of this.fighters) if (f.update) f.update(dt, f.state || { x: 0, z: 0, facing: 1, action: 'none', moving: false, y: 0, dead: false }, t);
    if (this.showcase && !this.fighters.has(this.showcase)) this.showcase.update(dt, this.showcaseState, t);

    this.beacons.forEach((b, i) => { if (b.material) b.material.color.setHex(Math.sin(t * 2 + i) > 0 ? 0xff2244 : 0x330a12); });
    this.pointLights.forEach((l, i) => { l.intensity = 1.6 + Math.sin(t * 3 + i) * 0.55; });
    if (this.train) this.train.children.forEach((c, i) => { if (c.material && c.material.emissive) c.material.emissiveIntensity = 0.3 + Math.sin(t * 5 + i) * 0.15; });
  }

  project(pos) {
    const v = pos.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, visible: v.z < 1 && v.z > -1 };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
