export const RANKS = [
  { name: 'D', min: 0, color: '#7c8798', mult: 1 },
  { name: 'C', min: 30, color: '#4fd1c5', mult: 1.1 },
  { name: 'B', min: 75, color: '#63b3ed', mult: 1.22 },
  { name: 'A', min: 140, color: '#f6c453', mult: 1.38 },
  { name: 'S', min: 235, color: '#ff8a3d', mult: 1.6 },
  { name: 'SS', min: 360, color: '#ff4d6d', mult: 1.9 },
  { name: 'SSS', min: 520, color: '#ffd166', mult: 2.3 },
];

export const CHARACTERS = [
  {
    id: 'rook', name: 'ROOK', title: 'THE LAST BRUISER', role: 'BALANCED BRAWLER',
    weapon: 'gauntlets', comboName: 'CONCRETE LITANY', ultimate: 'SEISMIC VERDICT',
    power: 7, speed: 6, range: 4, tech: 5, unlock: 0,
    colors: { suit: 0x202638, accent: 0xff3d74, skin: 0xb97856, hair: 0x171419, energy: 0xff3d74 },
    desc: 'An ex-enforcer who traded a badge for a pair of loaded knuckles. Hits like a wrecking ball and never breaks rhythm.',
    style: 'Close-range power, armored heavy attacks, and ground-shaking finishers.',
    kit: { heavy: 'shockwave', passive: 'poise' },
    perk: { shockMult: 1.4 },
    unlockPerk: { name: 'SEISMIC FIST', desc: 'Ground shockwaves hit 40% harder.' },
    signatureSkill: 'might',
  },
  {
    id: 'vex', name: 'VEX', title: 'CHROME SAMURAI', role: 'YAMATO DUELIST',
    weapon: 'yamato', actions: { launch: 'weave' }, specialMove: 'judgmentcut',
    comboName: 'ZERO DISTANCE', ultimate: 'JUDGMENT CUT', tauntName: 'MILLIONAIRE VIBES',
    power: 7, speed: 9, range: 7, tech: 9, unlock: 0,
    colors: { suit: 0x181b2f, accent: 0x56e1ff, skin: 0xd7a785, hair: 0xe8eef5, energy: 0x56e1ff },
    desc: 'A blade-for-hire who answers to nobody. Yamato in hand, a crimson wave on the wind, and a coat that never stops moving. He does not fight to win. He fights to be admired on the way out.',
    style: 'A four-cut Yamato string, the Crimson Weave thrown across the street, and a Blink that ends the argument before it starts.',
    kit: { light3: 'blink', passive: 'reach' },
    perk: { blinkMult: 1.5, weavePierce: 1 },
    unlockPerk: { name: 'YAMATO', desc: 'Blink slashes hit 50% harder and the Crimson Weave cuts 30% deeper.' },
    signatureSkill: 'swift',
  },
  {
    id: 'sable', name: 'SABLE', title: 'NEON VALKIRIE', role: 'STYLE DEMON',
    weapon: 'neonedge', gun: 'neonrevolver', actions: { heavy: 'shot', launch: 'rev' },
    specialMove: 'judgment', rev: true,
    kit: { passive: 'revPierce' },
    perk: { revTime: 1.5 },
    unlockPerk: { name: 'DEVIL TRIGGER', desc: 'The rev lasts 50% longer.' },
    signatureSkill: 'aerial',
    comboName: 'RED QUEEN', ultimate: 'JUDGMENT',
    power: 7, speed: 9, range: 7, tech: 9, unlock: 0,
    colors: { suit: 0x2a1533, accent: 0xff55d1, skin: 0x8f5a46, hair: 0x2b1a2e, energy: 0xff55d1 },
    desc: 'A rooftop courier who carries a neon katana in one hand and a six-shot revolver in the other. She fights the way a devil does: cut, shoot, cancel, and never give the enemy the ground.',
    style: 'Sword-and-gun strings that never break, Devil-Trigger revs, and jump cancels that keep the combo in the air.',
  },
  {
    id: 'jett', name: 'JETT', title: 'STATIC COWBOY', role: 'GUNSLINGER BRAWLER',
    weapon: 'deserteagle', actions: { launch: 'shot' }, specialMove: 'bullets',
    comboName: 'DEAD AIR', ultimate: 'BULLET STORM',
    power: 7, speed: 8, range: 8, tech: 6, unlock: 0,
    colors: { suit: 0x1d2a25, accent: 0xffc247, skin: 0x6e4634, hair: 0x161a18, energy: 0xffc247 },
    desc: 'A bootleg signal-runner with a stolen Desert Eagle. He fights the way Adam does — kicks that crack ribs and launch bodies into the air — and he never has to put the gun away to keep them there.',
    style: 'Leg-first brawling with rising kicks that juggle, backed by a .50 caliber that ends the conversation from across the street.',
    kit: { cancelInto: 'shot' },
    perk: { juggleMult: 1.3 },
    unlockPerk: { name: 'DEAD AIR', desc: 'Juggle launches send enemies 30% higher.' },
    signatureSkill: 'swift',
  },
  {
    id: 'nyx', name: 'NYX', title: 'GRAVEYARD SHIFT', role: 'REAPER',
    weapon: 'scythe', comboName: 'LAST RITES', ultimate: 'DEAD HOUR',
    power: 9, speed: 6, range: 8, tech: 6, unlock: 1200,
    colors: { suit: 0x14151f, accent: 0x9cff57, skin: 0x9a6b55, hair: 0x0d0e14, energy: 0x9cff57 },
    desc: 'Death took a holiday. Nyx picked up the scythe and put in overtime.',
    style: 'Huge reach, health drain, and slow, terrifying sweeps.',
    kit: { light3: 'harvest', passive: 'drain' },
    perk: { drain: 0.12 },
    unlockPerk: { name: 'LAST RITES', desc: 'Harvests drain 12% of all damage as life.' },
    signatureSkill: 'vitality',
  },
  {
    id: 'grimm', name: 'GRIMM', title: 'IRON MONK', role: 'UNSTOPPABLE TITAN',
    weapon: 'hammer', comboName: 'BELLTOWER', ultimate: 'WORLD END',
    power: 10, speed: 4, range: 5, tech: 4, unlock: 1800,
    colors: { suit: 0x30251b, accent: 0xff7a35, skin: 0x7b4a31, hair: 0x16110d, energy: 0xff7a35 },
    desc: 'A decommissioned war-priest who believes every problem is a nail. The hammer is not a metaphor.',
    style: 'Armored juggernaut with crushing staggers and launch-resistant posture.',
    kit: { heavy: 'slam', passive: 'superArmor' },
    perk: { armor: 0.75 },
    unlockPerk: { name: 'BELLTOWER', desc: 'Ignores 75% of incoming knockback.' },
    signatureSkill: 'might',
  },
  {
    id: 'kira', name: 'KIRA', title: 'GHOST PROTOCOL', role: 'SHADOW ASSASSIN',
    weapon: 'daggers', comboName: 'WHITE NOISE', ultimate: 'ZERO HOUR',
    power: 5, speed: 10, range: 3, tech: 9, unlock: 2600,
    colors: { suit: 0x191c25, accent: 0xf7f7ff, skin: 0xc58f6c, hair: 0x1a1a22, energy: 0x8feaff },
    desc: 'A surveillance ghost who weaponized her own missing person report. You will not hear the second knife.',
    style: 'Blistering speed, afterimages, and back-to-back air combos.',
    kit: { light3: 'assassinate', passive: 'crit' },
    perk: { critMult: 1.5 },
    unlockPerk: { name: 'WHITE NOISE', desc: 'Backstabs crit for 50% more damage.' },
    signatureSkill: 'swift',
  },
  {
    id: 'ash', name: 'ASH', title: 'PYRE SAINT', role: 'BURNING FIST',
    weapon: 'fists', comboName: 'PROMETHEUS', ultimate: 'SOLAR FLARE',
    power: 8, speed: 7, range: 4, tech: 7, unlock: 3600,
    colors: { suit: 0x2b1712, accent: 0xff6a1a, skin: 0x8f5944, hair: 0x1b1210, energy: 0xff6a1a },
    desc: 'A reactor cultist who walked out of the meltdown. The fire followed him home.',
    style: 'Pyrotechnic brawling, burn damage, and explosive finishers.',
    kit: { passive: 'burn' },
    perk: { burnMult: 1.5 },
    unlockPerk: { name: 'PROMETHEUS', desc: 'Burn ticks for 50% more damage.' },
    signatureSkill: 'overdrive',
  },
  {
    id: 'volt', name: 'VOLT', title: 'LIVE WIRE', role: 'STORM CALLER',
    weapon: 'staff', comboName: 'BLACKOUT', ultimate: 'GRID COLLAPSE',
    power: 6, speed: 7, range: 8, tech: 10, unlock: 5000,
    colors: { suit: 0x172033, accent: 0x72a6ff, skin: 0x6d4a3a, hair: 0xd6e6ff, energy: 0x72a6ff },
    desc: 'The city\'s power grid started talking back. Volt answered with a polearm and a smile.',
    style: 'Long-range arcs, chain lightning, and devastating area control.',
    kit: { passive: 'chain' },
    perk: { chainExtra: 1 },
    unlockPerk: { name: 'GRID COLLAPSE', desc: 'Lightning chains to one extra target.' },
    signatureSkill: 'overdrive',
  },
  {
    id: 'mara', name: 'MARA', title: 'CROWN OF ASHES', role: 'DEMON QUEEN',
    weapon: 'demonblade', comboName: 'REGICIDE', ultimate: 'THRONE OF RUIN',
    power: 9, speed: 8, range: 7, tech: 9, unlock: 7500,
    colors: { suit: 0x200d18, accent: 0xff224f, skin: 0xe0a583, hair: 0x1b0910, energy: 0xff224f },
    desc: 'The syndicate\'s first experiment and final mistake. She wears the crown they forged for her.',
    style: 'A complete predator: demonic reach, lifesteal, and screen-clearing power.',
    kit: { passive: 'drain' },
    perk: { drain: 0.1 },
    unlockPerk: { name: 'REGICIDE', desc: 'Steals 10% of all damage as life.' },
    signatureSkill: 'might',
  },
];

