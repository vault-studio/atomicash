// Arte de los efectos (FX_ART): tiras, tamaños y anclas de cada efecto.
import type { AnimId } from '../entities';
import type { AuraArt } from './art';

/**
 * Efectos con dibujo (tools/slice_fx.py → `assets/fx/`): tiras de frames del mismo tamaño. Sin la tira, FxLayer sigue
 * dibujando su placeholder. Tamaños en px de mundo: `r` es múltiplo del radio del efecto (charco, zona, explosión) o
 * del enemigo; `w`, ancho fijo. `ay` (y `ax`) es el punto de apoyo como fracción del frame; `fps` en las que hacen
 * bucle. Las planas (`flat`) se aplastan a 2:1 para casar con los círculos isométricos del suelo.
 */
export const FX_ART = {
  dir: 'assets/fx/',
  index: 'assets/fx/fx.json',
  zone: {
    ring: { r: 2.12, ay: 0.5 },
    glow: { r: 2, ay: 0.5, fps: 8, alpha: 0.55 },
    motes: { r: 2, ay: 0.82, fps: 8, alpha: 0.8 },
    /** Color de la zona de «limpia la zona» (la de «aguanta» usa `RUN_COLORS.objective`). */
    purge: 0xff5a3c,
  },
  tele: { circle: { r: 2.1 }, disc: { r: 2.1, alpha: 0.4 } },
  /**
   * Pasillo de embestida: franja de tierra levantada sin borde duro (`bands`: semiancho relativo y opacidad, de fuera
   * adentro) y galones que avanzan hacia donde va la carga (`gap` px entre ellos, `speed` px/s); los que ya ha
   * alcanzado el aviso se encienden. `dust` es el color de la tierra; el rojo del aviso va en los galones.
   */
  lane: {
    dust: 0x3a1a0c,
    bands: [
      { w: 1.3, a: 0.14 },
      { w: 1, a: 0.18 },
      { w: 0.65, a: 0.22 },
    ],
    glow: { w: 0.55, a: 0.26 },
    chevron: { gap: 46, speed: 90, len: 0.45, wing: 0.7, width: 3, dim: 0.22, lit: 0.85 },
  },
  /**
   * Lo que cae, en px de pantalla: `w` ancho, `ay` punto de la tira que marca su posición. La chatarra lleva una pieza
   * por frame; el resto, un bucle.
   */
  fall: {
    scrap: { strip: 'fall_scrap', w: 74, ay: 0.5, spin: 9 },
    acid: { strip: 'fall_acid', w: 44, ay: 0.72, fps: 10 },
    shell: { strip: 'fall_shell', w: 36, ay: 0.95, fps: 1 },
    // El obús con tinte: verde (barril de ácido del bidonero) y azul pálido (nevera).
    barrel: { strip: 'fall_shell', w: 36, ay: 0.95, fps: 1, tint: 0x7dff3a },
    ice: { strip: 'fall_shell', w: 36, ay: 0.95, fps: 1, tint: 0x8fd0ff },
  },
  /**
   * Auras de arma en el suelo. `ring`: parte del ancho del frame que ocupa el anillo, que marca el alcance; (`ax`, `ay`)
   * es su centro. Las escribe tools/slice_destrozos.py al recortar.
   */
  aura: {
    geiger: { strip: 'aura_geiger', ring: 0.844, ax: 0.512, ay: 0.566, fps: 8, alpha: 0.75 },
    nucleo_inestable: { strip: 'aura_core', ring: 0.868, ax: 0.506, ay: 0.585, fps: 10, alpha: 0.85 },
  } as Readonly<Record<string, AuraArt>>,
  pool: {
    fire: { r: 2.3, ay: 0.62, fps: 10 },
    /** `fade`: s finales en los que se apaga. `cull`: px de mundo; más lejos del jugador no se dibuja. */
    acid: { r: 2.3, ay: 0.58, fps: 7, fade: 3, cull: 1300 },
  },
  boom: {
    fire: { r: 2.2, ay: 0.72 },
    acid: { r: 2.4, ay: 0.68 },
    slam: { r: 2.3, ay: 0.55 },
    debris: { r: 3.4, ay: 0.78 },
    /** Las que barren la pantalla: `r` deja la explosión del ancho de la vista; `fade`, parte final en la que se apaga. */
    big: { r: 1, ay: 0.8, alpha: 0.9, fade: 0.3 },
    ice: { r: 1, ay: 0.72, alpha: 0.9, fade: 0.3 },
    /** Las explosiones más grandes que esto (bomba y crio-granada, que barren la pantalla) usan las tiras grandes. */
    maxR: 220,
  },
  shot: {
    pistola_clavos: { w: 28 },
    jeringa: { w: 36 },
    remachadora: { w: 28 },
    dardos_incendiarios: { w: 38 },
    rifle_cerrojo: { w: 34 },
    escopeta_chatarra: { w: 26 },
  } as Readonly<Record<string, { w: number }>>,
  /** Qué tira usa cada arma con proyectil dibujado (las demás, círculo de su color). */
  shotArt: {
    pistola_clavos: 'nail',
    jeringa: 'syringe',
    remachadora: 'rivet',
    dardos_incendiarios: 'dart',
    rifle_cerrojo: 'bullet',
    escopeta_chatarra: 'pellet',
  } as Readonly<Record<string, string>>,
  /** Punto de la tira que va en la posición del proyectil (la estela queda detrás). */
  shotAx: 0.68,
  ebullet: { r: 6.5, fps: 12 },
  molotov: { w: 30, fps: 14 },
  wrench: { size: 4.6 },
  coil: { size: 3.4, fps: 12 },
  wave: { len: 1.05 },
  enemy: {
    burn: { r: 3, ay: 0.95, fps: 12 },
    ice: { r: 3.2, ay: 0.88, thaw: 0.3 },
    stun: { r: 2.4, head: 3.4, fps: 10 },
    spawn: { r: 3.6, ay: 0.6, dur: 0.45 },
  },
  death: { w: 46, ay: 0.6, dur: 0.45 },
  /**
   * Muerte de los robots. Las piezas se recortan del sprite: `anims` y `dir` dicen de qué hoja y fila (primer frame);
   * salen `base + tamaño × perSize` trozos, hasta `max`, y se descartan los de menos de `minPiece` del robot; en el suelo
   * miden `restScale` de lo que medían en el robot. `seamDark` oscurece los cortes. `delay` s tras la muerte aparecen las piezas, ya con la explosión encima; se oscurecen hasta
   * `char` en `charTime` s y se apagan los últimos `fade` s. `colorPiece`: lado de cada trozo del robot sin sprite, en
   * fracción de su ancho, y `colorDark`, cuánto se oscurece su color. Explosión: una cada `per` px de ancho del robot, hasta `max`, separadas `gap` s; `w` en
   * fracción de su ancho. `scorch`: mancha quemada del suelo: `strip` de `w` veces el
   * ancho del robot, o un círculo de radio `r` si no carga.
   */
  wreck: {
    anims: ['move', 'idle'] as readonly AnimId[],
    dir: 1,
    pieces: { base: 6, perSize: 2, max: 14 },
    restScale: 0.85,
    minPiece: 0.02,
    shatter: { alpha: 60, tries: 12, uneven: 0.3, jag: 0.03, seam: 2.5 },
    seamDark: 0.4,
    delay: 0.05,
    char: 0.72,
    charTime: 0.8,
    fade: 2,
    colorPiece: 0.08,
    colorDark: 0.6,
    motion: { air: 0.55, fall: 450, reach: 0.8, pop: 0.7, heavy: 2, spin: 8, turn: 1.8 },
    blast: { per: 170, max: 5, gap: 0.13, dur: 0.5, w: 1.5, ay: 0.72, spread: 0.55 },
    scorch: { strip: 'scorch', w: 1.15, artAlpha: 0.9, r: 0.36, alpha: 0.3, color: 0x14100c, in: 0.25 },
  },
  levelup: { w: 78, ay: 0.92, dur: 0.9 },
  heal: { w: 56, ay: 0.9, dur: 0.6, minFrac: 0.08 },
} as const;
