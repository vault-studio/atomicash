# Decisiones de arquitectura

Una línea por decisión, con su motivo. No reabrir las ya registradas.

- 2026-11-03 · Los valores de balance pasan a `src/data/tuning.json` y los `src/config/*.ts` lo importan aportando tipos e IDs · el JSON exportado desde el depurador puede sustituir tal cual a los valores por defecto, sin traducirlo a TS.
- 2026-11-03 · El depurador modifica en sitio los mismos objetos de configuración que ya importan los sistemas · evita refactorizar todos los consumidores; los cambios valen desde la siguiente partida (reinicio instantáneo).
- 2026-11-03 · Depurador como superposición React sobre la partida, cargada solo con `import.meta.env.DEV` · reutiliza la sesión de run y sus atajos; no llega al build de producción.
- 2026-11-03 · «Guardar como valores por defecto» escribe `src/data/tuning.json` mediante un middleware de Vite solo en dev, además de descargar/importar JSON · sin paso manual de copiar archivos.
- 2026-11-03 · Validación de balance y refactors con simulación sin navegador y semilla fija (Vitest) · el motor ya es determinista y puro; un refactor de datos debe dar resultados idénticos.
- 2026-11-03 · Smoke test con Playwright sobre el servidor de desarrollo, arrancando la partida por parámetros de URL · es lo único que comprueba render, consola y captura; Chromium ya está en la caché local.
- 2026-11-03 · Lógica nueva en funciones puras pequeñas (blindaje, aturdimiento, límite por tipo, predicción, carga de datos) · se testean sin montar un mundo.
- 2026-11-03 · Enemigos nuevos sin sprite: placeholder procedural en `render/placeholders.ts`, elegido por el render según el ID · el motor no sabe si hay sprite.
- 2026-11-03 · No se consultó a un subagente `opus` para la arquitectura · el director ya es Opus; la consulta duplicaría el contexto sin aportar.
- 2026-11-03 · Plantel de esta rama: Dot, Gus y Benny, no Dot, Mae y El Errante como dice CAMBIOS.md · decisión del usuario; son los que tienen sprites.
- 2026-11-03 · Babosa, Reptador e Hinchado se quedan en el Acto 1 como mutantes · decisión del usuario; se revisará al añadir actos.
