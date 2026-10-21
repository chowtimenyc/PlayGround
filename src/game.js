import * as THREE from '../vendor/three.module.js';
import { CHARACTERS, BOSSES, STAGES, ENEMY_TYPES, UPGRADES, RANKS, MODES, WEAPON_PROFILES } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const KEYMAPS = [
  {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    light: ['KeyJ'], heavy: ['KeyK'], launch: ['KeyL'], dodge: ['Space'],
    jump: ['KeyI'], special: ['KeyE'], taunt: ['KeyU'],
  },
  {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    light: ['Numpad1', 'NumpadEnd'], heavy: ['Numpad2', 'NumpadArrowDown'], launch: ['Numpad3', 'NumpadPageDown'],
    dodge: ['Numpad0', 'NumpadInsert'], jump: ['Numpad5', 'NumpadClear'], special: ['NumpadDecimal', 'NumpadDelete'], taunt: ['NumpadAdd'],
  },
  {}, {},
];

const PAD_GLYPHS = {
  playstation: { move: 'L-STICK', light: '✕', heavy: '○', launch: '□', special: '△', dodge: 'L1', jump: 'R1', taunt: 'L3', pause: 'OPTIONS' },
  xbox: { move: 'L-STICK', light: 'A', heavy: 'B', launch: 'X', special: 'Y', dodge: 'LB', jump: 'RB', taunt: 'L3', pause: 'MENU' },
};

export function controllerInfo(id = '') {
  const name = String(id);
  const lower = name.toLowerCase();
  let kind = 'generic';
  let label = 'GAMEPAD';
  if (/dualsense edge/.test(lower)) { kind = 'playstation'; label = 'DUALSENSE EDGE'; }
  else if (/dualsense/.test(lower)) { kind = 'playstation'; label = 'DUALSENSE'; }
  else if (/dualshock|playstation|sony|ps4|ps5/.test(lower)) { kind = 'playstation'; label = 'PLAYSTATION'; }
  else if (/steam deck|steam|valve/.test(lower)) { kind = 'steam'; label = 'STEAM DECK'; }
  else if (/rog ally|asus|ally/.test(lower)) { kind = 'asus'; label = 'ROG ALLY'; }
  else if (/xbox|xinput|microsoft/.test(lower)) { kind = 'xbox'; label = 'XBOX'; }
  else if (/wireless controller/.test(lower)) { kind = 'playstation'; label = 'PLAYSTATION'; }
  const glyphs = kind === 'playstation' ? PAD_GLYPHS.playstation : PAD_GLYPHS.xbox;
  return { kind, label, glyphs, id: name };
}

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.padPrev = {};
    this.padState = {};
    this.padObjects = {};
    this.padMeta = {};
    this.deadzone = 0.26;
    this.lastSource = 'keyboard';
    this.padActivePrev = false;
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.lastSource = 'keyboard';
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  update() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const connected = pads.filter(p => p && p.connected).sort((a, b) => a.index - b.index);
    this.padState = {};
    this.padObjects = {};
    this.padMeta = {};
    let active = false;
    let slot = 0;
    for (const pad of connected) {
      if (slot >= 4) break;
      const buttons = pad.buttons.map(b => !!(b?.pressed || (b?.value ?? 0) > 0.5));
      const prev = this.padPrev[pad.index] || {};
      const prevButtons = prev.buttons || [];
      const down = i => !!buttons[i];
      const act = (...indices) => {
        let held = false, edge = false;
        for (const i of indices) {
          if (!down(i)) continue;
          held = true;
          if (!prevButtons[i]) edge = true;
        }
        return { down: held, edge };
      };
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const left = ax < -this.deadzone || down(14);
      const right = ax > this.deadzone || down(15);
      const up = ay < -this.deadzone || down(12);
      const downPad = ay > this.deadzone || down(13);
      const mag = Math.hypot(ax, ay);
      const axisMag = mag > this.deadzone ? Math.min(1, (mag - this.deadzone) / (1 - this.deadzone)) : 0;
      let axisX = mag > 0.001 ? ax / mag * axisMag : 0;
      let axisY = mag > 0.001 ? ay / mag * axisMag : 0;
      const dpadX = (down(15) ? 1 : 0) - (down(14) ? 1 : 0);
      const dpadY = (down(13) ? 1 : 0) - (down(12) ? 1 : 0);
      const dpadMag = Math.hypot(dpadX, dpadY);
      if (dpadMag > 0) { axisX = dpadX / dpadMag; axisY = dpadY / dpadMag; }
      const info = controllerInfo(pad.id);
      this.padState[slot] = {
        left, right, up, down: downPad, axisX, axisY,
        leftEdge: left && !prev.left,
        rightEdge: right && !prev.right,
        upEdge: up && !prev.up,
        downEdge: downPad && !prev.down,
        light: act(0),
        heavy: act(1, 7),
        launch: act(2),
        special: act(3, 19),
        dodge: act(4, 6, 18),
        jump: act(5),
        taunt: act(10, 8, 17),
        start: act(9),
      };
      this.padObjects[slot] = pad;
      this.padMeta[slot] = { ...info, index: pad.index, slot };
      this.padPrev[pad.index] = { buttons, left, right, up, down: downPad };
      active = active || buttons.some(Boolean) || Math.abs(ax) > 0.35 || Math.abs(ay) > 0.35;
      slot++;
    }
    const live = new Set(connected.map(p => p.index));
    for (const key of Object.keys(this.padPrev)) {
      if (!live.has(Number(key))) delete this.padPrev[key];
    }
    if (active && !this.padActivePrev) this.lastSource = 'gamepad';
    this.padActivePrev = active;
  }

  get(index, remote = null) {
    if (remote) {
      const rx = (remote.right ? 1 : 0) - (remote.left ? 1 : 0);
      const ry = (remote.down ? 1 : 0) - (remote.up ? 1 : 0);
      const rm = Math.hypot(rx, ry) || 1;
      return {
        ...remote, axisX: rx / rm, axisY: ry / rm,
        light: remote.light, heavy: remote.heavy, launch: remote.launch,
        dodge: remote.dodge, jump: remote.jump, special: remote.special, taunt: remote.taunt,
      };
    }
    const km = KEYMAPS[index] || {};
    const held = codes => (codes || []).some(c => this.keys.has(c));
    const edge = codes => (codes || []).some(c => this.pressed.has(c));
    const p = this.padState[index] || null;
    const kx = (held(km.right) ? 1 : 0) - (held(km.left) ? 1 : 0);
    const ky = (held(km.down) ? 1 : 0) - (held(km.up) ? 1 : 0);
    const kmag = Math.hypot(kx, ky);
    const axisX = kmag > 0 ? kx / kmag : (p?.axisX || 0);
    const axisY = kmag > 0 ? ky / kmag : (p?.axisY || 0);
    return {
      left: held(km.left) || !!p?.left,
      right: held(km.right) || !!p?.right,
      up: held(km.up) || !!p?.up,
      down: held(km.down) || !!p?.down,
      axisX, axisY,
      light: edge(km.light) || !!p?.light?.edge,
      heavy: edge(km.heavy) || !!p?.heavy?.edge,
      launch: edge(km.launch) || !!p?.launch?.edge,
      dodge: edge(km.dodge) || !!p?.dodge?.edge,
      jump: edge(km.jump) || !!p?.jump?.edge,
      special: edge(km.special) || !!p?.special?.edge,
      taunt: edge(km.taunt) || !!p?.taunt?.edge,
      start: !!p?.start?.edge,
    };
  }

  readMenu() {
    const p = this.padState[0];
    if (!p) return { up: false, down: false, left: false, right: false, confirm: false, cancel: false, start: false };
    return {
      up: !!p.upEdge, down: !!p.downEdge, left: !!p.leftEdge, right: !!p.rightEdge,
      confirm: !!p.light?.edge, cancel: !!p.heavy?.edge, start: !!p.start?.edge,
    };
  }

  padInfo(slot = 0) {
    return this.padMeta[slot] || null;
  }

  hasPad() {
    return Object.keys(this.padObjects).length > 0;
  }

  rumble(strong = 0.2, weak = 0.15, duration = 60, index = 0, options = {}) {
    const pad = this.padObjects[index];
    const actuator = pad?.vibrationActuator;
    if (!actuator) return;
    const trigger = Math.max(0, Math.min(1, Number(options.trigger) || 0));
    const effects = Array.isArray(actuator.effects) ? actuator.effects : [];
    try {
      if (trigger > 0 && effects.includes('trigger-rumble')) {
        const left = Math.max(0, Math.min(1, Number(options.leftTrigger ?? trigger)));
        const right = Math.max(0, Math.min(1, Number(options.rightTrigger ?? trigger)));
        const result = actuator.playEffect('trigger-rumble', {
          startDelay: 0, duration, leftTrigger: left, rightTrigger: right,
        });
        result?.catch?.(() => {});
      } else if (typeof actuator.playEffect === 'function') {
        const result = actuator.playEffect('dual-rumble', {
          startDelay: 0, duration,
          strongMagnitude: Math.max(0, Math.min(1, strong)),
          weakMagnitude: Math.max(0, Math.min(1, weak)),
        });
        result?.catch?.(() => {});
      } else if (typeof actuator.pulse === 'function') {
        actuator.pulse(Math.max(strong, weak), duration);
      }
    } catch {}
  }

  endFrame() { this.pressed.clear(); this.released.clear(); }

  anyPadStart() {
    return Object.values(this.padState).some(p => p.start?.edge);
  }

  connectedPads() {
    return Object.keys(this.padState).length;
  }
}

export class Player {
  constructor(game, index, def, x = 0) {
    this.game = game;
    this.index = index;
    this.def = def;
    this.name = def.name;
    this.color = def.colors.accent;
    const skillSet = game.save.skills?.[def.id] || [];
    this.skills = new Set(skillSet);
    this.maxHp = 120 + (this.skills.has('vitality') ? 30 : 0);
    this.hp = this.maxHp;
    this.damageMult = 1 + (this.skills.has('might') ? 0.12 : 0);
    this.speedMult = 1 + (this.skills.has('swift') ? 0.1 : 0);
    this.styleMult = 1 + (this.skills.has('artist') ? 0.25 : 0);
    this.specialMult = 1 + (this.skills.has('overdrive') ? 0.35 : 0);
    this.defense = 0;
    this.lifesteal = 0;
    this.executeMult = 0;
    this.rankDamage = 0;
    this.bossHeal = 0;
    this.waveSpecial = 0;
    this.chainKill = false;
    this.specialDamage = 1;
    this.x = x; this.y = 0; this.z = rand(-1.5, 1.5);
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.walkVX = 0; this.walkVZ = 0; this.walkSpeed = 0;
    this.moveInputX = 0; this.moveInputY = 0;
    this.facing = 1;
    this.action = 'none';
    this.actionTime = 0;
    this.actionDuration = 0;
    this.actionHit = false;
    this.attackKind = 'light';
    this.chainStage = 0;
    this.chainTimer = 0;
    this.buffer = null;
    this.invuln = 0;
    this.hitStun = 0;
    this.dodgeCd = 0;
    this.grounded = true;
    this.airJumps = 0;
    this.special = this.waveSpecial * 100;
    this.style = 0;
    this.styleTimer = 0;
    this.styleRank = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.kills = 0;
    this.score = 0;
    this.downed = false;
    this.respawnTimer = 0;
    this.godMode = false;
    this.tauntTimer = 0;
    this.moving = false;
    this.animSpeed = 0;
    this.totalDamage = 0;
    const profile = WEAPON_PROFILES[def.weapon] || WEAPON_PROFILES.default;
    this.weaponProfile = profile;
    this.juggle = profile.juggle || null;
    const gunProfile = def.gun ? WEAPON_PROFILES[def.gun] : profile;
    this.gunProfile = gunProfile?.gun ? { ...gunProfile.gun } : null;
    this.gunSide = def.gun ? 'left' : 'right';
    this.hasRev = !!def.rev;
    this.rev = 0;
    this.revActive = false;
    this.fireCd = 0;
    this.kit = def.kit || {};
    this.perk = def.perk || {};
    this.gunKey = Object.keys(def.actions || {}).find(k => def.actions[k] === 'shot') || null;
    this.drain = this.perk.drain || 0;
    this.critMult = this.perk.critMult || 1;
    this.shockMult = this.perk.shockMult || 1;
    this.dashMult = this.perk.dashMult || 1;
    this.burnMult = this.perk.burnMult || 1;
    this.chainExtra = this.perk.chainExtra || 0;
    this.juggleMult = this.perk.juggleMult || 1;
    this.armor = this.perk.armor || 0;
    this.revTimeMult = this.perk.revTime || 1;
    this.visual = game.world.createFighter(def, false, false);
    this.visual.root.position.set(this.x, 0, this.z);
    this.state = {};
    this.syncVisual(0);
  }

  addUpgrade(up) {
    if (up && up.apply) up.apply(this);
    this.hp = Math.min(this.hp, this.maxHp);
  }

  rank() { return RANKS[this.styleRank]; }

  addStyle(amount) {
    this.style += amount * this.styleMult;
    this.styleTimer = 4.2;
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (this.style >= RANKS[i].min) idx = i;
    if (idx > this.styleRank) {
      this.styleRank = idx;
      const r = RANKS[idx];
      this.game.callbacks.rank?.(r.name, r.color, this.index);
      this.game.audio.rank(idx);
      this.game.run.reachedSSS ||= r.name === 'SSS';
    } else if (idx < this.styleRank) {
      this.styleRank = idx;
    }
  }

