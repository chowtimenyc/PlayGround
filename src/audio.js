export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.started = false;
    this.step = 0;
    this.nextNote = 0;
    this.timer = null;
    this.intensity = 0;
    this.tempo = 112;
    this.noise = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.62 : 0;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.68;
    this.sfxGain.connect(this.master);
    this.noise = this.makeNoise(1.5);
    this.startMusic();
    this.started = true;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.62 : 0, this.ctx.currentTime, 0.05);
  }

  makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  tone({ freq = 220, type = 'sine', dur = 0.15, gain = 0.15, slide = 0, delay = 0, filter = 0, q = 1, dest = null }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      f.Q.value = q;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseHit({ dur = 0.08, gain = 0.12, hp = 600, lp = 6000, delay = 0 }) {
    if (!this.ctx || !this.enabled || !this.noise) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(hp, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, lp), t + dur);
    f.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  hit(power = 1) {
    this.noiseHit({ dur: 0.06 + 0.05 * power, gain: 0.08 + 0.05 * power, hp: 900, lp: 160 });
    this.tone({ freq: 110 + Math.random() * 50, type: 'triangle', dur: 0.1 + power * 0.04, gain: 0.1 + power * 0.04, slide: -60 });
  }

  heavy() {
    this.noiseHit({ dur: 0.18, gain: 0.18, hp: 700, lp: 90 });
    this.tone({ freq: 72, type: 'sine', dur: 0.28, gain: 0.3, slide: -35 });
  }

  slash() {
    this.noiseHit({ dur: 0.1, gain: 0.09, hp: 4500, lp: 900 });
  }

  gunshot() {
    this.noiseHit({ dur: 0.16, gain: 0.17, hp: 200, lp: 240 });
    this.tone({ freq: 180, type: 'square', dur: 0.14, gain: 0.1, slide: -140, filter: 1100 });
    this.tone({ freq: 58, type: 'sine', dur: 0.24, gain: 0.19, slide: -22 });
  }

  revUp() {
    this.tone({ freq: 90, type: 'sawtooth', dur: 0.7, gain: 0.12, slide: 620, filter: 2400 });
    this.tone({ freq: 180, type: 'square', dur: 0.5, gain: 0.06, slide: 420, filter: 3200 });
    this.noiseHit({ dur: 0.5, gain: 0.07, hp: 200, lp: 1800 });
  }

  dodge() {
    this.noiseHit({ dur: 0.2, gain: 0.08, hp: 2500, lp: 500 });
    this.tone({ freq: 320, type: 'sine', dur: 0.12, gain: 0.05, slide: 240 });
  }

  jump() {
    this.tone({ freq: 190, type: 'sine', dur: 0.14, gain: 0.07, slide: 220 });
  }

  launch() {
    this.tone({ freq: 140, type: 'sawtooth', dur: 0.2, gain: 0.07, slide: 300, filter: 900 });
    this.noiseHit({ dur: 0.16, gain: 0.08, hp: 1200, lp: 300 });
  }

  special() {
    if (!this.ctx) return;
    [0, 0.05, 0.1].forEach((d, i) => this.tone({ freq: 90 + i * 45, type: 'sawtooth', dur: 0.55, gain: 0.09, slide: 420, delay: d, filter: 1800 }));
    this.noiseHit({ dur: 0.5, gain: 0.12, hp: 3000, lp: 100 });
  }

  hurt() {
    this.tone({ freq: 170, type: 'square', dur: 0.17, gain: 0.1, slide: -100, filter: 800 });
  }

  kill() {
    this.noiseHit({ dur: 0.26, gain: 0.13, hp: 800, lp: 80 });
    this.tone({ freq: 90, type: 'triangle', dur: 0.24, gain: 0.12, slide: -45 });
  }

  rank(rank) {
    const base = 440 + rank * 55;
    [0, 0.06, 0.12].forEach((d, i) => this.tone({ freq: base * (1 + i * 0.25), type: 'triangle', dur: 0.32, gain: 0.055, delay: d }));
  }

  ui(up = true) {
    this.tone({ freq: up ? 540 : 360, type: 'sine', dur: 0.07, gain: 0.045, slide: up ? 90 : -60 });
  }

  unlock() {
    [0, 0.1, 0.2, 0.32].forEach((d, i) => this.tone({ freq: 330 * Math.pow(1.26, i), type: 'triangle', dur: 0.6, gain: 0.07, delay: d }));
  }

  boss() {
    this.tone({ freq: 55, type: 'sawtooth', dur: 1.4, gain: 0.2, slide: -20, filter: 260 });
    this.noiseHit({ dur: 1.1, gain: 0.12, hp: 180, lp: 50 });
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 45);
  }

  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
  }

  setIntensity(n) {
    this.intensity = Math.max(0, Math.min(1, n));
    this.tempo = 108 + this.intensity * 20;
  }

  schedule() {
    if (!this.ctx || !this.enabled) return;
    const spb = 60 / this.tempo / 4;
    while (this.nextNote < this.ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextNote);
      this.nextNote += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t) {
    const dest = this.musicGain;
    const bar = Math.floor(step / 16);
    const root = [55, 55, 65.4, 49][bar];
    const chord = [[0, 3, 7], [0, 3, 10], [0, 4, 7], [0, 3, 7]][bar];
    const scheduleTone = (freq, type, dur, gain, slide = 0, filter = 0) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let n = osc;
      if (filter) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = filter;
        n.connect(f);
        n = f;
      }
      n.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };
    if (step % 4 === 0) {
      scheduleTone(46, 'sine', 0.22, 0.5, -18);
      this.noiseHit({ dur: 0.04, gain: 0.05, hp: 5000, lp: 3000 });
    }
    if (step % 8 === 4) this.noiseHit({ dur: 0.1, gain: 0.06, hp: 1300, lp: 500 });
    if (step % 2 === 0) this.noiseHit({ dur: 0.025, gain: 0.015 + this.intensity * 0.012, hp: 9000, lp: 6000 });
    if (step % 8 === 0) {
      const lead = chord[bar % 3] || 0;
      scheduleTone(root * 2, 'sawtooth', 0.5, 0.08, 0, 520);
    }
    if (step % 16 === 0 || step % 16 === 7 || step % 16 === 10) {
      scheduleTone(root, 'sawtooth', 0.7, 0.045, 0, 320);
    }
    if (this.intensity > 0.25 && step % 4 === 2) {
      const arp = [0, 7, 12, 10, 7, 3][step % 6];
      scheduleTone(root * 4 * Math.pow(2, arp / 12), 'triangle', 0.14, 0.02, 0, 2600);
    }
    if (this.intensity > 0.65 && step % 2 === 0) {
      this.noiseHit({ dur: 0.06, gain: 0.022, hp: 2000, lp: 700 });
    }
  }
}
