// Motor de sonido, capa 1: estado (todos los campos), grafo de mezcla, reverb, volúmenes, filtro de radio y
// pistas de música (<audio>).
import { AUDIO, type MusicMood } from '../config/audio';
import { type MusicState, type Index, type Voice, type Deck, type Bed, safe } from './shared';

export class AudioMix {
  protected ctx: AudioContext | null = null;
  protected master!: GainNode;
  /** Compresor final; su `reduction` sirve para comprobar que la mezcla no lo tiene trabajando todo el rato. */
  comp: DynamicsCompressorNode | null = null;
  /** Petición de música en curso: una nueva invalida las anteriores aunque aún se estén bajando. */
  protected musicReq = 0;
  protected music!: GainNode;
  protected musicLevel!: GainNode;
  protected duckGain!: GainNode;
  protected radio!: [BiquadFilterNode, BiquadFilterNode];
  protected world!: BiquadFilterNode;
  protected fx!: GainNode;
  protected ui!: GainNode;
  protected amb!: GainNode;
  protected windLevel!: GainNode;
  protected fxSend!: GainNode;
  protected ambSend!: GainNode;
  protected index: Index | null = null;
  protected loading = false;
  protected readonly buffers = new Map<string, AudioBuffer[]>();
  protected readonly voices: Voice[] = [];
  protected readonly lastVariant = new Map<string, number>();
  protected readonly lastPlay = new Map<string, number>();
  protected decks: Deck[] = [];
  protected activeDeck = -1;
  protected bed: Bed | null = null;
  protected musicVol: number = AUDIO.defaultMusic;
  protected sfxVol: number = AUDIO.defaultSfx;
  protected mood: MusicMood | null = null;
  protected playlist: string[] = [];
  protected state: MusicState = { intensity: -1, streak: false, lowHp: false };
  protected focused = true;
  protected paused = false;
  protected chain = 0;
  protected lastPickup = -1;
  protected ambTimer: number | null = null;
  protected readonly nextAmb = new Map<string, number>();
  protected heartAt = 0;

  protected buildGraph(ctx: AudioContext): void {
    // Final: margen de −3 dB, compresor que solo toca los picos y techo suave: lineal hasta 0,8 y redondeado por
    // encima. La curva cubre ±2 (entra a media ganancia) para que hasta +6 dB de exceso se redondee sin recortarse.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -3;
    comp.knee.value = 0;
    comp.ratio.value = 20;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.comp = comp;
    const N = 2048;
    const K = 0.8;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = ((i / (N - 1)) * 2 - 1) * 2;
      const a = Math.abs(x);
      curve[i] = Math.sign(x) * (a <= K ? a : K + (1 - K) * Math.tanh((a - K) / (1 - K)));
    }
    const clip = ctx.createWaveShaper();
    clip.curve = curve;
    clip.oversample = '2x';
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    this.master = ctx.createGain();
    this.master.gain.value = AUDIO.headroom;
    this.master.connect(comp).connect(pre).connect(clip).connect(ctx.destination);

    // Filtro de poca vida: apaga el mundo (efectos, ambiente y música), no la interfaz.
    this.world = ctx.createBiquadFilter();
    this.world.type = 'lowpass';
    this.world.Q.value = Math.SQRT1_2;
    this.world.frequency.value = this.openFreq();
    this.world.connect(this.master);

    this.fx = ctx.createGain();
    this.fx.connect(this.world);
    this.ui = ctx.createGain();
    this.ui.connect(this.master);
    this.amb = ctx.createGain();
    this.windLevel = ctx.createGain();
    this.amb.connect(this.windLevel).connect(this.world);

    // Dos retornos de reverb con la misma sala: el de los efectos va con su volumen y el del ambiente con el suyo.
    const ir = this.impulse(ctx);
    this.fxSend = this.reverbBus(ctx, ir, this.fx);
    this.ambSend = this.reverbBus(ctx, ir, this.amb);

