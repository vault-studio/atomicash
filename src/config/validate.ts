// Validación de la config al arrancar en dev (05_TECH.md §5) y en tests.
import { ACT_IDS, CAMPAIGN, type ActId } from './acts';
import { ENTITIES, ENTITY_IDS, isEntityId, type SurvivorId } from './entities';
import { ELITES, ENEMY_RULES, ENEMY_STATS, type EnemyStats, type StatEnemyId } from './enemies';
import { BUILDINGS, type BuildingKind } from './props';
import { SURVIVORS, hasStats } from './survivors';
import { HORDES, WAVES } from './waves';
import { WEAPONS } from './weapons';

const SNAKE_ASCII = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

const isEnemyStat = (id: string): id is StatEnemyId => Object.prototype.hasOwnProperty.call(ENEMY_STATS, id);

/** Segundo del acto en que se desbloquea el tipo. */
const gateOf = (id: StatEnemyId): number => {
  const role = (ENEMY_STATS[id] as EnemyStats).role;
  return role === undefined ? 0 : CAMPAIGN.gates[role];
};

/** Comprueba que los tipos existan y sean de su acto; `where` nombra la lista en los errores. */
function checkActTypes(ids: readonly string[], act: ActId, where: string, errors: string[]): void {
  for (const id of ids) {
    if (!isEnemyStat(id)) errors.push(`${where}: ${id} no tiene stats de enemigo`);
    else if (ENTITIES[id].act !== act) errors.push(`${where}: ${id} no es del acto ${act}`);
  }
}

/** Oleadas, hordas, guarniciones y jefes de cada acto. */
function validateCampaign(errors: string[]): void {
  for (const act of ACT_IDS) {
    const list = WAVES.filter((x) => x.act === act);
    if (list[0]?.from !== 0) errors.push(`waves: la primera oleada del acto ${act} debe empezar en 0`);
    list.forEach((wave, i) => {
      const where = `waves[acto ${act}, ${wave.from}]`;
      if (i > 0 && wave.from <= list[i - 1]!.from) errors.push(`${where}: oleadas fuera de orden`);
      checkActTypes(Object.keys(wave.mix), act, where, errors);
      const ids = (Object.keys(wave.mix) as StatEnemyId[]).filter((id) => isEnemyStat(id));
      if (!ids.some((id) => gateOf(id) === 0 && !ELITES.exclude.includes(id)))
        errors.push(`${where}: sin tipos desbloqueados desde el segundo 0 que puedan ser élite`);
    });
    const ring = HORDES.ring.mix[act];
    const ringIds = Object.keys(ring) as StatEnemyId[];
    checkActTypes(ringIds, act, `hordes.ring.mix[${act}]`, errors);
    if (!ringIds.some((id) => isEnemyStat(id) && gateOf(id) === 0 && ENEMY_STATS[id].role !== 'heavy'))
      errors.push(`hordes.ring.mix[${act}]: sin tipos desbloqueados desde el segundo 0 que no sean pesados`);
    for (const H of ['stampede', 'wall'] as const) {
      const types = HORDES[H].types[act];
      const last = types[types.length - 1];
      checkActTypes(
        types.map((x) => x.type),
        act,
        `hordes.${H}.types[${act}]`,
        errors,
      );
      if (!last || !isEnemyStat(last.type) || gateOf(last.type) !== 0)
        errors.push(`hordes.${H}.types[${act}]: el último tipo debe estar desbloqueado desde el segundo 0`);
    }
    for (const [kind, groups] of Object.entries(BUILDINGS.enemies[act]) as [
      BuildingKind,
      readonly (readonly [StatEnemyId, number])[],
    ][]) {
      checkActTypes(
        groups.map(([id]) => id),
        act,
        `BUILDINGS.enemies[${act}].${kind}`,
        errors,
      );
      if (groups.length > 0 && !groups.some(([id]) => isEnemyStat(id) && gateOf(id) === 0))
        errors.push(`BUILDINGS.enemies[${act}].${kind}: nada desbloqueado desde el segundo 0`);
    }
    if (!isEnemyStat(CAMPAIGN.acts[act].boss)) errors.push(`campaign.acts[${act}]: jefe inexistente`);
  }
}

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
    for (const w of [s.weapon, s.exclusiveWeapon ?? s.weapon]) {
      if (!(w in WEAPONS)) errors.push(`survivors.${id}: arma ${w} no existe`);
    }
  }
  for (const [id, s] of Object.entries(ENEMY_STATS) as [string, EnemyStats][]) {
    const cat = isEntityId(id) ? ENTITIES[id].category : null;
    if (cat !== (s.boss ? 'bosses' : 'enemies'))
      errors.push(`enemies.${id}: no es un ${s.boss ? 'jefe' : 'enemigo'}`);
    if (!(s.hp > 0) || s.speed < 0) errors.push(`enemies.${id}: PV o velocidad inválidos`);
  }
  WAVES.forEach((wave, i) => {
    if (!(wave.rate > 0) || !(wave.max > 0)) errors.push(`waves[${i}]: rate y max deben ser > 0`);
    if (wave.max > ENEMY_RULES.maxAlive) errors.push(`waves[${i}]: max supera ENEMY_RULES.maxAlive`);
    const mix = Object.entries(wave.mix);
    if (!mix.some(([, wgt]) => (wgt ?? 0) > 0)) errors.push(`waves[${i}]: mezcla vacía`);
  });
  validateCampaign(errors);
  return errors;
}
