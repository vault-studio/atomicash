// Render de la partida (Pixi): API pública.
export {
  startVictory,
  startDefeat,
  victoryHolding,
  stepVictory,
  victoryLevel,
  drawVictory,
  drawDefeatText,
} from './cinematics';
export { drawRadFog } from './radFog';
export { GameRenderer } from './gameRenderer';
export type { DebugInfo } from './gameRenderer';
