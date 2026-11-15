// Reglas del Búnker (02_GAMEPLAY.md §8–9). Todas mutan un borrador de `SaveData`: el store lo clona antes.
export { dayKey, hashSeed } from './util';
export { grantSurvivor, starCost, starUp, addSurvivorXp, setActive, chooseStarter } from './collection';
export type { Grant } from './collection';
export {
  buyUpgrade,
  runOptionsFor,
  buyConsumable,
  buyImplant,
  learnableStarters,
  learnStarter,
  setStarter,
} from './workshop';
export { treePoints, treeFree, canAllocate, allocateNode, canRefund, refundNode, resetTree } from './tree';
export { applyRun } from './rewards';
export type { RunReward } from './rewards';
export { refreshDaily, claimMission, achievementProgress, checkAchievements } from './missions';
export { rollRarity, pullBoxes } from './supplies';
