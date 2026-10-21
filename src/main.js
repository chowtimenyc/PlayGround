import { World } from './world.js';
import { Game, InputManager, controllerInfo } from './game.js';
import {
  CHARACTERS, MODES, STAGES, SKILLS, UPGRADES, ACHIEVEMENTS, RANKS,
  loadSave, persistSave,
} from './data.js';
import { AudioEngine } from './audio.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const hex = n => '#' + (n || 0xff3d74).toString(16).padStart(6, '0');
const fmt = n => Math.round(n).toLocaleString('en-US');
const pad = (n, l = 6) => String(Math.round(n)).padStart(l, '0');
const niceTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const save = loadSave();
const audio = new AudioEngine();
audio.enabled = save.audio !== false;
const canvas = $('#game');
const world = new World(canvas, audio);
const game = new Game(world, audio, save, {});

const state = {
  screen: 'title',
  mode: 'campaign',
  selectedChar: save.selectedChar || save.unlocked[0] || 'rook',
  squadCount: Math.max(1, Math.min(4, save.squad || 1)),
  squadChars: ['rook', 'vex', 'sable', 'jett'],
  online: {
    role: null, peer: null, conns: [], code: '', started: false, guestIndex: 1,
    guestConn: null, localIndex: 0, lastHudSend: 0,
  },
  awarded: 0,
  result: null,
  modal: null,
  guest: false,
};

let padFocusEl = null;
let promptSource = null;
let promptKind = '';
let promptLabels = '';

state.squadChars[0] = state.selectedChar;
if (new URLSearchParams(location.search).has('qa')) window.__sr = {
  game, world, state, save, padMenu: handlePadMenu, focusPad: focusPadElement, hints: updateControlHints,
  openTraining: openTrainingMenu, closeTraining: closeTrainingMenu, trainingMenu: buildTrainingMenu,
};
const unlocked = () => CHARACTERS.filter(c => save.unlocked.includes(c.id));
const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
const modeById = id => MODES.find(m => m.id === id) || MODES[0];

function fillSquadChars() {
  const available = unlocked().map(c => c.id);
  for (let i = 0; i < 4; i++) {
    if (!state.squadChars[i] || !save.unlocked.includes(state.squadChars[i])) {
      state.squadChars[i] = available.find(id => !state.squadChars.includes(id)) || available[0] || 'rook';
    }
  }
  state.squadChars[0] = state.selectedChar;
}

function refreshWallet() {
  $('#title-shards').textContent = fmt(save.shards);
  $('#hub-shards').textContent = fmt(save.shards);
  $('#roster-shards').textContent = fmt(save.shards);
  $('#skills-shards').textContent = fmt(save.shards);
  const rec = Math.max(...Object.values(save.best || { x: 0 }));
  $('#hub-record').textContent = fmt(rec || 0);
}

function showToast(text, warn = false) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('warn', warn);
  el.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function clearPadFocus() {
  if (padFocusEl) padFocusEl.classList.remove('pad-focus');
  padFocusEl = null;
}

function menuRoot() {
  if (state.modal?.classList.contains('visible')) return state.modal;
  return $('.screen.active');
}

function menuFocusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll('button, select, input, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.disabled && !el.hidden && el.getClientRects().length > 0);
}

