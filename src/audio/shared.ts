// Tipos y utilidades del audio compartidos por las capas del motor de sonido.
import { AUDIO, type SfxDef, type SoundId } from '../config/audio';

/** Estado de la partida que mueve la mezcla. */
export interface MusicState {
  /** 0–1. */
  intensity: number;
  streak: boolean;
  lowHp: boolean;
}

export interface Entry {
  file: string;
  dur: number;
  /** Lechos: tramo que se repite (el archivo lleva margen antes y después para esquivar los bordes del AAC). */
  loopStart?: number;
  loopEnd?: number;
}
export interface Index {
  sfx: Record<string, Entry[]>;
  amb: Record<string, Entry | Entry[]>;
  music: Record<string, Entry & { loop: boolean }>;
}

export interface Voice {
  id: SoundId;
  src: AudioBufferSourceNode;
  gain: GainNode;
  end: number;
  priority: boolean;
}

/** Pista por streaming: un <audio> y su ganancia. `gen` invalida las paradas pendientes al reutilizarla. */
export interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  track: string | null;
  gen: number;
  url: string | null;
}

/** Lecho de ambiente en loop exacto. */
export interface Bed {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export const BASE = `${import.meta.env.BASE_URL}${AUDIO.dir}`;
export const SFX = AUDIO.sfx as Readonly<Record<SoundId, SfxDef>>;

export const shuffle = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** El audio es un adorno: un fallo (navegador viejo, nodo raro) se traga en vez de parar el bucle del juego. */
export function safe(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[audio]', e);
  }
}

/** WAV de silencio para «estrenar» los <audio> dentro del gesto (iOS y WebView no los dejan sonar después si no). */
export function silentWav(): string {
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
