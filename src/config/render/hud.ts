// Radar, mapa de la pausa y protección de toques del HUD.
import type { BuildingKind } from '../props';

export const RADAR = {
  range: 1500,
  /** Lado del radar en px CSS (el HUD lo encoge en pantallas bajas). */
  size: 176,
  /** Vueltas por segundo del barrido. */
  sweep: 0.35,
  phosphor: '#3cff6b',
  dim: 'rgba(60, 255, 107, 0.28)',
  bg: 'rgba(6, 20, 9, 0.88)',
  barrel: '#ff5a3c',
  /** Evento en el que hay que entrar: amarillo «aguanta», rojo «limpia la zona». */
  objective: '#ffe14a',
  objectivePurge: '#ff5a3c',
  /** Aro de una zona en la que se está luchando. */
  fight: '#ff3c28',
  /** Trazo oscuro de los marcadores. */
  ink: '#06140a',
  lake: 'rgba(157, 255, 0, 0.2)',
  kinds: {
    medkit: '#ff4d4d',
    magnet: '#4db8ff',
    bomb: '#ff9a2e',
    crate: '#ffe14a',
    chest: '#c77dff',
    cache: '#3fb8af',
    freeze: '#bfefff',
    nuka: '#ff3d6a',
    boots: '#e8a33a',
  } as Readonly<
    Record<'medkit' | 'magnet' | 'bomb' | 'crate' | 'chest' | 'cache' | 'freeze' | 'nuka' | 'boots', string>
  >,
  /** Edificios de 3×3: un rombo del color de lo que los rodea. */
  buildings: {
    raiders: '#ff6a3d',
    robots: '#4de3ff',
    necro: '#c9ff4d',
    supply: '#ffe14a',
  } as Readonly<Record<BuildingKind, string>>,
  /** Medio lado del rombo de un edificio, en px CSS. */
  buildingSize: 8,
  /** Lado del dibujo de un cofre y radio del marcador de un evento, en px CSS. */
  chestSize: 22,
  eventSize: 9,
} as const;

/** Lo que tarda en hacer caso una pantalla abierta al apretar: el clic de ese toque llega después. */
export const TAP_GUARD_MS = 350;

/**
 * Mapa de la pausa. `range`: unidades de mundo isométricas de la mitad de su alto. `cells`: casillas que se miran a
 * cada lado del jugador (hasta salir de pantalla en un móvil apaisado). `grid`: lado de la cuadrícula. `arrowRange`: hasta dónde lleva flecha en el borde una zona que no cabe. Tamaños en px CSS.
 */
export const MAP = {
  range: 1100,
  arrowRange: 2400,
  cells: 34,
  grid: 400,
  margin: 22,
  font: 13,
  zone: 12,
  chest: 30,
  event: 13,
  bg: '#050d07',
  object: 'rgba(60, 255, 107, 0.3)',
  enemy: '#ff5a3c',
} as const;
