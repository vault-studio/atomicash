// Motor de sonido, capa 3: lechos de ambiente, sonidos sueltos y latido.
import { AUDIO } from '../config/audio';
import type { Entry } from './shared';
import { AudioSfx } from './sfx';

export class AudioAmbience extends AudioSfx {
  /** Cambia el lecho de ambiente con un fundido; suena en loop exacto desde memoria. */
  protected setBed(id: string | null): void {
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

  /** Truenos, ráfagas y explosiones lejanas al azar, colocados a un lado u otro; y el latido con poca vida. */
  protected tickAmbience(): void {
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
  protected heartbeat(t: number): void {
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
}
