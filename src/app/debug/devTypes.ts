// Tipos compartidos por el panel del depurador y sus pestañas.
import type { ReactNode } from 'react';
import type { ActId } from '../../config/acts';
import type { StatSurvivorId } from '../../config/survivors';
import type { BotKind } from '../../sim/sim';
import type { RunSession } from '../runSession';

/** Lo que se edita en «Partida» y se aplica al pulsar «Reiniciar». */
export interface Setup {
  char: StatSurvivorId;
  act: ActId;
  seedText: string;
  /** Con la semilla fija cada reinicio repite la misma partida; si no, cada uno saca una nueva. */
  fixedSeed: boolean;
  buildText: string;
}

/** Lo que se aplica al instante y se conserva entre reinicios. */
export interface Live {
  god: boolean;
  speed: number;
  paused: boolean;
  bot: BotKind | null;
}

export interface DevCtx {
  getSession: () => RunSession | null;
  /** Semilla de la partida en curso. */
  seed: number;
  setup: Setup;
  patchSetup: (p: Partial<Setup>) => void;
  live: Live;
  patchLive: (p: Partial<Live>) => void;
  /** Aplica `setup`, con los cambios de `over`, y empieza otra partida. */
  restart: (over?: Partial<Setup>) => void;
  /** Resultado de reaplicar los valores guardados en el navegador al cargar (null = no había). */
  savedTuning: { skipped: string[] } | null;
}

export interface DevTab {
  id: string;
  label: string;
  render: (ctx: DevCtx) => ReactNode;
}
