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
- 2026-11-03 · Blindaje plano por impacto tras el crítico (`applyArmor`), con `armorPierce` por arma y un mínimo global `armor.minFrac` · sustituye al multiplicador: los golpes pequeños rinden mal contra blindados.
- 2026-11-03 · Especialización de armas como dato (`spec`) y control genérico por arma (`slow`, `interrupt`) aplicado en `hitEnemy` · un solo sitio y editable en el depurador; los jefes no se ralentizan ni se interrumpen.
- 2026-11-03 · Un enemigo recibe como mucho un golpe de charco por intervalo aunque pise varios · los charcos solapados multiplicaban ×4 el daño a un solo blanco y el cóctel ganaba en todo.
- 2026-11-03 · Todo campo numérico que pueda llevar decimales nace decimal (0,5 en `createEnemy`, −0 en el mundo) · si nace entero, V8 cambia el mapa a media partida y desoptimiza el bucle.
- 2026-11-03 · El bot «kite» de la sim rodea charcos y rastros radiactivos · se ven en pantalla; sin eso la radiación dominaba las muertes y el balance medía un defecto del bot.
- 2026-11-03 · La embestida termina al dejar atrás al jugador (`over` px, proyectado sobre su pasillo), no por tiempo; `maxDur` es solo red de seguridad · el usuario la vio quedarse corta; si el jugador corre por el pasillo más que ella, acaba.
- 2026-11-03 · Aturdido, el jugador no ataca (`updateWeapons` no corre) · decisión del usuario tras probarlo; sustituye a CAMBIOS §2 «el autoataque sigue activo».
- 2026-11-03 · El bot «kite» se aparta del pasillo de las embestidas (segmento), no solo de su origen · el pasillo se ve en pantalla.
- 2026-11-03 · Tope del cofre especial por cupones de la partida (`w.coupons` ≥ `capAfter` → uniforme en `capped`), también con «Contrabandista» · decisión del usuario.
- 2026-11-03 · Jefes en los minutos 2, 4 y 6; los tramos de oleada se reordenan para dejar el minuto de respiro delante de cada jefe · decisión del usuario.
- 2026-11-03 · Árbol por superviviente (`TREES`, misma forma, distinto contenido) pagado con sus chapas (= fichas de duplicados), coste fijo por tamaño · decisión del usuario; sustituye al árbol de cuenta con cupones (se devuelven al cargar, guardado v3).
