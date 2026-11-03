# TASKS — cambios de jugabilidad

Rama: `cambios-jugabilidad` · Roadmap: `docs/CAMBIOS.md` · Estado: **T0–T16 hechas; pendiente de revisión del usuario antes de tocar `main`**.

Leyenda: ⬜ pendiente · 🔄 en curso · ✅ hecha (pruebas vistas por el director) · ⛔ bloqueada

## Fase 0 — Base: datos, depurador y pruebas (CAMBIOS §6.1–6.3)

| #   | Tarea                                                                                                                                                                                                                                                                                                               | Reutiliza                                                                          | Crea                                                                                     | Pruebas                                                      | Estado                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| T0  | Arnés de simulación con semilla fija: corre N s por personaje y exporta estadísticas a `out/*.json`; instantánea de referencia                                                                                                                                                                                      | `createWorld`/`tick`, `results()`, `dmgBy`                                         | `tests/sim/`, `npm run sim` (sustituye a `sim.js`, que simula el prototipo HTML antiguo) | la sim es determinista (dos pasadas iguales)                 | ✅                                                                                            |
| T1  | Archivo de datos `src/data/tuning.json` + cargador; los `config/*.ts` leen de él (personajes, enemigos, IA, furia, élites, armas, oleadas, hordas)                                                                                                                                                                  | objetos de `src/config/`                                                           | `src/data/tuning.json`, `src/config/tuning.ts`                                           | test de carga y validación; sim de T0 idéntica antes/después | ✅                                                                                            |
| T1b | Números sueltos que queden en `src/engine/systems/*` → archivo de datos (agente `data-migrator`)                                                                                                                                                                                                                    | —                                                                                  | —                                                                                        | sim idéntica, typecheck                                      | ✅ (hecho por el director: solo quedaban 2 valores; el resto son efectos visuales o técnicos) |
| T2  | Depurador (superposición DEV, F1): editar valores, exportar/importar JSON, volver a defaults, guardar como defaults (middleware Vite); herramientas: personaje y build inicial, generar enemigo/cerco, jefe, velocidad y pausa, reinicio instantáneo, invencible, semilla fija; arranque por URL `?dev&char=&seed=` | atajos DEV de `runSession.ts`, `spawnEnemy`, `spawnBoss`, `announceHorde`, `p.god` | `src/app/debug/`                                                                         | tests de import/export/reset; prueba manual en el panel      | ✅                                                                                            |
| T3  | Smoke test: arranca, 60 s de partida sin errores de consola, captura en `out/smoke.png`                                                                                                                                                                                                                             | URL de T2                                                                          | `tests/smoke/smoke.mjs`, dependencia `playwright`                                        | `npm run smoke`                                              | ✅                                                                                            |

## Fase 1 — Interceptores y tiradores (CAMBIOS §2, §3 normales)

| #   | Tarea                                                                                                                                   | Reutiliza                                | Crea                                                  | Pruebas                                                         | Estado |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------ |
| T5  | Aturdimiento del jugador + inmunidad posterior; el autoataque sigue                                                                     | `stun` de enemigos (solo enemigos hoy)   | funciones puras `tryStun`                             | unitarios: aturde, inmunidad, no encadena                       | ✅     |
| T6  | Interceptor: muy rápido, giro lento, apunta a una ruta de salida (predicción), aturde si carrera > 2 s, máx. 2 en pantalla; placeholder | IA por tipo en `enemies.ts`, spawner     | rol `interceptor`, `predictPosition`, límite por tipo | unitarios: predicción, límite; sim: cargas esquivadas/recibidas | ✅     |
| T7  | Tiradores normales desde el minuto 0 (disparo o zona de peligro)                                                                        | `AI.tirador`, rastro de babosa como zona | zona de peligro configurable                          | sim                                                             | ✅     |

## Fase 2 — Velocidad de los enemigos (CAMBIOS §1)

| #   | Tarea                                                                                                                                                      | Reutiliza                                                   | Crea                         | Pruebas                           | Estado                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| T8  | Furia configurable por enemigo: condición (vida %, aliado cercano muere, X s persiguiendo), duración, enfriamiento, velocidad > jugador, indicador visible | `RAGE`, `enrage()`, tinte rojo                              | condiciones y ciclo de furia | unitarios de condición/ciclo; sim | ✅ furia por defecto + excepciones por enemigo; aliado muerto solo en reptador |
| T9  | Habilidad de velocidad (carrera/embestida) telegrafiada, con apuntado predictivo opcional                                                                  | embestida del cortacésped y del Rey Rata (`aim`, `dashSpd`) | habilidad genérica por datos | unitarios de apuntado; sim        | ✅                                                                             |

## Fase 3 — Roles y cercos (CAMBIOS §4)

