# Online con Supabase (Fase 4)

El código de cuentas, nube, ranking y moderación está hecho, pero **apagado** hasta configurar Supabase.
Sin las variables de entorno el juego no descarga el cliente de Supabase y funciona igual, solo en local.

## Qué hay

| Pieza                                                                   | Dónde                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| Tablas, RLS, vistas del ranking y ocultación por reportes               | `supabase/migrations/20261028000000_init.sql`     |
| Rankings de daño total y tiempo en acabar (diario, semanal, siempre)    | `supabase/migrations/20261029000000_rankings.sql` |
| Edge Function que valida y guarda runs (antitrampas, 1 run/min)         | `supabase/functions/submit-run/index.ts`          |
| Reglas antitrampas y de apodos (compartidas con el cliente y los tests) | `supabase/functions/_shared/runCheck.ts`          |
| Cliente (import dinámico), sesión y sincronización                      | `src/online/online.ts`, `src/online/session.ts`   |
| UI: «Cuenta y nube» en Ajustes, «Ranking» en el Tablón                  | `src/app/screens/bunker/Online.tsx`               |

### Flujo

1. **Ajustes → Conectar como invitado** (consentimiento explícito; antes no se envía nada). Crea un usuario
   anónimo de Supabase Auth. Si en este dispositivo no hay partida empezada y en la nube sí, la baja.
2. **Vincular con Google**: `linkIdentity` sobre el mismo usuario → el progreso no se pierde.
3. Tras cada run se sube la partida y, si hay apodo y «Enviar al ranking» está activo, se llama a `submit-run`.
4. **Ranking**: «Daño total» (más daño en una partida) y «Tiempo en acabar» (la victoria más rápida, al
   matar al Coloso), cada uno de hoy, de la semana (desde el lunes, UTC) y de siempre; mejor marca de cada jugador. Cada entrada se puede
   **reportar** (apodo, trampas, otro) u **ocultar** solo para ti. Con 3 reportes de personas distintas la
   entrada se oculta para todos hasta que la revises.

## Puesta en marcha (≈15 min)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **Base de datos**: en _SQL Editor_ pega y ejecuta las migraciones en orden, o con la CLI:

   ```bash
   npx supabase link --project-ref TU-REF
   ```

   ```bash
   npx supabase db push
   ```

3. **Auth → Providers**: activa _Anonymous sign-ins_ y _Manual linking_ (Auth → Settings). Activa _Google_
   con un cliente OAuth de Google Cloud (tipo «Aplicación web»; URI de redirección la que indica Supabase).
4. **Auth → URL Configuration**: añade la URL de Vercel (y `http://localhost:5173` para desarrollo) a
   _Redirect URLs_.
5. **Edge Function**:

   ```bash
   npx supabase functions deploy submit-run
   ```

6. **Variables** (Project Settings → API): copia `URL` y la clave `anon` pública en Vercel
   (_Settings → Environment Variables_) como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y vuelve a
   desplegar. En local, copia `.env.example` a `.env.local`.

La clave `service_role` **no** va nunca en el cliente: la Edge Function la recibe sola del entorno de Supabase.

## Moderación

- Ver lo oculto: `select * from leaderboard_runs where hidden;` y sus `reports`.
- Restaurar: `update leaderboard_runs set hidden = false where id = …;` (y borra sus reportes).
- Banear: borra al usuario en _Authentication → Users_ (sus filas caen en cascada).

## Antitrampas (lo que valida `submit-run`)

Personaje existente, enteros no negativos, tiempo ≤ 1500 s, ≤ 3 jefes, daño a jefes ≤ 30 000 (la vida
total de los tres) y > 0 si hubo jefes, ≤ 15 bajas/s, daño total ≤ 50 000 por segundo y no menor que el daño a jefes, victoria solo con 3 jefes y ≥ 67 s (el Coloso sale a las 1000 bajas como pronto), apodo válido
y una run por minuto. `tests/online.test.ts` comprueba que esos límites siguen cuadrando con `src/config`.
Es validación básica: un cliente modificado puede mandar runs verosímiles. Para más, haría falta repetir la
run en el servidor con la semilla (ya se guarda `seed`).

## Sin probar

No hay proyecto de Supabase conectado, así que la parte de red no se ha ejecutado contra un servidor real:
solo están probadas las reglas puras y el modo sin conexión. Prueba el flujo completo tras configurarlo.
