// Colores de la partida (RUN_COLORS) y aspecto de la furia.
/** Colores de la run (placeholders de proyectiles, chatarra, charcos…). */
export const RUN_COLORS = {
  gem: { 1: 0xe8d36a, 5: 0x6ad8e8, 25: 0xff8ad8 } as Readonly<Record<number, number>>,
  gemBig: 0xff8ad8,
  stim: 0xff5577,
  chest: 0xd8a53a,
  crate: 0x8a7a4a,
  coupon: 0xf3e9d2,
  couponInk: 0xd7263d,
  cache: 0x3fb8af,
  cacheTrim: 0xffe14a,
  medkit: 0xf2efe6,
  medkitCross: 0xd8322e,
  magnet: 0xd8322e,
  magnetTip: 0xc8ccd0,
  bomb: 0x2a2a2a,
  bombFuse: 0xffb347,
  hazard: 0x9dff00,
  hazardAlpha: 0.18,
  /** Mancha de hielo de la nevera, si no carga la baldosa de `TILES.iceLake`. */
  ice: { color: 0xc4e8f6, edge: 0x7fd8ff, alpha: 0.55 },
  /** Bala radiactiva del liquidador cuando falta su tira. */
  radBullet: 0x9dff00,
  /** Suelo roto si faltan sus baldosas y lo que cae si faltan sus tiras, en px de pantalla. */
  crater: { color: 0x14100c, alpha: 0.5, r: 50, vary: 0.35, cracks: 7, reach: 1.4, short: 0.65, width: 2.5 },
  falling: {
    height: 340,
    from: 0.15,
    scrap: { color: 0x8a6a4a, edge: 0x2a2018, size: 26 },
    acid: { color: 0x9dff00, edge: 0x3a6a00, size: 24 },
  },
  slime: 0x7dff3a,
  pool: 0xff7a2a,
  tele: 0xff3c28,
  objective: 0xffe14a,
  /** Tinte de la copia del jugador y bomba del evento «Tú mismo, otra vez» (cuerpo y pulso). */
  mirror: 0xc070ff,
  mirrorBomb: 0x2a1018,
  mirrorPulse: 0xff2a2a,
  barrel: 0xc0321e,
  barrelBand: 0xffd34a,
  mine: 0xff5a5a,
  ebullet: 0xff6a3a,
  shadow: 0x000000,
  irradiated: 0xa8ff70,
  /** Enemigo enfurecido (gana al verde de irradiado). */
  rage: 0xff4a3a,
  /** Luces de la cinemática de victoria: rayos dorados y verde radiactivo alternos. */
  victoryA: 0xffd34d,
  victoryB: 0x9dff3a,
  /** Luces de la cinemática de derrota (el Coloso celebra) y su texto. */
  defeatA: 0xff4a3a,
  defeatB: 0xffa03a,
  defeatText: 0xff3a2a,
  flash: 0xffb0b0,
  frozen: 0x9fdcff,
  freeze: 0x7fd8ff,
  freezeCore: 0xe8f8ff,
  nuka: 0xff3d6a,
  nukaGlow: 0xffe14a,
  boots: 0xe8a33a,
  rain: 0x9dff00,
  storm: 0x8a3324,
  aura: 0x7dff6a,
  text: {
    dmg: 0xeeeeee,
    crit: 0xffe14a,
    hurt: 0xff6050,
    dodge: 0x99ccff,
    pickup: 0xffffff,
    slogan: 0xd6b0ff,
  },
} as const;

/**
 * Enemigo enfurecido: se ve más grande (`scale`) mientras dura, y en el último `warn` s parpadea entre rojo y normal
 * a `blinkHz` veces por segundo para avisar de que se le va a pasar.
 */
export const RAGE_VIEW = { scale: 1.25, warn: 1, blinkHz: 6 } as const;
