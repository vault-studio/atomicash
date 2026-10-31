// Audio con grabaciones (tools/build_audio.py → assets/audio/, créditos en assets/audio/CREDITS.md).
// DECISIÓN: WebAudio directo, sin librerías. Efectos y lechos de ambiente decodificados en memoria (variantes, tono
// al azar, posición en el estéreo, reverb, loops exactos al sample); la música va por <audio> porque 4 min
// decodificados no caben, y se baja entera como blob para que el service worker la guarde sin peticiones parciales.
// Mezcla: efectos/ambiente/música → filtro de poca vida → margen → compresor → recorte suave; la interfaz se salta
// el filtro. El audio nunca puede romper el juego: todo lo público va dentro de `safe`.
import { AUDIO, type MusicMood, type SfxDef, type SoundId } from '../config/audio';

/** Estado de la partida que mueve la mezcla. */
export interface MusicState {
  /** 0–1. */
  intensity: number;
  streak: boolean;
  lowHp: boolean;
}

interface Entry {
  file: string;
  dur: number;
  /** Lechos: tramo que se repite (el archivo lleva margen antes y después para esquivar los bordes del AAC). */
  loopStart?: number;
  loopEnd?: number;
}
interface Index {
  sfx: Record<string, Entry[]>;
  amb: Record<string, Entry | Entry[]>;
  music: Record<string, Entry & { loop: boolean }>;
}

interface Voice {
  id: SoundId;
  src: AudioBufferSourceNode;
  gain: GainNode;
  end: number;
  priority: boolean;
}

/** Pista por streaming: un <audio> y su ganancia. `gen` invalida las paradas pendientes al reutilizarla. */
interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  track: string | null;
  gen: number;
  url: string | null;
}

/** Lecho de ambiente en loop exacto. */
interface Bed {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const BASE = `${import.meta.env.BASE_URL}${AUDIO.dir}`;
const SFX = AUDIO.sfx as Readonly<Record<SoundId, SfxDef>>;

const shuffle = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** El audio es un adorno: un fallo (navegador viejo, nodo raro) se traga en vez de parar el bucle del juego. */
function safe(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[audio]', e);
  }
}

