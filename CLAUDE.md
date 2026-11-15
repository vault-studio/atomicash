# Atomic Ash — guía para agentes

## 1. Qué es

Survivor-like isométrico post-nuclear (estilo Fallout 1/2, IP original: `MDS/AGENTS.md` §1). Autoataque y movimiento
libre. Package `com.vaultstudio.atomicash`. TypeScript strict + Vite + React 18 (menús) + PixiJS 8 (render) + Zustand +
i18next (ES/EN) + Vitest.

**Fase:** contenido y pulido sobre un juego ya completo (3 personajes, campaña de 3 actos, búnker, online apagado).
**No hacer en esta fase:**

- Ampliar el alcance sin consultar. Solo hay 3 personajes: Dot, Gus y Benny (`ROSTER`).
- Cambiar la campaña de 3 actos: «Las Afueras», «Las Heladas» y «La Espesura». Cada acto termina al matar a su jefe, que sale en el minuto 2. El Coloso gana la partida.
- Usar enemigos de otro acto. Cada acto lleva solo los suyos, salvo los eventos especiales.
- Inventar tipos de enemigo nuevos. Los nuevos deben ser humanoides o robots. Los mutantes que ya existen se quedan en el Acto 1.
- Tocar el arte existente o generar arte nuevo. Si un enemigo no tiene sprite, usar un placeholder simple y distinguible.

## 2. Regla de oro

Cada conversación trabaja en UN área. Busca la tuya en la tabla, lee solo esos archivos y no explores el resto. Si de
verdad necesitas otro archivo, lee solo la parte que haga falta.

## 3. Áreas

Las carpetas con `index.ts` se importan desde fuera solo por su índice. Los valores de balance viven en `src/data/tuning.json`: lee solo la sección que toca.

| Área (cómo pedirlo)                                                          | Leer                                                                                                                                                                                         | No tocar                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Enemigos** (IA, jefes, furia, disparos)                                    | `src/engine/systems/enemies/` (think, roles, bosses, rage, shooters…), `src/config/enemies/`, `tuning.json` › `enemies`/`ai`/`rage`/`elites`                                                 | render, UI                                            |
| **Armas** (disparo, auras, fusiones)                                         | `src/engine/systems/weapons/`, `src/config/weapons.ts`, `tuning.json` › `weapons`                                                                                                            | enemigos, render                                      |
| **Combate** (golpes, daño, muertes, botín)                                   | `src/engine/systems/combat/`, `src/engine/rules.ts`, `src/engine/stats.ts`                                                                                                                   | armas, IA                                             |
| **Tarjetas** (subir de nivel, rasgos, objetos)                               | `src/engine/systems/progression/`, `src/config/traits.ts`, `src/config/items.ts`, `src/app/screens/run/Cards.tsx`, `src/app/cardText.ts`                                                     | árbol del búnker                                      |
| **Oleadas y campaña** (aparición, hordas, cercos, actos)                     | `src/engine/systems/spawning/`, `src/engine/systems/campaign.ts`, `src/engine/encircle.ts`, `src/config/waves.ts`, `src/config/acts.ts`, `tuning.json` › `waves`/`spawn`/`hordes`/`campaign` | IA de enemigos                                        |
| **Eventos y modos** (espejo, lluvias, barriles, objetivos, infinito, diario) | `src/engine/systems/{mirror,rains,modes}.ts`, `src/config/modes.ts`, `src/meta/daily.ts`, `tuning.json` › `events`/`rains`/`mirror`, `docs/EVENTOS.md`                                       | resto del motor                                       |
| **Mapa** (obstáculos, charcos, destrozos, props)                             | `src/engine/obstacles/`, `src/engine/{hazards,scars,spatialHash}.ts`, `src/config/props.ts`                                                                                                  | render del suelo                                      |
| **Jugador y mundo** (crear partida, tick, radiación)                         | `src/engine/world/`, `src/engine/types/`, `src/config/{survivors,radiation,run}.ts`                                                                                                          | sistemas concretos                                    |
| **Render** (cámara, actores, cinemáticas, suelo)                             | `src/render/renderer/`, `src/render/{actor,enemyLayer,sprites,placeholders,iso}.ts`, `src/render/ground/`, `src/render/wreck/`, `src/config/render/`                                         | `src/engine/`                                         |
| **Efectos** (charcos, explosiones, textos flotantes)                         | `src/render/fx/`, `src/render/fxSprites.ts`, `src/engine/fx.ts`, `src/config/render/fx.ts`                                                                                                   | lógica del motor                                      |
| **HUD y partida** (HUD, radar, pausa, mapa, resultados)                      | `src/app/screens/run/`, `src/app/screens/RunScreen.tsx`, `src/app/runSession/`, `src/app/styles/run/`                                                                                        | motor, búnker                                         |
| **Búnker** (pantallas, tiendas, ficha, ajustes)                              | `src/app/screens/bunker/` (sin `tree/`), `src/app/styles/bunker/`, `src/meta/actions/`                                                                                                       | partida                                               |
| **Árbol** (árbol de cada superviviente)                                      | `src/app/screens/bunker/Tree.tsx`, `src/app/screens/bunker/tree/`, `src/config/tree/`, `src/meta/actions/tree.ts`, `src/app/styles/bunker/tree*.css`                                         | resto del búnker                                      |
| **Progreso y guardado** (colección, misiones, recompensas, guardado)         | `src/meta/`, `src/config/meta.ts`, `src/store/save.ts`                                                                                                                                       | UI                                                    |
| **Online** (cuentas, nube, ranking)                                          | `src/online/`, `src/store/online.ts`, `src/app/screens/bunker/{Online,Leaderboard,SaveConflictDialog}.tsx`, `supabase/`, `docs/ONLINE.md`                                                    | motor                                                 |
| **Audio** (mezcla, efectos, música)                                          | `src/audio/`, `src/config/audio.ts`, `src/app/runSession/sound.ts`, `src/engine/sfx.ts`                                                                                                      | `assets/audio/` (generado por `tools/build_audio.py`) |
| **Intro y carga**                                                            | `src/app/screens/Intro.tsx`, `src/app/screens/intro/`, `src/app/screens/ExpeditionLoader.tsx`, `src/app/screens/loader/`, `src/app/styles/{intro,loader}/`                                   | resto de la UI                                        |
| **Depurador** (panel F1, atajos)                                             | `src/app/debug/`, `tools/devTuning.ts`                                                                                                                                                       | motor, salvo para leerlo                              |
| **Editor de eventos** (editor.html, solo dev)                                | `src/editor/`, `src/config/events.ts`, `tools/devEvents.ts`, `src/data/events/`, `editor.html`                                                                                               | `src/engine/`, el juego, `assets/`                    |
| **Balance** (números, simulación)                                            | `src/data/tuning.json`, `src/config/tuning.ts`, `tests/sim/`, `tools/simdiff.mjs`, `docs/BALANCE.md`                                                                                         | lógica                                                |
| **Arte** (importar sprites, tiles y efectos)                                 | `tools/*.py`, `tools/artAssets.ts`, `src/config/entities.ts`, `src/config/render/{sprites,art}.ts`                                                                                           | `assets/` a mano, `ARTE/`                             |
| **Textos**                                                                   | `src/i18n/{es,en}.json` (busca la clave con grep, no los leas enteros)                                                                                                                       | —                                                     |

