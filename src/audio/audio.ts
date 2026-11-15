// Audio con grabaciones (tools/build_audio.py → assets/audio/, créditos en assets/audio/CREDITS.md).
// DECISIÓN: WebAudio directo, sin librerías. Efectos y lechos de ambiente decodificados en memoria (variantes, tono
// al azar, posición en el estéreo, reverb, loops exactos al sample); la música va por <audio> porque 4 min
// decodificados no caben, y se baja entera como blob para que el service worker la guarde sin peticiones parciales.
// Mezcla: efectos/ambiente/música → filtro de poca vida → margen → compresor → recorte suave; la interfaz se salta
// el filtro. El audio nunca puede romper el juego: todo lo público va dentro de `safe`.
import { AudioEngine } from './engine';

export type { MusicState } from './shared';

export const audio = new AudioEngine();