  addCombo() {
    this.combo++;
    this.comboTimer = 2.8;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.game.run.maxCombo = Math.max(this.game.run.maxCombo, this.combo);
    if ([10, 25, 50, 100, 150, 200].includes(this.combo)) {
      this.game.callbacks.milestone?.(this.combo);
      this.game.audio.rank(Math.min(6, Math.floor(this.combo / 20)));
    }
  }

  resetCombo() {
    this.combo = 0;
    this.comboTimer = 0;
    this.style = Math.max(0, this.style * 0.55);
    this.styleTimer = 2;
    this.styleRank = 0;
    for (let i = 0; i < RANKS.length; i++) if (this.style >= RANKS[i].min) this.styleRank = i;
    this.game.callbacks.rank?.(RANKS[this.styleRank].name, RANKS[this.styleRank].color, this.index);
  }

  startAttack(kind, stage = 0) {
    if (this.downed || this.hitStun > 0) return;
    const map = this.def.actions || {};
    if (map[kind]) kind = map[kind];
    if (kind === 'rev') { this.startRev(); return; }
    if (kind === 'shot') {
      if (!this.gunProfile || this.fireCd > 0) return;
    }
    let dur = 0.3, hitAt = 0.42;
    if (kind === 'light') {
      const seq = [0.27, 0.29, 0.33, 0.44];
      dur = seq[stage % 4];
      hitAt = stage === 3 ? 0.5 : 0.38;
      this.attackKind = 'light';
    } else if (kind === 'heavy') {
      dur = 0.55; hitAt = 0.46; this.attackKind = 'heavy';
    } else if (kind === 'shot') {
      dur = 0.3; hitAt = 0.14; this.attackKind = 'shot';
    } else if (kind === 'weave') {
      dur = 0.46; hitAt = 0.2; this.attackKind = 'weave';
    } else if (kind === 'launch') {
      dur = 0.46; hitAt = 0.42; this.attackKind = 'launch';
    } else if (kind === 'special') {
      dur = 0.95; hitAt = 0.46; this.attackKind = 'special';
    }
    this.action = kind;
    this.actionTime = 0;
    this.actionDuration = dur * (this.revActive ? 0.82 : 1);
    this.actionHitAt = hitAt;
    this.actionHit = false;
    this.chainStage = kind === 'light' ? stage : this.chainStage;
    if (kind !== 'shot') this.chainTimer = 0;
    else if (this.chainTimer <= 0) this.chainStage = -1;
    const target = this.game.nearestEnemy(this);
    if (target && Math.abs(target.x - this.x) > 0.35) this.facing = Math.sign(target.x - this.x);
    else if (!this.input?.left && !this.input?.right) {
      // keep facing
    }
    this.moving = false;
    this.walkVX *= 0.22;
    this.walkVZ *= 0.22;
    if (kind === 'light') this.vx += this.facing * [0.55, 1.15, 1.5, 2.5][stage % 4] * (this.revActive ? 1.25 : 1);
    if (kind === 'heavy') this.vx += this.facing * 3.4;
    if (kind === 'shot') this.vx -= this.facing * (this.revActive ? 0.5 : 1.1);
    if (kind === 'special') {
      this.game.callbacks.special?.(this);
    }
  }

  startRev() {
    if (!this.hasRev || this.revActive || this.rev < 0.25 || this.downed || this.hitStun > 0) return;
    this.revActive = true;
    this.game.audio.revUp?.();
    this.game.world.shake(0.16);
    this.game.world.ring(new THREE.Vector3(this.x, 0.06, this.z), this.color, 1.3, 0.5);
    this.game.world.burst(new THREE.Vector3(this.x, 1, this.z), this.color, 16, 5, 0.5);
    this.game.hitstop = 0.06;
    this.game.callbacks.announce?.('REV UP', this.def.comboName, this.color);
    if (!this.game.remoteInputs?.[this.index]) this.game.input?.rumble?.(0.4, 0.3, 140, this.index, { trigger: 0.6 });
  }

  startDive() {
    if (this.downed || this.y < 0.3) return;
    this.action = 'dive'; this.actionTime = 0; this.actionDuration = 1.5;
    this.actionHit = false; this.actionHitAt = 1;
    this.vy = -15;
    this.vx = this.facing * 7.5;
    this.invuln = Math.max(this.invuln, 0.3);
    this.game.audio.launch?.();
  }

  cancelAction() {
    if (this.action === 'none' || this.action === 'dodge' || this.action === 'special') return false;
    this.action = 'none';
    this.actionTime = 0;
    this.actionDuration = 0;
    this.actionHit = true;
    return true;
  }

  startDodge() {
    if (this.dodgeCd > 0 || this.hitStun > 0 || this.downed) return;
    this.action = 'dodge'; this.actionTime = 0; this.actionDuration = 0.42;
    this.actionHit = true;
    this.invuln = Math.max(this.invuln, 0.34);
    this.dodgeCd = 0.85;
    let dx = Number.isFinite(this.input?.axisX) ? this.input.axisX : 0;
    let dz = Number.isFinite(this.input?.axisY) ? this.input.axisY : 0;
    if (Math.hypot(dx, dz) < 0.3) { dx = this.facing; dz = 0; }
    const len = Math.hypot(dx, dz) || 1;
    this.vx = dx / len * 15;
    this.vz = dz / len * 15;
    this.walkVX = 0;
    this.walkVZ = 0;
    this.walkSpeed = 0;
    if (Math.abs(dx) > 0.15) this.facing = dx < 0 ? -1 : 1;
    this.game.audio.dodge();
    if (!this.game.remoteInputs?.[this.index]) this.game.input?.rumble?.(0.09, 0.07, 35, this.index);
    this.game.world.dashTrail(new THREE.Vector3(this.x, 0.2, this.z), this.color);
  }

  doJump() {
    if (this.downed) return;
    if (this.y <= 0.01) { this.vy = 9.4; this.grounded = false; this.audioJump = true; }
    else if (this.airJumps > 0) { this.airJumps--; this.vy = 8; this.audioJump = true; }
    else return;
    this.game.audio.jump();
    this.game.world.ring(new THREE.Vector3(this.x, 0.05, this.z), this.color, 0.5, 0.3);
  }

  specialAttack() {
    if (this.special < 100 || this.downed) return;
    this.special = 0;
    this.invuln = Math.max(this.invuln, 0.7);
    this.startAttack('special');
    this.game.audio.special();
    this.game.world.explosion(new THREE.Vector3(this.x, 1, this.z), this.color, 1.1);
    const stage = this.game.stageTheme;
    this.game.callbacks.specialCinema?.(this);
  }

  update(dt) {
    if (this.downed) {
      this.walkVX = 0; this.walkVZ = 0; this.walkSpeed = 0;
      this.moveInputX = 0; this.moveInputY = 0;
      this.moving = false; this.animSpeed = 0;
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && this.game.anyPlayerAlive()) {
        this.downed = false;
        this.hp = Math.round(this.maxHp * 0.4);
        this.invuln = 2;
        this.action = 'none';
        this.visual.deadT = 0;
        this.visual.root.traverse(o => { if (o.isMesh && o.material && o.material.userData.wasTransparent) o.material.opacity = o.material.userData.baseOpacity ?? 1; });
        this.game.callbacks.announce?.('BACK IN THE FIGHT', this.name, this.color);
        this.game.world.ring(new THREE.Vector3(this.x, 0.05, this.z), this.color, 1, 0.6);
      }
      this.syncVisual(dt);
      return;
    }

    const input = this.game.input.get(this.index, this.game.remoteInputs?.[this.index] || null);
    this.input = input;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitStun = Math.max(0, this.hitStun - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.hasRev) {
      if (this.revActive) {
        this.rev -= dt * 0.15 / (this.revTimeMult || 1);
        if (this.rev <= 0) { this.rev = 0; this.revActive = false; }
      } else {
        this.rev = Math.min(1, this.rev + dt * 0.025);
      }
    }
    this.chainTimer = Math.max(0, this.chainTimer - dt);
    this.tauntTimer = Math.max(0, this.tauntTimer - dt);
    if (this.buffer) { this.buffer.ttl -= dt; if (this.buffer.ttl <= 0) this.buffer = null; }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; this.game.callbacks.comboReset?.(this.index); }
    }
    if (this.styleTimer > 0) {
      this.styleTimer -= dt;
      this.style = Math.max(0, this.style - dt * (this.skills.has('artist') ? 14 : 22));
      let idx = 0;
      for (let i = 0; i < RANKS.length; i++) if (this.style >= RANKS[i].min) idx = i;
      if (idx !== this.styleRank) {
        this.styleRank = idx;
        this.game.callbacks.rank?.(RANKS[idx].name, RANKS[idx].color, this.index);
      }
    }

    const canAct = this.hitStun <= 0;
    if (canAct && this.action === 'none') {
      if (input.special && this.special >= 100) this.specialAttack();
      else if (input.dodge) this.startDodge();
      else if (input.jump) this.doJump();
      else if (input.light && input.down && this.y > 0.3) this.startDive();
      else if (input.light) {
        const stage = this.chainTimer > 0 ? (this.chainStage + 1) % 4 : 0;
        this.startAttack('light', stage);
      } else if (input.heavy) this.startAttack('heavy');
      else if (input.launch) this.startAttack('launch');
      else if (input.taunt) {
        this.tauntTimer = 0.8;
        this.addStyle(5);
        this.game.callbacks.announce?.('TAUNT', this.def.tauntName || this.def.comboName, this.color);
        this.game.audio.ui(true);
      }
    } else if (canAct && this.action !== 'dodge' && this.action !== 'none') {
      // DMC-style flow: any attack can be cancelled into a jump
      const gunPressed = this.gunKey === 'heavy' ? input.heavy : this.gunKey === 'launch' ? input.launch : false;
      if (input.jump && this.action !== 'special' && this.cancelAction()) {
        this.doJump();
      } else if (gunPressed && this.action === 'light' && this.fireCd <= 0) {
        // weapon cancel: slash straight into a gunshot
        this.cancelAction();
        this.startAttack('shot');
      } else if (input.light || input.heavy || input.launch) {
        this.buffer = { type: input.light ? 'light' : input.heavy ? 'heavy' : 'launch', ttl: 0.32 };
      }
      if (input.dodge && this.actionTime > 0.1) this.startDodge();
    }

    if (this.game.mode === 'training' && this.game.training.player.autoCombo && this.action === 'none' && this.hitStun <= 0) {
      const target = this.game.nearestEnemy(this, 3.4);
      if (target) {
        const stage = this.chainTimer > 0 ? (this.chainStage + 1) % 4 : 0;
        this.startAttack('light', stage);
      }
    }

    // Movement
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const ax = Number.isFinite(input.axisX) ? input.axisX : dx;
    const az = Number.isFinite(input.axisY) ? input.axisY : dz;
    const inputMag = Math.min(1, Math.hypot(ax, az));
    const speed = 5.5 * this.speedMult * (this.revActive ? 1.28 : 1) * (this.game.training?.player.speed || 1);
    this.moveInputX = ax;
    this.moveInputY = az;
    this.moving = false;
    if (this.action === 'none' && this.hitStun <= 0 && this.tauntTimer <= 0) {
      if (inputMag > 0.06) {
        this.walkVX += (ax * speed - this.walkVX) * Math.min(1, dt * 18);
        this.walkVZ += (az * speed - this.walkVZ) * Math.min(1, dt * 18);
        this.walkSpeed = Math.hypot(this.walkVX, this.walkVZ);
        this.moving = this.walkSpeed > 0.18;
        this.animSpeed = this.walkSpeed;
        if (!this.game.nearestEnemy(this, 8)) {
          if (ax < -0.14) this.facing = -1;
          else if (ax > 0.14) this.facing = 1;
        }
        if (this.walkSpeed > 1.4 && Math.random() < dt * 12) {
          this.game.world.spawnParticle(this.x - Math.sign(this.walkVX) * 0.3, 0.08, this.z, this.color, 1.2, 0.3, -2);
        }
      } else {
        this.walkVX += (0 - this.walkVX) * Math.min(1, dt * 16);
        this.walkVZ += (0 - this.walkVZ) * Math.min(1, dt * 16);
        this.walkSpeed = Math.hypot(this.walkVX, this.walkVZ);
        this.moving = this.walkSpeed > 0.18;
        this.animSpeed = this.walkSpeed;
        if (this.walkSpeed < 0.04) {
          this.walkVX = 0; this.walkVZ = 0; this.walkSpeed = 0;
          this.moving = false; this.animSpeed = 0;
        }
      }
      this.vx *= Math.pow(0.0001, dt);
      this.vz *= Math.pow(0.0001, dt);
    } else if (this.action === 'dodge') {
      this.moving = true;
      this.walkVX = 0; this.walkVZ = 0; this.walkSpeed = 0;
      this.animSpeed = 0;
    } else {
      this.walkVX *= Math.pow(0.0001, dt);
      this.walkVZ *= Math.pow(0.0001, dt);
      this.walkSpeed = Math.hypot(this.walkVX, this.walkVZ);
      this.animSpeed = this.walkSpeed;
      this.vx *= Math.pow(0.006, dt);
      this.vz *= Math.pow(0.006, dt);
    }

    // Face nearest target while idling/attacking
    if (this.action !== 'dodge' && (this.action !== 'none' || inputMag < 0.15)) {
      const target = this.game.nearestEnemy(this, 9);
      if (target) {
        const dir = Math.sign(target.x - this.x);
        if (dir !== 0) this.facing = dir;
      }
    }

    // Physics
    this.x += (this.vx + this.walkVX) * dt;
    this.z += (this.vz + this.walkVZ) * dt;
    if (this.y > 0 || this.vy > 0) {
      this.vy -= 25 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (!this.grounded) {
          this.grounded = true;
          this.airJumps = this.skills.has('aerial') ? 1 : 0;
          this.game.world.ring(new THREE.Vector3(this.x, 0.04, this.z), this.color, 0.45, 0.25);
        }
      } else this.grounded = false;
    }
    const bounds = this.game.getBounds();
    this.x = clamp(this.x, bounds[0], bounds[1]);
    this.z = clamp(this.z, -7.6, 7.6);

    // Action progress
    if (this.action !== 'none') {
      this.actionTime += dt;
      const p = this.actionTime / this.actionDuration;
      if (this.action === 'dive') {
        if (!this.actionHit && this.y <= 0.03) {
          this.actionHit = true;
          this.game.playerDive(this);
        }
      } else if (!this.actionHit && p >= this.actionHitAt) {
        this.actionHit = true;
        if (this.action === 'special') this.game.playerSpecial(this);
        else if (this.action === 'shot') this.game.playerShoot(this);
        else if (this.action === 'weave') this.game.playerWeave(this);
        else this.game.playerAttack(this, this.attackKind, this.chainStage);
      }
      if (p >= 1) {
        const was = this.action;
        this.action = 'none';
        this.actionTime = 0;
        if (was === 'light' || was === 'heavy' || was === 'launch' || was === 'shot') this.chainTimer = 0.48;
        if (this.buffer) {
          const b = this.buffer;
          this.buffer = null;
          if (b.type === 'light') {
            const stage = this.chainTimer > 0 ? (this.chainStage + 1) % 4 : 0;
            this.startAttack('light', stage);
          } else this.startAttack(b.type);
        }
      }
    }

    if (this.action === 'dodge') {
      this.vx *= Math.pow(0.02, dt);
      this.vz *= Math.pow(0.02, dt);
    }

    // Regen a fraction of special on damage done is handled in hit; passive trickle in training
    if (this.game.mode === 'training') this.special = 100;

    this.syncVisual(dt);
  }

  syncVisual(dt) {
    const p = this.action !== 'none' ? this.actionTime / this.actionDuration : 0;
    this.state = {
      x: this.x, y: this.y, z: this.z, facing: this.facing,
      action: this.tauntTimer > 0 ? 'none' : this.action,
      actionProgress: p, stage: this.chainStage, moving: this.moving,
      speed: this.walkSpeed || 0, moveX: this.moveInputX || 0, moveY: this.moveInputY || 0,
      backward: this.facing * this.walkVX < -0.12,
      blink: this.action === 'light' && this.chainStage === 3 && this.kit?.light3 === 'blink',
      rev: this.revActive, revAmount: this.rev,
      velocityX: this.vx + this.walkVX, velocityZ: this.vz + this.walkVZ,
      dead: this.downed, block: false,
    };
    if (this.visual) {
      this.visual.state = this.state;
      if (this.downed) this.visual.root.visible = true;
      else this.visual.root.visible = !(this.invuln > 0 && this.action === 'none' && Math.floor(this.game.time * 22) % 2 === 0);
    }
  }
}

