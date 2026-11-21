// Sound, synthesized live with WebAudio: no audio files, no network.
// Footsteps pan and fade with distance, so you can hear a warden coming
// before you see the cone. Everything here is optional and guarded: the
// game plays fine with sound off or on a browser without audio.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastStepAt = 0;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** A soft footstep tick. `pan` -1..1, `loud` 0..1 by distance. */
  footstep(pan, loud) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this.lastStepAt < 90) return;
    this.lastStepAt = now;
    const t0 = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, 2205, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.25 * loud;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(filter);
    filter.connect(g);
    g.connect(panner);
    panner.connect(this.master);
    src.start(t0);
  }

  spotted() {
    this.tone(392, 0.16, 'square', 0.10);
    this.tone(523, 0.22, 'square', 0.10, 0.12);
  }

  alarm() {
    this.tone(220, 0.5, 'sawtooth', 0.12, 0, 440);
    this.tone(440, 0.5, 'sawtooth', 0.08, 0.1, 220);
  }

  relic() {
    this.tone(880, 0.12, 'sine', 0.12);
    this.tone(1318, 0.2, 'sine', 0.10, 0.09);
  }

  lure() {
    this.tone(1200, 0.07, 'sine', 0.10, 0, 700);
  }

  caught() {
    this.tone(196, 0.4, 'sawtooth', 0.14, 0, 98);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.11, i * 0.11));
  }
}