function focusPadElement(el) {
  if (!el || el === padFocusEl) return;
  if (padFocusEl) padFocusEl.classList.remove('pad-focus');
  padFocusEl = el;
  padFocusEl.classList.add('pad-focus');
  try { padFocusEl.focus({ preventScroll: true }); } catch {}
  try { padFocusEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {}
}

function updatePadHelp(pad) {
  const info = pad || controllerInfo('');
  const glyphs = info.glyphs;
  const set = (id, value) => { const el = $('#' + id); if (el) el.textContent = value; };
  const label = $('#pad-label');
  if (label) label.textContent = pad ? info.label : 'GAMEPAD';
  set('pad-kbd-move', glyphs.move);
  set('pad-kbd-light', glyphs.light);
  set('pad-kbd-heavy', glyphs.heavy);
  set('pad-kbd-launch', glyphs.launch);
  set('pad-kbd-dodge', glyphs.dodge);
  set('pad-kbd-jump', glyphs.jump);
  set('pad-kbd-special', glyphs.special);
  set('pad-kbd-taunt', glyphs.taunt);
  set('pad-kbd-pause', glyphs.pause);
}

function actionLabels(def) {
  const map = def?.actions || {};
  return {
    heavy: map.heavy === 'shot' ? 'GUN' : 'HEAVY',
    launch: map.launch === 'shot' ? 'FIRE' : map.launch === 'rev' ? 'REV UP' : map.launch === 'weave' ? 'CRIMSON WEAVE' : 'LAUNCH',
  };
}

function updateControlHints(force = false) {
  const info = game.input.padInfo(0) || controllerInfo('');
  const source = game.input.hasPad() ? game.input.lastSource : 'keyboard';
  const kind = info.kind;
  const labels = actionLabels(game.players?.[0]?.def);
  const labelKey = `${labels.heavy}/${labels.launch}`;
  if (!force && source === promptSource && kind === promptKind && labelKey === promptLabels) return;
  promptSource = source;
  promptKind = kind;
  promptLabels = labelKey;
  if (source === 'keyboard') clearPadFocus();
  const strip = $('#controls-strip');
  if (!strip) return;
  const launchLabel = labels.launch;
  const heavyLabel = labels.heavy;
  if (source === 'gamepad') {
    const g = info.glyphs;
    strip.innerHTML = [
      `<span><kbd>${g.move}</kbd> MOVE</span>`,
      `<span><kbd>${g.light}</kbd> LIGHT</span>`,
      `<span><kbd>${g.heavy}</kbd> ${heavyLabel}</span>`,
      `<span><kbd>${g.launch}</kbd> ${launchLabel}</span>`,
      `<span><kbd>${g.dodge}</kbd> DODGE</span>`,
      `<span><kbd>${g.jump}</kbd> JUMP</span>`,
      `<span><kbd>${g.special}</kbd> SPECIAL</span>`,
      `<span><kbd>${g.taunt}</kbd> TAUNT</span>`,
    ].join('');
  } else {
    strip.innerHTML = [
      '<span><kbd>WASD</kbd> MOVE</span>',
      '<span><kbd>J</kbd> LIGHT</span>',
      `<span><kbd>K</kbd> ${heavyLabel}</span>`,
      `<span><kbd>L</kbd> ${launchLabel}</span>`,
      '<span><kbd>SPACE</kbd> DODGE</span>',
      '<span><kbd>I</kbd> JUMP</span>',
      '<span><kbd>E</kbd> SPECIAL</span>',
      '<span><kbd>U</kbd> TAUNT</span>',
    ].join('');
  }
}

// ---------------- Training menu ----------------
const TRAINING_OPTIONS = {
  player: [
    { key: 'takeDamage', label: 'TAKE DAMAGE', type: 'seg', values: [[false, 'OFF'], [true, 'ON']] },
    { key: 'infiniteHealth', label: 'HEALTH', type: 'seg', values: [[true, 'INFINITE'], [false, 'FINITE']] },
    { key: 'infiniteSpecial', label: 'SPECIAL METER', type: 'seg', values: [[true, 'INFINITE'], [false, 'FINITE']] },
    { key: 'damage', label: 'OUTPUT DAMAGE', type: 'step', min: 0.5, max: 5, step: 0.5, format: v => `${v.toFixed(1)}x` },
    { key: 'speed', label: 'MOVE SPEED', type: 'step', min: 0.5, max: 2, step: 0.1, format: v => `${v.toFixed(1)}x` },
    { key: 'autoCombo', label: 'AUTO COMBO', type: 'seg', values: [[false, 'OFF'], [true, 'ON']] },
  ],
  dummy: [
    { key: 'behavior', label: 'BEHAVIOR', type: 'seg', values: [['static', 'STATIC'], ['patrol', 'PATROL'], ['approach', 'APPROACH'], ['aggressive', 'AGGRESSIVE'], ['block', 'BLOCK']] },
    { key: 'speed', label: 'MOVE SPEED', type: 'step', min: 0.5, max: 3, step: 0.1, format: v => `${v.toFixed(1)}x` },
    { key: 'juggle', label: 'JUGGLE', type: 'seg', values: [[true, 'ON'], [false, 'OFF']] },
    { key: 'health', label: 'DUMMY HEALTH', type: 'seg', values: [['infinite', 'INFINITE'], ['finite', 'FINITE']] },
    { key: 'count', label: 'DUMMIES', type: 'seg', values: [[1, '1'], [2, '2'], [3, '3']] },
    { key: 'facing', label: 'FACING', type: 'seg', values: [['player', 'FOLLOW'], ['fixed', 'FIXED']] },
  ],
};

function trainingGroup() {
  return state.mode === 'training' || game.mode === 'training' ? 'training' : null;
}

function buildTrainingMenu() {
  const groups = { player: $('#training-player-opts'), dummy: $('#training-dummy-opts') };
  for (const [id, host] of Object.entries(groups)) {
    if (!host) continue;
    host.innerHTML = '';
    for (const opt of TRAINING_OPTIONS[id]) {
      const row = document.createElement('div');
      row.className = 'trow';
      const label = document.createElement('span');
      label.className = 'trow-label';
      label.textContent = opt.label;
      row.appendChild(label);
      if (opt.type === 'seg') {
        const seg = document.createElement('div');
        seg.className = 'tseg';
        for (const [value, text] of opt.values) {
          const b = document.createElement('button');
          b.textContent = text;
          b.dataset.opt = opt.key;
          b.dataset.value = String(value);
          b.addEventListener('click', () => {
            audio.init(); audio.ui(true);
            setTrainingOption(id, opt.key, value);
          });
          seg.appendChild(b);
        }
        row.appendChild(seg);
      } else {
        const step = document.createElement('div');
        step.className = 'tstep';
        const minus = document.createElement('button');
        minus.textContent = '−';
        const val = document.createElement('b');
        const plus = document.createElement('button');
        plus.textContent = '+';
        const apply = dir => {
          const cur = Number(game.training[id][opt.key]) || opt.min;
          const next = Math.round(Math.min(opt.max, Math.max(opt.min, cur + dir * opt.step)) * 1000) / 1000;
          audio.init(); audio.ui(dir > 0);
          setTrainingOption(id, opt.key, next);
        };
        minus.addEventListener('click', () => apply(-1));
        plus.addEventListener('click', () => apply(1));
        step.appendChild(minus);
        step.appendChild(val);
        step.appendChild(plus);
        row.appendChild(step);
        row._sync = () => {
          const cur = game.training[id][opt.key];
          val.textContent = opt.format ? opt.format(cur) : String(cur);
        };
      }
      host.appendChild(row);
    }
  }
  syncTrainingMenu();
}

function syncTrainingMenu() {
  const groups = { player: $('#training-player-opts'), dummy: $('#training-dummy-opts') };
  for (const [id, host] of Object.entries(groups)) {
    if (!host) continue;
    for (const opt of TRAINING_OPTIONS[id]) {
      const cur = game.training[id][opt.key];
      for (const b of host.querySelectorAll(`[data-opt="${opt.key}"]`)) {
        b.classList.toggle('on', String(b.dataset.value) === String(cur));
      }
      for (const row of host.querySelectorAll('.trow')) {
        if (row._sync && row.querySelector(`[data-opt="${opt.key}"]`) === null) row._sync();
      }
    }
  }
  const reset = $('#btn-training-reset');
  if (reset) reset.disabled = game.mode !== 'training';
}

function setTrainingOption(group, key, value) {
  game.training[group][key] = value;
  if (group === 'dummy' && key === 'count' && game.mode === 'training') game.spawnTraining();
  if (group === 'dummy' && key === 'health' && game.mode === 'training') {
    game.enemies.forEach(e => { if (e.training) e.hp = e.maxHp; });
  }
  syncTrainingMenu();
}

let trainingWasPaused = false;
function openTrainingMenu() {
  buildTrainingMenu();
  setModal($('#screen-training'), true);
  if (game.active && !game.paused) { trainingWasPaused = false; game.pause(); }
  else trainingWasPaused = true;
}
function closeTrainingMenu() {
  setModal($('#screen-training'), false);
  if (game.active && document.body.classList.contains('playing')) {
    if (!trainingWasPaused) game.resume();
    else setModal($('#screen-pause'), true);
  }
  trainingWasPaused = true;
}

function showScreen(name) {
  clearPadFocus();
  state.screen = name;
  $$('.screen').forEach(s => s.classList.remove('active'));
  if (name) {
    const el = $('#screen-' + name);
    if (el) el.classList.add('active');
  }
  document.body.classList.toggle('menu-mode', !!name && name !== 'game');
  if (name === 'title' || name === 'hub') refreshWallet();
}

function setModal(el, on = true) {
  clearPadFocus();
  if (on) {
    $$('.modal-screen.visible').forEach(m => m.classList.remove('visible'));
    el.classList.add('visible');
    state.modal = el;
  } else {
    el.classList.remove('visible');
    if (state.modal === el) state.modal = null;
  }
}
function closeModals() {
  clearPadFocus();
  $$('.modal-screen.visible').forEach(m => m.classList.remove('visible'));
  state.modal = null;
}

function showMenuWorld() {
  world.setCameraMode('menu');
  world.showShowcase(charById(state.selectedChar));
}

function resetToMenuWorld() {
  world.reset('menu');
  world.setCameraMode('menu');
  world.showShowcase(charById(state.selectedChar));
}

// ---------------- Mode list ----------------
function buildModes() {
  const list = $('#mode-list');
  list.innerHTML = '';
  MODES.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.className = 'mode-card';
    if (i === 0) btn.setAttribute('data-pad-default', '');
    btn.dataset.tone = m.tone;
    btn.dataset.mode = m.id;
    const best = save.best?.[m.id] || 0;
    btn.innerHTML = `
      <div class="mode-num">${m.icon}</div>
      <div class="mode-copy"><h3>${m.name} <small>${m.tag}</small></h3><p>${m.desc}</p></div>
      <div class="mode-best"><span>BEST SCORE</span><b>${best ? fmt(best) : '—'}</b><span style="margin-top:4px">${m.detail}</span></div>
      <div class="mode-arrow">→</div>`;
    btn.addEventListener('click', () => {
      audio.init(); audio.ui(true);
      selectMode(m.id);
    });
    list.appendChild(btn);
  });
}

function selectMode(id) {
  state.mode = id;
  $('#roster-mode-label').textContent = `${modeById(id).name} // ${modeById(id).tag}`;
  fillSquadChars();
  openRoster();
}

function openHub() {
  fillSquadChars();
  buildModes();
  refreshWallet();
  showMenuWorld();
  showScreen('hub');
}

// ---------------- Roster ----------------
const GLYPHS = { gauntlets: '✦', katana: '╱', glaive: '⟋', tonfas: '‖', scythe: '⌁', hammer: '▣', daggers: '⋰', fists: '✹', staff: '⌇', demonblade: '†', deserteagle: '⌖', neonedge: 'ᛘ', neonrevolver: '⌾' };