    // Música: volumen del jugador → ducking → nivel por intensidad → radio (solo en el menú) → mundo.
    this.music = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.musicLevel = ctx.createGain();
    const lo = ctx.createBiquadFilter();
    lo.type = 'highpass';
    const hi = ctx.createBiquadFilter();
    hi.type = 'lowpass';
    this.radio = [lo, hi];
    this.setRadio(false, true);
    this.music.connect(this.duckGain).connect(this.musicLevel).connect(lo).connect(hi).connect(this.world);
  }

  /** Envío de reverb: sin graves (no embarra las explosiones) y con un poco de retardo antes de la cola. */
  protected reverbBus(ctx: AudioContext, ir: AudioBuffer, out: AudioNode): GainNode {
    const R = AUDIO.reverb;
    const send = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = R.highpass;
    const pre = ctx.createDelay(0.2);
    pre.delayTime.value = R.predelay;
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = R.wet;
    send.connect(hp).connect(pre).connect(conv).connect(wet).connect(out);
    return send;
  }

  protected openFreq(): number {
    return Math.min(AUDIO.layers.lowpass.open, (this.ctx?.sampleRate ?? 44100) / 2.2);
  }

  /** Respuesta al impulso: ruido estéreo que cae y se oscurece, como el eco de un páramo con ruinas. */
  protected impulse(ctx: AudioContext): AudioBuffer {
    const R = AUDIO.reverb;
    const n = Math.floor(ctx.sampleRate * R.seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    const a = Math.exp((-2 * Math.PI * R.damp) / ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // El filtro se cierra con el tiempo: los agudos se apagan antes que los graves.
        const k = a + (1 - a) * t * 0.9;
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] =
          lp * Math.pow(1 - t, R.decay) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
      }
    }
    return buf;
  }

  protected deck(ctx: AudioContext, silence: string): Deck {
    const el = new Audio();
    el.preload = 'auto';
    // Estreno dentro del gesto: a partir de aquí el elemento puede sonar sin otro toque.
    el.src = silence;
    void el
      .play()
      .then(() => el.pause())
      .catch(() => undefined);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(this.music);
    return { el, gain, track: null, gen: 0, url: null };
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    safe(() => this.applyVolumes());
  }

  protected applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * AUDIO.musicGain, t, 0.05);
    // El ambiente va con los efectos: es parte del mundo, no de la banda sonora.
    this.amb.gain.setTargetAtTime(this.sfxVol * AUDIO.ambGain, t, 0.05);
    this.fx.gain.setTargetAtTime(this.sfxVol * AUDIO.sfxGain, t, 0.02);
    this.ui.gain.setTargetAtTime(this.sfxVol * AUDIO.sfxGain, t, 0.02);
  }

  protected fadeOut(d: Deck, xf: number): void {
    const t = this.ctx!.currentTime;
    const g = d.gain.gain;
    const gen = ++d.gen;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + xf);
    d.el.ontimeupdate = null;
    d.el.onended = null;
    d.el.onerror = null;
    window.setTimeout(
      () => {
        if (d.gen === gen) this.stopDeck(d);
      },
      xf * 1000 + 100,
    );
  }

  protected stopDeck(d: Deck): void {
    d.gen++;
    d.el.pause();
    d.gain.gain.cancelScheduledValues(0);
    d.gain.gain.value = 0;
    d.track = null;
  }

  protected setRadio(on: boolean, now = false): void {
    const R = AUDIO.music.radio;
    const t = this.ctx!.currentTime;
    const tc = now ? 0.001 : 0.4;
    this.radio[0].frequency.setTargetAtTime(on ? R.lo : 20, t, tc);
    this.radio[1].frequency.setTargetAtTime(on ? R.hi : this.openFreq(), t, tc);
  }

  /** Barrido del filtro de poca vida, exponencial (suena como el oído, no como un corte tardío). */
  protected sweep(f: number, time: number): void {
    const t = this.ctx!.currentTime;
    const p = this.world.frequency;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.exponentialRampToValueAtTime(f, t + time);
  }
}