export const WEAPON_PROFILES = {
  gauntlets: { family: 'blunt', reach: 2.15, width: 1.35 },
  fists: { family: 'blunt', reach: 2.1, width: 1.4 },
  tonfas: { family: 'tonfa', reach: 2.25, width: 1.55 },
  daggers: { family: 'dagger', reach: 2.2, width: 1.3 },
  katana: { family: 'blade', reach: 3.0, width: 1.55 },
  yamato: {
    family: 'blade', reach: 3.45, width: 1.6,
    juggle: { stages: [0, 0, 5.4, 0], heavy: 0, sustain: 3.6 },
  },
  demonblade: { family: 'blade', reach: 3.15, width: 1.7 },
  glaive: { family: 'pole', reach: 3.55, width: 2.0 },
  neonedge: {
    family: 'blade', reach: 3.05, width: 1.5,
    juggle: { stages: [0, 0, 5.2, 6.0], heavy: 0, sustain: 3.2 },
  },
  neonrevolver: {
    family: 'gun', reach: 1.9, width: 1.2,
    gun: { damage: 19, speed: 52, range: 40, cooldown: 0.16, spread: 0.015 },
  },
  scythe: { family: 'pole', reach: 3.65, width: 2.15 },
  staff: { family: 'pole', reach: 3.45, width: 1.9 },
  hammer: { family: 'hammer', reach: 3.05, width: 2.05 },
  deserteagle: {
    family: 'gun', reach: 2.05, width: 1.3,
    gun: { damage: 27, speed: 46, range: 36, cooldown: 0.5, spread: 0.02 },
    juggle: { stages: [0, 0, 5.6, 6.4], heavy: 6.0, sustain: 3.4 },
  },
  default: { family: 'blunt', reach: 1.85, width: 1.2 },
};