function buildRoster() {
  const grid = $('#roster-grid');
  grid.innerHTML = '';
  CHARACTERS.forEach((c, i) => {
    const locked = !save.unlocked.includes(c.id);
    const card = document.createElement('button');
    card.className = 'char-card' + (locked ? ' locked' : '') + (c.id === state.selectedChar ? ' selected' : '');
    card.style.setProperty('--char', hex(c.colors.accent));
    card.innerHTML = `
      <div class="char-figure"><span>${c.name[0]}</span><div class="weapon-glyph">${GLYPHS[c.weapon] || '✦'}</div></div>
      <div class="char-num">${String(i + 1).padStart(2, '0')}</div>
      ${locked ? `<div class="char-lock">◆ ${fmt(c.unlock)}</div><div class="unlock-hint">UNLOCK<br><b>◆ ${fmt(c.unlock)}</b><br><span style="color:#8e98af">SOUL SHARDS</span></div>` : ''}
      ${locked ? '' : `<div class="char-perk">${c.unlockPerk?.name || ''}</div>`}
      <div class="char-meta"><h3>${c.name}</h3><p>${c.role}</p></div>`;
    card.addEventListener('click', () => {
      audio.init(); audio.ui(true);
      if (locked) tryUnlock(c.id);
      else selectCharacter(c.id);
    });
    grid.appendChild(card);
  });
}

function tryUnlock(id) {
  const c = charById(id);
  if (save.shards < c.unlock) {
    showToast(`NEED ◆ ${fmt(c.unlock - save.shards)} MORE SOUL SHARDS`, true);
    audio.ui(false);
    return;
  }
  save.shards -= c.unlock;
  save.unlocked.push(id);
  save.selectedChar = id;
  state.selectedChar = id;
  state.squadChars[0] = id;
  // the unlock ships with the character's signature skill, mastered
  const gift = SKILLS.find(sk => sk.id === c.signatureSkill);
  if (gift) {
    save.skills[id] ||= [];
    if (!save.skills[id].includes(gift.id)) save.skills[id].push(gift.id);
  }
  persistSave(save);
  audio.unlock();
  showToast(`${c.name} UNLOCKED — ${c.title}`);
  buildRoster();
  updateFighterPanel();
  buildSquad();
  refreshWallet();
  world.showShowcase(c);
  showUnlockCard(c, gift);
}

function showUnlockCard(c, gift) {
  const card = $('#screen-unlock');
  $('#unlock-initial').textContent = c.name[0];
  $('#unlock-initial').style.textShadow = `0 0 34px ${hex(c.colors.accent)}`;
  $('#unlock-name').textContent = c.name;
  $('#unlock-title').textContent = c.title;
  $('#unlock-perk-name').textContent = c.unlockPerk?.name || 'SIGNATURE KIT';
  $('#unlock-perk-desc').textContent = c.unlockPerk?.desc || '';
  $('#unlock-skill').textContent = gift ? gift.name : '—';
  card.style.setProperty('--uc', hex(c.colors.accent));
  setModal(card, true);
  audio.ui(true);
}

function selectCharacter(id) {
  state.selectedChar = id;
  save.selectedChar = id;
  state.squadChars[0] = id;
  persistSave(save);
  buildRoster();
  updateFighterPanel();
  buildSquad();
  world.showShowcase(charById(id));
}

function updateFighterPanel() {
  const c = charById(state.selectedChar);
  const panel = $('#fighter-panel');
  panel.style.setProperty('--char', hex(c.colors.accent));
  $('#fighter-index').textContent = String(CHARACTERS.indexOf(c) + 1).padStart(2, '0');
  $('#fighter-initial').textContent = c.name[0];
  $('#fighter-tag').textContent = c.title;
  $('#fighter-name').textContent = c.name;
  $('#fighter-role').textContent = c.role;
  $('#fighter-desc').textContent = c.desc;
  $('#fighter-ultimate').textContent = c.ultimate;
  $('#fighter-combo').textContent = c.comboName;
  const perkBox = $('#fighter-perk');
  if (perkBox) {
    const owned = save.unlocked.includes(c.id);
    perkBox.style.display = owned ? 'block' : 'none';
    $('#fighter-perk-name').textContent = c.unlockPerk?.name || '';
    $('#fighter-perk-desc').textContent = c.unlockPerk?.desc || '';
  }
  const stats = [['POWER', c.power], ['SPEED', c.speed], ['RANGE', c.range], ['TECH', c.tech]];
  $('#fighter-stats').innerHTML = stats.map(([n, v]) => `
    <div class="stat-row"><span>${n}</span><div class="stat-track"><i style="width:${v * 10}%"></i></div><b>${v}</b></div>`).join('');
  const locked = !save.unlocked.includes(c.id);
  $('#btn-launch').innerHTML = locked ? `UNLOCK ◆ ${fmt(c.unlock)} <span>→</span>` : 'DEPLOY <span>→</span>';
  $('#btn-launch').disabled = false;
  $('#fighter-art').style.setProperty('--char', hex(c.colors.accent));
}

function buildSquad() {
  const wrap = $('#squad-slots');
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    if (i >= state.squadCount) {
      const slot = document.createElement('div');
      slot.className = 'squad-slot empty';
      slot.innerHTML = `<button class="squad-add" data-add="${i}">+ P${i + 1}</button>`;
      wrap.appendChild(slot);
      continue;
    }
    const slot = document.createElement('div');
    slot.className = 'squad-slot';
    slot.dataset.slot = i;
    const options = unlocked().map(c => `<option value="${c.id}" ${c.id === state.squadChars[i] ? 'selected' : ''}>${c.name}</option>`).join('');
    slot.innerHTML = `<span class="sq-p" style="--sc:${hex(charById(state.squadChars[i]).colors.accent)}">P${i + 1}</span><select data-slot="${i}" ${i === 0 ? 'disabled' : ''}>${options}</select>${i > 0 ? `<button class="squad-remove" data-remove="${i}">×</button>` : ''}`;
    wrap.appendChild(slot);
    const col = hex(charById(state.squadChars[i]).colors.accent);
    slot.style.setProperty('--sc', col);
    slot.querySelector('.sq-p').style.color = col;
    slot.querySelector('.sq-p').style.background = col + '22';
  }
  wrap.onchange = e => {
    const sel = e.target.closest('select[data-slot]');
    if (!sel) return;
    const i = Number(sel.dataset.slot);
    state.squadChars[i] = sel.value;
    save.squad = state.squadCount;
    persistSave(save);
    buildSquad();
    audio.ui(true);
  };
  wrap.onclick = e => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const i = Number(add.dataset.add);
      const available = unlocked().map(c => c.id);
      state.squadChars[i] = available.find(id => !state.squadChars.slice(0, i).includes(id)) || available[i % available.length] || 'rook';
      state.squadCount = Math.max(state.squadCount, i + 1);
      save.squad = state.squadCount;
      persistSave(save);
      buildSquad();
      audio.ui(true);
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const i = Number(rm.dataset.remove);
      state.squadCount = i;
      save.squad = state.squadCount;
      persistSave(save);
      buildSquad();
      audio.ui(false);
    }
  };
}

function openRoster() {
  fillSquadChars();
  buildRoster();
  updateFighterPanel();
  buildSquad();
  refreshWallet();
  const setupBtn = $('#btn-roster-training');
  if (setupBtn) setupBtn.hidden = state.mode !== 'training';
  showScreen('roster');
  world.setCameraMode('menu');
  world.showShowcase(charById(state.selectedChar));
}

// ---------------- Skills ----------------
function openSkills() {
  showScreen('skills');
  buildSkills();
  refreshWallet();
}