Los tests están en `tests/<tema>.test.ts`. Lee solo el del área.

## 4. Recetas rápidas

- **Valor de balance:** cambiarlo en `src/data/tuning.json`. Si es nuevo, añadir su tipo en `src/config/tuning.ts` y quitar el número del motor.
- **Enemigo nuevo:**
  - Datos en `tuning.json` › `enemies` y su ID en `src/config/enemies/`.
  - Comportamiento en `engine/systems/enemies/roles.ts`, o en `bosses.ts` si es un jefe.
  - Placeholder en `src/render/placeholders.ts`.
  - Textos en i18n y un test.
- **Arma nueva:**
  - Datos en `src/config/weapons.ts` y `tuning.json`.
  - La función `fireX` en `engine/systems/weapons/` y su entrada en el despacho de `fire.ts`.
  - Textos en i18n y un test.
- **Evento especial:** seguir la plantilla de `docs/EVENTOS.md`, con `mirror.ts` como referencia.
- **Texto visible:** siempre en `src/i18n/es.json` y `en.json`. El depurador está exento.
- **Estilos:** en `src/app/styles/<pantalla>/`. Un archivo nuevo se importa en `src/app/styles/index.ts`, y el orden importa.
- **Probar en el juego:** `npm run dev` y abrir `/?dev&char=dot&act=1&seed=1&god=1&bot=kite&speed=2&weapons=llave:3` (F1 abre el panel).
  - Atajos: K morir, J 100 enemigos, L subir nivel, G invencible, B jefe, T +60 s.
  - Más atajos: E élite, H horda, N lluvia, M espejo, Y siguiente acto, F3 debug del render.

## 5. Arquitectura

- **Capas:**
  - `src/engine/` y `src/config/` son TS puro, sin React, DOM ni Pixi.
  - `src/render/` (Pixi) lee el motor; `src/app/` (React) lo orquesta.
  - El motor nunca importa `render/`, `app/` ni `input/`. eslint lo comprueba: desde el motor, importa `config/render` por su índice.
