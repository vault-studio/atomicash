// Motor de sonido, capa 2: efectos (voces, robo de voces, ducking).
import { AUDIO, type SoundId } from '../config/audio';
import { type Voice, SFX, safe } from './shared';
import { AudioMix } from './mix';

export class AudioSfx extends AudioMix {
  // ---------- efectos ----------

  /**
   * Suena un efecto. `pan` −1…1 (izquierda–derecha) y `dist` en pantallas desde el jugador; sin ellos, centrado.
   * `intensity` (≈ cuántos a la vez) sube un poco el volumen.
   */
  play(id: SoundId, intensity = 1, pan = 0, dist = 0): void {
    safe(() => this.playUnsafe(id, intensity, pan, dist));
  }

  protected playUnsafe(id: SoundId, intensity: number, pan: number, dist: number): void {
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

  protected steal(v: Voice, now: number): void {
    v.gain.gain.setTargetAtTime(0, now, 0.01);
    v.src.stop(now + 0.05);
    v.end = now;
    this.voices.splice(this.voices.indexOf(v), 1);
  }

  /** Baja la música un momento para que se oiga el golpe. */
  protected duck(amount: number): void {
    const t = this.ctx!.currentTime;
    const g = this.duckGain.gain;
    const D = AUDIO.duck;
    const target = Math.min(g.value, 1 - amount);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + D.attack);
    g.setTargetAtTime(1, t + D.attack + 0.1, D.release / 3);
  }

  protected stopOneShots(): void {
    if (this.ambTimer !== null) window.clearInterval(this.ambTimer);
    this.ambTimer = null;
  }
}