function buildSkills() {
  const c = charById(state.selectedChar);
  const owned = new Set(save.skills?.[c.id] || []);
  $('#skills-name').textContent = c.name;
  $('#skills-role').textContent = c.role;
  $('#skills-initial').textContent = c.name[0];
  const art = $('#skills-art');
  art.style.setProperty('--char', hex(c.colors.accent));
  art.querySelector('span').style.color = hex(c.colors.accent);
  art.querySelector('span').style.textShadow = `0 0 50px ${hex(c.colors.accent)}`;
  const stats = [['POWER', c.power], ['SPEED', c.speed], ['RANGE', c.range], ['TECH', c.tech]];
  $('#skills-chips').innerHTML = stats.map(([n, v]) => `<span>${n} ${v}</span>`).join('') + `<span>◆ ${fmt(save.shards)}</span>`;
  const cards = $('#skills-cards');
  cards.innerHTML = '';
  SKILLS.forEach(skill => {
    const has = owned.has(skill.id);
    const card = document.createElement('div');
    card.className = 'skill-card' + (has ? ' owned' : '');
    card.innerHTML = `
      <div class="skill-icon">${skill.icon}</div>
      <div class="skill-copy"><h3>${skill.name}</h3><p>${skill.desc}</p><span class="skill-cost">${has ? '<span style="color:var(--green)">MASTERED</span>' : `<span class="shard">◆</span><b>${fmt(skill.cost)}</b>`}</span></div>
      ${has ? '<span class="owned-tag">ACTIVE</span>' : `<button class="btn btn-ghost btn-small" data-skill="${skill.id}">UNLOCK</button>`}`;
    if (!has) {
      const btn = card.querySelector('[data-skill]');
      btn.addEventListener('click', () => buySkill(c, skill));
    }
    cards.appendChild(card);
  });
}

function buySkill(c, skill) {
  if (save.shards < skill.cost) {
    showToast(`NEED ◆ ${fmt(skill.cost - save.shards)} MORE SOUL SHARDS`, true);
    audio.ui(false);
    return;
  }
  save.shards -= skill.cost;
  save.skills[c.id] ||= [];
  if (!save.skills[c.id].includes(skill.id)) save.skills[c.id].push(skill.id);
  persistSave(save);
  audio.unlock();
  showToast(`${skill.name} MASTERED — ${c.name}`);
  buildSkills();
  refreshWallet();
}

// ---------------- Game start / UI ----------------
function launchGame(config = {}) {
  audio.init();
  if (audio.ctx?.state === 'suspended') audio.ctx.resume();
  closeModals();
  showScreen(null);
  $('#hud').hidden = false;
  document.body.classList.add('playing');
  document.body.classList.remove('guest-mode');
  $('#guest-video').srcObject = null;
  state.awarded = 0;
  state.result = null;
  playerSig = '';
  fillSquadChars();
  const ids = state.squadChars.slice(0, state.squadCount);
  game.start({
    mode: config.mode || state.mode,
    squad: config.squad || state.squadCount,
    characterIds: config.characterIds || ids,
    remoteInputs: config.remoteInputs || null,
  });
  world.setCameraMode('game');
  const focus = game.players[0]?.x || 0;
  world.cameraX = focus;
  world.cameraLookX = focus;
  const mode = modeById(game.mode);
  const linkedSquad = game.players.length || state.squadCount;
  $('#hud-mode').textContent = mode.name;
  $('#controls-strip').style.display = linkedSquad > 1 ? 'none' : 'flex';
  $('#coop-indicator').classList.toggle('show', linkedSquad > 1);
  if (linkedSquad > 1) $('#coop-indicator').textContent = `SQUAD LINK ACTIVE // ${linkedSquad} FIGHTERS`;
  refreshHudNow({ players: [], mode: game.mode, wave: 0, enemies: 0, score: 0, shards: 0, boss: null, objective: null, phase: 'intro' });
}

let playerSig = '';
let playerRefs = [];

function updateHUD(hud) {
  if (!hud) return;
  refreshHudNow(hud);
  if (state.online.role === 'host' && state.online.started) {
    const now = performance.now();
    if (now - state.online.lastHudSend > 100) {
      state.online.lastHudSend = now;
      for (const c of state.online.conns) {
        try { c.conn.send({ type: 'hud', hud }); } catch {}
      }
    }
  }
}

function refreshHudNow(hud) {
  const players = hud.players || [];
  const sig = players.map(p => p.name + p.index).join('|') + (state.guest ? 'g' + state.online.guestIndex : '');
  if (sig !== playerSig) {
    playerSig = sig;
    const wrap = $('#player-panels');
    wrap.innerHTML = '';
    playerRefs = players.map((p, i) => {
      const col = hex(p.def?.colors?.accent || p.color || 0xff3d74);
      const el = document.createElement('div');
      el.className = 'player-panel' + (state.guest && p.index === state.online.guestIndex ? ' you' : '');
      el.style.setProperty('--pc', col);
      el.innerHTML = `
        <div class="pp-portrait">${p.name[0]}</div>
        <div class="pp-body">
          <div class="pp-top"><span class="pp-name">${p.name}<small>P${p.index + 1}${state.guest && p.index === state.online.guestIndex ? ' // YOU' : ''}</small></span><span class="pp-hp-num"></span></div>
          <div class="pp-hp-track"><i class="pp-hp-fill"></i></div>
          <div class="pp-special-track"><i class="pp-special-fill"></i></div>
          <div class="pp-rev-track"><i class="pp-rev-fill"></i></div>
          <div class="pp-rev-label">REV</div>
          <div class="pp-special-ready"></div>
        </div>
        <div class="pp-rank">D</div>`;
      wrap.appendChild(el);
      return {
        el, hp: el.querySelector('.pp-hp-fill'), hpNum: el.querySelector('.pp-hp-num'),
        sp: el.querySelector('.pp-special-fill'), ready: el.querySelector('.pp-special-ready'),
        revTrack: el.querySelector('.pp-rev-track'), revFill: el.querySelector('.pp-rev-fill'),
        revLabel: el.querySelector('.pp-rev-label'),
        rank: el.querySelector('.pp-rank'), name: el.querySelector('.pp-name'),
      };
    });
  }
  players.forEach((p, i) => {
    const ref = playerRefs[i];
    if (!ref) return;
    const hpPct = Math.max(0, p.hp / Math.max(1, p.maxHp) * 100);
    ref.hp.style.width = hpPct + '%';
    ref.hpNum.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    ref.sp.style.width = Math.min(100, p.special) + '%';
    ref.ready.textContent = p.downed ? 'DOWNED // LINK LOST' : p.special >= 100 ? '◉ OVERDRIVE READY [E]' : '';
    if (ref.revTrack) {
      const hasRev = p.hasRev || p.def?.rev;
      ref.revTrack.classList.toggle('on', !!hasRev);
      ref.revTrack.classList.toggle('active', !!p.revActive);
      ref.revFill.style.width = Math.max(0, Math.min(100, (p.rev || 0) * 100)) + '%';
      if (ref.revLabel) {
        ref.revLabel.classList.toggle('on', !!hasRev);
        ref.revLabel.textContent = p.revActive ? '◉ DEVIL TRIGGER' : hasRev && (p.rev || 0) >= 0.25 ? 'REV READY [L]' : '';
      }
    }
    ref.el.classList.toggle('downed', !!p.downed);
    ref.rank.textContent = p.rank?.name || 'D';
    ref.rank.style.color = p.rank?.color || '#fff';
  });

  const me = players[state.guest ? Math.min(players.length - 1, state.online.guestIndex) : 0] || players[0];
  if (me) {
    const rank = me.rank || RANKS[0];
    const rankEl = $('#style-rank');
    if (rankEl.textContent !== rank.name) {
      rankEl.textContent = rank.name;
      rankEl.classList.remove('pop');
      void rankEl.offsetWidth;
      rankEl.classList.add('pop');
    }
    rankEl.style.color = rank.color;
    rankEl.dataset.rank = rank.name;
    document.documentElement.style.setProperty('--rank-color', rank.color);
    const idx = RANKS.findIndex(r => r.name === rank.name);
    const next = RANKS[Math.min(RANKS.length - 1, idx + 1)];
    const prev = RANKS[Math.max(0, idx)];
    const pct = rank.name === 'SSS' ? 100 : Math.max(0, Math.min(100, (me.style - prev.min) / Math.max(1, next.min - prev.min) * 100));
    $('#style-fill').style.width = pct + '%';
    $('#style-fill').style.background = rank.color;
    $('#style-label').textContent = `STYLE // ${me.name}`;
    $('#combo-value').textContent = me.combo || 0;
    $('#combo-counter').classList.toggle('show', (me.combo || 0) > 1);
  }

  if (hud.boss) {
    $('#boss-bar').hidden = false;
    $('#boss-name').textContent = hud.boss.name;
    $('#boss-title').textContent = hud.boss.title;
    const pct = Math.max(0, hud.boss.hp / Math.max(1, hud.boss.maxHp) * 100);
    $('#boss-fill').style.width = pct + '%';
    $('#boss-hp-text').textContent = Math.ceil(pct) + '%';
  } else {
    $('#boss-bar').hidden = true;
  }

  if (hud.objective) {
    $('#objective-title').textContent = hud.objective.title;
    $('#objective-sub').textContent = hud.objective.sub;
  }
  $('#hud-score').textContent = pad(hud.score || 0);
  $('#hud-shards').textContent = '+' + fmt(hud.shards || 0);
  if (hud.mode) $('#hud-mode').textContent = MODES.find(m => m.id === hud.mode)?.name || 'RUN';
  $('#hud-wave').textContent = hud.mode === 'training' ? 'THE LAB' : hud.mode === 'bossrush' ? 'GAUNTLET' : `WAVE ${hud.wave || 1}`;
}