- **Motor:**
  - `createWorld(charId, seed, opts)` y `tick(world, input, dt)` (`src/engine/world/`) son deterministas con semilla (`engine/rng.ts`). Se puede simular sin navegador.
  - Lógica separada del render: cambiar un placeholder por un sprite no toca `src/engine/`.
- **Reglas del motor:**
  - Nada de números sueltos: todo va en `tuning.json`.
  - No sustituir `Math.hypot` por `Math.sqrt(x*x + y*y)`. Cambia partidas enteras y `npm run sim` no lo detecta.
  - El bucle de combate no reserva memoria (`tests/alloc.test.ts`): los decimales van en `decimalFields` (`engine/pool.ts`) y no se pasan decimales como argumento en caminos calientes.
- **Tamaño:**
  - Límite de ~200 líneas por archivo.
  - Si un archivo crece, se divide en una carpeta con `index.ts` que mantiene la API, y se actualiza la tabla de áreas.
  - No se dividen `tuning.json` ni los i18n.
  - Siguen por encima del límite y conviene dividirlos al tocarlos: `render/renderer/gameRenderer.ts`, `Tree.tsx`, `runSession/startRun.ts`, `RunScreen.tsx` y `render/ground/view.ts`.
- **Decisiones de arquitectura:** están en `docs/DECISIONS.md`. No reabrirlas.

## 6. Comandos

- **Desarrollo:** `npm run dev` (puerto 5173; en el panel de vista previa, `atomicash-dev`). Editor de eventos: `/editor.html`.
- **Tests:** `npm test`. Tipos: `npm run typecheck`. Lint y formato: `npm run lint`. Build: `npm run build`.
- **Simulación:** `npm run sim` (semilla fija, 600 s; referencia en `tests/sim/__snapshots__`).
- **Smoke:** `npm run smoke` (60 s con piloto automático; captura en `out/smoke.png`).
- **Balance:**
  - `npm run balance` y después `node tools/simdiff.mjs out/balance`.
  - Para comparar: `node tools/simdiff.mjs <antes> <después>`.
  - Con 6 semillas hay mucho ruido.
- **Deploy:** cada push a `main` se publica en https://atomicash.vercel.app (`docs/DEPLOY.md`).
- **Git:**
  - Rama única `main`. Un commit local por tarea.
  - Push solo con aprobación del usuario y después de probarlo.
  - Un cambio grande va en una rama temporal, que se borra al fusionarla.
- **Agentes:**
  - Trabajar directamente por defecto. Agentes de `.claude/agents/` solo para tareas grandes que encajen claramente con uno, avisando antes.
  - Modelo: `haiku` para tareas mecánicas, `sonnet` para gameplay, UI y depuración, `opus` solo para arquitectura multisistema.
  - El encargo lleva objetivo, archivos, criterios y pruebas. El informe del agente, ≤10 líneas.
  - Agentes en paralelo solo si el usuario lo pide.
- **Verificación:**
  - Una tarea solo está terminada cuando se han visto pasar sus pruebas.
  - Balance y comportamientos: semilla fija y comparar estadísticas antes y después.
  - Si algo falla dos veces, analizar la causa o escalar de modelo.
  - Ante una ambigüedad que obligue a rehacer algo importante, parar y preguntar.

## 7. Documentos

- `TASKS.md`: tareas pendientes. Leerlo al empezar la sesión, junto con `git status` y `git log --oneline -10`.
- `DONE.md`: historial de lo hecho. Leerlo solo si hace falta contexto de una tarea antigua.
  - Al terminar una tarea: una línea en `DONE.md` y quitarla de `TASKS.md`.
  - Antes de `/clear` o `/compact`: `TASKS.md` al día y commit.
- `docs/CAMBIOS.md`: roadmap y fuente de verdad. No reescribirlo, solo marcar los apartados hechos. Leer solo el apartado de la tarea.
- `docs/DECISIONS.md`: decisiones de arquitectura (no reabrirlas).
- Otros documentos de `docs/`:
  - `docs/BALANCE.md`: informe de balance.
  - `docs/EVENTOS.md`: plantilla de eventos.
  - `docs/ONLINE.md`: Supabase.
  - `docs/DEPLOY.md`: Vercel y PWA.
  - `docs/archivo/`: el prototipo original, solo como referencia.
- `MDS/`: diseño original (visión, gameplay, contenido, arte/UI, técnica). Leer solo el apartado citado.
- Arte nuevo: no llega solo a `Apps/galeria-assets`, hay que copiarlo allí a mano.
