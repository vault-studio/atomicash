// Motor de sonido, capa 4: desbloqueo y carga, foco y pausa, música por estado de la partida.
import { AUDIO, type MusicMood, type SoundId } from '../config/audio';
import { type MusicState, type Entry, type Index, BASE, SFX, shuffle, safe, silentWav } from './shared';
import { AudioAmbience } from './ambience';

export class AudioEngine extends AudioAmbience {
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

  protected async load(ctx: AudioContext): Promise<void> {
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

  // ---------- música y ambiente ----------

  /** Menús: discos de los años 20 por la radio del búnker; run: ambiente del páramo; jefe: percusión. null = silencio. */
  setMusic(mood: MusicMood | null): void {
    if (mood === this.mood) return;
    this.mood = mood;
    safe(() => {
      if (this.ctx && this.index) this.startMood(mood);
    });
  }

  protected startMood(mood: MusicMood | null): void {
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

  protected nextTrack(): void {
    if (!this.mood) return;
    if (!this.playlist.length) this.playlist = shuffle([...AUDIO.music.tracks[this.mood]]);
    const id = this.playlist.shift()!;
    const e = this.index!.music[id];
    if (e) void this.crossfade(id, e.file);
  }

  /** Funde de la pista que suena a `track` en el otro reproductor. La pista se baja entera antes de sonar. */
  protected async crossfade(track: string, file: string): Promise<void> {
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