function flashScreen() {
  const el = $('#screen-flash');
  el.classList.remove('fire');
  void el.offsetWidth;
  el.classList.add('fire');
}

function showAnnounce(kicker, main, sub, color = '#32d8ff') {
  const el = $('#announcer');
  $('#announce-kicker').textContent = kicker || '';
  $('#announce-kicker').style.color = color;
  $('#announce-main').textContent = main || '';
  $('#announce-sub').textContent = sub || '';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showAnnounce.timer);
  showAnnounce.timer = setTimeout(() => el.classList.remove('show'), 1600);
}

function showMilestone(n) {
  const el = $('#milestone');
  $('#milestone-value').textContent = n;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function addDamage(x, y, text, color, type) {
  const layer = $('#damage-layer');
  if (layer.childElementCount > 26) layer.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = 'dmg' + (type === 'heavy' ? ' heavy' : type === 'player' ? ' player' : '');
  el.textContent = text;
  el.style.left = clamp(x, 20, window.innerWidth - 20) + 'px';
  el.style.top = clamp(y, 80, window.innerHeight - 80) + 'px';
  el.style.color = color || '#fff';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function startSpecialCinema(player) {
  const el = $('#special-cinema');
  $('#special-name').textContent = player.def.ultimate;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  flashScreen();
  clearTimeout(startSpecialCinema.timer);
  startSpecialCinema.timer = setTimeout(() => { el.hidden = true; }, 1000);
}

function hurtFlash() {
  const el = $('#hurt-vignette');
  el.classList.add('show');
  clearTimeout(hurtFlash.timer);
  hurtFlash.timer = setTimeout(() => el.classList.remove('show'), 260);
}

// ---------------- Game callbacks ----------------
function wireCallbacks() {
  const cb = game.callbacks;
  cb.hud = updateHUD;
  cb.announce = (main, sub, color) => {
    showAnnounce('//', main, sub, color);
    if (state.online.role === 'host') netEvent('announce', { main, sub, color });
  };
  cb.banner = (main, sub, color) => {
    showAnnounce('CONTRACT', main, sub, color);
    if (state.online.role === 'host') netEvent('announce', { main, sub, color });
  };
  cb.objective = () => {};
  cb.rank = (rank, color, index) => {
    const me = state.guest ? state.online.guestIndex : 0;
    if (index !== undefined && index !== me) return;
    const el = $('#style-rank');
    el.textContent = rank;
    el.style.color = color;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    document.documentElement.style.setProperty('--rank-color', color);
    if (rank === 'S' || rank === 'SS' || rank === 'SSS') showAnnounce('STYLE', rank, rank === 'SSS' ? 'PURE THEATER' : 'KEEP IT GOING', color);
  };
  cb.milestone = n => {
    showMilestone(n);
    if (state.online.role === 'host') netEvent('milestone', { n });
  };
  cb.damage = (x, y, text, color, type) => addDamage(x, y, text, color, type);
  cb.hurt = hurtFlash;
  cb.special = startSpecialCinema;
  cb.kill = () => {};
  cb.pickup = kind => showToast(kind === 'health' ? '+ VITALITY' : '+ SOUL METER', false);
  cb.upgrade = choices => {
    game.pause();
    showUpgrade(choices);
    if (state.online.role === 'host') netEvent('upgrade', {});
  };
  cb.results = result => {
    game.pause();
    showResults(result, false);
  };
  cb.stageComplete = result => {
    game.pause();
    showResults(result, true);
  };
  cb.boss = info => {
    if (info) showAnnounce('ELITE', info.name, info.title, info.color);
  };
  cb.telegraph = () => {};
}

// ---------------- Upgrade ----------------
function showUpgrade(choices) {
  const wrap = $('#upgrade-choices');
  wrap.innerHTML = '';
  choices.forEach(up => {
    const card = document.createElement('button');
    card.className = 'upgrade-choice';
    card.style.setProperty('--uc', up.color);
    card.innerHTML = `<span>SOUL ABSORPTION</span><h3>${up.name}</h3><p>${up.desc}</p><b>TAKE POWER →</b>`;
    card.addEventListener('click', () => {
      audio.ui(true);
      setModal($('#screen-upgrade'), false);
      game.chooseUpgrade(up.id);
    });
    wrap.appendChild(card);
  });
  setModal($('#screen-upgrade'), true);
  audio.rank(3);
}

// ---------------- Results ----------------
function bankResult(result) {
  const delta = Math.max(0, Math.round(result.shards - state.awarded));
  state.awarded = Math.round(result.shards);
  save.shards += delta;
  const mode = result.mode;
  if (mode) save.best[mode] = Math.max(save.best[mode] || 0, Math.round(result.score));
  save.bestCombo = Math.max(save.bestCombo || 0, result.maxCombo || 0);
  save.reachedSSS = save.reachedSSS || !!result.reachedSSS;
  if (result.bossKills) save.totalBosses = Math.max(save.totalBosses || 0, 0);
  const stats = {
    kills: result.kills || 0, bossKills: result.bossKills || 0, bestCombo: result.maxCombo || 0,
    reachedSSS: !!result.reachedSSS, waves: result.wave || 0,
  };
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements.includes(a.id) && a.test(stats)) {
      save.achievements.push(a.id);
      showToast(`ACHIEVEMENT // ${a.name}`, false);
      audio.unlock();
    }
  }
  persistSave(save);
  refreshWallet();
  buildModesSafe();
  return delta;
}

function buildModesSafe() {
  if (state.screen === 'hub') buildModes();
}

function showResults(result, stageComplete) {
  state.result = { result, stageComplete };
  const delta = bankResult(result);
  if (state.online.role === 'host' && state.online.started) {
    for (const c of state.online.conns) {
      try { c.conn.send({ type: 'results', result, stageComplete }); } catch {}
    }
  }
  renderResults(result, delta, stageComplete, false);
}

