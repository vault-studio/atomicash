# Atomic Ash — guía para agentes

Survivor-like isométrico post-nuclear (estilo Fallout 1/2, IP original: ver `MDS/AGENTS.md` §1). Autoataque y
movimiento libre. Package `com.vaultstudio.atomicash`.

## Alcance cerrado (no ampliar sin consultar)

- 3 personajes: Dot, Gus y Benny (`ROSTER`).
- Campaña de 3 actos en una partida: «Las Afueras», «Las Heladas» y «La Espesura» (`src/config/acts.ts`, `engine/systems/campaign.ts`). Cada acto acaba al matar a su jefe, que sale en su minuto 2; el Coloso gana la partida. Solo enemigos de su acto (`waves` y `campaign` en `tuning.json`), salvo eventos especiales.
- Enemigos y jefes: humanoides, robots/máquinas o mutantes ya existentes (babosa, reptador, hinchado; se quedan en el Acto 1). Nuevos: humanoides o robots.
- Roadmap y fuente de verdad: `docs/CAMBIOS.md` (no reescribirlo; solo marcar apartados hechos).
- Tareas pendientes: `TASKS.md`. Historial de lo hecho: `DONE.md` (no leerlo salvo que haga falta contexto de una tarea antigua). Decisiones de arquitectura: `docs/DECISIONS.md` (no reabrirlas).

## Stack y estructura

- TypeScript strict + Vite + React 18 (menús) + PixiJS 8 (render) + Zustand + i18next (ES/EN). Tests: Vitest.
- `src/engine/` y `src/config/`: TS puro, sin React/DOM/Pixi. El render lee el motor, nunca al revés.
- `src/engine/world.ts`: `createWorld(charId, seed, opts)` y `tick(world, input, dt)`. Determinista con semilla
  (`engine/rng.ts`); se puede simular sin navegador.
- Sistemas en `engine/systems/` (enemies, spawning, weapons, combat, progression, modes, campaign, rains, mirror…).
- Render: `src/render/` (placeholders en `render/placeholders.ts`). Sesión de run: `src/app/runSession.ts`.
- Textos visibles siempre en `src/i18n/{es,en}.json` (el depurador está exento: solo existe en desarrollo).

## Reglas del motor

- Nada de números sueltos en el motor: todo en `tuning.json`.
- No sustituir `Math.hypot` por `Math.sqrt(x*x + y*y)`: difiere en el último bit y cambia partidas enteras; `npm run sim` no lo detecta.
- Bucle de combate sin reservar memoria (`tests/alloc.test.ts`): campos decimales declarados en `decimalFields` (`engine/pool.ts`), sin decimales como argumento en caminos calientes.

## Datos de balance

- Archivo de datos: `src/data/tuning.json` (personajes, enemigos, IA, furia, armas, oleadas, cercos).
- Los módulos `src/config/*.ts` lo leen y aportan tipos e IDs.
- En desarrollo, el depurador modifica esos objetos en sitio; los cambios se aplican al reiniciar la partida.

## Arte

- No tocar el arte existente ni generar arte nuevo. Enemigo sin sprite → placeholder simple y distinguible.
- Lógica separada del render: cambiar un placeholder por un sprite no debe tocar `src/engine/`.
- El arte nuevo no llega solo a `Apps/galeria-assets`: hay que copiarlo allí.

## Comandos

- Desarrollo: `npm run dev` (puerto 5173; en el panel de vista previa: `atomicash-dev`).
- Tests: `npm test` · tipos: `npm run typecheck` · lint: `npm run lint` · build: `npm run build`.
- Simulación con semilla fija: `npm run sim` (bot por personaje, 600 s; JSON en `out/sim/`; referencia en `tests/sim/__snapshots__`).
- Barrido de balance: `npm run balance` (personajes × builds × bots × 6 semillas, `out/balance/summary.csv`); resumen
  `node tools/simdiff.mjs out/balance`, comparación `node tools/simdiff.mjs <antes> <después>`. Con 6 semillas hay mucho ruido.
- Smoke test: `npm run smoke` (60 s de partida con piloto automático, errores de consola, captura en `out/smoke.png`).
- Depurador: `npm run dev` y abrir `/?dev&char=dot&act=1&seed=1&god=1&bot=kite&speed=2&weapons=llave:3` (F1 panel). Atajos (DEV):
  K morir, J 100 enemigos, L subir nivel, G invencible, B jefe, T +60 s, E élite, H horda, N lluvia, M evento espejo, Y siguiente acto, F3 debug del render.

## Git

- Rama única: `main`. Cada push a `main` se publica en https://atomicash.vercel.app.
- Un commit por tarea terminada, en local. Push solo con aprobación del usuario, después de probarlo.
- Cambio grande o arriesgado → rama temporal, que se borra al fusionarla.
- Al terminar una tarea: una línea breve en `DONE.md` y quitarla de `TASKS.md`.
- Antes de `/clear` o `/compact`: TASKS.md al día y commit.

## Agentes y modelos

- Trabajar directamente por defecto. Agentes de `.claude/agents/` solo para tareas grandes que encajen claramente con uno; avisar antes de lanzarlo. No crear agentes nuevos sin preguntar.
- Modelo más barato capaz: `haiku` (búsquedas, tareas mecánicas bien especificadas, QA simple), `sonnet`
  (comportamientos enemigos, armas, blindaje, panel del depurador, depuración), `opus` (solo arquitectura
  multisistema o bugs donde Sonnet falló dos veces). Cada agente con `model:` en su frontmatter.
- Encargo = objetivo, archivos a leer, archivos que puede modificar, criterios de aceptación y pruebas. Nada de
  historial ni documentos enteros: rutas y el apartado de CAMBIOS.md que toca.
- Informe ≤ 10 líneas: qué cambió, archivos, resultado de pruebas, pendientes. Sin pegar código.
- Al revisar trabajo de un agente: el diff y el resultado de las pruebas, no releer archivos enteros.
- Ambigüedad que pueda obligar a reescribir algo importante → parar y preguntar.
- Agentes en paralelo solo si el usuario lo pide, con tareas independientes, cada una en su rama.

## Verificación

- Una tarea solo está terminada cuando se han visto pasar sus pruebas.
- Balance y comportamientos: semilla fija y comparar estadísticas exportadas antes/después.
- Si algo falla dos veces, analizar la causa o escalar de modelo; no probar una tercera variación menor.
- Al empezar sesión: leer TASKS.md, `git status` y `git log --oneline -10`, comprobar la última tarea.
