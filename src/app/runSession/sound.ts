// Puente con el audio: estado de la música y efectos pedidos por el motor en cada frame.
import { audio, type MusicState } from '../../audio/audio';
import { AUDIO } from '../../config/audio';
import { streakMult } from '../../config/run';
import type { World } from '../../engine/types';
import { SFX, SFX_COUNT, type SfxId } from '../../engine/sfx';
import { isOnScreen, isoX, isoY } from '../../engine/view';

const SFX_NAMES = Object.keys(SFX) as SfxId[];

/** Intensidad de la partida para la música por capas: enemigos en pantalla, hordas y élites. */
function musicState(w: World): MusicState {
  const L = AUDIO.layers;
  let onScreen = 0;
  let elite = false;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    if (e.elite) elite = true;
    if (isOnScreen(w, e.x, e.y)) onScreen++;
  }
  const intensity = Math.min(1, onScreen / L.fullAt + (w.horde ? L.horde : 0) + (elite ? L.elite : 0));
  return {
    intensity,
    streak: streakMult(w.streak) > 1,
    lowHp: w.player.hp < w.player.maxHp * L.lowHp && w.player.deadAt === null,
  };
}

/** Hace sonar lo que el motor contó desde el último fotograma y el chasquido del Geiger según la RAD. */
export function createSoundTap(): (w: World, frameSec: number) => void {
  const prev = new Int32Array(SFX_COUNT);
  let geiger = 0;
  return (w, frameSec) => {
    for (let i = 0; i < SFX_COUNT; i++) {
      const n = w.sfx[i]! - prev[i]!;
      prev[i] = w.sfx[i]!;
      if (n <= 0) continue;
      // Colocado en el estéreo según dónde pasó respecto al jugador en la pantalla (isométrica), en pantallas.
      const ox = w.sfxX[i]! - w.player.x;
      const oy = w.sfxY[i]! - w.player.y;
      const dx = isoX(ox, oy) / (w.view.halfW || 1);
      const dy = isoY(ox, oy) / (w.view.halfH || 1);
      audio.play(SFX_NAMES[i]!, n, dx, Math.sqrt(dx * dx + dy * dy));
    }
    geiger += frameSec * AUDIO.geigerRate * (w.player.rad / 100) * (0.5 + Math.random());
    if (geiger >= 1) {
      geiger = 0;
      audio.play('geiger');
    }
    audio.setMusic(w.bossAlive > 0 ? 'boss' : 'run');
    audio.setMusicState(musicState(w));
  };
}
