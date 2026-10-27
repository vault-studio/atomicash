# 06 — Roadmap por fases

Cada tarea tiene un id para referenciarla en ramas y PRs (`feat/F1-03-spatial-hash`).

## Fase 1 — Núcleo jugable con formas primitivas

| id | Tarea | Criterio de aceptación |
|---|---|---|
| F1-01 | Proyecto Vite + React + TS strict + ESLint + Prettier + Vitest + i18n ES/EN | `npm run dev/typecheck/lint/test` funcionan sin errores |
| F1-02 | Bucle de paso fijo + `World` + render Pixi de placeholders | Triángulo del jugador visible, 60 FPS estables |
| F1-03 | Input teclado + joystick táctil + aviso de orientación vertical | Se mueve en PC y en móvil horizontal; en vertical sale el aviso |
| F1-04 | Spatial hash + pooling | Test: 1 000 entidades sin allocations por frame |
| F1-05 | Spawning por oleadas desde `config/waves.ts` | Enemigos aparecen fuera de cámara según el minuto |
| F1-06 | 4 armas (`wrench`, `nailgun`, `molotov`, `tesla`) + daño + muerte + drops | Matan enemigos, sueltan chatarra |
| F1-07 | XP, subida de nivel con 3 tarjetas + reroll | Pausa el juego, teclas 1/2/3/R funcionan |
| F1-08 | HUD básico (PV, XP, tiempo, armas) | Se ve correcto a 1280×720 y en móvil |
| F1-09 | Muerte → pantalla de resultados → volver a jugar | Ciclo completo sin recargar la página |

**Hito:** una run de 15 min jugable y divertida con formas.

## Fase 2 — Contenido completo de la zona 1 y arte

| id | Tarea | Criterio |
|---|---|---|
| F2-01 | Las 12 armas y sus niveles | Todas configurables y testeadas |
| F2-02 | 4 fusiones + pantalla de Apaño | Aparece al tener ambas armas a nv.5 |
| F2-03 | 10 enemigos + variante irradiada | Comportamientos de la tabla |
| F2-04 | Sistema de RADS completo | Tramos y efectos según `02_GAMEPLAY.md` |
| F2-05 | 2 minijefes + jefe final con fases + Tormenta | Victoria al matar al jefe |
| F2-06 | Objetos y consumibles en la run | Hueco único de objeto con elección |
| F2-07 | Eventos aleatorios | 1 cada ~3 min |
| F2-08 | Sprites, atlas, tipografías, paleta, filtro CRT | Sustituyen a placeholders; CRT desactivable |
| F2-09 | Audio y ajustes de volumen | Música y SFX separados |

## Fase 3 — Meta-progresión (MVP completo)

| id | Tarea | Criterio |
|---|---|---|
| F3-01 | Stores persistidos + migraciones + exportar/importar | Recargar página conserva todo |
| F3-02 | Perfil psicológico + elección de inicial | Solo en primera partida; "Elegir otro" funciona |
| F3-03 | Colección de supervivientes, niveles, estrellas, irradiados | Fichas por duplicado |
| F3-04 | Taller: mejoras por personaje | Solo aplican al personaje correspondiente |
| F3-05 | Mercader con rotación diaria | Implantes y manuales funcionan |
| F3-06 | Cajas de suministros con probabilidades visibles y garantía | Tests estadísticos pasan |
| F3-07 | Misiones diarias y logros | Se reinician a medianoche local |
| F3-08 | Ajustes completos + accesibilidad | Reducir movimiento, sin números de daño, CRT off |
| F3-09 | Deploy en Vercel + PWA (instalable, offline) | Lighthouse PWA en verde |

**Hito:** MVP publicable en web.

## Fase 4 — Cuentas y ranking

Supabase Auth (invitado → Google), guardado en la nube, ranking de tiempo y de daño al jefe, apodos y moderación básica (reportes, ocultar entradas).

## Fase 5 — Cooperativo hasta 4

Salas con código, amigos, WebRTC con anfitrión autoritativo, fallback por servidor si falla la conexión directa.

## Fase 6 — Android

Empaquetado con Capacitor, controles táctiles pulidos, guardado sincronizado, ficha de Play Store bajo Vault Studio.

## Fase 7+ — Contenido

Zonas 2–9, nuevos supervivientes, armas y fusiones, dificultad Difícil/Pesadilla, eventos de temporada.
