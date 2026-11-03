# TASKS — cambios de jugabilidad

Rama: `cambios-jugabilidad` · Roadmap: `docs/CAMBIOS.md` · Estado: **fase de preparación hecha, esperando aprobación**.

Leyenda: ⬜ pendiente · 🔄 en curso · ✅ hecha (pruebas vistas por el director) · ⛔ bloqueada

## Fase 0 — Base: datos, depurador y pruebas (CAMBIOS §6.1–6.3)

| #   | Tarea                                                                                                                                                                                                                                                                                                               | Reutiliza                                                                          | Crea                                                                                     | Pruebas                                                      | Estado                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| T0  | Arnés de simulación con semilla fija: corre N s por personaje y exporta estadísticas a `out/*.json`; instantánea de referencia                                                                                                                                                                                      | `createWorld`/`tick`, `results()`, `dmgBy`                                         | `tests/sim/`, `npm run sim` (sustituye a `sim.js`, que simula el prototipo HTML antiguo) | la sim es determinista (dos pasadas iguales)                 | ✅                                                                                            |
| T1  | Archivo de datos `src/data/tuning.json` + cargador; los `config/*.ts` leen de él (personajes, enemigos, IA, furia, élites, armas, oleadas, hordas)                                                                                                                                                                  | objetos de `src/config/`                                                           | `src/data/tuning.json`, `src/config/tuning.ts`                                           | test de carga y validación; sim de T0 idéntica antes/después | ✅                                                                                            |
| T1b | Números sueltos que queden en `src/engine/systems/*` → archivo de datos (agente `data-migrator`)                                                                                                                                                                                                                    | —                                                                                  | —                                                                                        | sim idéntica, typecheck                                      | ✅ (hecho por el director: solo quedaban 2 valores; el resto son efectos visuales o técnicos) |
| T2  | Depurador (superposición DEV, F1): editar valores, exportar/importar JSON, volver a defaults, guardar como defaults (middleware Vite); herramientas: personaje y build inicial, generar enemigo/cerco, jefe, velocidad y pausa, reinicio instantáneo, invencible, semilla fija; arranque por URL `?dev&char=&seed=` | atajos DEV de `runSession.ts`, `spawnEnemy`, `spawnBoss`, `announceHorde`, `p.god` | `src/app/debug/`                                                                         | tests de import/export/reset; prueba manual en el panel      | ⬜                                                                                            |
| T3  | Smoke test: arranca, 60 s de partida sin errores de consola, captura en `out/smoke.png`                                                                                                                                                                                                                             | URL de T2                                                                          | `tests/smoke/smoke.mjs`, dependencia `playwright`                                        | `npm run smoke`                                              | ⬜                                                                                            |

## Fase 1 — Interceptores y tiradores (CAMBIOS §2, §3 normales)

| #   | Tarea                                                                                                                                   | Reutiliza                                | Crea                                                  | Pruebas                                                         | Estado |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------ |
| T5  | Aturdimiento del jugador + inmunidad posterior; el autoataque sigue                                                                     | `stun` de enemigos (solo enemigos hoy)   | funciones puras `tryStun`                             | unitarios: aturde, inmunidad, no encadena                       | ⬜     |
| T6  | Interceptor: muy rápido, giro lento, apunta a una ruta de salida (predicción), aturde si carrera > 2 s, máx. 2 en pantalla; placeholder | IA por tipo en `enemies.ts`, spawner     | rol `interceptor`, `predictPosition`, límite por tipo | unitarios: predicción, límite; sim: cargas esquivadas/recibidas | ⬜     |
| T7  | Tiradores normales desde el minuto 0 (disparo o zona de peligro)                                                                        | `AI.tirador`, rastro de babosa como zona | zona de peligro configurable                          | sim                                                             | ⬜     |

## Fase 2 — Velocidad de los enemigos (CAMBIOS §1)

