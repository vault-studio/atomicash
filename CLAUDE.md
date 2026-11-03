# Atomic Ash — guía para agentes

Survivor-like isométrico post-nuclear (estilo Fallout 1/2, IP original: ver `MDS/AGENTS.md` §1). Autoataque y
movimiento libre. Package `com.vaultstudio.atomicash`.

## Alcance cerrado (no ampliar sin consultar)

- 3 personajes: Dot, Mae, El Errante. Solo el Acto 1, «Las Afueras».
- Enemigos y jefes: solo humanoides o robots/máquinas.
- Roadmap y fuente de verdad: `docs/CAMBIOS.md` (no reescribirlo; solo marcar apartados hechos).
- Estado real de las tareas: `TASKS.md`. Decisiones de arquitectura: `docs/DECISIONS.md` (no reabrirlas).

## Stack y estructura

- TypeScript strict + Vite + React 18 (menús) + PixiJS 8 (render) + Zustand + i18next (ES/EN). Tests: Vitest.
- `src/engine/` y `src/config/`: TS puro, sin React/DOM/Pixi. El render lee el motor, nunca al revés.
- `src/engine/world.ts`: `createWorld(charId, seed, opts)` y `tick(world, input, dt)`. Determinista con semilla
  (`engine/rng.ts`); se puede simular sin navegador.
- Sistemas: `engine/systems/{enemies,spawning,weapons,combat,progression,modes}.ts`.
- Render: `src/render/` (placeholders en `render/placeholders.ts`). Sesión de run: `src/app/runSession.ts`.
- Textos visibles siempre en `src/i18n/{es,en}.json` (el depurador está exento: solo existe en desarrollo).

## Datos de balance

- Archivo de datos: `src/data/tuning.json` (personajes, enemigos, IA, furia, armas, oleadas, cercos).
- Los módulos `src/config/*.ts` lo leen y aportan tipos e IDs. Nada de números sueltos en el motor.
- En desarrollo, el depurador modifica esos objetos en sitio; los cambios se aplican al reiniciar la partida.

## Arte

- No tocar el arte existente ni generar arte nuevo. Enemigo sin sprite → placeholder simple y distinguible.
- Lógica separada del render: cambiar un placeholder por un sprite no debe tocar `src/engine/`.

## Comandos

- Desarrollo: `npm run dev` (puerto 5173; en el panel de vista previa: `atomicash-dev`).
- Tests: `npm test` · tipos: `npm run typecheck` · lint: `npm run lint` · build: `npm run build`.
- Simulación con semilla fija: `npm run sim` (pendiente de T0; exporta estadísticas a `out/`).
- Smoke test: `npm run smoke` (pendiente de T3; 60 s de partida, errores de consola y captura).
- Depurador: solo `import.meta.env.DEV`; tecla F1 (pendiente de T2). Atajos ya existentes en partida (DEV):
  K morir, J 100 enemigos, L subir nivel, G invencible, B jefe, T +60 s, E élite, H horda, F3 debug del render.

## Git

- Trabajar en `cambios-jugabilidad`. No tocar `main` sin aprobación. Un commit por tarea terminada.
- Antes de `/clear` o `/compact`: TASKS.md al día y commit.

## Agentes y modelos

- Agentes en `.claude/agents/`. Se crean solo cuando una tarea lo justifica y se reutilizan.
- Modelo más barato capaz: `haiku` (búsquedas, tareas mecánicas bien especificadas, QA simple), `sonnet`
  (comportamientos enemigos, armas, blindaje, panel del depurador, depuración), `opus` (solo arquitectura
  multisistema o bugs donde Sonnet falló dos veces).
- Encargo = objetivo, archivos a leer, archivos que puede modificar, criterios de aceptación y pruebas. Nada de
  historial ni documentos enteros: rutas y el apartado de CAMBIOS.md que toca.
- Informe ≤ 10 líneas: qué cambió, archivos, resultado de pruebas, pendientes. Sin pegar código.
- Ambigüedad que pueda obligar a reescribir algo importante → parar y preguntar.
- Sin agentes en paralelo salvo tareas independientes, cada una en su rama.

## Verificación

- Una tarea solo está terminada cuando el director ha visto pasar sus pruebas.
- Balance y comportamientos: semilla fija y comparar estadísticas exportadas antes/después.
- Si algo falla dos veces, analizar la causa o escalar de modelo; no probar una tercera variación menor.
- Al empezar sesión: leer este archivo y TASKS.md, `git status` y `git log`, comprobar la última tarea.