/** WAV de silencio para «estrenar» los <audio> dentro del gesto (iOS y WebView no los dejan sonar después si no). */
function silentWav(): string {
  const n = 64;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, s: string): void => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  b.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVEfmt ');
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true);
  b.setUint32(28, 16000, true);
  b.setUint16(32, 2, true);
  b.setUint16(34, 16, true);
  w(36, 'data');
  b.setUint32(40, n * 2, true);
  let s = '';
  for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b.getUint8(i));
  return 'data:audio/wav;base64,' + btoa(s);
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  /** Compresor final; su `reduction` sirve para comprobar que la mezcla no lo tiene trabajando todo el rato. */
  comp: DynamicsCompressorNode | null = null;
  /** Petición de música en curso: una nueva invalida las anteriores aunque aún se estén bajando. */
  private musicReq = 0;
  private music!: GainNode;
  private musicLevel!: GainNode;
  private duckGain!: GainNode;
  private radio!: [BiquadFilterNode, BiquadFilterNode];
  private world!: BiquadFilterNode;
  private fx!: GainNode;
  private ui!: GainNode;
  private amb!: GainNode;
  private windLevel!: GainNode;
  private fxSend!: GainNode;
  private ambSend!: GainNode;
  private index: Index | null = null;
  private loading = false;
  private readonly buffers = new Map<string, AudioBuffer[]>();
  private readonly voices: Voice[] = [];
  private readonly lastVariant = new Map<string, number>();
  private readonly lastPlay = new Map<string, number>();
  private decks: Deck[] = [];
  private activeDeck = -1;
  private bed: Bed | null = null;
  private musicVol: number = AUDIO.defaultMusic;
  private sfxVol: number = AUDIO.defaultSfx;
  private mood: MusicMood | null = null;
  private playlist: string[] = [];
  private state: MusicState = { intensity: -1, streak: false, lowHp: false };
  private focused = true;
  private paused = false;
  private chain = 0;
  private lastPickup = -1;
  private ambTimer: number | null = null;
  private readonly nextAmb = new Map<string, number>();
  private heartAt = 0;

  /**
   * Primer gesto del usuario: crea el contexto y los reproductores de música (los navegadores exigen las dos cosas
   * dentro del gesto). Los siguientes gestos reaniman el contexto si quedó suspendido o interrumpido (iOS).
   */
  unlock(): void {
    safe(() => {
      if (this.ctx) {
        if (this.ctx.state !== 'running' && this.focused) void this.ctx.resume();
        if (!this.index && !this.loading) void this.load(this.ctx);
        return;
      }
      if (typeof AudioContext === 'undefined') return;
      // iOS: que el interruptor de silencio mande igual sobre todo el juego (antes de crear el contexto).
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'ambient';
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.buildGraph(ctx);
      const silence = silentWav();
      this.decks = [this.deck(ctx, silence), this.deck(ctx, silence)];
      this.applyVolumes();
      if (ctx.state !== 'running') void ctx.resume();
      void this.load(ctx);
    });
  }

  private buildGraph(ctx: AudioContext): void {
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
  private reverbBus(ctx: AudioContext, ir: AudioBuffer, out: AudioNode): GainNode {
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

  private openFreq(): number {
    return Math.min(AUDIO.layers.lowpass.open, (this.ctx?.sampleRate ?? 44100) / 2.2);
  }

  /** Respuesta al impulso: ruido estéreo que cae y se oscurece, como el eco de un páramo con ruinas. */
  private impulse(ctx: AudioContext): AudioBuffer {
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

  private async load(ctx: AudioContext): Promise<void> {
    this.loading = true;
    let idx: Index;
    try {
      const res = await fetch(BASE + 'audio.json');
      if (!res.ok) throw new Error(`audio.json ${res.status}`);
      idx = (await res.json()) as Index;
    } catch (e) {
      // Sin índice no hay audio; el siguiente gesto lo vuelve a intentar.
      if (import.meta.env.DEV) console.warn('[audio]', e);
      this.loading = false;
      return;
    }
    const decode = async (key: string, list: Entry[]): Promise<void> => {
      const out: AudioBuffer[] = [];
      for (const e of list) {
        try {
          const data = await (await fetch(BASE + e.file)).arrayBuffer();
          out.push(await ctx.decodeAudioData(data));
        } catch (err) {
          // Una variante que falle no tumba las demás.
          if (import.meta.env.DEV) console.warn('[audio]', e.file, err);
        }
      }
      if (out.length) this.buffers.set(key, out);
    };
    // Primero el lecho y la música del momento, luego interfaz y armas, luego el resto.
    const beds = Object.entries(idx.amb).filter((e): e is [string, Entry] => !Array.isArray(e[1]));
    await Promise.all(beds.map(([k, v]) => decode('bed:' + k, [v])));
    // Con el índice publicado ya puede arrancar la música (antes, setMusic solo apunta el momento).
    this.index = idx;
    safe(() => {
      if (this.mood) this.startMood(this.mood);
    });
    const order = Object.keys(idx.sfx).sort(
      (a, b) => Number(!SFX[a as SoundId]?.ui) - Number(!SFX[b as SoundId]?.ui),
    );
    await Promise.all(order.map((k) => decode(k, idx.sfx[k]!)));
    for (const [k, v] of Object.entries(idx.amb)) if (Array.isArray(v)) await decode('amb:' + k, v);
    this.loading = false;
  }

  private deck(ctx: AudioContext, silence: string): Deck {
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

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * AUDIO.musicGain, t, 0.05);
    // El ambiente va con los efectos: es parte del mundo, no de la banda sonora.
    this.amb.gain.setTargetAtTime(this.sfxVol * AUDIO.ambGain, t, 0.05);
    this.fx.gain.setTargetAtTime(this.sfxVol * AUDIO.sfxGain, t, 0.02);
    this.ui.gain.setTargetAtTime(this.sfxVol * AUDIO.sfxGain, t, 0.02);
  }

  /** Silencio al perder el foco (04_ART_UI.md §4). */
  setFocused(f: boolean): void {
    this.focused = f;
    safe(() => {
      if (!this.ctx) return;
      const active = this.decks[this.activeDeck];
      for (const d of this.decks) {
        if (f && d === active && d.track) void d.el.play().catch(() => undefined);
        else if (!f) d.el.pause();
        // Un reproductor que se estaba apagando se queda apagado.
        else if (d !== active) this.stopDeck(d);
      }
      if (f) void this.ctx.resume();
      else void this.ctx.suspend();
    });
  }

  /** La run en pausa (o eligiendo tarjeta): sin truenos ni latido. */
  setPaused(p: boolean): void {
    this.paused = p;
  }

  // ---------- efectos ----------

  /**
   * Suena un efecto. `pan` −1…1 (izquierda–derecha) y `dist` en pantallas desde el jugador; sin ellos, centrado.
   * `intensity` (≈ cuántos a la vez) sube un poco el volumen.
   */
  play(id: SoundId, intensity = 1, pan = 0, dist = 0): void {
    safe(() => this.playUnsafe(id, intensity, pan, dist));
  }

  private playUnsafe(id: SoundId, intensity: number, pan: number, dist: number): void {
    const ctx = this.ctx;
    const def = SFX[id];
    if (!ctx || !def || ctx.state !== 'running' || this.sfxVol <= 0) return;
    const bufs = this.buffers.get(id);
    if (!bufs) return;
    if (!Number.isFinite(pan)) pan = 0;
    if (!Number.isFinite(dist)) dist = 0;
    const S = AUDIO.space;
    if (!def.ui && dist > S.cull) return;
    const now = ctx.currentTime;
    if (now - (this.lastPlay.get(id) ?? -1) < def.gap) return;
    const priority = def.priority ?? false;

    // Límite de voces: por sonido y en total. Se apaga la más vieja; las prioritarias solo ceden ante otras.
    for (let i = this.voices.length - 1; i >= 0; i--)
      if (this.voices[i]!.end <= now) this.voices.splice(i, 1);
    let count = 0;
    let oldest: Voice | undefined;
    for (const v of this.voices)
      if (v.id === id) {
        count++;
        oldest ??= v;
      }
    if (oldest && count >= def.voices) this.steal(oldest, now);
    else if (this.voices.length >= AUDIO.maxVoices) {
      const victim = this.voices.find((v) => !v.priority) ?? (priority ? this.voices[0] : undefined);
      if (!victim) return;
      this.steal(victim, now);
    }
    this.lastPlay.set(id, now);

    // Variante al azar sin repetir la anterior.
    let vi = (Math.random() * bufs.length) | 0;
    if (bufs.length > 1 && vi === this.lastVariant.get(id)) vi = (vi + 1) % bufs.length;
    this.lastVariant.set(id, vi);
    const buf = bufs[vi]!;

    let semis = (Math.random() * 2 - 1) * def.pitch;
    if (id === 'pickup') {
      // Cadena de recogidas: cada una medio tono más aguda si llega seguida de la anterior.
      const C = AUDIO.pickupChain;
      this.chain = now - this.lastPickup < C.gap ? Math.min(C.max, this.chain + 1) : 0;
      this.lastPickup = now;
      semis = this.chain;
    }

    const far = def.ui ? 0 : Math.max(0, dist - S.near);
    const att = 1 / (1 + far * S.falloff);
    const vol = def.gain * Math.min(1.25, 0.85 + 0.15 * intensity) * att * (0.9 + Math.random() * 0.2);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, semis / 12);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    const nodes: AudioNode[] = [g];
    if (def.ui) g.connect(this.ui);
    else {
      // Sin StereoPanner (navegadores viejos) suena centrado.
      const p = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      let out: AudioNode = g;
      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan * S.pan));
        g.connect(p);
        out = p;
        nodes.push(p);
      }
      out.connect(this.fx);
      const send = (def.reverb ?? 0) + Math.min(1, far) * S.farReverb;
      if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        out.connect(s).connect(this.fxSend);
        nodes.push(s);
      }
    }
    src.onended = () => {
      for (const n of nodes) n.disconnect();
    };
    src.start(now);
    this.voices.push({ id, src, gain: g, end: now + buf.duration / src.playbackRate.value, priority });
    if (def.duck) this.duck(def.duck);
  }

  private steal(v: Voice, now: number): void {
    v.gain.gain.setTargetAtTime(0, now, 0.01);
    v.src.stop(now + 0.05);
    v.end = now;
    this.voices.splice(this.voices.indexOf(v), 1);
  }

  /** Baja la música un momento para que se oiga el golpe. */
  private duck(amount: number): void {
    const t = this.ctx!.currentTime;
    const g = this.duckGain.gain;
    const D = AUDIO.duck;
    const target = Math.min(g.value, 1 - amount);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + D.attack);
    g.setTargetAtTime(1, t + D.attack + 0.1, D.release / 3);
  }

  // ---------- música y ambiente ----------

  /** Menús: discos de los años 20 por la radio del búnker; run: ambiente del páramo; jefe: percusión. null = silencio. */
  setMusic(mood: MusicMood | null): void {
    if (mood === this.mood) return;
    this.mood = mood;
    safe(() => {
      if (this.ctx && this.index) this.startMood(mood);
    });
  }

  private startMood(mood: MusicMood | null): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.setRadio(mood === 'menu');
    // La mezcla de la run se vuelve a aplicar entera con el siguiente estado; fuera de ella, a su sitio.
    this.state = { intensity: -1, streak: false, lowHp: false };
    if (mood !== 'run') {
      this.musicLevel.gain.setTargetAtTime(1, t, 0.3);
      this.windLevel.gain.setTargetAtTime(1, t, 0.3);
    }
    // Entre run y jefe el filtro de poca vida se queda como está: el siguiente estado lo vuelve a fijar.
    if (mood !== 'run' && mood !== 'boss') this.sweep(this.openFreq(), 0.3);
    if (!mood) {
      this.musicReq++;
      for (const d of this.decks) if (d.track) this.fadeOut(d, 1.5);
      this.activeDeck = -1;
      this.setBed(null);
      this.stopOneShots();
      return;
    }
    this.playlist = shuffle([...AUDIO.music.tracks[mood]]);
    this.nextTrack();
    this.setBed(AUDIO.amb.bed[mood]);
    if (mood === 'menu') this.stopOneShots();
    else if (this.ambTimer === null) {
      for (const [k, o] of Object.entries(AUDIO.amb.oneShots))
        this.nextAmb.set(k, t + o.every[0] * (0.3 + Math.random() * 0.7));
      this.ambTimer = window.setInterval(() => safe(() => this.tickAmbience()), 250);
    }
  }

  private nextTrack(): void {
    if (!this.mood) return;
    if (!this.playlist.length) this.playlist = shuffle([...AUDIO.music.tracks[this.mood]]);
    const id = this.playlist.shift()!;
    const e = this.index!.music[id];
    if (e) void this.crossfade(id, e.file);
  }

  /** Funde de la pista que suena a `track` en el otro reproductor. La pista se baja entera antes de sonar. */
  private async crossfade(track: string, file: string): Promise<void> {
    const ctx = this.ctx!;
    const xf = AUDIO.music.crossfade;
    const req = ++this.musicReq;
    let url: string;
    try {
      const res = await fetch(BASE + file);
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      url = URL.createObjectURL(await res.blob());
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[audio]', e);
      return;
    }
    // Mientras se bajaba pudo cambiar el momento: esta pista ya no toca.
    if (req !== this.musicReq) {
      URL.revokeObjectURL(url);
      return;
    }
    // El reproductor se elige al sonar, no al pedir; todos los demás se funden.
    const ni = this.activeDeck === 0 ? 1 : 0;
    const next = this.decks[ni]!;
    for (const d of this.decks) if (d !== next && d.track) this.fadeOut(d, xf);
    const gen = ++next.gen;
    this.activeDeck = ni;
    if (next.url) URL.revokeObjectURL(next.url);
    next.url = url;
    next.track = track;
    next.el.src = url;
    const t = ctx.currentTime;
    next.gain.gain.cancelScheduledValues(t);
    next.gain.gain.setValueAtTime(0, t);
    next.gain.gain.linearRampToValueAtTime(1, t + xf);
    if (this.focused) void next.el.play().catch(() => undefined);
    // Antes de que acabe entra la siguiente con un fundido; `onended` por si el aviso de tiempo no llegó.
    const advance = (): void => {
      if (next.gen !== gen) return;
      next.el.ontimeupdate = null;
      next.el.onended = null;
      next.el.onerror = null;
      safe(() => this.nextTrack());
    };
    next.el.ontimeupdate = () => {
      const left = next.el.duration - next.el.currentTime;
      if (isFinite(left) && left < xf + 0.25) advance();
    };
    next.el.onended = advance;
    next.el.onerror = advance;
  }

  private fadeOut(d: Deck, xf: number): void {
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

  private stopDeck(d: Deck): void {
    d.gen++;
    d.el.pause();
    d.gain.gain.cancelScheduledValues(0);
    d.gain.gain.value = 0;
    d.track = null;
  }

  /** Cambia el lecho de ambiente con un fundido; suena en loop exacto desde memoria. */
  private setBed(id: string | null): void {
    if ((this.bed?.id ?? null) === id) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const F = AUDIO.amb.fade;
    const old = this.bed;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + F);
      old.src.stop(t + F + 0.05);
    }
    this.bed = null;
    const buf = id ? this.buffers.get('bed:' + id)?.[0] : undefined;
    const e = id ? (this.index?.amb[id] as Entry | undefined) : undefined;
    if (!id || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const a = e?.loopStart ?? 0;
    const b = Math.min(buf.duration, e?.loopEnd ?? buf.duration);
    src.loopStart = a;
    src.loopEnd = b;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(AUDIO.amb.bedGain, t + F);
    src.connect(gain).connect(this.amb);
    src.onended = () => gain.disconnect();
    // Cada vez desde un punto distinto del loop, para que no suene igual al entrar.
    src.start(t, a + Math.random() * (b - a));
    this.bed = { id, src, gain };
  }

  private setRadio(on: boolean, now = false): void {
    const R = AUDIO.music.radio;
    const t = this.ctx!.currentTime;
    const tc = now ? 0.001 : 0.4;
    this.radio[0].frequency.setTargetAtTime(on ? R.lo : 20, t, tc);
    this.radio[1].frequency.setTargetAtTime(on ? R.hi : this.openFreq(), t, tc);
  }

  /** Barrido del filtro de poca vida, exponencial (suena como el oído, no como un corte tardío). */
  private sweep(f: number, time: number): void {
    const t = this.ctx!.currentTime;
    const p = this.world.frequency;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.exponentialRampToValueAtTime(f, t + time);
  }

  private stopOneShots(): void {
    if (this.ambTimer !== null) window.clearInterval(this.ambTimer);
    this.ambTimer = null;
  }

  /** Truenos, ráfagas y explosiones lejanas al azar, colocados a un lado u otro; y el latido con poca vida. */
  private tickAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.paused) return;
    const t = ctx.currentTime;
    for (const [k, o] of Object.entries(AUDIO.amb.oneShots)) {
      if (t < (this.nextAmb.get(k) ?? 0)) continue;
      this.nextAmb.set(k, t + o.every[0] + Math.random() * (o.every[1] - o.every[0]));
      const bufs = this.buffers.get('amb:' + k);
      if (!bufs) continue;
      const src = ctx.createBufferSource();
      src.buffer = bufs[(Math.random() * bufs.length) | 0]!;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const g = ctx.createGain();
      g.gain.value = o.gain;
      src.connect(g);
      let out: AudioNode = g;
      if (typeof ctx.createStereoPanner === 'function') {
        const p = ctx.createStereoPanner();
        p.pan.value = (Math.random() * 2 - 1) * 0.8;
        out = g.connect(p);
      }
      out.connect(this.amb);
      const s = ctx.createGain();
      s.gain.value = 0.5;
      out.connect(s).connect(this.ambSend);
      src.onended = () => {
        g.disconnect();
        out.disconnect();
        s.disconnect();
      };
      src.start(t);
    }
    if (this.state.lowHp && this.mood !== 'menu') this.heartbeat(t);
  }

  /** Latido grave con poca vida (dos golpes sordos), programado por delante en el reloj del audio. */
  private heartbeat(t: number): void {
    const H = AUDIO.layers.heartbeat;
    const beat = 60 / H.bpm;
    if (this.heartAt < t) this.heartAt = t + 0.05;
    const ctx = this.ctx!;
    while (this.heartAt < t + 0.6) {
      for (const [dt, v] of [
        [0, 1],
        [0.22, 0.7],
      ] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const at = this.heartAt + dt;
        o.frequency.setValueAtTime(62, at);
        o.frequency.exponentialRampToValueAtTime(38, at + 0.15);
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(H.gain * v * this.sfxVol, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        // Directo al margen final: el latido no se apaga con el filtro de poca vida.
        o.connect(g).connect(this.master);
        o.onended = () => g.disconnect();
        o.start(at);
        o.stop(at + 0.25);
      }
      this.heartAt += beat;
    }
  }

  /** La run informa de su estado: la mezcla se mueve con un fundido. */
  setMusicState(s: MusicState): void {
    safe(() => {
      const changed =
        s.streak !== this.state.streak ||
        s.lowHp !== this.state.lowHp ||
        Math.abs(s.intensity - this.state.intensity) > 0.05;
      if (!changed || !this.ctx) return;
      const wasLow = this.state.lowHp;
      this.state = { ...s };
      const L = AUDIO.layers;
      const t = this.ctx.currentTime;
      const tc = L.fade / 3;
      const i = this.mood === 'run' ? s.intensity : 1;
      const lerp = (r: readonly [number, number]): number => r[0] + (r[1] - r[0]) * i;
      this.musicLevel.gain.setTargetAtTime(lerp(L.music) * (s.streak ? 1.1 : 1), t, tc);
      this.windLevel.gain.setTargetAtTime(lerp(L.wind), t, tc);
      const low = this.mood !== 'menu' && s.lowHp;
      if (low !== wasLow) this.sweep(low ? L.lowpass.closed : this.openFreq(), L.fade);
    });
  }
}

export const audio = new AudioEngine();
