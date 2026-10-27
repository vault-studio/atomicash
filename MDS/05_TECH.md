# 05 — Especificación técnica

## 1. Stack

| Pieza | Elección |
|---|---|
| Lenguaje | TypeScript 5 (strict) |
| Build | Vite |
| UI de menús | React 18 |
| Render de la run | **PixiJS v8** (WebGL, con fallback Canvas) |
| Estado | Zustand + persist (localStorage) |
| i18n | i18next + react-i18next |
| Tests | Vitest |
| Lint/format | ESLint + Prettier |
| Deploy web | Vercel |
| Online (Fase 4+) | Supabase (auth, Postgres, Realtime para señalización) + WebRTC para cooperativo |
| Móvil (Fase 6) | Capacitor (envoltorio del build web) — decisión revisable |

No añadir más dependencias sin justificar.

## 2. Estructura de carpetas

```
atomic-ash/
├─ index.html
├─ src/
│  ├─ main.tsx
│  ├─ app/                 # Pantallas React (menús)
│  │  ├─ screens/          # Bunker, Survivors, Workshop, Merchant, Supplies, Board, Settings, Results
│  │  └─ components/
│  ├─ engine/              # TS puro: sin React, sin DOM, sin Pixi
│  │  ├─ world.ts          # Estado de la run y tick(dt)
│  │  ├─ systems/          # movement, spawning, weapons, projectiles, collision, damage, xp, radiation, bosses, events
│  │  ├─ spatialHash.ts
│  │  ├─ pool.ts           # Object pooling
│  │  ├─ rng.ts            # RNG con semilla (necesario para coop y tests)
│  │  └─ types.ts
│  ├─ render/              # PixiJS: lee World y dibuja
│  │  ├─ renderer.ts
│  │  ├─ hud.ts
│  │  └─ placeholders.ts
│  ├─ input/               # Teclado, joystick táctil → InputState
│  ├─ config/              # Todo el balance: survivors, weapons, fusions, enemies, bosses, waves, items, consumables, economy, gacha
│  ├─ store/               # Zustand: profile, collection, inventory, settings, missions
│  ├─ i18n/es.json, en.json
│  └─ assets/
├─ tests/
└─ CHANGELOG.md
```

## 3. Motor

- **Paso fijo** de 60 Hz (`dt = 1/60`) con acumulador; render a la tasa del monitor con interpolación.
- `World` contiene arrays de entidades por tipo (no ECS completo; estructuras simples y planas para rendimiento).
- Orden de sistemas por tick: input → movimiento jugador → spawning → IA enemigos → armas → proyectiles → colisiones → daño → muertes/drops → recogida XP → radiación → jefes/eventos → comprobación de fin.
- **Colisiones**: spatial hash con celdas de 64 px. Solo círculos.
- **Pooling** para enemigos, proyectiles, drops y números de daño.
- **Límite** de enemigos simultáneos configurable (por defecto 400); al superarlo, los más lejanos se reciclan.
- Pausa total del tick al abrir subida de nivel, fusión o pausa (en coop: el juego sigue).
- RNG con semilla en todo lo aleatorio del motor.

## 4. Modelo de datos (persistido)

```ts
interface Profile {
  version: number;           // para migraciones
  nickname: string | null;
  credits: number;
  starterChosen: SurvivorId | null;
  stats: { runs: number; kills: number; bestTimeSec: number; bossesKilled: number };
}

interface OwnedSurvivor {
  id: SurvivorId;
  level: number;             // 1–30
  xp: number;
  stars: number;             // 1–5
  shards: number;
  irradiated: boolean;
  upgrades: Record<UpgradeId, number>;
  implants: ImplantId[];
  learnedStarters: WeaponId[];
}

interface Inventory { consumables: Record<ConsumableId, number>; loadout: (ConsumableId | null)[] }
interface GachaState { pityCounter: Record<ZoneId, number> }
interface MissionsState { dailySeed: string; daily: MissionProgress[]; achievements: Record<AchievementId, boolean> }
interface Settings { musicVol: number; sfxVol: number; crtFilter: boolean; damageNumbers: boolean; language: 'es' | 'en'; reduceMotion: boolean }
```

- Guardado con Zustand persist bajo la clave `atomicash-save`. Campo `version` + función `migrate`.
- Exportar/importar partida como JSON desde Ajustes (útil antes de tener cuentas).

## 5. Config

- Cada archivo de `src/config/` exporta un objeto tipado (`satisfies Record<Id, Def>`).
- Validación al arrancar en modo dev: ids únicos, referencias existentes (fusiones, oleadas).

## 6. Rendimiento

- Objetivo: 60 FPS con 300 enemigos + 200 proyectiles en PC; 45 FPS en Android gama media.
- Sprites en un atlas único; `ParticleContainer` de Pixi para enemigos y proyectiles.
- Nada de allocations en el bucle caliente (sin `map/filter` por frame sobre entidades).
- Overlay de debug (F3): FPS, entidades, tiempo por sistema.

## 7. Tests mínimos

- Curva de XP y subida de nivel.
- Selección de tarjetas (sin duplicados, respeta huecos, ofrece fusión cuando toca).
- Probabilidades del gacha (10 000 tiradas con semilla dentro de ±1 %) y garantía a las 90.
- Daño, armadura y tramos de RADS.
- Migración de guardado de v1 a v2 (cuando exista v2).

## 8. Online (Fase 4–5, solo diseño)

- Supabase Auth: invitado local → vincular con Google sin perder progreso.
- Tablas: `profiles`, `saves` (JSON + version), `leaderboard_runs`, `friends`.
- Validación básica antitrampas en servidor (Edge Function): tiempos imposibles, daño fuera de rango.
- Coop: anfitrión autoritativo, WebRTC DataChannel, señalización por Supabase Realtime, misma semilla de RNG, hasta 4 jugadores. Aviso de privacidad sobre IP como en `02_GAMEPLAY.md`.