function renderResults(result, delta, stageComplete, guest) {
  $('#results-kicker').textContent = guest ? 'LINK COMPLETE' : stageComplete ? 'DISTRICT CLEARED' : result.win ? 'RUN COMPLETE' : 'RUN ENDED';
  $('#results-title').textContent = guest ? 'SQUAD REPORT' : stageComplete ? 'DISTRICT CLEARED' : result.win ? 'CITY CLEARED' : 'YOU DIED';
  $('#results-sub').textContent = guest ? 'The host calls it there. Link terminated.' : stageComplete ? 'Advance to the next district. Your squad keeps its power.' : result.win ? 'The night belongs to you. For now.' : 'The city always collects. Run it back.';
  $('#results-rank').textContent = result.rank || 'C';
  $('#results-score').textContent = fmt(result.score);
  $('#results-combo').textContent = fmt(result.maxCombo);
  $('#results-kills').textContent = fmt(result.kills);
  $('#results-shards').textContent = '+' + fmt(delta);
  $('#results-players').innerHTML = (result.players || []).map(p => `<div style="border-color:${hex(p.def?.colors?.accent)}44"><b>${p.name}</b>${fmt(p.kills)} KILLS · ${fmt(p.damage)} DMG</div>`).join('');
  const next = $('#btn-results-next');
  const again = $('#btn-results-again');
  const menu = $('#btn-results-menu');
  if (guest) {
    next.hidden = true;
    again.hidden = true;
    menu.textContent = 'LEAVE LINK';
  } else {
    next.hidden = !stageComplete;
    again.hidden = false;
    again.textContent = stageComplete ? 'RESTART RUN' : 'RUN IT BACK';
    menu.textContent = 'COMMAND';
  }
  $('#results-note').textContent = stageComplete ? 'NEXT DISTRICT RESTORES 35% VITALITY. SOUL SHARDS ARE ALREADY BANKED.' : `${result.modeName || 'RUN'} // ${niceTime(result.time || 0)} // ${result.upgrades?.length ? 'BUILD: ' + result.upgrades.join(' · ') : 'NO UPGRADES'}`;
  setModal($('#screen-results'), true);
  audio.setIntensity(0.2);
}

// ---------------- Online ----------------
function onlineStatus(text, mode = '') {
  const el = $('#online-status');
  el.innerHTML = `<span></span> ${text}`;
  el.className = 'online-status ' + mode;
}

function netEvent(event, data) {
  if (state.online.role !== 'host' || !state.online.started) return;
  for (const c of state.online.conns) {
    try { c.conn.send({ type: 'event', event, data }); } catch {}
  }
}

function netResume() {
  if (state.online.role !== 'host' || !state.online.started) return;
  for (const c of state.online.conns) {
    try { c.conn.send({ type: 'resume' }); } catch {}
  }
}

function blankRemoteInputs() {
  const inputs = {};
  for (const c of state.online.conns) {
    inputs[c.index] = {
      left: false, right: false, up: false, down: false,
      light: false, heavy: false, launch: false, dodge: false,
      jump: false, special: false, taunt: false,
    };
  }
  return inputs;
}

function openOnline() {
  closeLink();
  state.online.role = null;
  $('#online-mode-name').textContent = modeById(state.mode).name;
  $('#online-host-char').textContent = charById(state.selectedChar).name;
  $('#room-code-wrap').hidden = true;
  $('#join-list').innerHTML = '';
  $('#join-note').classList.remove('error');
  $('#join-note').textContent = 'PEER-TO-PEER · NO ACCOUNT NEEDED';
  onlineStatus('OFFLINE');
  showScreen('online');
}

function closeLink() {
  const o = state.online;
  if (o.peer) { try { o.peer.destroy(); } catch {} }
  o.peer = null;
  o.conns.forEach(c => { try { c.conn.close(); } catch {} });
  o.conns = [];
  o.guestConn = null;
  o.role = null;
  o.started = false;
  o.code = '';
  o.guestIndex = 1;
  o.localIndex = 0;
  const v = $('#guest-video');
  if (v.srcObject) { v.srcObject.getTracks?.().forEach(t => t.stop()); v.srcObject = null; }
  document.body.classList.remove('guest-mode');
  state.guest = false;
}

function randomCode() {
  const chars = 'ACDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function hostRoom() {
  if (typeof Peer === 'undefined') {
    $('#join-note').textContent = 'PeerJS failed to load. Check your connection and retry.';
    $('#join-note').classList.add('error');
    return;
  }
  closeLink();
  state.online.role = 'host';
  const code = randomCode();
  state.online.code = code;
  onlineStatus('CONNECTING', 'connecting');
  const peer = new Peer('streetrequiem-' + code, { debug: 0 });
  state.online.peer = peer;
  peer.on('open', () => {
    onlineStatus('ONLINE', 'on');
    $('#room-code').textContent = code;
    $('#room-code-wrap').hidden = false;
    $('#btn-online-start').disabled = true;
    $('#btn-online-start').textContent = 'WAITING FOR SQUAD…';
    updateJoinList();
    audio.unlock();
  });
  peer.on('error', err => {
    onlineStatus('ERROR', '');
    $('#join-note').textContent = 'Could not create room: ' + (err.type || err.message || 'network error');
    $('#join-note').classList.add('error');
    showToast('ROOM CREATE FAILED', true);
  });
  peer.on('connection', conn => {
    if (state.online.conns.length >= 3) { try { conn.close(); } catch {} return; }
    conn.on('open', () => {
      const index = 1 + state.online.conns.length;
      state.online.conns.push({ conn, index });
      updateJoinList();
      $('#btn-online-start').disabled = false;
      $('#btn-online-start').textContent = 'START CO-OP RUN →';
      audio.ui(true);
      showToast(`P${index + 1} LINKED`);
    });
    conn.on('data', data => {
      const entry = state.online.conns.find(c => c.conn === conn);
      if (!entry) return;
      if (data.type === 'input' && state.online.started) {
        const idx = entry.index;
        const cur = game.remoteInputs?.[idx];
        const inp = data.input || {};
        if (cur) {
          cur.left = !!inp.left; cur.right = !!inp.right; cur.up = !!inp.up; cur.down = !!inp.down;
          cur.light = cur.light || !!inp.light; cur.heavy = cur.heavy || !!inp.heavy; cur.launch = cur.launch || !!inp.launch;
          cur.dodge = cur.dodge || !!inp.dodge; cur.jump = cur.jump || !!inp.jump; cur.special = cur.special || !!inp.special; cur.taunt = cur.taunt || !!inp.taunt;
        }
      }
    });
    conn.on('close', () => {
      state.online.conns = state.online.conns.filter(c => c.conn !== conn);
      updateJoinList();
      if (state.online.started) showToast('A SQUAD LINK DROPPED', true);
    });
  });
}

function updateJoinList() {
  const list = $('#join-list');
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const c = state.online.conns[i];
    rows.push(c ? `<div class="join-slot"><span class="dot"></span><b>P${c.index + 1} LINKED</b><span>REMOTE FIGHTER</span></div>` : `<div class="join-slot" style="opacity:.4"><span class="dot" style="background:#555"></span><b>P${i + 2} OPEN</b><span>WAITING</span></div>`);
  }
  list.innerHTML = rows.join('');
}

function startOnlineHost() {
  if (state.online.conns.length === 0) return;
  const ids = [];
  ids.push(state.selectedChar);
  for (const c of state.online.conns) {
    const pick = CHARACTERS.find(ch => save.unlocked.includes(ch.id) && !ids.includes(ch.id)) || CHARACTERS[0];
    ids.push(pick.id);
  }
  const remoteInputs = blankRemoteInputs();
  state.online.started = true;
  state.online.localIndex = 0;
  for (const c of state.online.conns) {
    try {
      c.conn.send({ type: 'start', mode: state.mode, playerIndex: c.index, characters: ids, hostName: charById(ids[0]).name });
    } catch {}
  }
  launchGame({ mode: state.mode, squad: ids.length, characterIds: ids, remoteInputs });
  setTimeout(() => {
    try {
      const stream = canvas.captureStream(30);
      for (const c of state.online.conns) {
        const call = state.online.peer.call(c.conn.peer, stream);
        c.call = call;
      }
      showToast('SQUAD STREAM LIVE');
    } catch (err) {
      showToast('VIDEO STREAM UNAVAILABLE', true);
    }
  }, 600);
}