export class Game {
  constructor(world, audio, save, callbacks) {
    this.world = world;
    this.audio = audio;
    this.save = save;
    this.callbacks = callbacks || {};
    this.input = new InputManager();
    this.mode = null;
    this.players = [];
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.pickups = [];
    this.run = null;
    this.paused = false;
    this.active = false;
    this.time = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.boss = null;
    this.bossActive = false;
    this.bossIndex = 0;
    this.phase = 'idle';
    this.pendingSpawn = 0;
    this.clearTimer = 0;
    this.advanceTarget = null;
    this.stageTheme = 'downtown';
    this.hudTimer = 0;
    this.enemyId = 1;
    this.remoteInputs = null;
    this.network = null;
    this.training = {
      player: { takeDamage: false, infiniteHealth: true, infiniteSpecial: true, speed: 1, damage: 1, autoCombo: false },
      dummy: { behavior: 'approach', speed: 1, juggle: true, health: 'infinite', count: 3, facing: 'player' },
    };
    this.stageIndex = 0;
    this.anchors = [-32, 0, 32];
    this.takenUpgrades = [];
    this.cameraFocus = 0;
    this.zoneCenter = 0;
    this.zoneHalf = 13;
    this.lastBossName = '';
    this.spawnFxTimer = 0;
  }

  start(config) {
    this.mode = config.mode || 'campaign';
    this.stageIndex = config.stageIndex || 0;
    this.squad = config.squad || 1;
    this.remoteInputs = config.remoteInputs || null;
    this.takenUpgrades = [];
    this.run = {
      mode: this.mode, score: 0, shards: 0, kills: 0, bossKills: 0,
      wave: 0, maxCombo: 0, reachedSSS: false, time: 0, stageIndex: this.stageIndex,
      damage: 0, upgrades: [], startTime: performance.now(),
    };
    this.paused = false;
    this.active = true;
    this.time = 0;
    this.enemies = [];
    this.players = [];
    this.projectiles = [];
    this.hazards = [];
    this.pickups = [];
    this.boss = null;
    this.bossActive = false;
    this.bossIndex = 0;
    this.bossSpawned = false;
    this.ending = false;
    this.finished = false;
    this.phase = 'intro';
    this.advanceTarget = null;
    this.world.clearShowcase();
    this.world.setCameraMode('game');
    this.world.reset(this.stageThemeFor(this.stageIndex));
    this.world.setGates(false);
    this.setupPlayers(config.characterIds || [this.save.selectedChar || 'rook']);
    this.audio.setIntensity(0.25);
    this.callbacks.boss?.(null);
    this.hudTimer = 0;
    if (this.mode === 'training') {
      this.zoneCenter = 0; this.zoneHalf = 15;
      this.spawnTraining();
      this.setObjective('THE LAB', 'Unleash. Experiment. Break the combo counter.');
      this.callbacks.banner?.('TRAINING', 'NO RULES // INFINITE SPECIAL', '#9cff57');
    } else if (this.mode === 'bossrush') {
      this.zoneCenter = 0; this.zoneHalf = 16;
      this.pendingSpawn = 1.3;
      this.setObjective('BOSS RUSH', 'The gauntlet begins.');
      this.callbacks.banner?.('BOSS RUSH', 'FIVE KILLERS. NO WITNESSES.', '#ffc247');
    } else if (this.mode === 'survival') {
      this.zoneCenter = 0; this.zoneHalf = 16;
      this.run.wave = 1;
      this.pendingSpawn = 1.1;
      this.setObjective('SURVIVAL', 'Endless night. Build your power.');
    } else if (this.mode === 'rampage') {
      this.zoneCenter = 0; this.zoneHalf = 16;
      this.run.wave = 1;
      this.pendingSpawn = 1.1;
      this.setObjective('RAMPAGE', 'Ten waves. Score attack. No upgrades.');
    } else {
      this.zoneCenter = this.anchors[0];
      this.zoneHalf = 13;
      this.run.wave = 1;
      this.pendingSpawn = 1.2;
      this.setObjective(STAGES[this.stageIndex].name, STAGES[this.stageIndex].district);
    }
    this.refreshHud(true);
  }

