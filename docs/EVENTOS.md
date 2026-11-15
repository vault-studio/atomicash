# Eventos especiales — plantilla

Referencia: evento espejo «Tú mismo, otra vez» (`engine/systems/mirror.ts`, `tests/mirror.test.ts`).
Un evento = estado propio en `World` + `updateX(w)` por tick + render placeholder + textos + atajo + test.

## Archivos que tocar (en este orden)

1. **`src/data/tuning.json`** → bloque de primer nivel `"<evento>": { from, to, ...radios, daños }` (junto a `mirror`).
   Si trae un enemigo nuevo (humanoide o robot): entrada en `enemies` y en `ai` (como `copia`, líneas ~395 y ~591).
2. **`src/config/modes.ts`** → `export const X = TUNING.<evento>;` con JSDoc que explique cada clave.
   Enemigo nuevo: su ID en `config/enemies.ts` (`X_ID = '...' satisfies StatEnemyId`) y excluirlo de `MOB_IDS` si no
   debe salir en oleadas.
3. **`src/engine/types.ts`** → `interface XState { phase: 0|1|2; at: number; x; y; readonly rng: Rng }` y campo en
   `World` (junto a `mirror: MirrorState`, ~l. 683).
4. **`src/engine/systems/<evento>.ts`** con:
   - `createX(seed)`: `createRng(seed ^ SALT)` propio (sal hex nueva). **Nunca `w.rng`**: así no cambian las partidas
     ni los snapshots de `npm run sim` mientras el evento no se active.
   - `updateX(w)`: fase 0 espera `w.time >= at`; si `w.bossAlive > 0` o `w.time - w.lastBossAt < EVENTS.bossQuiet`,
     retrasa `at`. Fase 1 detecta el disparo (distancia² < r², sin `Math.sqrt`). Fase 2 = hecho.
   - Función pública de disparo directo (como `putBomb`) para depurador y tests.
   - `resetX(w)` para el cambio de acto si el evento deja algo en el mapa.
   - Efectos: `boom`, `burst`, `addShake`, `hitStop`, `banner(w, 'banner.<evento>')`, `sfx(w, SFX.*)` de `engine/fx`
     y `engine/sfx`. Daño al jugador: `hurtPlayer(w, dmg, 0, true, hurtIndex(ID))`.
   - Constantes puramente visuales (colores, nº de esquirlas) pueden ir como `const` local; lo de juego, a tuning.
   - Recompensa: `w.garrisons.push({x,y,left:1})` + `e.gar` hace caer el cofre especial al matar (ver
     `combat.ts` ~l. 409, que distingue por `e.skin`); si no, `addChest(...)`.
5. **`src/engine/world.ts`** → `x: createX(seed)` en `createWorld` (~l. 263) y `updateX(w)` dentro del bloque
   `if (p.deadAt === null && w.actClearAt < 0)` (~l. 424, junto a `updateMirror`).
6. **`src/engine/systems/campaign.ts`** → llamar a `resetX(w)` en el cambio de acto (~l. 114).
7. IA de un enemigo nuevo: rama en `enemies.ts` (~l. 727) que llame a `xThink(...)` escribiendo en un `Vec` estático
   del módulo (`mirrorVel`) — nada de objetos nuevos por tick (`tests/alloc.test.ts`).

## Render (placeholder, sin arte)

- `src/config/render.ts` → colores en `RUN_COLORS` (`x`, `xPulse`…).
- `src/render/fxLayer.ts` (~l. 285) → círculo pulsante con `g.circle(...).fill/stroke` mientras `phase === 1`.
- Enemigo nuevo: tinte en `render/enemyLayer.ts` (~l. 124/153) o placeholder en `render/placeholders.ts`.
- Mapa y minimapa: marcador en `app/screens/run/MapView.tsx` (~l. 252) y `Minimap.tsx` (~l. 181).

## Textos (`src/i18n/es.json` y `en.json`, mismas claves)

- `banner.<evento>` (al dispararse) y `banner.<evento>Won` (al resolverse), ~l. 418.
- `map.events.<evento>` (etiqueta en el mapa), ~l. 1018.

## Atajo del depurador

`src/app/runSession.ts` (~l. 340): `else if (e.code === 'KeyX') putX(world, p.x + p.facingX * 120, p.y + p.facingY * 120);`
Libres: no usar K J L G B T E H N M Y ni F1/F3. Añadir la tecla a la lista de atajos de `CLAUDE.md`.

## Pruebas mínimas (`tests/<evento>.test.ts`, copiar `quiet()`/`run()` de `mirror.test.ts`)

- Sale una sola vez dentro de [`from`, `to`] y se retrasa con un jefe vivo.
- Mismo `seed` → mismo instante y sitio; activar el evento no cambia `w.rng` antes de dispararse.
- El disparo directo aplica daño/efecto y la recompensa cae al resolverlo.
- Cambio de acto con el evento pendiente → vuelve a esperar.
- `npm test`, `npm run typecheck`, `npm run lint`; si es visible, `/?dev&...&god=1` y su tecla.

## Cierre por evento

Commit local (sin push), una línea en `DONE.md`, y anotar aquí lo aprendido.
