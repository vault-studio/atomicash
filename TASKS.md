# TASKS — cambios de jugabilidad

Rama: `main` · Roadmap: `docs/CAMBIOS.md` · Estado: **T0–T16 hechas y publicadas**.

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

## Tras la primera prueba del usuario (2026-11-03)

- ✅ La embestida (saqueador, cortacésped, Rey Rata) siempre llega: corre en línea recta hasta dejar al jugador `over` px atrás (tope `maxDur` por si algo la frena), en vez de durar un tiempo fijo que se quedaba corto.
- ✅ Aturdido no se dispara (cambia CAMBIOS §2, que decía que el autoataque seguía).
- Efecto en balance (bot «kite» que ahora también esquiva el pasillo marcado, build propia): media 410 → 361 s; Dot 409 s (1/6), Gus 261 s (0/6), Benny 412 s (3/6). Daño del saqueador por partida 6 → 30. Muertes repartidas; 6 semillas dan mucho ruido.
- ✅ Cofre especial: con 500 cupones ya recogidos en la partida, las tiradas siguientes dan entre 50 y 200 (`CACHE_ROLL.capAfter`/`capped`).
- ✅ Jefes en los minutos 2, 4 y 6 (`bosses.*.at`); los respiros se mueven con ellos y el resto de tramos de oleada conserva su orden.
- ✅ 30 % menos de experiencia por baja (`XP.killMult` 3,125 → 2,1875).
- Efecto en balance de estos tres (bot «kite», build propia): media 361 → 214 s; Dot 166 s (0/6), Gus 224 s (0/6), Benny 253 s (1/6). Nivel medio al acabar 26 → 13. El Rey Rata en el minuto 2 mata 4 de 18 partidas. Pendiente de la prueba del usuario.
- ✅ Pausa: armas en fichas grandes con daño y DPS desde que se consiguieron; al pulsar una, con qué se combina.
- ✅ Expedición y Supervivientes en una pantalla (retrato grande + cuadrícula de retratos) y ficha del personaje: nivel y su bonificación, estrellas y su bonificación, pasiva, arma inicial y su árbol.
- ✅ Árbol por personaje pagado con sus chapas (las fichas de los duplicados de las cajas); el de cuenta desaparece y devuelve sus cupones. Mods nuevos: arma inicial, cuerpo a cuerpo y duración de consumibles.
- ✅ Suministros pasa al menú principal; Intendencia queda con taller, mercader y mochila.
- ✅ Ficha: botón «i» en Nivel, Estrellas y Arma inicial con ventana de lo que da cada uno; arma inicial centrada.
- ✅ Taller dentro de la ficha (pestañas Ficha · Taller · Árbol): mejoras de cupones, implante y arsenal (aprender y elegir armas iniciales). Intendencia queda en una pantalla de consumibles (comprar packs; mochila y lo que se lleva a la expedición en la misma ficha). Desaparece el mercader con rotación diaria.
- ✅ Pasillo de embestida sin aspecto de depuración: franja de tierra difuminada, brillo rojo que avanza con la carga y galones que marchan hacia donde irá (`FX_ART.lane`).
- ✅ Botón de pantalla completa en el menú principal y en Ajustes (`src/app/fullscreen.tsx`). Oculto si el juego está instalado; en iPhone, Ajustes explica cómo añadirlo a la pantalla de inicio.
- ✅ HUD de la run a escala de la pantalla del juego (`--u` en `run.css`): compacto en móvil y grande en PC. Armas, objetos y consumibles en una tira abajo al centro, sin panel. PV/RAD ya no pisa el nivel. Botón de test del Coloso oculto (`TEST_PHASE = false`).
- ✅ Saltar la intro ya no pulsa el menú de debajo (toque y teclado). En PC, PV/RAD, nivel y radar crecen menos que el resto (`--u-top`, `--u-radar`); en móvil no cambian.
- ✅ En táctil, la tira de armas y equipo va abajo a la derecha, y los consumibles se usan con un segundo dedo mientras el otro mueve el joystick.
- ✅ Mapa: dos edificios nunca salen juntos (`PROPS.buildingGap`, un bloque libre entre ellos) y alrededor de cada uno queda una casilla sin objetos ni ácido (`PROPS.clearance`). Las zonas de objetivo buscan un sitio despejado. Cofres y cajas siempre a la vista: las del supermercado, de la derecha a la esquina delantera; los que caerían detrás del edificio pasan a su cara visible (`chestSpot`).
- ✅ En táctil, los botones de consumibles miden 50 px como mínimo (antes 37 en móvil).
- ✅ Árboles personalizados: Radiación (igual para todos, con los caminos Plomo y Mutación), Pasiva y Oficio de cada personaje y 6 nodos mixtos, 28 nodos en total. 15 puntos: 1 por estrella y 1 cada 3 niveles. Cada nodo cuesta 1 punto y se recolocan gratis. Las chapas gastadas en el árbol viejo se devuelven (guardado v4). Los 18 efectos nuevos tienen icono propio en `assets/icons/tree/`; los 8 efectos antiguos y las 6 mejoras del Taller siguen con iconos prestados.
- ✅ Destrozos del mapa (`engine/scars.ts`): cada impacto del mortero rompe el suelo y deja escombros; lluvia de chatarra y lluvia de ácido (`systems/rains.ts`, `tuning.json` → `rains`, atajo N), a las 0:30, 2:40 y 5:10 aunque haya jefe y luego cada 100–140 s, por turnos. El ácido deja lagos con las baldosas de siempre. Arte propio desde 2026-11-04.
- ✅ Con un jefe vivo las oleadas siguen al 50 % de su ritmo (`bossRateMult`); antes se paraban del todo. Primer élite a los 40 s.
- ✅ Lluvias de 15 s; la de ácido cae cada 0,4 s en un radio de 800 (unos 37 lagos) y solo el 10 % busca al jugador (`aimChance`, la chatarra sigue en 25 %). El rastro de babosa dura 60 s (`trailEvery` 0,8 y `maxSlime` 500 para aguantarlo). El hinchado deja 4 losetas de ácido juntas (`acidCells`). Las bombas del dirigible dejan escombros. Los esbirros del rey rata salen alrededor del jugador (`summonDist` 300).
- ✅ Arte de destrozos y efectos (`tools/slice_destrozos.py`, hojas en `ARTE/`): 3 baldosas de suelo roto, 4 montones de escombros (tierra y asfalto para obús y dirigible, chatarra para la lluvia), chatarra, gota y obús cayendo, polvo del impacto de chatarra, perdigón, explosiones de bomba y crio-granada, y auras del Geiger y del Núcleo inestable. Pendientes: 15 iconos (árbol, Taller e hinchado) y sprites de interceptor y mortero.

## Bugs conocidos

- `tests/alloc.test.ts` › «combate sin GC: llave, pistola_clavos, escopeta_chatarra, tesla» ya fallaba en `main` (f606252; tras los cambios del 2026-11-03 pasa, pero puede volver): `updateEnemies` corre desoptimizado («insufficient type feedback») y reserva números. En T14 se arreglaron otras causas (campos que nacían enteros, `hitAt` opcional, jefes por bajas en la prueba) y la combinación «martillo_pilon…» vuelve a pasar. 2026-11-04: ha vuelto con los escombros del mortero, pero no los causan: medidos 3 000 ticks con 1 000 enemigos vivos, salen los mismos GC (unos 12) y los mismos ms/tick con y sin destrozos. La multitud reserva memoria siempre; el test parece pasar solo cuando parte de la medida cae con la multitud ya muerta o la partida parada en una elección de objeto, y los destrozos cambian ese momento. Hay que arreglar `updateEnemies`, no el test.
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

Probar jugando (`npm run dev`, depurador F1) mortero, cercos y furia.