| #   | Tarea                                                                 | Reutiliza                           | Crea                                         | Pruebas                             | Estado                                                                     |
| --- | --------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| T10 | Campo `role` por enemigo; pesados que bloquean de verdad (solo ellos) | `kbRes`, separación en `enemies.ts` | colisión jugador–pesado                      | unitarios; rendimiento (alloc.test) | ✅                                                                         |
| T11 | Cercos compuestos por roles, siempre con al menos una salida          | `HORDES.ring/wall/stampede`         | composición por datos, comprobación de hueco | unitario «siempre hay salida»       | ✅ `hordes.ring.mix` por minuto, salida `gap`, un pesado cada `heavyEvery` |

## Fase 4 — Tiradores especiales (CAMBIOS §3)

| #   | Tarea                                                                                                                        | Reutiliza                                                             | Crea                   | Pruebas                                            | Estado                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| T12 | Línea de impactos por delante del jugador según su dirección, cada uno marcado en el suelo; minuto configurable; placeholder | bombardeo en pasillo del Dirigible (`bombCount`, `bombWarn`, `laneR`) | rol `tirador_especial` | unitarios de colocación; sim: esquivados/recibidos | ✅ `mortero` (Acto 1, desde 240 s, máx. 2), `ai.mortero`; placeholder |

## Fase 5 — Armas, builds y blindaje (CAMBIOS §5)

| #   | Tarea                                                                                   | Reutiliza                         | Crea                      | Pruebas                             | Estado                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------- | --------------------------------- | ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| T13 | Blindaje plano por impacto (hoy es un multiplicador) + daño contra blindaje por arma    | `armor`, élite `blindado`         | `applyArmor`              | unitarios de daño y blindaje        | ✅ blindado 6, excavadora 8, élite +4; `armorPierce` en rifle, martillo y remachadora; `armor.minFrac` 0,2                                 |
| T14 | Especialización hordas / jefes / élites y control (empuje, ralentización, interrupción) | armas existentes, `stun` de minas | campos por nivel en datos | sim por build: ninguna gana en todo | ✅ `spec` por arma, `slow` (cóctel), `interrupt` (megáfono, martillo, remachadora); charcos solapados no suman; `tests/sim/builds.test.ts` |

## Fase 6 — Estadísticas completas (CAMBIOS §6.4)

| #   | Tarea                                                                                                                                                     | Reutiliza                       | Crea                 | Pruebas                | Estado                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------- | ---------------------- | --------------------------------------------------------------- |
| T15 | Colector de estadísticas (supervivencia, daño por fuente/arma, TTK, ritmo, presión, esquivas, decisiones) + exportar JSON/CSV desde el depurador y la sim | `dmgBy`, `SUMMARY`, `results()` | `engine/runStats.ts` | unitarios del colector | ✅ pestaña Estadísticas, `npm run balance`, `tools/simdiff.mjs` |

## Fase 7 — Balance final (CAMBIOS §7)

| #   | Tarea                                                                             | Reutiliza       | Crea | Pruebas                                   | Estado                                                                        |
| --- | --------------------------------------------------------------------------------- | --------------- | ---- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| T16 | Pasadas de balance con semilla fija por personaje y build, pocos valores cada vez | sim + depurador | —    | comparación de estadísticas antes/después | ✅ bot «kite» esquiva charcos y rastros; sin cambios de valores (ver Balance) |

## Bugs conocidos

- `tests/alloc.test.ts` › «combate sin GC: llave, pistola_clavos, escopeta_chatarra, tesla» ya fallaba en `main` (f606252): `updateEnemies` corre desoptimizado («insufficient type feedback») y reserva números. En T14 se arreglaron otras causas (campos que nacían enteros, `hitAt` opcional, jefes por bajas en la prueba) y la combinación «martillo_pilon…» vuelve a pasar.
- Depurador › Valores: solo edita claves que ya existen en `tuning.json` (no se puede añadir `rage`/`dash` a un enemigo que no los tenga; hay que añadirlos al archivo).

## Preguntas resueltas

1. Plantel (2026-11-03): por ahora Dot, Gus y Benny (el `ROSTER` actual). Mae y El Errante no entran. Sin tarea de plantel.
2. Babosa, Reptador e Hinchado son mutantes y se quedan todos en el Acto 1 por ahora; quizá cambien de acto cuando haya más actos.

## Balance (T16, 2026-11-03)

`npm run balance` (126 partidas, 6 semillas) y `node tools/simdiff.mjs out/balance`. Bot «kite», build propia:
Dot 451 s (4/6 victorias), Gus 423 s (2/6), Benny 357 s (4/6). Daño recibido repartido (Coloso 17 %, interceptor 16 %,
barril 13 %, saqueador 11 %). Cargas del interceptor: 3,6 recibidas / 3,9 esquivadas por partida. El mortero casi nunca
acierta al bot (cambia de rumbo sin parar): revisarlo jugando. Empezar con tesla es la peor build inicial (195–346 s).

## Siguiente tarea recomendada

Probar jugando (`npm run dev`, depurador F1) mortero, cercos y furia; decidir si se lleva la rama a `main`.
