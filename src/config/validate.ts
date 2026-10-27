// Validación de la config al arrancar en dev (05_TECH.md §5) y en tests.
import { ENTITIES, ENTITY_IDS, isEntityId, type SurvivorId } from './entities';
import { ENEMY_RULES, ENEMY_STATS } from './enemies';
import { SURVIVORS, hasStats } from './survivors';
import { WAVES } from './waves';

const SNAKE_ASCII = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function validateConfig(): string[] {
  const errors: string[] = [];
  for (const id of ENTITY_IDS) {
    const d = ENTITIES[id];
    if (!SNAKE_ASCII.test(id)) errors.push(`${id}: el ID debe ser snake_case ASCII`);
    if (!HEX.test(d.color)) errors.push(`${id}: color de firma inválido (${d.color})`);
    if (!(d.size > 0)) errors.push(`${id}: el tamaño debe ser > 0`);
    if (d.variantOf !== undefined) {
      if (!isEntityId(d.variantOf))
        errors.push(`${id}: variantOf apunta a un ID que no existe (${d.variantOf})`);
      else if (ENTITIES[d.variantOf].category !== d.category)
        errors.push(`${id}: la variante cambia de categoría`);
    }
    if (d.owner !== undefined && !isEntityId(d.owner)) errors.push(`${id}: owner no existe (${d.owner})`);
    if (d.category === 'characters') {
      if (d.status === undefined) errors.push(`${id}: superviviente sin estado`);
      // La categoría ya se ha comprobado arriba: el ID es de un superviviente.
      if (d.status === 'playable' && !hasStats(id as SurvivorId))
        errors.push(`${id}: jugable sin stats en survivors.ts`);
    }
  }
  for (const [id, s] of Object.entries(SURVIVORS)) {
    if (!isEntityId(id) || ENTITIES[id].category !== 'characters')
      errors.push(`survivors.${id}: no es un superviviente`);
    for (const w of [s.weapon, s.exclusiveWeapon]) {
      if (!isEntityId(w) || ENTITIES[w].category !== 'props')
        errors.push(`survivors.${id}: arma ${w} no existe`);
    }
  }
  for (const [id, s] of Object.entries(ENEMY_STATS)) {
    if (!isEntityId(id) || ENTITIES[id].category !== 'enemies')
      errors.push(`enemies.${id}: no es un enemigo`);
    if (!(s.hp > 0) || s.speed < 0) errors.push(`enemies.${id}: PV o velocidad inválidos`);
  }
  WAVES.forEach((wave, i) => {
    const prev = WAVES[i - 1];
    if (i === 0 && wave.from !== 0) errors.push('waves[0]: la primera oleada debe empezar en 0');
    if (prev && wave.from <= prev.from) errors.push(`waves[${i}]: oleadas fuera de orden`);
    if (!(wave.rate > 0) || !(wave.max > 0)) errors.push(`waves[${i}]: rate y max deben ser > 0`);
    if (wave.max > ENEMY_RULES.maxAlive) errors.push(`waves[${i}]: max supera ENEMY_RULES.maxAlive`);
    const mix = Object.entries(wave.mix);
    if (!mix.some(([, wgt]) => (wgt ?? 0) > 0)) errors.push(`waves[${i}]: mezcla vacía`);
    for (const [id] of mix) {
      if (!Object.prototype.hasOwnProperty.call(ENEMY_STATS, id))
        errors.push(`waves[${i}]: ${id} no tiene stats de enemigo`);
    }
  });
  return errors;
}