| #   | Tarea                                                                                                                                                      | Reutiliza                                                   | Crea                         | Pruebas                           | Estado |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------- | --------------------------------- | ------ |
| T8  | Furia configurable por enemigo: condición (vida %, aliado cercano muere, X s persiguiendo), duración, enfriamiento, velocidad > jugador, indicador visible | `RAGE`, `enrage()`, tinte rojo                              | condiciones y ciclo de furia | unitarios de condición/ciclo; sim | ⬜     |
| T9  | Habilidad de velocidad (carrera/embestida) telegrafiada, con apuntado predictivo opcional                                                                  | embestida del cortacésped y del Rey Rata (`aim`, `dashSpd`) | habilidad genérica por datos | unitarios de apuntado; sim        | ⬜     |

## Fase 3 — Roles y cercos (CAMBIOS §4)

| #   | Tarea                                                                 | Reutiliza                           | Crea                                         | Pruebas                             | Estado |
| --- | --------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------- | ----------------------------------- | ------ |
| T10 | Campo `role` por enemigo; pesados que bloquean de verdad (solo ellos) | `kbRes`, separación en `enemies.ts` | colisión jugador–pesado                      | unitarios; rendimiento (alloc.test) | ⬜     |
| T11 | Cercos compuestos por roles, siempre con al menos una salida          | `HORDES.ring/wall/stampede`         | composición por datos, comprobación de hueco | unitario «siempre hay salida»       | ⬜     |

## Fase 4 — Tiradores especiales (CAMBIOS §3)

| #   | Tarea                                                                                                                        | Reutiliza                                                             | Crea                   | Pruebas                                            | Estado |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- | ------ |
| T12 | Línea de impactos por delante del jugador según su dirección, cada uno marcado en el suelo; minuto configurable; placeholder | bombardeo en pasillo del Dirigible (`bombCount`, `bombWarn`, `laneR`) | rol `tirador_especial` | unitarios de colocación; sim: esquivados/recibidos | ⬜     |

## Fase 5 — Armas, builds y blindaje (CAMBIOS §5)

| #   | Tarea                                                                                   | Reutiliza                         | Crea                      | Pruebas                             | Estado |
| --- | --------------------------------------------------------------------------------------- | --------------------------------- | ------------------------- | ----------------------------------- | ------ |
| T13 | Blindaje plano por impacto (hoy es un multiplicador) + daño contra blindaje por arma    | `armor`, élite `blindado`         | `applyArmor`              | unitarios de daño y blindaje        | ⬜     |
| T14 | Especialización hordas / jefes / élites y control (empuje, ralentización, interrupción) | armas existentes, `stun` de minas | campos por nivel en datos | sim por build: ninguna gana en todo | ⬜     |

## Fase 6 — Estadísticas completas (CAMBIOS §6.4)

| #   | Tarea                                                                                                                                                     | Reutiliza                       | Crea                 | Pruebas                | Estado |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------- | ---------------------- | ------ |
| T15 | Colector de estadísticas (supervivencia, daño por fuente/arma, TTK, ritmo, presión, esquivas, decisiones) + exportar JSON/CSV desde el depurador y la sim | `dmgBy`, `SUMMARY`, `results()` | `engine/runStats.ts` | unitarios del colector | ⬜     |

## Fase 7 — Balance final (CAMBIOS §7)

| #   | Tarea                                                                             | Reutiliza       | Crea | Pruebas                                   | Estado |
| --- | --------------------------------------------------------------------------------- | --------------- | ---- | ----------------------------------------- | ------ |
| T16 | Pasadas de balance con semilla fija por personaje y build, pocos valores cada vez | sim + depurador | —    | comparación de estadísticas antes/después | ⬜     |

## Bugs conocidos

- `tests/alloc.test.ts` › «combate sin GC: llave, pistola_clavos, escopeta_chatarra, tesla» falla en `main` (dos de dos ejecuciones, 2026-11-03): hay un GC durante el combate. Reproducir: `npx vitest run tests/alloc.test.ts`. Pendiente de mirar en T0 (no es de esta rama).

## Preguntas resueltas

1. Plantel (2026-11-03): por ahora Dot, Gus y Benny (el `ROSTER` actual). Mae y El Errante no entran. Sin tarea de plantel.
2. Babosa, Reptador e Hinchado son mutantes y se quedan todos en el Acto 1 por ahora; quizá cambien de acto cuando haya más actos.

## Siguiente tarea recomendada

T0 → T1 (el director), luego T1b con `data-migrator` (haiku).