export const SKILLS = [
  { id: 'vitality', name: 'IRON BODY', desc: '+30 maximum vitality.', cost: 300, icon: '♥' },
  { id: 'might', name: 'EDGE MASTER', desc: '+12% damage from all attacks.', cost: 450, icon: '✦' },
  { id: 'swift', name: 'WIND STEP', desc: '+10% movement speed.', cost: 350, icon: '»' },
  { id: 'artist', name: 'SHOWMAN', desc: '+25% style gain. Ranks decay slower.', cost: 500, icon: 'S' },
  { id: 'aerial', name: 'JUGGLE KING', desc: '+1 air jump and stronger launchers.', cost: 700, icon: '↑' },
  { id: 'overdrive', name: 'OVERDRIVE', desc: 'Special meter charges 35% faster.', cost: 900, icon: '⚡' },
];

export const UPGRADES = [
  { id: 'bloodlust', name: 'BLOODLUST', desc: '+18% damage.', color: '#ff3d74', apply: p => { p.damageMult *= 1.18; } },
  { id: 'iron', name: 'IRON SKIN', desc: '+35 max vitality and heal 35.', color: '#63b3ed', apply: p => { p.maxHp += 35; p.hp = Math.min(p.maxHp, p.hp + 35); } },
  { id: 'quick', name: 'QUICKSTEP', desc: '+14% movement speed.', color: '#4fd1c5', apply: p => { p.speedMult *= 1.14; } },
  { id: 'showoff', name: 'STYLE FIEND', desc: '+35% style gain.', color: '#ffd166', apply: p => { p.styleMult *= 1.35; } },
  { id: 'vampire', name: 'RED HUNGER', desc: 'Heal 4 vitality on each kill.', color: '#9cff57', apply: p => { p.lifesteal += 4; } },
  { id: 'executioner', name: 'EXECUTIONER', desc: '+30% damage to staggered foes.', color: '#ff7a35', apply: p => { p.executeMult += 0.3; } },
  { id: 'battery', name: 'SOUL BATTERY', desc: 'Start each wave with 40% special.', color: '#72a6ff', apply: p => { p.waveSpecial += 0.4; } },
  { id: 'glass', name: 'GLASS CANNON', desc: '+40% damage, -20% max vitality.', color: '#ff224f', apply: p => { p.damageMult *= 1.4; p.maxHp = Math.max(50, Math.round(p.maxHp * 0.8)); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: 'juggernaut', name: 'JUGGERNAUT', desc: 'Take 25% less damage.', color: '#c7a17a', apply: p => { p.defense += 0.25; } },
  { id: 'chain', name: 'CHAIN REACTION', desc: 'Kills release a damaging shockwave.', color: '#ff55d1', apply: p => { p.chainKill = true; } },
  { id: 'overclock', name: 'OVERCLOCK', desc: 'Special gains +25% and hits harder.', color: '#56e1ff', apply: p => { p.specialMult *= 1.25; p.specialDamage *= 1.3; } },
  { id: 'bloodpact', name: 'BLOOD PACT', desc: '+25% style rank damage. Heal 10 on boss kill.', color: '#ff8a3d', apply: p => { p.rankDamage += 0.25; p.bossHeal += 10; } },
];

export const ENEMY_TYPES = {
  thug: { name: 'STATIC RUNNER', hp: 55, speed: 3.2, damage: 7, range: 1.5, reward: 8, scale: 1, color: 0x49304a, accent: 0xff3d74 },
  brute: { name: 'CURB BREAKER', hp: 120, speed: 2.2, damage: 13, range: 1.9, reward: 16, scale: 1.25, color: 0x3e2b23, accent: 0xff7a35 },
  gunner: { name: 'WIRE SNIPER', hp: 65, speed: 2.7, damage: 9, range: 11, reward: 14, scale: 0.95, color: 0x283a4c, accent: 0x56e1ff, ranged: true },
  ninja: { name: 'GLASS SAINT', hp: 75, speed: 4.3, damage: 10, range: 1.8, reward: 15, scale: 0.98, color: 0x2a1b2e, accent: 0x9cff57, teleport: true },
};

export const BOSSES = [
  {
    id: 'brutus', name: 'BRUTUS', title: 'THE CURB', type: 'brute',
    hp: 720, speed: 2.5, damage: 18, color: 0x5a3021, accent: 0xff7a35,
    desc: 'A freight elevator with a grudge.', moves: ['slam', 'charge', 'shockwave'],
  },
  {
    id: 'conductor', name: 'THE CONDUCTOR', title: 'GHOST LINE', type: 'gunner',
    hp: 820, speed: 3.2, damage: 16, color: 0x1c3344, accent: 0x56e1ff,
    desc: 'He runs the last train. Nobody buys a return ticket.', moves: ['barrage', 'rail', 'summon'],
  },
  {
    id: 'seraph', name: 'SERAPH', title: 'SKYLINE CATHEDRAL', type: 'ninja',
    hp: 980, speed: 4.2, damage: 19, color: 0x39233f, accent: 0xff55d1,
    desc: 'A corporate angel with a blade for every prayer.', moves: ['blink', 'cross', 'halo'],
  },
  {
    id: 'wraith', name: 'WRAITH', title: 'EMPTY FREQUENCY', type: 'ninja',
    hp: 1120, speed: 4.8, damage: 21, color: 0x1a2420, accent: 0x9cff57,
    desc: 'The signal that remains after a person is deleted.', moves: ['blink', 'cross', 'summon'],
  },
  {
    id: 'mara', name: 'MARA', title: 'CROWN OF ASHES', type: 'brute',
    hp: 1500, speed: 3.4, damage: 25, color: 0x310f1c, accent: 0xff224f,
    desc: 'The queen beneath the city. End the bloodline.', moves: ['slam', 'charge', 'halo', 'barrage'],
  },
];

export const STAGES = [
  {
    id: 'neon-mile', name: 'NEON MILE', district: 'DOWNTOWN // SECTOR 07', theme: 'downtown',
    desc: 'The syndicate owns every light on this street. Turn them off.',
    waves: [
      { enemies: [['thug', 3]] },
      { enemies: [['thug', 3], ['gunner', 1]] },
      { enemies: [['brute', 1], ['thug', 3], ['gunner', 1]] },
    ],
    boss: 'brutus',
  },
  {
    id: 'ghost-line', name: 'GHOST LINE', district: 'TRANSIT // BELOW ZERO', theme: 'subway',
    desc: 'A dead train keeps running. Find out who is driving.',
    waves: [
      { enemies: [['ninja', 2], ['thug', 2]] },
      { enemies: [['gunner', 2], ['ninja', 2], ['thug', 2]] },
      { enemies: [['brute', 2], ['ninja', 2], ['gunner', 1]] },
    ],
    boss: 'conductor',
  },
  {
    id: 'skyline', name: 'SKYLINE CATHEDRAL', district: 'APEX // PRIVATE AIR', theme: 'rooftop',
    desc: 'At the top of the food chain, the only law is gravity.',
    waves: [
      { enemies: [['ninja', 3], ['gunner', 2]] },
      { enemies: [['brute', 2], ['gunner', 2], ['ninja', 2]] },
      { enemies: [['brute', 3], ['ninja', 3], ['gunner', 2]] },
    ],
    boss: 'seraph',
  },
];

export const MODES = [
  {
    id: 'campaign', name: 'STORY', tag: 'CITY OF SINS', icon: 'I',
    desc: 'Three districts. One night. Cut a path through the syndicate and face the crown.',
    detail: '3 STAGES • BOSSES • FULL PROGRESSION', tone: 'pink',
  },
  {
    id: 'survival', name: 'SURVIVAL', tag: 'ROGUELIKE', icon: 'II',
    desc: 'Endless waves, escalating elites, and a new build every two rounds. How deep can you go?',
    detail: 'ENDLESS • UPGRADES • LEADERBOARD', tone: 'cyan',
  },
  {
    id: 'bossrush', name: 'BOSS RUSH', tag: 'THE GAUNTLET', icon: 'III',
    desc: 'Five killers. No mobs. One health bar. Prove you are the apex of the city.',
    detail: '5 BOSSES • HEAL BETWEEN • RANKED', tone: 'gold',
  },
  {
    id: 'rampage', name: 'RAMPAGE', tag: 'SCORE ATTACK', icon: 'IV',
    desc: 'Ten hyper-lethal waves. No upgrades. Style is the only armor you get.',
    detail: '10 WAVES • SCORE • NO MERCY', tone: 'orange',
  },
  {
    id: 'training', name: 'TRAINING', tag: 'THE LAB', icon: 'V',
    desc: 'Unkillable dummies, infinite special, and all the time in the world to learn your links.',
    detail: 'SANDBOX • FRAME DATA • NO FAIL', tone: 'green',
  },
];

export const ACHIEVEMENTS = [
  { id: 'first-blood', name: 'FIRST BLOOD', desc: 'Win your first fight.', test: s => s.kills >= 1 },
  { id: 'style-100', name: 'SHOWSTOPPER', desc: 'Reach a 100 hit combo.', test: s => s.bestCombo >= 100 },
  { id: 'rank-sss', name: 'PRIME PERFORMER', desc: 'Reach SSS rank.', test: s => s.reachedSSS },
  { id: 'boss-one', name: 'CURB STOMP', desc: 'Defeat a boss.', test: s => s.bossKills >= 1 },
  { id: 'wave-10', name: 'DEEP END', desc: 'Survive 10 waves.', test: s => s.waves >= 10 },
];

export const DEFAULT_SAVE = {
  version: 1,
  shards: 500,
  unlocked: ['rook', 'vex', 'sable', 'jett'],
  skills: {},
  best: { survival: 0, rampage: 0, bossrush: 0 },
  achievements: [],
  audio: true,
  squad: 1,
  totalKills: 0,
  totalBosses: 0,
  bestCombo: 0,
  reachedSSS: false,
  tutorialSeen: false,
};

export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem('street-requiem-save-v1'));
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return { ...structuredClone(DEFAULT_SAVE), ...raw, best: { ...DEFAULT_SAVE.best, ...(raw.best || {}) } };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function persistSave(save) {
  try { localStorage.setItem('street-requiem-save-v1', JSON.stringify(save)); } catch {}
}
