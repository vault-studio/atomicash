// Audio procedural con WebAudio (F2-09): efectos sintetizados y música generativa, sin archivos.
// DECISIÓN: sin dependencias ni samples; todo se genera con osciladores y ruido, así es 100 % original
// y funciona sin red. Volúmenes de música y efectos separados; silencio cuando la pestaña pierde el foco.
import type { SfxId } from '../engine/sfx';
import { AUDIO, type MusicMood } from '../config/audio';

type Ctx = AudioContext;

class AudioEngine {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private fx!: GainNode;
  private noise!: AudioBuffer;
  private musicVol: number = AUDIO.defaultMusic;
  private sfxVol: number = AUDIO.defaultSfx;
  private mood: MusicMood | null = null;
  private nextNote = 0;
  private step = 0;
  private timer: number | null = null;
  private readonly lastPlay = new Map<string, number>();
  private focused = true;
  private chain = 0;
  private lastPickup = -1;

  /** Crea el contexto en el primer gesto del usuario (los navegadores lo exigen). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.focused) void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.fx = ctx.createGain();
    this.music.connect(this.master);
    this.fx.connect(this.master);
    this.applyVolumes();
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (this.mood) this.startScheduler();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * AUDIO.musicGain, t, 0.05);
    this.fx.gain.setTargetAtTime(this.sfxVol * AUDIO.sfxGain, t, 0.02);
  }

  /** Silencio al perder el foco (04_ART_UI.md §4). */
  setFocused(f: boolean): void {
    this.focused = f;
    if (!this.ctx) return;
    if (f) void this.ctx.resume();
    else void this.ctx.suspend();
  }

  // ---------- efectos ----------

  play(id: SfxId | 'level' | 'select' | 'death' | 'win' | 'geiger' | 'chest', intensity = 1): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.sfxVol <= 0) return;
    const now = ctx.currentTime;
    const gap = AUDIO.minGap[id] ?? 0.03;
    if (now - (this.lastPlay.get(id) ?? -1) < gap) return;
    this.lastPlay.set(id, now);
    const v = Math.min(1, intensity);
    switch (id) {
      case 'shot':
        this.blip(now, 'square', 880, 440, 0.05, 0.12 * v);
        break;
      case 'hit':
        this.burst(now, 0.03, 2400, 0.1 * v);
        break;
      case 'kill':
        this.blip(now, 'triangle', 300, 90, 0.08, 0.18 * v);
        this.burst(now, 0.06, 900, 0.12 * v);
        break;
      case 'pickup': {
        // Cadena de recogidas: cada una medio tono más aguda (hasta dos octavas) si llega seguida de la anterior.
        this.chain =
          now - this.lastPickup < AUDIO.pickupChain.gap ? Math.min(AUDIO.pickupChain.max, this.chain + 1) : 0;
        this.lastPickup = now;
        const f = AUDIO.pickupChain.base * Math.pow(2, this.chain / 12);
        this.blip(now, 'sine', f, f * 1.5, 0.06, 0.1);
        break;
      }
      case 'hurt':
        this.blip(now, 'sawtooth', 220, 80, 0.18, 0.25);
        break;
      case 'boom':
        this.burst(now, 0.35, 400, 0.35 * v);
        this.blip(now, 'sine', 90, 35, 0.3, 0.35 * v);
        break;
      case 'zap':
        this.blip(now, 'sawtooth', 1600, 300, 0.08, 0.1 * v);
        break;
      case 'boss':
        for (let i = 0; i < 3; i++) this.blip(now + i * 0.22, 'square', 110, 104, 0.2, 0.25);
        break;
      case 'dodge':
        this.blip(now, 'sine', 600, 1400, 0.08, 0.12);
        break;
      case 'level':
        [523, 659, 784, 1046].forEach((f, i) => this.blip(now + i * 0.07, 'square', f, f, 0.1, 0.14));
        break;
      case 'chest':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.blip(now + i * 0.06, 'triangle', f, f, 0.12, 0.16));
        break;
      case 'select':
        this.blip(now, 'square', 1400, 1400, 0.03, 0.08);
        break;
      case 'geiger':
        this.burst(now, 0.008, 4000, 0.18);
        break;
      case 'death':
        this.blip(now, 'sawtooth', 300, 40, 1.2, 0.3);
        break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
          this.blip(now + i * 0.15, 'square', f, f, 0.2, 0.16),
        );
        break;
    }
  }

  private blip(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, cutoff: number, vol: number, out: AudioNode = this.fx): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---------- música ----------

  /** Menús: swing de bajo y acordes; run: arpegio menor con más tensión. null = silencio. */
  setMusic(mood: MusicMood | null): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.step = 0;
    if (!mood) this.stopScheduler();
    else if (this.ctx) this.startScheduler();
  }

  private startScheduler(): void {
    if (this.timer !== null || !this.ctx) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  private stopScheduler(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const mood = this.mood;
    if (!ctx || !mood || ctx.state !== 'running') return;
    const M = AUDIO.music[mood];
    const beat = 60 / M.bpm / 2;
    while (this.nextNote < ctx.currentTime + 0.3) {
      const s = this.step;
      const bar = Math.floor(s / 8) % M.prog.length;
      const root = M.prog[bar]!;
      // Swing: las corcheas impares llegan tarde.
      const t = this.nextNote + (s % 2 === 1 ? beat * M.swing : 0);
      if (s % 2 === 0)
        this.note(t, 'triangle', midi(root - 12 + M.bass[(s / 2) % M.bass.length]!), beat * 1.6, 0.22);
      if (s % 8 === 2 || s % 8 === 6)
        for (const iv of M.chord) this.note(t, 'square', midi(root + iv), beat * 0.6, 0.035);
      if (M.arp.length)
        this.note(t, 'sawtooth', midi(root + 12 + M.arp[s % M.arp.length]!), beat * 0.5, 0.03);
      if (s % 4 === 0) this.burst(t, 0.04, 6000, 0.05, this.music);
      if (M.kick && s % 4 === 0) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(g).connect(this.music);
        o.start(t);
        o.stop(t + 0.2);
      }
      this.nextNote += beat;
      this.step++;
    }
  }

  private note(t: number, type: OscillatorType, f: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export const audio = new AudioEngine();
