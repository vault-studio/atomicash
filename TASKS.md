# TASKS — Atomic Ash

Rama: `main` · Roadmap: `docs/CAMBIOS.md` · Historial de lo hecho: `DONE.md` (no leerlo salvo que haga falta contexto de una tarea antigua).

Leyenda: ⬜ pendiente · 🔄 en curso · ✅ hecha · ⛔ bloqueada

Al terminar una tarea: una línea breve en `DONE.md` y quitarla de aquí.

## Siguiente tarea recomendada

⬜ Probar jugando (`npm run dev`, depurador F1) mortero, cercos y furia.

## Pendiente de prueba del usuario (valores de partida)

- ⬜ Jefes en los minutos 2/4/6 y −30 % de XP: media del bot bajó a ~214 s; el Rey Rata en el minuto 2 mata 4 de 18 partidas.
- ⬜ Evento «Tú mismo, otra vez» (`mirror`, atajo M).
- ⬜ Cinco enemigos nuevos (Liquidador, Sabueso Geiger, Bidonero, Nevera, Motorista).
- ⬜ Campaña de 3 actos: supervivencia media 116,5 s (126 partidas).
- ⬜ El mortero casi nunca acierta al bot: revisarlo jugando.

## Pendiente

- ⬜ Subir `minWinSec` de 67 a 360 en `supabase/functions/_shared/runCheck.ts` (exige redesplegar la función).
- ⬜ Arte: bidón, hielo y escombros por bioma. Bomba del evento espejo: placeholder y sin sonido.
- ⬜ Enemigos propios de los actos 2 y 3 en oleadas (hoy Nevera y Motorista solo salen desde el depurador).
- ⬜ Eventos, poco a poco. Acto 1: Las Devueltas, Los cartuchos enterrados, Baile de necrófagos. Acto 2: El platillo bajo el hielo, El Cobrador, Los necrófagos del hielo. Acto 3: La Mano, El trono de chatarra, La caravana del desierto. Sin acto: La puerta que no se abre, La limpieza.

## Bugs conocidos

- `tests/alloc.test.ts` falla a veces en la suite completa con carga de CPU (efecto de tiempos, también en commits anteriores con `--no-concurrent-recompilation`). Solo pasa siempre. Posible arreglo: ejecutarlo sin paralelismo.
- Depurador › Valores: solo edita claves que ya existen en `tuning.json` (para añadir `rage`/`dash` a un enemigo hay que editar el archivo).

## Notas que hay que tener presentes

- No sustituir `Math.hypot` por `Math.sqrt(x*x + y*y)`: difiere en el último bit y cambia partidas enteras; `npm run sim` no lo detecta.
- El arte nuevo no llega solo a `Apps/galeria-assets`: hay que copiarlo allí.
- Plantel: solo Dot, Gus y Benny. Babosa, Reptador e Hinchado se quedan en el Acto 1.
- Balance: `npm run balance` (126 partidas, 6 semillas) y `node tools/simdiff.mjs out/balance`. Con 6 semillas hay mucho ruido.