function joinRoom() {
  const code = ($('#join-code').value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    $('#join-note').textContent = 'ENTER A VALID FOUR-CHARACTER CODE';
    $('#join-note').classList.add('error');
    return;
  }
  if (typeof Peer === 'undefined') {
    $('#join-note').textContent = 'PeerJS failed to load. Check your connection and retry.';
    return;
  }
  closeLink();
  state.online.role = 'guest';
  onlineStatus('CONNECTING', 'connecting');
  $('#join-note').classList.remove('error');
  $('#join-note').textContent = 'DIALING ' + code + '…';
  const peer = new Peer({ debug: 0 });
  state.online.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect('streetrequiem-' + code, { reliable: true });
    state.online.guestConn = conn;
    conn.on('open', () => {
      onlineStatus('LINKED', 'on');
      $('#join-note').textContent = 'LINKED. WAITING FOR HOST TO START…';
      audio.unlock();
    });
    conn.on('data', data => handleGuestData(data));
    conn.on('close', () => {
      if (state.guest) {
        showToast('HOST DISCONNECTED', true);
        setTimeout(() => leaveGuest(), 1600);
      } else {
        onlineStatus('DISCONNECTED');
        $('#join-note').textContent = 'HOST NOT FOUND. CHECK THE CODE.';
        $('#join-note').classList.add('error');
      }
    });
  });
  peer.on('call', call => {
    call.answer();
    call.on('stream', stream => {
      const video = $('#guest-video');
      video.srcObject = stream;
      video.muted = true;
      video.play().catch(() => {});
    });
  });
  peer.on('error', err => {
    onlineStatus('ERROR');
    $('#join-note').classList.add('error');
    $('#join-note').textContent = 'CONNECTION FAILED: ' + (err.type || err.message || 'network');
  });
}

function handleGuestData(data) {
  if (data.type === 'start') {
    state.guest = true;
    state.online.started = true;
    state.online.guestIndex = data.playerIndex;
    state.online.localIndex = data.playerIndex;
    state.mode = data.mode;
    document.body.classList.add('guest-mode');
    closeModals();
    showScreen(null);
    $('#hud').hidden = false;
    document.body.classList.add('playing');
    showToast(`SQUAD LINKED // YOU ARE P${data.playerIndex + 1}`);
    showAnnounce('SQUAD LINK', 'P' + (data.playerIndex + 1), charById(data.characters[data.playerIndex] || 'rook').name, '#32d8ff');
    playerSig = '';
    return;
  }
  if (data.type === 'hud') { updateHUD(data.hud); return; }
  if (data.type === 'resume') {
    state.result = null;
    state.awarded = 0;
    playerSig = '';
    closeModals();
    showScreen(null);
    $('#hud').hidden = false;
    document.body.classList.add('playing', 'guest-mode');
    return;
  }
  if (data.type === 'event') {
    const d = data.data || {};
    if (data.event === 'announce') showAnnounce('//', d.main, d.sub, d.color);
    if (data.event === 'milestone') showMilestone(d.n);
    if (data.event === 'upgrade') showToast('HOST IS DRAFTING AN UPGRADE…');
    return;
  }
  if (data.type === 'results') {
    state.guest = true;
    state.result = data;
    renderResults(data.result, data.result.shards, data.stageComplete, true);
    state.awarded = 0;
  }
}

function leaveGuest() {
  closeLink();
  $('#hud').hidden = true;
  document.body.classList.remove('playing');
  resetToMenuWorld();
  showScreen('title');
}

// ---------------- Pause / results controls ----------------
function goBack() {
  if ($('#screen-unlock').classList.contains('visible')) { setModal($('#screen-unlock'), false); return; }
  if ($('#screen-training').classList.contains('visible')) { closeTrainingMenu(); return; }
  if ($('#screen-help').classList.contains('visible')) { closeHelp(); return; }
  if ($('#screen-results').classList.contains('visible') || $('#screen-upgrade').classList.contains('visible')) return;
  if (state.screen === 'online') { closeLink(); openRoster(); return; }
  if (state.screen === 'roster') { showMenuWorld(); showScreen('hub'); return; }
  if (state.screen === 'skills') { openRoster(); return; }
  if (game.active) requestPause();
}

function handlePadMenu(action) {
  if (!action || !game.input.hasPad()) return;
  const any = action.up || action.down || action.left || action.right || action.confirm || action.cancel || action.start;
  if (!any && game.input.lastSource !== 'gamepad') return;
  if (action.cancel) { goBack(); return; }
  if (action.start && game.active && !$('#screen-results').classList.contains('visible') && !$('#screen-upgrade').classList.contains('visible')) {
    requestPause();
    return;
  }
  if (action.start) action.confirm = true;
  const root = menuRoot();
  const items = menuFocusables(root);
  if (!items.length) return;
  const hadFocus = padFocusEl && items.includes(padFocusEl);
  if (!hadFocus) {
    const preferred = items.find(el => el.hasAttribute('data-pad-default'))
      || items.find(el => el.classList.contains('btn-primary'))
      || items[0];
    focusPadElement(preferred);
    if (!action.confirm) return;
  }
  let index = items.indexOf(padFocusEl);
  let moved = false;
  if ((action.left || action.right) && padFocusEl?.tagName === 'SELECT') {
    const count = padFocusEl.options.length;
    const delta = action.right ? 1 : -1;
    padFocusEl.selectedIndex = (padFocusEl.selectedIndex + delta + count) % count;
    padFocusEl.dispatchEvent(new Event('change', { bubbles: true }));
    moved = true;
  } else {
    if (action.up || action.left) { index = (index - 1 + items.length) % items.length; moved = true; }
    if (action.down || action.right) { index = (index + 1) % items.length; moved = true; }
    if (moved) focusPadElement(items[index]);
  }
  if (action.confirm) {
    game.input.rumble?.(0.06, 0.06, 20, 0);
    if (padFocusEl?.tagName === 'INPUT') padFocusEl.focus();
    else padFocusEl?.click();
  } else if (moved) {
    game.input.rumble?.(0.025, 0.035, 12, 0);
  }
}

function requestPause() {
  if ($('#screen-training').classList.contains('visible')) { closeTrainingMenu(); return; }
  if (state.screen === 'online') return;
  if (state.guest) {
    if (state.modal) { closeModals(); return; }
    leaveGuest();
    return;
  }
  if (!game.active) return;
  if ($('#screen-results').classList.contains('visible') || $('#screen-upgrade').classList.contains('visible')) return;
  if ($('#screen-help').classList.contains('visible')) { setModal($('#screen-help'), false); return; }
  if (game.paused) {
    game.resume();
    setModal($('#screen-pause'), false);
  } else {
    game.pause();
    const tBtn = $('#btn-pause-training');
    if (tBtn) tBtn.hidden = game.mode !== 'training';
    $('#pause-mode').textContent = modeById(game.mode).name;
    $('#pause-progress').textContent = game.mode === 'campaign' ? `${STAGES[game.stageIndex].name} // WAVE ${game.run.wave}` : `WAVE ${game.run.wave}`;
    setModal($('#screen-pause'), true);
    netEvent('announce', { main: 'PAUSED', sub: 'HOST IS IN THE MENU', color: '#8e98af' });
  }
}

function returnToHub() {
  closeModals();
  if (game.active) game.exit();
  if (state.online.role === 'host') closeLink();
  document.body.classList.remove('playing');
  $('#hud').hidden = true;
  resetToMenuWorld();
  showScreen('hub');
  audio.setIntensity(0.2);
  buildModesSafe();
}

function restartRun() {
  closeModals();
  const mode = game.mode || state.mode;
  const ids = game.players.map(p => p.def.id);
  const squad = ids.length;
  const onlineHost = state.online.role === 'host' && state.online.started;
  const remoteInputs = onlineHost ? blankRemoteInputs() : null;
  if (game.active) game.exit();
  launchGame({ mode, squad, characterIds: ids, remoteInputs });
  if (onlineHost) netResume();
}

// ---------------- Help ----------------
function openHelp() { setModal($('#screen-help'), true); }
function closeHelp() {
  setModal($('#screen-help'), false);
  if (game.paused && !$('#screen-results').classList.contains('visible') && !$('#screen-upgrade').classList.contains('visible')) setModal($('#screen-pause'), true);
}

