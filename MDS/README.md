# ATOMIC ASH — Paquete de especificaciones

> Título provisional. Package ID: `com.vaultstudio.atomicash`
> Survivor-like de hordas (estilo Survivor.io / Vampire Survivors / PokéSurvivor) con estética retrofuturista atómica de los años 50 en un páramo post-nuclear. Web primero (PC + móvil en horizontal), Android después.

## Orden de lectura para los agentes

| # | Archivo | Para qué sirve |
|---|---------|----------------|
| 0 | `AGENTS.md` | Reglas obligatorias para cualquier agente que toque el código. **Leer siempre primero.** |
| 1 | `01_VISION.md` | Concepto, pilares, alcance y lo que NO es el juego. |
| 2 | `02_GAMEPLAY.md` | Bucle de juego, controles, combate, subidas de nivel, meta-progresión y economía. |
| 3 | `03_CONTENT.md` | Contenido inicial con números: personajes, armas, fusiones, enemigos, jefes, zonas, objetos. |
| 4 | `04_ART_UI.md` | Dirección de arte, paleta, tipografías, pantallas, HUD y audio. |
| 5 | `05_TECH.md` | Stack, arquitectura, estructura de carpetas, modelo de datos, rendimiento y guardado. |
| 6 | `06_ROADMAP.md` | Fases de trabajo en tareas cerradas, con criterios de aceptación. |

## Cómo repartir el trabajo entre agentes

- **Agente Motor**: `05_TECH.md` §Motor + `02_GAMEPLAY.md` §Combate. Fase 1.
- **Agente Contenido**: `03_CONTENT.md` → archivos de `src/config/`. Fase 1–2.
- **Agente UI**: `04_ART_UI.md` + pantallas de menú. Fase 2.
- **Agente Meta/Persistencia**: colección, mejoras, tienda, cajas, guardado. Fase 3.
- **Agente Online** (más adelante): cuentas, ranking, cooperativo. Fase 4–5.

Cada agente trabaja solo sobre su fase y entrega cumpliendo los criterios de aceptación de `06_ROADMAP.md`. Si dos documentos se contradicen, manda este orden: `AGENTS.md` > `05_TECH.md` > `02_GAMEPLAY.md` > resto.
