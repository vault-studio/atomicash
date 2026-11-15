// Obstáculos y edificios del mapa: API pública. Fuera de esta carpeta se importa solo desde aquí.
export { buildingState, scanArea, BUILDING_WEIGHT, areaClutter, chestSpot } from './buildings';
export type { BuildingState, AreaScan } from './buildings';
export { body, blockCircle, blockBody, hitsObstacle } from './collision';
export {
  createObstacleGrid,
  createCellObject,
  objectAt,
  worldObjectAt,
  refreshObstacles,
  putObstacle,
} from './grid';
export type { CellObject } from './grid';