  setupPlayers(ids) {
    const count = Math.max(1, Math.min(4, this.squad || 1));
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let id = ids[i];
      if (!id || used.has(id)) {
        id = CHARACTERS.find(c => this.save.unlocked.includes(c.id) && !used.has(c.id))?.id || 'rook';
      }
      used.add(id);
      const def = CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
      const startX = this.mode === 'campaign' ? -36 + i * 1.3 : -3 + i * 2;
      const p = new Player(this, i, def, startX);
      p.z = (i - (count - 1) / 2) * 1.1;
      p.x = startX;
      p.visual.root.position.set(p.x, 0, p.z);
      this.players.push(p);
    }
  }

  stageThemeFor(i) {
    const theme = STAGES[i]?.theme || 'downtown';
    this.stageTheme = theme;
    return theme;
  }

  nextStage() {
    if (this.stageIndex >= STAGES.length - 1) return;
    this.stageIndex++;
    this.run.stageIndex = this.stageIndex;
    this.world.reset(this.stageThemeFor(this.stageIndex));
    this.world.setCameraMode('game');
    this.enemies.forEach(e => this.world.removeFighter(e.visual));
    this.enemies = [];
    this.projectiles.forEach(pr => pr.mesh && this.world.worldRoot.remove(pr.mesh));
    this.projectiles = [];
    this.hazards = [];
    this.boss = null; this.bossActive = false;
    this.players.forEach((p, i) => {
      p.x = -36 + i * 1.3; p.z = (i - (this.players.length - 1) / 2) * 1.1; p.y = 0;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.35));
      p.downed = false;
      p.action = 'none';
      p.style = 0; p.styleTimer = 0; p.styleRank = 0;
      p.combo = 0; p.comboTimer = 0;
      p.visual.deadT = 0;
      p.visual.root.position.set(p.x, 0, p.z);
      p.visual.root.visible = true;
      p.visual.root.traverse(o => { if (o.isMesh && o.material && o.material.userData.wasTransparent) o.material.opacity = o.material.userData.baseOpacity ?? 1; });
    });
    this.stageTheme = this.stageThemeFor(this.stageIndex);
    this.players.forEach(p => {
      if (p.visual) this.world.removeFighter(p.visual);
      p.visual = this.world.createFighter(p.def, false, false);
      p.visual.root.position.set(p.x, 0, p.z);
      p.state = {};
      p.syncVisual(0);
    });
    this.run.wave = 1;
    this.phase = 'intro';
    this.pendingSpawn = 1.2;
    this.anchors = [-32, 0, 32];
    this.zoneCenter = this.anchors[0];
    this.zoneHalf = 13;
    this.advanceTarget = null;
    this.bossSpawned = false;
    this.ending = false;
    this.finished = false;
    this.callbacks.boss?.(null);
    this.setObjective(STAGES[this.stageIndex].name, STAGES[this.stageIndex].district);
    this.callbacks.banner?.(STAGES[this.stageIndex].name, STAGES[this.stageIndex].district, '#ff3d74');
    this.resume();
    this.refreshHud(true);
  }

  setObjective(title, sub) {
    this.objective = { title, sub };
    this.callbacks.objective?.(title, sub);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  togglePause() { this.paused = !this.paused; return this.paused; }

  getBounds() {
    if (this.mode === 'campaign') {
      if (this.phase === 'advance') return [-42, 42];
      return [this.zoneCenter - this.zoneHalf, this.zoneCenter + this.zoneHalf];
    }
    return [-this.zoneHalf, this.zoneHalf];
  }

  nearestEnemy(player, maxDist = 30) {
    let best = null, bd = maxDist;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  anyPlayerAlive() { return this.players.some(p => !p.downed); }

  aliveEnemies() { return this.enemies.filter(e => !e.dead); }

  update(dt) {
    if (!this.active || this.paused) return;
    dt = Math.min(dt, 0.034);
    this.time += dt;
    this.run.time += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.world.update(dt * 0.35);
      this.updateCamera(dt);
      return;
    }
    const sdt = dt * this.timeScale;
    this.timeScale = lerp(this.timeScale, 1, dt * 4);

    for (const e of this.enemies) e.visual.state = e.state || {};
    this.players.forEach(p => p.update(sdt));
    this.updateEnemies(sdt);
    this.updateProjectiles(sdt);
    this.updateHazards(sdt);
    this.updatePickups(sdt);
    this.updateDirector(sdt);
    this.cleanup();
    this.world.update(sdt);
    this.updateCamera(dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.07; this.refreshHud(); }
    if (this.players.every(p => p.downed) && (this.mode !== 'training')) {
      if (!this.ending) {
        this.ending = true;
        this.clearTimer = 1.6;
        this.phase = 'defeat';
        this.callbacks.announce?.('DOWN', 'The city wins this round.', '#ff3d74');
      }
    }
    if (this.phase === 'defeat') {
      this.clearTimer -= sdt;
      if (this.clearTimer <= 0) this.finishRun(false);
    }
    if (this.phase === 'victory') {
      this.clearTimer -= sdt;
      if (this.clearTimer <= 0) this.finishRun(true);
    }
    this.input.endFrame?.();
  }

  updateCamera(dt) {
    const alive = this.players.filter(p => !p.downed);
    const focus = alive.length ? alive.reduce((s, p) => s + p.x, 0) / alive.length : this.zoneCenter;
    const front = alive.length ? alive.reduce((s, p) => s + p.facing, 0) / alive.length : 0;
    // lead the camera with the player's momentum so fast movement reads as fast
    const drive = alive.length ? alive.reduce((s, p) => s + (p.walkVX || 0) + p.facing * 0.6, 0) / alive.length : 0;
    const target = clamp(focus + front * 1.2 + drive * 0.16, -43, 43);
    this.cameraFocus = target;
    this.world.updateCamera(dt, target, focus + front * 1.8, this.zoneCenter);
  }

  updateDirector(dt) {
    if (this.mode === 'training') {
      const tp = this.training.player;
      const td = this.training.dummy;
      this.players.forEach(p => {
        if (tp.infiniteHealth) p.hp = p.maxHp;
        if (tp.infiniteSpecial) p.special = 100;
        if (p.downed && this.players.every(pl => pl.downed)) {
          p.downed = false;
          p.hp = p.maxHp;
          p.respawnTimer = 0;
          p.action = 'none';
          p.visual.deadT = 0;
        }
      });
      this.enemies.forEach(e => { if (e.training && td.health === 'infinite') e.hp = e.maxHp; });
      return;
    }

    if (this.phase === 'bossdown') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) { this.phase = 'idle'; this.onBossDefeated(); }
      return;
    }
    if (this.phase === 'cleared') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.afterClear();
      return;
    }
    if (this.phase === 'advance') {
      const alive = this.players.filter(p => !p.downed);
      const avg = alive.length ? alive.reduce((s, p) => s + p.x, 0) / alive.length : this.zoneCenter;
      if (avg > this.advanceTarget - 5) {
        this.run.wave++;
        this.phase = 'intro';
        this.pendingSpawn = 0.45;
        this.zoneCenter = this.anchors[this.run.wave - 1] || 32;
        this.setObjective(STAGES[this.stageIndex].name, `WAVE ${this.run.wave} / 3 — INCOMING`);
      }
      return;
    }
    if (this.phase === 'upgrade') return;
    if (this.phase === 'stagecomplete') return;
    if (this.phase === 'intermission') {
      this.pendingSpawn -= dt;
      if (this.pendingSpawn <= 0) this.spawnNextBoss();
      return;
    }
    if (this.phase === 'intro') {
      this.pendingSpawn -= dt;
      if (this.pendingSpawn <= 0) this.spawnForMode();
      return;
    }
    if (this.phase !== 'combat') return;
    if (this.pendingSpawn > 0) {
      this.pendingSpawn -= dt;
      if (this.pendingSpawn <= 0) this.spawnForMode();
      return;
    }
    const alive = this.aliveEnemies();
    if (alive.length === 0) {
      if (!this.clearTimer) {
        this.clearTimer = 1.35;
        this.phase = 'cleared';
        this.callbacks.announce?.('AREA CLEAR', this.mode === 'campaign' ? 'MOVE EAST' : 'NEXT WAVE INCOMING', '#4fd1c5');
        this.audio.ui(true);
      }
    } else {
      this.clearTimer = 0;
    }
  }

  afterClear() {
    const mode = this.mode;
    if (mode === 'campaign') {
      const stage = STAGES[this.stageIndex];
      if (this.run.wave < stage.waves.length) {
        this.advanceTarget = this.anchors[this.run.wave];
        this.phase = 'advance';
        this.setObjective(stage.name, 'ADVANCE EAST // NEXT ZONE');
        this.callbacks.announce?.('ADVANCE', 'MOVE EAST TO THE NEXT ZONE', '#4fd1c5');
      } else if (!this.bossSpawned) {
        this.bossSpawned = true;
        this.zoneCenter = this.anchors[2];
        this.zoneHalf = 15;
        this.spawnBoss(BOSSES.find(b => b.id === stage.boss), 1, false);
        this.setObjective(stage.name, `ELITE // ${this.boss.name}`);
        this.phase = 'combat';
      }
      return;
    }
    if (mode === 'survival') {
      this.run.wave++;
      if (this.run.wave % 2 === 0) {
        this.phase = 'upgrade';
        this.callbacks.upgrade?.(this.upgradeChoices());
        this.callbacks.announce?.('LEVEL UP', 'CHOOSE A POWER', '#ffd166');
      } else {
        this.phase = 'intro';
        this.pendingSpawn = 0.9;
      }
      return;
    }
    if (mode === 'rampage') {
      this.run.wave++;
      if (this.run.wave > 10) this.completeVictory();
      else { this.phase = 'intro'; this.pendingSpawn = 0.9; }
      return;
    }
    if (mode === 'bossrush') {
      // handled by bossdown path
    }
  }

  upgradeChoices() {
    const available = UPGRADES.filter(u => !this.takenUpgrades.includes(u.id));
    const pool = available.length >= 3 ? available : UPGRADES;
    const picks = [];
    while (picks.length < 3) {
      const up = pool[Math.floor(Math.random() * pool.length)];
      if (!picks.includes(up)) picks.push(up);
    }
    return picks;
  }

  spawnForMode() {
    if (this.mode === 'campaign') this.spawnCampaignWave();
    else if (this.mode === 'survival') this.spawnSurvivalWave();
    else if (this.mode === 'rampage') this.spawnRampageWave();
    else if (this.mode === 'bossrush') this.spawnNextBoss();
  }

  spawnCampaignWave() {
    const stage = STAGES[this.stageIndex];
    const waveData = stage.waves[Math.min(this.run.wave - 1, stage.waves.length - 1)];
    const anchor = this.run.wave === 1 ? this.anchors[0] : this.run.wave === 2 ? this.anchors[1] : this.anchors[2];
    this.zoneCenter = anchor; this.zoneHalf = 14;
    this.adjustAnchorPlayers(anchor);
    this.callbacks.boss?.(null);
    const scale = 1 + this.stageIndex * 0.22 + (this.run.wave - 1) * 0.06;
    for (const [type, count] of waveData.enemies) {
      for (let i = 0; i < count; i++) this.spawnEnemy(type, anchor + rand(-7, 7), scale);
    }
    this.setObjective(stage.name, `WAVE ${this.run.wave} / ${stage.waves.length} — ${this.aliveEnemies().length} HOSTILES`);
    this.callbacks.banner?.('WAVE ' + this.run.wave, stage.name, '#ff3d74');
    this.phase = 'combat';
    this.audio.setIntensity(0.35 + this.run.wave * 0.08);
  }

  spawnSurvivalWave() {
    const wave = this.run.wave;
    const isBoss = wave % 5 === 0;
    this.callbacks.boss?.(null);
    if (isBoss) {
      const bossDef = BOSSES[Math.min(BOSSES.length - 1, Math.floor(wave / 5) - 1)];
      this.spawnBoss(bossDef, 1 + wave * 0.08, true);
      this.setObjective('SURVIVAL', `WAVE ${wave} — ELITE INBOUND`);
      this.callbacks.banner?.(`WAVE ${wave}`, 'ELITE ENCOUNTER', '#ffc247');
    } else {
      const scale = 1 + wave * 0.075;
      const count = Math.min(11, 2 + Math.floor(wave * 0.8));
      for (let i = 0; i < count; i++) {
        const pool = wave < 3 ? ['thug', 'thug', 'gunner'] : wave < 6 ? ['thug', 'brute', 'gunner', 'ninja'] : ['thug', 'brute', 'brute', 'gunner', 'ninja', 'ninja'];
        this.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], rand(-12, 12), scale);
      }
      this.setObjective('SURVIVAL', `WAVE ${wave} — ${this.aliveEnemies().length} HOSTILES`);
      this.callbacks.banner?.(`WAVE ${wave}`, 'SURVIVE', '#32d8ff');
    }
    this.phase = 'combat';
    this.audio.setIntensity(clamp(0.3 + wave * 0.06, 0.3, 1));
  }

  spawnRampageWave() {
    const wave = this.run.wave;
    this.callbacks.boss?.(null);
    if (wave === 5 || wave === 10) {
      const bossDef = BOSSES[wave === 5 ? 1 : 4];
      this.spawnBoss(bossDef, 1 + wave * 0.055, wave === 10);
      this.setObjective('RAMPAGE', `WAVE ${wave} — APEX`);
      this.callbacks.banner?.(`WAVE ${wave}`, 'APEX ENCOUNTER', '#ff8a3d');
    } else {
      const count = 3 + Math.floor(wave * 0.8);
      const pool = wave < 3 ? ['thug', 'gunner'] : ['thug', 'brute', 'gunner', 'ninja'];
      for (let i = 0; i < count; i++) this.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], rand(-13, 13), 1 + wave * 0.1);
      this.setObjective('RAMPAGE', `WAVE ${wave} / 10 — ${this.aliveEnemies().length} HOSTILES`);
      this.callbacks.banner?.(`WAVE ${wave}`, 'NO MERCY', '#ff8a3d');
    }
    this.phase = 'combat';
    this.audio.setIntensity(clamp(0.4 + wave * 0.06, 0.4, 1));
  }

  spawnNextBoss() {
    if (this.bossIndex >= 5) return this.completeVictory();
    const def = BOSSES[this.bossIndex];
    this.spawnBoss(def, 1 + this.bossIndex * 0.1, false);
    const names = ['FIRST SEAL', 'SECOND SEAL', 'THIRD SEAL', 'FOURTH SEAL', 'FINAL SEAL'];
    this.setObjective('BOSS RUSH', `${names[this.bossIndex]} — ${def.name}`);
    this.callbacks.banner?.(def.name, def.title, '#ffc247');
    this.phase = 'combat';
    this.audio.setIntensity(0.75);
  }

  adjustAnchorPlayers(anchor) {
    // Do not teleport; guide camera zone toward the fight.
    for (const p of this.players) {
      if (Math.abs(p.x - anchor) > 14 && this.run.wave > 1) {
        // allow travel, the camera zone follows the players for advancing sections
      }
    }
  }

  spawnEnemy(type, x, scale = 1) {
    const base = ENEMY_TYPES[type];
    const def = {
      id: type, name: base.name, weapon: type === 'brute' ? 'hammer' : type === 'ninja' ? 'daggers' : type === 'gunner' ? 'tonfas' : 'gauntlets',
      color: base.color, accent: base.accent,
      colors: { suit: base.color, accent: base.accent, skin: 0x926447, hair: 0x111116, energy: base.accent },
      scale: base.scale,
    };
    const e = {
      id: this.enemyId++, type, def, base, x, y: 0, z: rand(-5.5, 5.5), vx: 0, vy: 0, vz: 0,
      facing: -1, hp: base.hp * scale, maxHp: base.hp * scale, speed: base.speed * (1 + (scale - 1) * 0.25),
      damage: base.damage * (1 + (scale - 1) * 0.4), range: base.range, reward: base.reward,
      attackCd: rand(0.6, 1.6), hitStun: 0, attackWindup: 0, action: 'none', actionTime: 0,
      dead: false, deadT: 0, launched: false, launchedT: 0, color: base.accent,
      boss: false, elite: scale > 1.6, name: base.name, telegraph: 0,
    };
    e.visual = this.world.createFighter(def, true, false);
    e.visual.root.position.set(e.x, 0, e.z);
    this.enemies.push(e);
    this.world.ring(new THREE.Vector3(e.x, 0.06, e.z), base.accent, 0.8, 0.35);
    this.world.burst(new THREE.Vector3(e.x, 0.8, e.z), base.accent, 10, 3, 0.5);
    return e;
  }

  spawnBoss(def, scale = 1, eliteMode = false) {
    const visualDef = {
      id: def.id === 'brutus' ? 'grimm' : def.id === 'conductor' ? 'volt' : def.id === 'seraph' ? 'vex' : def.id === 'wraith' ? 'nyx' : 'mara',
      name: def.name, weapon: def.id === 'brutus' ? 'hammer' : def.id === 'conductor' ? 'staff' : def.id === 'seraph' ? 'katana' : def.id === 'wraith' ? 'scythe' : 'demonblade',
      color: def.color, accent: def.accent,
      colors: { suit: def.color, accent: def.accent, skin: 0x9a6b55, hair: 0x0d0e14, energy: def.accent },
      scale: 1,
    };
    const e = {
      id: this.enemyId++, type: 'boss', def: visualDef, base: def,
      x: this.zoneCenter + 9, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      facing: -1, hp: def.hp * scale, maxHp: def.hp * scale, speed: def.speed,
      damage: def.damage, range: 2.6, reward: 250, attackCd: 1.5, hitStun: 0,
      dead: false, deadT: 0, launched: false, launchedT: 0, color: def.accent,
      boss: true, phase: 1, specialTimer: 2.8, charging: 0, attackWindup: 0,
      action: 'none', actionTime: 0, actionDuration: 0, actionHit: false,
      name: def.name, title: def.title, eliteMode,
    };
    e.visual = this.world.createFighter(visualDef, true, true);
    e.visual.root.position.set(e.x, 0, e.z);
    this.enemies.push(e);
    this.boss = e;
    this.bossActive = true;
    this.lastBossName = def.name;
    this.callbacks.boss?.({ name: def.name, title: def.title, hp: e.hp, maxHp: e.maxHp, color: def.accent, index: this.bossIndex });
    this.audio.boss();
    this.world.explosion(new THREE.Vector3(e.x, 1, e.z), def.accent, 1.7);
    this.world.setArena(e.x);
    return e;
  }

  spawnTraining() {
    this.zoneCenter = 0; this.zoneHalf = 15;
    this.enemies.forEach(e => this.world.removeFighter(e.visual));
    this.enemies = [];
    const spots = [[-3, -2], [0, 2], [4, 0], [-6, 1], [6, -1]];
    const count = Math.max(1, Math.min(3, this.training.dummy.count | 0));
    for (let i = 0; i < count; i++) {
      const [x, z] = spots[i];
      const e = this.spawnEnemy('brute', x, 1.8);
      e.z = z; e.hp = 9999; e.maxHp = 9999; e.training = true; e.speed = 0;
      e.dummyHome = { x, z };
      e.dummyPhase = i * 1.7;
      e.visual.root.position.set(x, 0, z);
    }
    this.phase = 'combat';
  }

  resetTrainingDummies() {
    if (this.mode !== 'training') return;
    const dummies = this.enemies.filter(e => e.training);
    const spots = [[-3, -2], [0, 2], [4, 0]];
    dummies.forEach((e, i) => {
      const spot = e.dummyHome || spots[i % spots.length];
      e.x = spot.x; e.z = spot.z; e.y = 0; e.vy = 0; e.vx = 0; e.vz = 0;
      e.hp = e.maxHp; e.hitStun = 0; e.launched = false; e.launchedT = 0;
      e.action = 'none'; e.actionTime = 0; e.dead = false; e.deadT = 0;
      e.visual.root.position.set(e.x, 0, e.z);
    });
    this.world.burst(new THREE.Vector3(0, 1, 0), 0x9cff57, 14, 4, 0.5);
  }

  attackShape(def, kind, stage = 0) {
    const base = WEAPON_PROFILES[def.weapon] || WEAPON_PROFILES.default;
    const statScale = 1 + ((def.range ?? 5) - 5) * 0.035;
    let reach = base.reach * statScale;
    let width = base.width * statScale;
    let vertical = 2.2;
    let behind = 0.3;
    if (kind === 'light') {
      const stageScale = 1 + stage * 0.06;
      reach *= stageScale;
      width *= stageScale;
      const mods = {
        blunt: [[0.92, 0.86], [1.0, 1.24], [1.1, 0.92], [1.08, 1.2]],
        tonfa: [[0.92, 0.86], [1.0, 1.24], [1.1, 0.92], [1.08, 1.2]],
        blade: [[0.96, 1.18], [1.04, 1.3], [1.14, 0.9], [1.1, 1.28]],
        dagger: [[0.9, 0.9], [0.94, 0.95], [1.14, 0.78], [1.08, 1.2]],
        pole: [[1.12, 0.75], [1.04, 1.35], [1.16, 0.85], [1.12, 1.28]],
        hammer: [[0.98, 0.95], [0.98, 1.0], [1.1, 0.95], [1.08, 1.24]],
        gun: [[0.95, 0.95], [1.0, 1.35], [1.1, 0.85], [1.15, 1.45]],
      };
      const m = mods[base.family]?.[stage];
      if (m) { reach *= m[0]; width *= m[1]; }
      if (stage === 3) { reach *= 1.05; width *= 1.12; behind = 0.45; }
    } else if (kind === 'heavy') {
      reach *= 1.14; width *= 1.18; vertical = 2.35; behind = 0.6;
    } else if (kind === 'launch') {
      reach *= 1.06; width *= 1.05; vertical = 2.45; behind = 0.35;
    }
    return { reach, width, vertical, behind, close: Math.max(1.05, width * 0.9) };
  }

  playerWeave(p) {
    const dmg = 24 * (1 + (p.perk.weavePierce || 0) * 0.3) * p.damageMult * RANKS[p.styleRank].mult * (p.revActive ? 1.5 : 1);
    const geo = new THREE.RingGeometry(0.9, 2.9, 26, 1, -Math.PI * 0.42, Math.PI * 0.84);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff224f, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x + p.facing * 1.5, 1.15, p.z);
    mesh.rotation.y = p.facing > 0 ? 0 : Math.PI;
    this.world.worldRoot.add(mesh);
    const core = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.75, 26, 1, -Math.PI * 0.34, Math.PI * 0.68),
      new THREE.MeshBasicMaterial({ color: 0xff9aa6, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    core.position.copy(mesh.position);
    core.rotation.copy(mesh.rotation);
    this.world.worldRoot.add(core);
    this.projectiles.push({
      mesh, core,
      x: mesh.position.x, y: 1.15, z: p.z,
      vx: p.facing * 24, vz: 0,
      damage: dmg, color: 0xff224f, life: 0.85, owner: p, friendly: true,
      wave: true, pierce: 90, travel: 0, hitSet: new Set(),
    });
    this.world.shake(0.08);
    this.audio.slash();
    if (!this.remoteInputs?.[p.index]) this.input.rumble?.(0.2, 0.14, 60, p.index);
    p.addStyle(4);
  }

  playerDive(p) {
    const dmg = 22 * p.damageMult * RANKS[p.styleRank].mult * (p.revActive ? 1.5 : 1);
    let hits = 0;
    for (const e of this.aliveEnemies()) {
      if (Math.hypot(e.x - p.x, e.z - p.z) > 3.6) continue;
      hits++;
      this.hitEnemy(e, dmg, { heavy: true, launch: 4.8, source: p, color: p.color });
      this.world.burst(new THREE.Vector3(e.x, e.y + 0.9, e.z), p.color, 8, 4, 0.4);
    }
    this.world.ring(new THREE.Vector3(p.x, 0.06, p.z), p.color, 1.7, 0.45);
    this.world.shake(hits ? 0.2 : 0.1);
    this.audio.heavy();
    this.hitstop = hits ? 0.05 : 0.02;
    if (!this.remoteInputs?.[p.index]) this.input.rumble?.(0.4, 0.3, 110, p.index, { trigger: 0.4 });
    p.addStyle(hits ? 9 : 3);
  }

  playerShoot(p) {
    const gun = p.gunProfile;
    if (!gun) return;
    p.fireCd = gun.cooldown;
    let dx = p.facing, dz = 0;
    const target = this.nearestEnemy(p, 28);
    if (target) {
      const ax = target.x - p.x, az = target.z - p.z;
      const dist = Math.hypot(ax, az) || 1;
      if ((ax / dist) * p.facing > 0.6) { dx = ax / dist; dz = az / dist; }
    }
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const side = p.gunSide === 'left' ? p.facing * 0.38 : 0;
    const muzzle = new THREE.Vector3(p.x + dx * 0.95, p.y + 1.18, p.z + dz * 0.95 + side);
    this.world.muzzleFlash(muzzle, dx, dz, p.color);
    this.spawnPlayerBullet(p, dx, dz, gun);
    this.audio.gunshot();
    this.world.shake(p.revActive ? 0.16 : 0.12);
    this.hitstop = 0.03;
    if (!this.remoteInputs?.[p.index]) this.input.rumble?.(p.revActive ? 0.5 : 0.4, 0.26, 85, p.index, { trigger: 0.45 });
    p.addStyle(4);
  }

  spawnPlayerBullet(p, dx, dz, gun, delay = 0, damageScale = 1) {
    const mesh = new THREE.Group();
    const tracer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.02, 1.2, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff0b4, toneMapped: false, transparent: true, opacity: 0.95 })
    );
    tracer.rotation.x = Math.PI / 2;
    mesh.add(tracer);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: p.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.55);
    mesh.add(glow);
    const y = p.y + 1.18;
    const x = p.x + dx * 0.95, z = p.z + dz * 0.95;
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.atan2(dx, dz);
    this.world.worldRoot.add(mesh);
    const pierce = p.revActive && p.kit?.passive === 'revPierce' ? 2 : 0;
    this.projectiles.push({
      mesh, x, y, z,
      vx: dx * gun.speed, vz: dz * gun.speed,
      dirX: dx, dirZ: dz, pierce,
      hitSet: new Set(),
      damage: gun.damage * damageScale * p.damageMult * RANKS[p.styleRank].mult
        * (p.revActive ? 1.5 : 1)
        * (this.mode === 'training' ? (this.training.player.damage || 1) : 1),
      color: p.color, life: (gun.range || 30) / gun.speed, delay,
      owner: p, friendly: true, travel: 0,
    });
  }

  applyKitOnHit(p, e, kind, stage, damage, kit) {
    const passive = kit.passive;
    if (passive === 'burn') {
      e.burn = 2.4;
      e.burnTick = 0;
      e.burnDmg = Math.max(1, damage * 0.16 * (p.burnMult || 1));
      e.burnSource = p;
      this.world.burst(new THREE.Vector3(e.x, e.y + 0.9, e.z), 0xff6a1a, 5, 2.4, 0.4);
    } else if (passive === 'chain') {
      this.chainLightning(p, e, damage);
    } else if (passive === 'drain' || passive === 'crit') {
      const rate = passive === 'drain' ? (p.drain || 0) : 0.04;
      if (rate > 0) {
        const heal = damage * rate;
        if (heal > 0) p.hp = Math.min(p.maxHp, p.hp + heal);
      }
    }
    if (kit.light3 === 'harvest' && kind === 'light' && stage === 3) {
      e.vx -= p.facing * 12;
      e.vz *= 0.3;
      this.world.ring(new THREE.Vector3(e.x, 0.06, e.z), 0x9cff57, 0.9, 0.35);
      this.world.burst(new THREE.Vector3(e.x, e.y + 0.9, e.z), 0x9cff57, 6, 2.6, 0.4);
    }
  }

  chainLightning(p, from, damage) {
    const near = this.aliveEnemies()
      .filter(e => e !== from && Math.hypot(e.x - from.x, e.z - from.z) < 7.5)
      .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))
      .slice(0, 2 + (p.chainExtra || 0));
    for (const t of near) {
      this.hitEnemy(t, damage * 0.45, { heavy: false, source: p, color: 0x72a6ff });
      this.world.lightningArc(
        new THREE.Vector3(from.x, from.y + 0.9, from.z),
        new THREE.Vector3(t.x, t.y + 0.9, t.z), 0x72a6ff);
    }
  }

  spawnShockwave(p, damage) {
    const geo = new THREE.RingGeometry(0.5, 1.0, 20, 1, -Math.PI * 0.45, Math.PI * 0.9);
    const mat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = p.facing > 0 ? 0 : Math.PI;
    mesh.position.set(p.x + p.facing * 1.1, 0.12, p.z);
    this.world.worldRoot.add(mesh);
    this.projectiles.push({
      mesh, x: p.x + p.facing * 1.1, y: 0.12, z: p.z,
      vx: p.facing * 19, vz: 0, damage: damage * (p.shockMult || 1), hitSet: new Set(),
      color: p.color, life: 0.95, owner: p, friendly: true, wave: true, travel: 0,
    });
    this.world.shake(0.14);
  }

  playerAttack(p, kind, stage) {
    const heavy = kind === 'heavy' || kind === 'special';
    const shape = this.attackShape(p.def, kind, stage);
    const juggle = p.juggle;
    const kit = p.kit || {};
    if (kit.passive === 'reach') shape.reach *= 1.12;
    let crit = false;
    let damageBonus = 1;
    if (kind === 'light') {
      // signature repositioning hits
      if (kit.light2 === 'dashStrike' && stage === 2) {
        const t = this.nearestEnemy(p, 13);
        if (t) {
          p.x = clamp(t.x - p.facing * 1.9, ...this.getBounds());
          p.z = t.z;
          this.world.dashTrail(new THREE.Vector3(p.x - p.facing * 1.2, 0.2, p.z), p.color);
          this.world.slash(new THREE.Vector3(t.x, 1, t.z), p.facing, p.color, true, 1.6);
        }
      } else if (kit.light3 === 'blink' && stage === 3) {
        const t = this.nearestEnemy(p, 16);
        if (t) {
          p.x = clamp(t.x - p.facing * 1.8, ...this.getBounds());
          p.z = t.z;
          p.invuln = Math.max(p.invuln, 0.22);
          this.world.dashTrail(new THREE.Vector3(p.x + p.facing * 1.6, 0.25, p.z), p.color);
          this.world.slash(new THREE.Vector3(t.x, 1, t.z), p.facing, p.color, true, 1.9);
          this.world.slash(new THREE.Vector3(t.x, 1, t.z), p.facing, 0xffffff, true, 1.2);
        }
        damageBonus = 1.45 * (p.perk.blinkMult || 1);
      } else if (kit.light3 === 'assassinate' && stage === 3) {
        const t = this.nearestEnemy(p, 13);
        if (t) {
          p.x = clamp(t.x + p.facing * 1.7, ...this.getBounds());
          p.z = t.z;
          p.facing = -p.facing;
          crit = true;
          this.world.dashTrail(new THREE.Vector3(p.x + p.facing * 1.2, 0.2, p.z), p.color);
          this.world.slash(new THREE.Vector3(t.x, 1, t.z), p.facing, 0xffffff, true, 1.9);
        }
      }
    }
    let damage = kind === 'light' ? (8 + stage * 3.2) : kind === 'heavy' ? 24 : kind === 'launch' ? 11 : 38;
    if (crit) damage *= 2.1 * (p.critMult || 1);
    damage *= damageBonus;
    if (kit.light2 === 'dashStrike' && stage === 2) damage *= (p.dashMult || 1);
    damage *= 1 + (p.def.power - 5) * 0.055;
    damage *= p.damageMult;
    if (p.revActive) damage *= 1.5;
    if (this.mode === 'training') damage *= this.training.player.damage || 1;
    damage *= 1 + p.rankDamage * RANKS[p.styleRank].mult;
    let hitAny = false;
    let launchT = 0;
    const attackY = p.y + (p.y > 0.3 ? 0.55 : 1.0);
    const hitEnemies = new Set();
    for (const e of this.aliveEnemies()) {
      const dx = e.x - p.x, dz = e.z - p.z;
      const dy = Math.abs((e.y + 0.9) - attackY);
      if (dy > (kind === 'special' ? 2.2 : shape.vertical)) continue;
      if (kind === 'special') {
        if (Math.hypot(dx, dz) > 6.2) continue;
      } else {
        const forward = dx * p.facing;
        if (forward < -shape.behind) continue;
        const depth = Math.max(0, forward);
        const ex = depth / shape.reach;
        const ez = dz / shape.width;
        const inArc = ex * ex + ez * ez <= 1;
        const close = Math.hypot(dx, dz) <= shape.close;
        if (!inArc && !close) continue;
      }
      hitAny = true;
      const finalDmg = damage * (e.boss ? 0.68 : 1) * (e.hitStun > 0 ? 1 + p.executeMult : 1) * RANKS[p.styleRank].mult;
      let launch = kind === 'launch' ? 7.4 + (p.skills.has('aerial') ? 2.4 : 0) : kind === 'light' && p.y > 0.4 ? 4.2 : 0;
      if (juggle) {
        if (kind === 'light') {
          const base = (juggle.stages?.[stage] || 0) * (p.juggleMult || 1);
          if (base > 0) launch = e.y > 0.4 ? (juggle.sustain ?? base * 0.6) * (p.juggleMult || 1) : base;
        } else if (kind === 'heavy') {
          launch = e.y > 0.4 ? (juggle.sustain ?? 3) : (juggle.heavy ?? 0);
        }
      }
      this.hitEnemy(e, finalDmg, {
        heavy: heavy || stage === 3 || crit,
        launch,
        source: p, color: p.color,
        crit,
      });
      this.applyKitOnHit(p, e, kind, stage, finalDmg, kit);
      hitEnemies.add(e);
      if (kind === 'launch') launchT = 1;
    }
    if (kit.heavy === 'shockwave' && kind === 'heavy') this.spawnShockwave(p, 15);
    if (kit.heavy === 'slam' && kind === 'heavy' && hitAny) {
      this.world.ring(new THREE.Vector3(p.x, 0.06, p.z), p.color, 2.4, 0.45);
      this.world.shake(0.22);
      for (const e2 of this.aliveEnemies()) {
        if (hitEnemies.has(e2)) continue;
        if (Math.hypot(e2.x - p.x, e2.z - p.z) > 4.8) continue;
        this.hitEnemy(e2, damage * 0.55, { heavy: true, launch: 3.6, source: p, color: p.color });
      }
    }
    if (hitAny) {
      const pos = new THREE.Vector3(p.x + p.facing * Math.min(shape.reach * 0.58, 2.2), p.y + (heavy ? 1.15 : 1.0), p.z);
      this.world.slash(pos, p.facing, p.color, heavy, clamp(shape.reach / 2.6, 0.85, 1.55));
      if (p.revActive) this.world.slash(pos, p.facing, 0xffffff, heavy, clamp(shape.reach / 2.2, 1.1, 2.1));
      if (heavy) {
        this.world.ring(new THREE.Vector3(p.x, 0.05, p.z), p.color, 0.65, 0.35);
        this.world.shake(0.13);
        this.world.punchZoom(0.14);
        this.audio.heavy();
        this.hitstop = 0.04;
      } else {
        this.audio.hit(kind === 'light' && stage === 3 ? 1.2 : 0.7);
        this.hitstop = 0.018;
      }
      this.audio.slash();
      if (kind === 'heavy' || stage === 3) this.world.shake(0.08);
      const impact = heavy || stage === 3;
      if (!this.remoteInputs?.[p.index]) {
        this.input.rumble?.(impact ? 0.3 : 0.1, impact ? 0.22 : 0.08, impact ? 75 : 30, p.index, impact ? { trigger: 0.45 } : {});
      }
      p.addStyle((kind === 'heavy' ? 14 : kind === 'launch' ? 10 : 7 + stage * 2));
      p.special = Math.min(100, p.special + damage * 0.15 * p.specialMult);
    } else {
      this.audio.slash();
      p.addStyle(0.5);
    }
  }

  playerBulletStorm(p) {
    const gun = p.gunProfile;
    const shots = 9;
    const base = Math.atan2(0, p.facing);
    for (let i = 0; i < shots; i++) {
      const spread = (i - (shots - 1) / 2) * 0.085;
      const a = base + spread;
      this.spawnPlayerBullet(p, Math.cos(a), Math.sin(a), { ...gun, speed: gun.speed * 1.15, range: gun.range + 6 }, i * 0.05, 0.5);
    }
    this.world.muzzleFlash(new THREE.Vector3(p.x + p.facing * 0.95, p.y + 1.18, p.z), p.facing, 0, p.color);
    this.audio.gunshot();
    for (const e of this.aliveEnemies()) {
      const dx = e.x - p.x, dz = e.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > 28) continue;
      if ((dx / dist) * p.facing < 0.5) continue;
      if (Math.abs(dz) > 3.4 + dist * 0.14) continue;
      const dmg = 30 * p.damageMult * p.specialDamage * RANKS[p.styleRank].mult;
      this.hitEnemy(e, dmg * (e.boss ? 0.6 : 1), { heavy: true, launch: e.y > 0.4 ? 3.4 : 4.2, source: p, color: p.color, special: true });
      this.world.burst(new THREE.Vector3(e.x, e.y + 1, e.z), p.color, 10, 4.4, 0.4);
    }
  }

  playerJudgment(p) {
    this.timeScale = 0.3;
    const dir = p.facing;
    const reach = 15;
    for (let i = 0; i < 4; i++) {
      const pos = new THREE.Vector3(p.x + dir * (1.4 + i * 2.6), p.y + 1.05, p.z);
      this.world.slash(pos, dir, p.color, true, 2.4 - i * 0.25);
    }
    this.world.ring(new THREE.Vector3(p.x + dir * 3, 0.06, p.z), p.color, 1.6, 0.5);
    for (const e of this.aliveEnemies()) {
      const dx = e.x - p.x;
      if (Math.abs(dx) > reach) continue;
      if (Math.sign(dx) !== Math.sign(dir) && Math.abs(dx) > 1.2) continue;
      if (Math.abs(e.z - p.z) > 3.2) continue;
      const dmg = 42 * p.damageMult * p.specialDamage * RANKS[p.styleRank].mult;
      this.hitEnemy(e, dmg * (e.boss ? 0.6 : 1), { heavy: true, launch: e.y > 0.4 ? 3.6 : 6.4, source: p, color: p.color, special: true });
      this.world.burst(new THREE.Vector3(e.x, e.y + 1, e.z), p.color, 12, 5, 0.45);
    }
    p.vx += dir * 15;
    p.invuln = Math.max(p.invuln, 0.45);
  }

  playerJudgmentCut(p) {
    this.timeScale = 0.22;
    const dir = p.facing;
    // a towering vertical cut that opens the whole street
    const geo = new THREE.RingGeometry(1.8, 2.6, 30, 1, -Math.PI * 0.09, Math.PI * 0.18);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const cut = new THREE.Mesh(geo, mat);
    cut.position.set(p.x + dir * 0.9, 0.1, p.z);
    cut.rotation.y = dir > 0 ? 0 : Math.PI;
    cut.rotation.z = Math.PI / 2;
    cut.scale.set(1.7, 0.65, 1);
    this.world.worldRoot.add(cut);
    this.world.addEffect(cut, 0.45, (e, t) => {
      e.mesh.material.opacity = (1 - t) * 0.9;
      e.mesh.scale.set(1.7 + t * 1.1, 0.65, 1);
    });
    this.world.ring(new THREE.Vector3(p.x, 0.06, p.z), p.color, 2.6, 0.5);
    this.world.shake(0.3);
    this.world.punchZoom(0.24);
    for (const e of this.aliveEnemies()) {
      if (Math.abs(e.x - p.x) > 6.5) continue;
      if (Math.abs(e.z - p.z) > 4.2) continue;
      const dmg = 46 * p.damageMult * p.specialDamage * RANKS[p.styleRank].mult;
      this.hitEnemy(e, dmg * (e.boss ? 0.62 : 1), { heavy: true, launch: e.y > 0.4 ? 3.8 : 6.6, source: p, color: p.color, special: true, crit: true });
      this.world.burst(new THREE.Vector3(e.x, e.y + 1, e.z), p.color, 12, 5, 0.45);
    }
    p.invuln = Math.max(p.invuln, 0.5);
  }

  playerSpecial(p) {
    this.timeScale = 0.35;
    if (!this.remoteInputs?.[p.index]) this.input.rumble?.(0.55, 0.4, 160, p.index, { trigger: 0.85 });
    this.world.shake(0.24);
    this.world.punchZoom(0.2);
    if (p.def.specialMove === 'judgmentcut') {
      this.playerJudgmentCut(p);
      p.addStyle(24);
      this.audio.special();
      this.callbacks.special?.(p);
      return;
    }
    if (p.def.specialMove === 'judgment') {
      this.playerJudgment(p);
      p.addStyle(24);
      this.audio.special();
      this.callbacks.special?.(p);
      return;
    }
    if (p.gunProfile) {
      this.playerBulletStorm(p);
      p.addStyle(24);
      this.audio.special();
      this.callbacks.special?.(p);
      return;
    }
    this.world.explosion(new THREE.Vector3(p.x, 1.1, p.z), p.color, 1.4);
    const radius = p.def.id === 'vex' || p.def.id === 'kira' ? 8 : 6.3;
    let hits = 0;
    for (const e of this.aliveEnemies()) {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > radius) continue;
      hits++;
      const dmg = 36 * p.damageMult * p.specialDamage * RANKS[p.styleRank].mult;
      this.hitEnemy(e, dmg * (e.boss ? 0.56 : 1), { heavy: true, launch: 5.5, source: p, color: p.color, special: true });
      this.world.burst(new THREE.Vector3(e.x, e.y + 1, e.z), p.color, 12, 5, 0.5);
    }
    if (p.def.id === 'nyx' || p.def.id === 'mara') {
      const heal = 12 + hits * 2;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
    if (p.def.id === 'ash') {
      for (let i = 0; i < 3; i++) this.world.ring(new THREE.Vector3(p.x, 0.1, p.z), 0xff5a1a, 1 + i, 0.65);
    }
    if (p.def.id === 'volt' || p.def.id === 'vex') {
      for (const e of this.aliveEnemies()) {
        if (Math.hypot(e.x - p.x, e.z - p.z) < 8 && Math.random() < 0.5) this.hitEnemy(e, 14 * p.damageMult, { heavy: false, source: p, color: p.color });
      }
    }
    p.addStyle(24);
    this.audio.special();
    this.callbacks.special?.(p);
  }

  hitEnemy(e, damage, opts = {}) {
    if (e.dead) return;
    damage = Math.max(1, Math.round(damage));
    e.hp -= damage;
    e.hitStun = Math.max(e.hitStun, opts.heavy ? 0.38 : 0.2);
    e.visual.hitFlash();
    const pos = new THREE.Vector3(e.x, e.y + 0.9, e.z);
    this.world.hitSparks(pos, opts.crit ? 0xffffff : (opts.color || e.color), opts.special ? 22 : opts.crit ? 20 : opts.heavy ? 14 : 8, opts.crit ? 1.7 : opts.heavy ? 1.4 : 0.8);
    if (opts.heavy) this.world.shake(0.1);
    const screen = this.world.project(pos);
    this.callbacks.damage?.(screen.x, screen.y, damage, opts.color || e.color, opts.heavy ? 'heavy' : '');
    const src = opts.source;
    if (src) {
      src.combo++;
      src.comboTimer = 2.8;
      src.maxCombo = Math.max(src.maxCombo, src.combo);
      src.kills = src.kills;
      this.run.maxCombo = Math.max(this.run.maxCombo, src.combo);
      this.run.score += damage * 10 + Math.round(damage * RANKS[src.styleRank].mult);
      this.run.damage += damage;
      src.totalDamage += damage;
      src.addStyle((opts.heavy ? 10 : 5) + damage * 0.1);
      if (src.hasRev) src.rev = Math.min(1, src.rev + (opts.heavy ? 0.09 : 0.05));
      src.special = Math.min(100, src.special + damage * 0.1 * src.specialMult);
      if ([10, 25, 50, 100, 150, 200].includes(src.combo)) {
        this.callbacks.milestone?.(src.combo);
        this.audio.rank(Math.min(6, Math.floor(src.combo / 25)));
      }
      if (e.boss) {
        // Boss stays threatening: stun cap and reduced knockback
        e.hitStun = Math.min(e.hitStun, 0.16);
        e.vx += (src.facing || 1) * (opts.heavy ? 1.5 : 0.5);
        if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
          e.phase = 2;
          this.callbacks.announce?.('ENRAGED', e.name, e.color);
          e.speed *= 1.28;
          e.specialTimer = 1.4;
          this.world.explosion(new THREE.Vector3(e.x, 1, e.z), e.color, 1.2);
        }
      } else {
        const kdir = opts.knockDir !== undefined ? opts.knockDir : (src.facing || 1);
        e.vx += kdir * (opts.heavy ? 6.5 : 2.8);
        e.vz += opts.knockZ !== undefined ? opts.knockZ : rand(-2, 2);
      }
      if (opts.launch) {
        if (e.boss) { e.vy = 2.2; e.launchedT = 0.3; }
        else { e.vy = opts.launch; e.launched = true; e.launchedT = 0; e.hitStun = 0.7; }
        this.world.ring(new THREE.Vector3(e.x, 0.04, e.z), opts.color || e.color, 0.45, 0.3);
      }
    }
    if (e.hp <= 0) this.killEnemy(e, opts.source, opts.color);
    else this.audio.hit(opts.heavy ? 1.3 : 0.7);
  }

  killEnemy(e, src, color) {
    if (e.dead) return;
    if (e.training) {
      e.hp = e.maxHp;
      e.hitStun = 0.8;
      e.vx = 0; e.vz = 0;
      this.callbacks.announce?.('DUMMY RESET', 'KEEP THE RHYTHM', '#9cff57');
      return;
    }
    e.dead = true;
    e.deadT = 0;
    e.hp = 0;
    const srcPlayer = src || this.players.find(p => !p.downed) || this.players[0];
    const pos = new THREE.Vector3(e.x, e.y + 1, e.z);
    this.world.burst(pos, e.color, e.boss ? 60 : 22, e.boss ? 10 : 6, e.boss ? 1.4 : 0.7);
    this.world.ring(new THREE.Vector3(e.x, 0.06, e.z), e.color, e.boss ? 2 : 0.8, e.boss ? 1 : 0.5);
    this.world.shake(e.boss ? 0.5 : 0.12);
    this.audio.kill();
    this.run.kills++;
    this.save.totalKills = (this.save.totalKills || 0) + 1;
    const shards = e.boss ? 180 : e.elite ? 16 : 7;
    this.run.shards += shards;
    this.run.score += e.boss ? 12000 : 450;
    if (srcPlayer) {
      srcPlayer.kills++;
      if (srcPlayer.lifesteal) srcPlayer.hp = Math.min(srcPlayer.maxHp, srcPlayer.hp + srcPlayer.lifesteal);
      if (srcPlayer.chainKill) {
        for (const other of this.aliveEnemies()) {
          if (other !== e && Math.hypot(other.x - e.x, other.z - e.z) < 3.2) this.hitEnemy(other, 18, { heavy: false, source: srcPlayer, color: srcPlayer.color });
        }
      }
    }
    if (e.boss) {
      this.run.bossKills++;
      this.save.totalBosses = (this.save.totalBosses || 0) + 1;
      this.bossActive = false;
      this.boss = null;
      this.callbacks.boss?.(null);
      this.timeScale = 0.3;
      this.hitstop = 0.12;
      this.callbacks.announce?.('ELITE DOWN', e.name, e.color);
      this.players.forEach(p => { p.hp = Math.min(p.maxHp, p.hp + p.bossHeal); });
      this.world.setArena(0);
      this.phase = 'bossdown';
      this.clearTimer = 1.5;
    } else if (Math.random() < 0.16) {
      this.spawnPickup(e.x, e.z);
    }
    this.callbacks.kill?.(e, srcPlayer);
  }

  spawnPickup(x, z) {
    const mesh = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0x4fd1c5, toneMapped: false }));
    mesh.add(orb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: undefined, color: 0x4fd1c5, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.1);
    mesh.add(glow);
    mesh.position.set(x, 0.5, z);
    this.world.worldRoot.add(mesh);
    this.pickups.push({ mesh, x, z, t: 0, life: 18, kind: Math.random() < 0.5 ? 'health' : 'special' });
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt; pk.life -= dt;
      pk.mesh.position.y = 0.55 + Math.sin(pk.t * 2.4) * 0.12;
      pk.mesh.rotation.y += dt * 1.8;
      let collected = false;
      for (const p of this.players) {
        if (p.downed) continue;
        if (Math.hypot(p.x - pk.x, p.z - pk.z) < 1.2) {
          if (pk.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + 14);
          else p.special = Math.min(100, p.special + 28);
          this.world.burst(pk.mesh.position.clone(), pk.kind === 'health' ? 0x4fd1c5 : 0xffc247, 14, 4, 0.5);
          this.callbacks.pickup?.(pk.kind, p.index);
          collected = true; break;
        }
      }
      if (collected || pk.life <= 0) {
        this.world.worldRoot.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  updateTrainingDummy(e, dt) {
    const cfg = this.training.dummy;
    const player = this.nearestPlayerTo(e) || this.players[0] || null;
    e.hitStun = Math.max(0, e.hitStun - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    const juggle = cfg.juggle !== false;

    // physics — juggled dummies leave the floor and fall back down
    if (juggle) {
      if (e.y > 0 || e.vy !== 0) {
        e.vy -= 23 * dt;
        e.y += e.vy * dt;
        if (e.y <= 0) { e.y = 0; e.vy = 0; e.launched = false; e.launchedT = 0; }
      }
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      e.vx *= Math.pow(0.02, dt);
      e.vz *= Math.pow(0.02, dt);
    } else {
      e.y = 0; e.vy = 0; e.launched = false;
      e.vx *= Math.pow(0.0001, dt);
      e.vz *= Math.pow(0.0001, dt);
    }
    e.x = clamp(e.x, this.zoneCenter - 15, this.zoneCenter + 15);
    e.z = clamp(e.z, -6.8, 6.8);

    const dx = player ? player.x - e.x : 0;
    const dz = player ? player.z - e.z : 0;
    const dist = Math.hypot(dx, dz) || 0.001;
    const behavior = cfg.behavior || 'static';
    const speed = (e.base?.speed ?? 3) * (cfg.speed || 1);
    e.moving = false;

    if (e.action === 'windup') {
      e.actionTime += dt;
      if (e.actionTime >= e.actionDuration) {
        e.action = 'none';
        e.actionTime = 0;
        if (behavior === 'aggressive' && player && dist < e.range + 1.2) this.damagePlayer(player, e.damage, e);
        e.attackCd = rand(1.1, 1.9);
      }
    } else if (e.hitStun <= 0) {
      if (behavior === 'patrol') {
        e.dummyPhase = (e.dummyPhase || 0) + dt;
        const home = e.dummyHome || { x: e.x, z: e.z };
        const dir = Math.sin(e.dummyPhase * 0.9 + (e.id || 0)) > 0 ? 1 : -1;
        e.x += dir * speed * 0.55 * dt;
        if (Math.abs(e.x - home.x) > 3.4) e.x = home.x + Math.sign(e.x - home.x) * 3.4;
        e.moving = true;
      } else if (behavior === 'approach' || behavior === 'aggressive') {
        const stop = behavior === 'aggressive' ? e.range * 0.75 : 3.4;
        if (dist > stop) {
          e.x += (dx / dist) * speed * dt;
          e.z += (dz / dist) * speed * 0.7 * dt;
          e.moving = true;
        }
        if (behavior === 'aggressive' && player && dist < e.range + 0.6 && e.attackCd <= 0) {
          e.action = 'windup'; e.actionDuration = 0.45; e.actionTime = 0;
        }
      }
    }

    if (cfg.facing !== 'fixed' && player && e.hitStun <= 0) {
      const dir = Math.sign(dx);
      if (dir) e.facing = dir;
    }

    const prog = e.actionDuration ? e.actionTime / e.actionDuration : 0;
    e.visual.state = e.state = {
      x: e.x, y: e.y, z: e.z, facing: e.facing,
      action: e.hitStun > 0 ? 'hurt' : e.action === 'windup' ? 'light' : 'none',
      actionProgress: prog, moving: e.moving, speed: e.speed, dead: false,
      launched: e.launched, launchedT: e.launched ? (e.y > 0 ? 0.1 : 0) : 0,
      block: behavior === 'block' && e.hitStun <= 0,
    };
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT += dt;
        e.visual.state = e.state = { x: e.x, y: e.y, z: e.z, facing: e.facing, action: 'none', actionProgress: 0, moving: false, y: e.y, dead: true };
        continue;
      }
      if (e.training) {
        this.updateTrainingDummy(e, dt);
        continue;
      }
      e.hitStun = Math.max(0, e.hitStun - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      if (e.charging > 0) e.charging -= dt;
      if (e.burn > 0) {
        e.burn -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.4;
          e.hp -= e.burnDmg || 1;
          this.world.burst(new THREE.Vector3(e.x, e.y + 0.8, e.z), 0xff6a1a, 3, 1.7, 0.35);
          if (e.hp <= 0) { this.killEnemy(e, e.burnSource, 0xff6a1a); continue; }
        }
      }

      // physics
      if (e.y > 0 || e.vy !== 0) {
        e.vy -= 23 * dt;
        e.y += e.vy * dt;
        if (e.y <= 0) { e.y = 0; e.vy = 0; e.launched = false; e.launchedT = 0; }
      }
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      e.vx *= Math.pow(0.02, dt);
      e.vz *= Math.pow(0.02, dt);
      e.x = clamp(e.x, this.zoneCenter - 18, this.zoneCenter + 18);
      e.z = clamp(e.z, -7.4, 7.4);

      if (e.hitStun > 0) {
        e.action = 'hurt';
        e.visual.state = e.state = { x: e.x, y: e.y, z: e.z, facing: e.facing, action: 'hurt', actionProgress: e.hitStun, moving: false, dead: false };
        continue;
      }

      const target = this.nearestPlayerTo(e);
      if (!target) { e.visual.state = e.state = { x: e.x, y: e.y, z: e.z, facing: e.facing, action: 'none', actionProgress: 0, moving: false, dead: false }; continue; }

      if (e.boss) this.updateBoss(e, target, dt);
      else this.updateMob(e, target, dt);

      // face target
      if (e.action === 'none' || e.action === 'windup') {
        const dir = Math.sign(target.x - e.x);
        if (dir) e.facing = dir;
      }
      const p = e.actionDuration ? e.actionTime / e.actionDuration : 0;
      e.visual.state = e.state = {
        x: e.x, y: e.y, z: e.z, facing: e.facing, action: e.action === 'windup' ? 'light' : e.action,
        actionProgress: p, moving: e.moving, speed: e.speed, dead: false, launched: e.launched,
        launchedT: e.launched ? (e.y > 0 ? 0.1 : 0) : 0,
      };
    }
  }

  nearestPlayerTo(e) {
    let best = null, bd = 999;
    for (const p of this.players) {
      if (p.downed) continue;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  updateMob(e, target, dt) {
    const dx = target.x - e.x, dz = target.z - e.z;
    const dist = Math.hypot(dx, dz);
    e.moving = false;
    if (e.action === 'windup') {
      e.actionTime += dt;
      if (e.actionTime >= e.actionDuration) {
        e.action = 'none';
        e.actionTime = 0;
        if (dist < e.range + 1.1) this.damagePlayer(target, e.damage, e);
        e.attackCd = e.base.ranged ? rand(1.4, 2.4) : rand(0.95, 1.8);
      }
      return;
    }
    if (e.action !== 'none') { e.actionTime += dt; if (e.actionTime > e.actionDuration) { e.action = 'none'; e.actionTime = 0; } return; }
    if (e.attackCd <= 0 && dist < e.range + (e.base.ranged ? 7 : 0.7)) {
      if (e.base.ranged) {
        e.action = 'windup'; e.actionDuration = 0.55; e.actionTime = 0;
        this.spawnProjectile(e, target, 1);
      } else {
        e.action = 'windup'; e.actionDuration = 0.5; e.actionTime = 0;
      }
      return;
    }
    if (e.base.ranged) {
      if (dist < 4.5) {
        e.x -= Math.sign(dx) * e.speed * dt;
        e.z -= Math.sign(dz) * e.speed * 0.5 * dt;
        e.moving = true;
      } else if (dist > 10) {
        e.x += Math.sign(dx) * e.speed * dt;
        e.z += Math.sign(dz) * e.speed * 0.6 * dt;
        e.moving = true;
      } else {
        // strafe
        e.z += Math.sin(this.time * 2 + e.id) * dt * 1.1;
      }
    } else {
      const stop = e.range * 0.72;
      if (dist > stop) {
        const speed = e.speed * (e.elite ? 1.1 : 1);
        e.x += (dx / Math.max(0.01, dist)) * speed * dt;
        e.z += (dz / Math.max(0.01, dist)) * speed * 0.8 * dt;
        e.moving = true;
      }
      if (e.base.teleport && e.attackCd <= 0.3 && Math.random() < dt * 0.8) {
        this.world.burst(new THREE.Vector3(e.x, 1, e.z), e.color, 12, 4, 0.4);
        e.x = target.x - Math.sign(dx) * 1.6;
        e.z = target.z + rand(-1, 1);
        this.world.burst(new THREE.Vector3(e.x, 1, e.z), e.color, 12, 4, 0.4);
      }
    }
  }

  updateBoss(e, target, dt) {
    const dx = target.x - e.x, dz = target.z - e.z;
    const dist = Math.hypot(dx, dz);
    e.moving = false;
    e.specialTimer -= dt;
    if (e.action === 'special' || e.action === 'charge') {
      e.actionTime += dt;
      const p = e.actionTime / e.actionDuration;
      if (!e.actionHit && p >= 0.5) {
        e.actionHit = true;
        this.bossSpecialImpact(e, target);
      }
      if (e.action === 'charge') {
        e.x += e.facing * 15 * dt;
        e.x = clamp(e.x, this.zoneCenter - 17, this.zoneCenter + 17);
        for (const p2 of this.players) {
          if (!p2.downed && Math.hypot(p2.x - e.x, p2.z - e.z) < 1.6) this.damagePlayer(p2, e.damage * 1.1, e);
        }
      }
      if (p >= 1) { e.action = 'none'; e.actionTime = 0; e.vx = 0; }
      if (e.visual) e.visual.root.position.set(e.x, e.y, e.z);
      return;
    }
    if (e.specialTimer <= 0 && e.hitStun <= 0) {
      this.beginBossSpecial(e, target);
      return;
    }
    if (e.attackCd <= 0 && dist < e.range + 0.6) {
      e.action = 'windup'; e.actionDuration = 0.6; e.actionTime = 0; e.attackCd = e.phase === 2 ? 0.9 : 1.3;
      return;
    }
    if (e.action === 'windup') {
      e.actionTime += dt;
      if (e.actionTime >= e.actionDuration) {
        e.action = 'none'; e.actionTime = 0;
        if (dist < e.range + 1.6) this.damagePlayer(target, e.damage, e);
        this.world.explosion(new THREE.Vector3(e.x + e.facing * 1.3, 0.4, e.z), e.color, 0.7);
      }
      return;
    }
    if (dist > e.range * 0.8) {
      e.x += Math.sign(dx) * e.speed * dt;
      e.z += Math.sign(dz) * e.speed * 0.55 * dt;
      e.moving = true;
    }
  }

  beginBossSpecial(e, target) {
    const moves = e.base.moves || ['slam'];
    const move = moves[Math.floor(Math.random() * moves.length)];
    e.action = 'special';
    e.actionType = move;
    e.actionTime = 0;
    e.actionDuration = move === 'charge' ? 0.95 : 1.15;
    e.actionHit = false;
    e.specialTimer = e.phase === 2 ? rand(2.2, 3.4) : rand(3.2, 4.6);
    if (move === 'charge') { e.action = 'charge'; e.facing = Math.sign(target.x - e.x) || 1; }
    this.callbacks.telegraph?.(e.name, move);
    this.world.ring(new THREE.Vector3(e.x, 0.08, e.z), e.color, 1.2, 0.7);
  }

  bossSpecialImpact(e, target) {
    const move = e.actionType || 'slam';
    const p = e.actionTime / e.actionDuration;
    if (move === 'slam' || move === 'shockwave') {
      const radius = move === 'slam' ? 5.5 : 7.5;
      this.world.ring(new THREE.Vector3(e.x, 0.06, e.z), e.color, 1, 0.8);
      this.world.explosion(new THREE.Vector3(e.x, 0.5, e.z), e.color, move === 'slam' ? 1.4 : 2);
      this.addHazard(e.x, e.z, radius, e.damage * 1.15, e.color, 0.32);
    }
    if (move === 'barrage' || move === 'rail') {
      const count = move === 'barrage' ? 7 : 3;
      for (let i = 0; i < count; i++) {
        const angle = Math.atan2(target.z - e.z, target.x - e.x) + (i - (count - 1) / 2) * 0.13;
        this.spawnProjectileDir(e, Math.cos(angle), Math.sin(angle), e.damage * 0.75, move === 'rail' ? 18 : 12, e.color, 0.15 + i * 0.03);
      }
    }
    if (move === 'summon') {
      for (let i = 0; i < 2; i++) this.spawnEnemy(i % 2 ? 'ninja' : 'thug', e.x + rand(-5, 5), 1 + this.run.wave * 0.05);
      this.callbacks.announce?.('SUMMON', 'THEY KEEP COMING', e.color);
    }
    if (move === 'blink') {
      this.world.burst(new THREE.Vector3(e.x, 1, e.z), e.color, 20, 5, 0.5);
      e.x = target.x - Math.sign(target.x - e.x) * 2.4;
      e.z = target.z;
      this.world.burst(new THREE.Vector3(e.x, 1, e.z), e.color, 20, 5, 0.5);
      this.addHazard(e.x, e.z, 2.8, e.damage * 0.9, e.color, 0.12);
    }
    if (move === 'cross') {
      e.x = clamp(e.x + e.facing * 8, this.zoneCenter - 16, this.zoneCenter + 16);
      this.world.slash(new THREE.Vector3(e.x, 1.2, e.z), e.facing, e.color, true);
      this.addHazard(e.x, e.z, 3.2, e.damage, e.color, 0.08);
    }
    if (move === 'halo') {
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2;
        this.spawnProjectileDir(e, Math.cos(a), Math.sin(a), e.damage * 0.7, 9, e.color, i * 0.02);
      }
      this.world.ring(new THREE.Vector3(e.x, 0.06, e.z), e.color, 1.3, 0.7);
    }
    if (e.visual) e.visual.root.position.set(e.x, e.y, e.z);
  }

  addHazard(x, z, radius, damage, color, delay = 0.2) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 36), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.04, z);
    this.world.worldRoot.add(mesh);
    this.hazards.push({ x, z, radius, damage, color, delay, t: 0, mesh, hit: false });
  }

  updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      const grow = clamp(h.t / 0.3, 0, 1);
      h.mesh.scale.setScalar(h.radius * (0.25 + grow * 0.85));
      h.mesh.material.opacity = 0.55 * (1 - h.t / (h.delay + 0.35));
      if (!h.hit && h.t >= h.delay) {
        h.hit = true;
        for (const p of this.players) {
          if (p.downed) continue;
          if (Math.hypot(p.x - h.x, p.z - h.z) < h.radius) this.damagePlayer(p, h.damage, null);
        }
        this.world.shake(0.18);
      }
      if (h.t > h.delay + 0.4) {
        this.world.worldRoot.remove(h.mesh);
        h.mesh.geometry.dispose(); h.mesh.material.dispose();
        this.hazards.splice(i, 1);
      }
    }
  }

  spawnProjectile(e, target, power = 1) {
    const angle = Math.atan2(target.z - e.z, target.x - e.x);
    this.spawnProjectileDir(e, Math.cos(angle), Math.sin(angle), e.damage * power, 10, e.color);
  }

  spawnProjectileDir(e, dx, dz, damage, speed, color, delay = 0) {
    if (delay > 0) {
      setTimeout(() => { if (this.active) this.spawnProjectileDir(e, dx, dz, damage, speed, color, 0); }, delay * 1000);
      return;
    }
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    mesh.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.5); mesh.add(glow);
    mesh.position.set(e.x, 1.1, e.z);
    this.world.worldRoot.add(mesh);
    this.projectiles.push({ mesh, x: e.x, y: 1.1, z: e.z, vx: dx * speed, vz: dz * speed, damage, color, life: 3.2, owner: e });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.delay > 0) { pr.delay -= dt; continue; }
      pr.life -= dt;
      pr.x += pr.vx * dt; pr.z += pr.vz * dt;
      pr.travel += Math.hypot(pr.vx * dt, pr.vz * dt);
      pr.mesh.position.set(pr.x, pr.y, pr.z);
      pr.mesh.rotation.z += dt * 8;
      if (Math.random() < dt * 30) this.world.spawnParticle(pr.x, pr.y, pr.z, pr.color, 0.5, 0.25, 0);
      let hit = false;
      if (pr.friendly) {
        const reach = pr.wave ? 2.4 : 0.95;
        for (const e of this.aliveEnemies()) {
          if (pr.hitSet && pr.hitSet.has(e)) continue;
          if (Math.hypot(e.x - pr.x, e.z - pr.z) < reach && Math.abs((e.y + 0.9) - pr.y) < 3.4) {
            this.hitEnemy(e, pr.damage, {
              heavy: true, source: pr.owner, color: pr.color,
              launch: pr.wave ? 2.6 : e.y > 0.4 ? 3.2 : 0, knockDir: pr.dirX, knockZ: pr.dirZ * 2.2,
            });
            this.world.hitSparks(new THREE.Vector3(pr.x, pr.y, pr.z), pr.color, pr.wave ? 8 : 12, 1.1);
            this.world.burst(new THREE.Vector3(pr.x, pr.y, pr.z), pr.color, 6, 3.4, 0.22);
            if (pr.hitSet) pr.hitSet.add(e);
            if (pr.pierce > 0) { pr.pierce--; continue; }
            hit = true; break;
          }
        }
        if (pr.wave) {
          pr.mesh.scale.setScalar(1 + pr.travel * 0.075);
          pr.mesh.material.opacity = Math.max(0, pr.life / 0.85) * 0.95;
          if (pr.core) {
            pr.core.scale.setScalar(1 + pr.travel * 0.075);
            pr.core.material.opacity = Math.max(0, pr.life / 0.85) * 0.9;
          }
        }
      } else {
        for (const p of this.players) {
          if (p.downed) continue;
          if (Math.hypot(p.x - pr.x, p.z - pr.z) < 0.5 && p.y < 2.0) {
            this.damagePlayer(p, pr.damage, pr.owner);
            this.world.hitSparks(new THREE.Vector3(pr.x, pr.y, pr.z), pr.color, 8, 0.6);
            hit = true; break;
          }
        }
      }
      if (hit || pr.life <= 0 || Math.abs(pr.x - this.zoneCenter) > 24) {
        this.world.worldRoot.remove(pr.mesh);
        if (pr.core) this.world.worldRoot.remove(pr.core);
        this.projectiles.splice(i, 1);
      }
    }
  }

  damagePlayer(p, damage, source) {
    if (!p || p.downed) return;
    if (p.godMode) return;
    if (this.mode === 'training' && !this.training.player.takeDamage) return;
    if (p.invuln > 0 || p.action === 'dodge' || p.action === 'special') return;
    const final = Math.max(1, Math.round(damage * (1 - p.defense)));
    p.hp -= final;
    p.invuln = 0.75;
    p.hitStun = 0.28;
    p.action = 'hurt';
    p.actionTime = 0; p.actionDuration = 0.28; p.actionHit = true;
    p.walkVX = 0; p.walkVZ = 0; p.walkSpeed = 0;
    p.vx = (source ? Math.sign(p.x - source.x) : (Math.random() > 0.5 ? 1 : -1)) * 5;
    p.vy = 2.4;
    const armor = Math.max(p.armor || 0, p.kit?.passive === 'poise' ? 0.3 : 0);
    if (armor > 0) {
      p.vx *= 1 - armor;
      p.vy *= 1 - armor * 0.6;
      p.hitStun = 0.28 * (1 - armor * 0.6);
    }
    p.resetCombo();
    p.special = Math.max(0, p.special - 8);
    const pos = new THREE.Vector3(p.x, p.y + 1.1, p.z);
    this.world.hitSparks(pos, 0xff224f, 12, 0.8);
    this.world.shake(0.18);
    if (!this.remoteInputs?.[p.index]) this.input.rumble?.(0.6, 0.38, 130, p.index);
    this.audio.hurt();
    const screen = this.world.project(pos);
    this.callbacks.damage?.(screen.x, screen.y, '-' + final, '#ff3d74', 'player');
    this.callbacks.hurt?.();
    if (p.hp <= 0) {
      p.hp = 0;
      p.downed = true;
      p.respawnTimer = 8;
      p.action = 'none';
      p.visual.deadT = 0;
      this.world.explosion(new THREE.Vector3(p.x, 0.7, p.z), p.color, 0.7);
      this.callbacks.announce?.('DOWN', p.name + ' IS OUT', '#ff3d74');
      if (this.players.every(pl => pl.downed)) {
        this.retireDefeated();
      }
    }
  }

  retireDefeated() {
    if (this.ending) return;
    this.ending = true;
    this.clearTimer = 1.8;
    this.phase = 'defeat';
  }

  cleanup() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && e.deadT > 1.65) {
        this.world.removeFighter(e.visual);
        this.enemies.splice(i, 1);
      }
    }
  }

  refreshHud(force = false) {
    const players = this.players.map(p => ({
      index: p.index, name: p.name, def: p.def, hp: p.hp, maxHp: p.maxHp,
      special: p.special, style: p.style, rank: p.rank(), combo: p.combo,
      downed: p.downed, color: p.color, styleRank: p.styleRank,
      rev: p.rev || 0, revActive: !!p.revActive, hasRev: !!p.hasRev,
    }));
    this.callbacks.hud?.({
      players, mode: this.mode,
      modeName: MODES.find(m => m.id === this.mode)?.name || '',
      wave: this.run?.wave || 0, enemies: this.aliveEnemies().length,
      score: this.run?.score || 0, shards: this.run?.shards || 0,
      objective: this.objective,
      boss: this.boss ? { name: this.boss.name, title: this.boss.title, hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp, color: this.boss.color } : null,
      phase: this.phase,
    });
  }

  updateClearedAndAdvance(dt) {
    // called from updateDirector extension
  }

  chooseUpgrade(id) {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;
    this.takenUpgrades.push(id);
    this.players.forEach(p => p.addUpgrade(up));
    this.run.upgrades.push(up.name);
    this.callbacks.announce?.(up.name, 'POWER ABSORBED', up.color);
    this.audio.unlock();
    this.refreshHud(true);
    this.resume();
    this.phase = 'intro';
    this.pendingSpawn = 0.45;
  }

  onBossDefeated() {
    if (this.mode === 'campaign') {
      if (this.stageIndex >= STAGES.length - 1) this.completeVictory();
      else {
        this.phase = 'stagecomplete';
        this.callbacks.stageComplete?.(this.makeResult(true));
      }
    } else if (this.mode === 'bossrush') {
      this.bossIndex++;
      if (this.bossIndex >= 5) this.completeVictory();
      else {
        this.players.forEach(p => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.28); p.special = 100; });
        this.phase = 'intermission';
        this.pendingSpawn = 2.2;
        this.callbacks.announce?.(`SEAL ${this.bossIndex} BROKEN`, 'NEXT CHALLENGER', '#ffc247');
      }
    } else if (this.mode === 'survival' || this.mode === 'rampage') {
      this.phase = 'cleared';
      this.clearTimer = 1.4;
    }
  }

  completeVictory() {
    if (this.ending) return;
    this.ending = true;
    this.phase = 'victory';
    this.clearTimer = 2.2;
    this.timeScale = 0.4;
    this.callbacks.announce?.('VICTORY', 'THE NIGHT IS YOURS', '#ffd166');
    this.world.explosion(new THREE.Vector3(this.cameraFocus, 2, 0), 0xffd166, 2.2);
  }

  finishRun(win) {
    if (this.finished) return;
    this.finished = true;
    this.active = false;
    const result = this.makeResult(win);
    this.callbacks.results?.(result);
  }

  makeResult(win) {
    const rank = this.run.maxCombo >= 150 ? 'SSS' : this.run.maxCombo >= 100 ? 'SS' : this.run.maxCombo >= 60 ? 'S' : this.run.maxCombo >= 35 ? 'A' : this.run.maxCombo >= 20 ? 'B' : 'C';
    return {
      win, mode: this.mode, modeName: MODES.find(m => m.id === this.mode)?.name,
      score: this.run.score + Math.round(this.run.maxCombo * 125) + (win ? 5000 : 0),
      shards: this.run.shards + (win ? 260 : 0) + Math.round(this.run.maxCombo * 0.9),
      kills: this.run.kills, bossKills: this.run.bossKills, maxCombo: this.run.maxCombo,
      time: this.run.time, rank, reachedSSS: this.run.reachedSSS,
      upgrades: this.run.upgrades, wave: this.run.wave, stageIndex: this.stageIndex,
      players: this.players.map(p => ({ name: p.name, def: p.def, kills: p.kills, damage: p.totalDamage })),
    };
  }

  exit() {
    this.active = false;
    this.paused = false;
    this.active = false;
    this.enemies.forEach(e => this.world.removeFighter(e.visual));
    this.players.forEach(p => this.world.removeFighter(p.visual));
    this.enemies = []; this.players = [];
    this.projectiles.forEach(pr => this.world.worldRoot.remove(pr.mesh));
    this.pickups.forEach(pk => this.world.worldRoot.remove(pk.mesh));
    this.hazards.forEach(h => this.world.worldRoot.remove(h.mesh));
    this.projectiles = []; this.pickups = []; this.hazards = [];
    this.boss = null; this.bossActive = false;
    this.world.setGates(false);
    this.world.setArena(0);
    this.callbacks.boss?.(null);
  }
}