// ---------------- Bind UI ----------------
function bind() {
  $('#btn-enter').addEventListener('click', () => { audio.init(); audio.ui(true); openHub(); });
  $('#btn-help').addEventListener('click', () => { audio.init(); openHelp(); });
  $('#btn-help-title').addEventListener('click', () => { audio.init(); openHelp(); });
  $('#btn-hub-help').addEventListener('click', () => { audio.ui(true); openHelp(); });
  $('#btn-help-close').addEventListener('click', closeHelp);
  $('#btn-hub-title').addEventListener('click', () => { audio.ui(false); showMenuWorld(); showScreen('title'); refreshWallet(); });
  $('#btn-audio-title').addEventListener('click', () => {
    audio.init();
    audio.setEnabled(!audio.enabled);
    save.audio = audio.enabled;
    persistSave(save);
    $('#btn-audio-title').style.color = audio.enabled ? '' : '#555c6c';
    showToast(audio.enabled ? 'AUDIO ON' : 'AUDIO MUTED');
  });
  $('#btn-audio-title').style.color = audio.enabled ? '' : '#555c6c';

  $$('.nav-link').forEach(btn => btn.addEventListener('click', () => {
    audio.ui(true);
    const to = btn.dataset.hub;
    if (to === 'modes') { showScreen('hub'); buildModes(); }
    if (to === 'roster') openRoster();
    if (to === 'skills') openSkills();
    if (to === 'online') openOnline();
  }));
  $('#btn-roster-back').addEventListener('click', () => { audio.ui(false); showMenuWorld(); showScreen('hub'); });
  $('#btn-skills-back').addEventListener('click', () => { audio.ui(false); openRoster(); });
  $('#btn-launch').addEventListener('click', () => {
    const c = charById(state.selectedChar);
    if (!save.unlocked.includes(c.id)) tryUnlock(c.id);
    else launchGame();
  });
  $('#btn-launch-2').addEventListener('click', () => launchGame());
  $('#btn-skills').addEventListener('click', () => { audio.ui(true); openSkills(); });
  $('#btn-online').addEventListener('click', () => { audio.ui(true); openOnline(); });
  $('#btn-online-back').addEventListener('click', () => { audio.ui(false); closeLink(); openRoster(); });

  $$('.online-tab').forEach(tab => tab.addEventListener('click', () => {
    audio.ui(true);
    $$('.online-tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#online-host').hidden = tab.dataset.online !== 'host';
    $('#online-join').hidden = tab.dataset.online !== 'join';
  }));
  $('#btn-host-room').addEventListener('click', hostRoom);
  $('#btn-join-room').addEventListener('click', joinRoom);
  $('#join-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  $('#btn-online-start').addEventListener('click', startOnlineHost);

  $('#btn-resume').addEventListener('click', () => { game.resume(); setModal($('#screen-pause'), false); });
  $('#btn-pause-training').addEventListener('click', () => { audio.ui(true); openTrainingMenu(); });
  $('#btn-roster-training').addEventListener('click', () => { audio.ui(true); openTrainingMenu(); });
  $('#btn-training-close').addEventListener('click', () => { audio.ui(false); closeTrainingMenu(); });
  $('#btn-unlock-ok').addEventListener('click', () => { audio.ui(true); setModal($('#screen-unlock'), false); });
  $('#btn-training-reset').addEventListener('click', () => { audio.ui(true); game.resetTrainingDummies(); });
  $('#btn-pause-controls').addEventListener('click', openHelp);
  $('#btn-pause-restart').addEventListener('click', restartRun);
  $('#btn-pause-quit').addEventListener('click', returnToHub);

  $('#btn-results-next').addEventListener('click', () => {
    if (!state.result?.stageComplete) return;
    setModal($('#screen-results'), false);
    game.nextStage();
    state.result = null;
    netResume();
    audio.setIntensity(0.4);
  });
  $('#btn-results-again').addEventListener('click', () => {
    setModal($('#screen-results'), false);
    restartRun();
  });
  $('#btn-results-menu').addEventListener('click', () => {
    if (state.guest) { leaveGuest(); return; }
    setModal($('#screen-results'), false);
    returnToHub();
  });

  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') { goBack(); return; }
    if (e.code === 'KeyT' && !e.repeat && !$('#screen-training').classList.contains('visible')) {
      if (game.active && game.mode === 'training') { audio.ui(true); openTrainingMenu(); }
      else if (state.screen === 'roster' && state.mode === 'training') { audio.ui(true); openTrainingMenu(); }
    }
  });
  window.addEventListener('pointerdown', clearPadFocus);
  window.addEventListener('gamepadconnected', e => {
    game.input.update();
    const info = game.input.padInfo(0) || controllerInfo(e.gamepad.id);
    updatePadHelp(info);
    updateControlHints(true);
    showToast(`${info.label} LINKED // P${(game.input.padInfo(0)?.slot ?? 0) + 1}`);
  });
  window.addEventListener('gamepaddisconnected', () => {
    setTimeout(() => {
      game.input.update();
      updatePadHelp(game.input.padInfo(0));
      updateControlHints(true);
    });
    showToast('GAMEPAD DISCONNECTED', true);
  });
  window.addEventListener('beforeunload', () => { persistSave(save); if (state.online.peer) try { state.online.peer.destroy(); } catch {} });
}

// ---------------- Main loop ----------------
const guestInput = new InputManager();
let last = performance.now();
let guestSendAccum = 0;

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (state.guest) {
    if (state.online.started && state.online.guestConn?.open) {
      guestInput.update();
      const inp = guestInput.get(0);
      guestSendAccum += dt;
      if (guestSendAccum > 0.016) {
        guestSendAccum = 0;
        try {
          state.online.guestConn.send({
            type: 'input', input: {
              left: !!inp.left, right: !!inp.right, up: !!inp.up, down: !!inp.down,
              light: !!inp.light, heavy: !!inp.heavy, launch: !!inp.launch, dodge: !!inp.dodge,
              jump: !!inp.jump, special: !!inp.special, taunt: !!inp.taunt,
            },
          });
        } catch {}
        guestInput.endFrame();
      }
    }
    world.render();
  } else {
    game.input.update();
    const menu = game.input.readMenu();
    const playing = game.active && document.body.classList.contains('playing');
    if (playing) {
      if (!game.paused) {
        if (menu.start) {
          requestPause();
          game.input.endFrame();
        } else {
          game.update(dt);
          if (state.online.role === 'host' && game.remoteInputs) {
            for (const k in game.remoteInputs) {
              const ri = game.remoteInputs[k];
              if (!ri) continue;
              ri.light = false; ri.heavy = false; ri.launch = false; ri.dodge = false; ri.jump = false; ri.special = false; ri.taunt = false;
            }
          }
        }
      } else {
        handlePadMenu(menu);
        game.input.endFrame();
      }
      world.render();
    } else {
      handlePadMenu(menu);
      game.input.endFrame();
      if (game.active && document.body.classList.contains('playing')) {
        world.render();
      } else {
        world.update(dt);
        world.updateCamera(dt, 0, 0);
        world.render();
      }
    }
    updateControlHints();
  }
  requestAnimationFrame(loop);
}

// ---------------- Boot ----------------
function boot() {
  wireCallbacks();
  bind();
  fillSquadChars();
  buildRoster();
  updateFighterPanel();
  buildSquad();
  refreshWallet();
  resetToMenuWorld();
  showScreen('title');
  game.input.update();
  updatePadHelp(game.input.padInfo(0));
  updateControlHints(true);
  showAnnounce('', '', '', '#fff');
  setTimeout(() => $('#boot').classList.add('done'), 900);
  requestAnimationFrame(loop);
  if (save.lastScreen === 'hub') { /* always title on boot */ }
}

boot();
