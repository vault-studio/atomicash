# Atomic Ash — Informe de Balance y Progresion

> Referencia interna para trabajar la dificultad y la experiencia del jugador nuevo.
> Datos extraidos del codigo fuente (src/config/*) a 2026-11-01.

---

## 1. Supervivientes

### Plantel activo (ROSTER)

| ID | PV | Velocidad | Rareza | Arma inicial | Arma exclusiva | Pasiva |
|----|-----|-----------|--------|--------------|----------------|--------|
| **Dot** | 100 | 200 | common | Pistola de clavos | Martillo pilon | +15% melee |
| **Gus** | 130 | 180 | rare | Coctel | *(pendiente: sarten)* | +50% duracion consumibles |
| **Benny** | 90 | 230 | common | Pistola de clavos | Petardos | +10% velocidad, +20% iman |

### Plantel futuro (con stats, sin sprites)

| ID | PV | Velocidad | Rareza | Arma inicial | Pasiva |
|----|-----|-----------|--------|--------------|--------|
| Mae | 110 | 190 | common | Jeringa | +0.5 PV/s regen |
| Errante | 120 | 205 | common | Escopeta chatarra | -30% RAD recibida |
| Silas | 100 | 210 | rare | Rifle cerrojo | +20% dano a jefes |
| Ilse | 85 | 200 | epic | Geiger | x2 bonus de dano de RAD |
| Kip | 150 | 170 | epic | Tesla | Inmune a drenaje de RAD |
| Rosalind | 120 | 200 | legendary | Megafono | +1 hueco de arma |

### Nivel de superviviente (meta)

- Nivel maximo: **30**
- XP por nivel: `60 + nivel × 40`
- Ganancias por run: 0.5 XP/s sobrevivido, 0.05 XP/baja, 60 XP/jefe
- Cada nivel: **+1 PV plano, +1% dano**

### Estrellas (duplicados)

- Maximo: **5 estrellas**
- Cada estrella: **+5% a stats base** (PV, dano, velocidad)
- Fichas por duplicado segun rareza: common 1, rare 2, epic 4, legendary 8
- Coste de ascenso: 5 → 10 → 20 → 40 fichas

---

## 2. Armas

### Armas base

| Arma | Tipo | Dano | Cadencia | Notas |
|------|------|------|----------|-------|
| **Llave** | orbit (melee) | 12 | 0.45s hit cd | Gira alrededor, +15%/lvl |
| **Pistola clavos** | bullet | 8 | 0.4s | Rango 560, -10%cd/lvl |
| **Jeringa** | fan | 10 | 1.0s | Cura 1+0.5/lvl PV por baja |
| **Coctel** | lob | 5 (charco) | 2.2s | Quemadura: 4dps, 3 stacks, 4.5s. Charco 5s+1/lvl |
| **Tesla** | chain | 15 | 1.4s | 4 saltos +2/lvl |
| **Geiger** | aura | 4 | 0.3s tick | Radio 72+14/lvl, escala con RAD |
| **Escopeta chatarra** | shotgun | 7 | 1.3s | 6 perdigones +2/lvl, cono 0.8 |
| **Megafono** | cone | 14 | 1.0s | Angulo 0.9+0.15/lvl, empuje 2.0+0.3/lvl |
| **Rifle cerrojo** | rifle | 40 | 1.6s | Rango 760, perfora 3, velocidad 900 |

### Armas exclusivas

| Arma | Dueno | Tipo | Dano | Cadencia | Notas |
|------|-------|------|------|----------|-------|
| **Martillo pilon** | Dot | slam (melee) | 22 | 1.6s | Radio 85+10/lvl, empuje 2.2 |
| **Petardos** | Benny | mines | 9 | 1.6s -0.06/lvl | 4-9 por ristra, cadena 0.07s, stun 0.3s |
| **Desfibrilador** | Mae | zap | 16 | 2.0s | 2 objetivos, +0.4 regen bonus |
| **Nucleo cobalto** | Errante | orb | 20 | 1.5s | Perfora 1, +0.02 RAD por golpe |

### Fusiones (Apano)

| Resultado | Receta | Tipo | Dano | Notas |
|-----------|--------|------|------|-------|
| **Dinamo** | Llave + Tesla | orbit | 34 | 3 orbitas, saltos chain x3 (18 dmg) |
| **Remachadora** | Pistola + Escopeta | bullet | 14 | 3 balas, cd 0.22s, perfora 4 |
| **Nucleo inestable** | Geiger + Megafono | unstable | 8 tick + 25 rayo | Aura + rayos x2 cada 0.5s |
| **Dardos incendiarios** | Jeringa + Coctel | firedarts | 14 | 6 dardos, charcos de fuego, cura 2 |

> **Nivel maximo de arma: 5.** Fusion requiere ambas armas al nivel 5.
> **Huecos de arma: 3** (Rosalind: 4). Inicial + 2 por subida de nivel.

---

## 3. Rasgos (subida de nivel)

Al subir de nivel se eligen 3 tarjetas. 75% de que un hueco sea arma (si hay disponibles).

### Rareza de tarjetas

- Tirada 0–100, la suerte acorta la tirada (minimo 20)
- **Epica** < 7, **Rara** < 28, resto **Comun**
- Multiplicadores: comun x1, rara x1.5, epica x2.2

### Lista de rasgos

| Rasgo | Stat | Base (comun) | Tope | Peso | Notas |
|-------|------|--------------|------|------|-------|
| Municion | dmg | +8% | 120% | 1 | |
| Botas | spd | +6% | 40% | 1 | |
| Manual | xp | +10% | 60% | 1 | |
| **Casco** | red | +8% | 40% | **3** | Defensivo, sale x3 mas |
| **Chaleco** | armor | +2 plano | 8 | **3** | Defensivo, sale x3 mas |
| **Sutura** | regen | +0.5 PV/s | 2.5 | **3** | Defensivo, sale x3 mas |
| Iman | mag | +25% | 150% | 1 | |
| Gato | dodge | +4% | 35% | 1 | |
| Mira | crit | +5% | 50% | 1 | |
| Punta hueca | critDmg | +25% | 200% | 0.7 | Sobre el x2 base. Sale menos sin Mira |
| Racion | hp | +20 PV | 200 | 1 | |
| Aceite | cd | +6% | 60% | 1 | |
| Yodo | radDecay | +1 RAD/s | 4 | 1 | Unica forma de bajar RAD (+ consumible) |
| Mecha | area | +10% | 60% | 1 | |
| Puntas | pierce | +1 | 3 | 1 | Enteros |
| Adrenalina | adren | +15% | 60% | 1 | Bonus de dano con <40% PV |
| Trebol | luck | +6% | 40% | 1 | |
| Culata | kb | +25% | 100% | 1 | Empuje |

### Mecanicas de tarjetas

- **Cambiar (reroll):** 1 gratis por run (+1/2 del Taller, +1 del arbol)
- **Desterrar (banish):** del arbol, quita la tarjeta de la run para siempre
- **Bloquear (lock):** del arbol, conserva una tarjeta entre subidas
- **Racha de rasgo:** si eliges el mismo rasgo 2 veces seguidas, no sale en la siguiente
- **Fallback:** si no queda nada que ofrecer: botiquin (30% PV) o lavado quimico (-30 RAD)

### Topes de stats

| Stat | Tope |
|------|------|
| Reduccion de cd | 60% |
| Reduccion de dano recibido | 50% |
| Esquiva | 40% |
| Critico | 60% |
| Multiplicador critico | x4 (x2 base + 200%) |
| Curacion por baja/s (jeringas) | 4 PV/s |

---

## 4. Enemigos

### Enemigos normales

| Enemigo | PV | Dano | Velocidad | XP | Especial |
|---------|-----|------|-----------|-----|---------|
| Dron | 8 | 4 | 122 | 1 | Metal, volador |
| Necrofago | 25 | 8 | 78 | 1 | |
| Saqueador | 40 | 10 | 100 | 2 | |
| Tirador | 30 | 8 | 72 | 2 | Se para a 600px y dispara (cd 1.4s) |
| Reptador | 35 | 9 | 112 | 2 | +5 RAD por golpe |
| Hinchado | 50 | 0 | 58 | 2 | Explota: R95, 10dmg jugador, 30dmg enemigos, +8 RAD |
| Cortacesped | 60 | 12 | 88 | 5 | Embiste cada 4s (340px/s), metal |
| Torreta | 120 | 10 | 0 | 5 | Estatica, 3 rafagas/2.6s, inamovible, metal |
| Babosa | 70 | 8 | 50 | 3 | Deja rastro RAD (5 RAD/s), resistente al empuje |
| Aspiradora | 60 | 10 | 80 | 2 | Al morir suelta 4 crias (6PV, 150spd), metal |
| Blindado | 80 | 14 | 58 | 4 | 40% armor, -75% empuje, metal |
| Predicador | 45 | 6 | 74 | 4 | Enfurece aliados a 210px cada 6s, se queda atras |
| Excavadora | 160 | 18 | 46 | 7 | 40% armor, -90% empuje, metal |

### Escalado de vida

- `PV × (1 + t × 1/250)` — +1% cada 2.5s, no aplica a jefes
- A los 10min: PV × 3.4 (un necrofago tendria ~85 PV)
- A los 15min: PV × 4.6

### Furia (RAGE)

- Se activa **10s** despues de aparecer (requiere nivel de jugador >= 3)
- **x2.5 dano, x1.8 velocidad** (tope: 95% de la velocidad del jugador)
- **x1.5 PV** (sobre lo que les quede)
- El Predicador enfurece al instante a aliados a 210px con su sermon

### Enemigos irradiados

- Probabilidad base 4%, +1/9000 por segundo de run
- x1.5 PV, golpe +6 RAD, x2 chatarra
- Aura de 90px que irradia 5 RAD/s al jugador

---

## 5. Elites

Aparece el primer elite a los **50s**, luego uno cada **30–50s**.

| Prefijo | Color | Efecto |
|---------|-------|--------|
| Blindado | gris | Recibe 50% menos dano |
| Veloz | azul | x1.7 velocidad |
| Radiactivo | verde | Aura 140px, 14 RAD/s |
| Divisor | naranja | Al morir se parte en 4 |
| Vampirico | rojo | Se cura 15% del dano que hace, +1%/s regen |

**Multiplicadores sobre el normal:** x14 PV, x1.35 radio, x12 XP, 30% empuje.
Siempre suelta un power-up. 20% de probabilidad de cofre especial (tragaperras).

---

## 6. Jefes

### Aparicion

| Jefe | Minuto | Bajas alt. | PV |
|------|--------|-----------|-----|
| **Rey Rata** | 3:00 (180s) | 200 bajas | 3,000 |
| **Dirigible** | 6:00 (360s) | 500 bajas | 7,000 |
| **Coloso** | 10:00 (600s) | 1,000 bajas | 20,000 |

> Mientras un jefe esta vivo, **no aparecen mas enemigos** (bossRateMult = 0). Solo el jefe y lo que invoca.

### Rey Rata (3,000 PV, 18 dmg, 76 spd)

**Ciclo:** llamada de ratas → 3 embestidas encadenadas
- **Llamada:** invoca 7 drones a 70px (se para 1s)
- **Embestida:** 0.55s de aviso → dash a 440px/s durante 0.7s, gap 0.25s entre embestidas
- **Fase 2 (<50% PV):** 4 embestidas, aviso 0.4s, gap 0.12s, invoca 10 drones

### Dirigible (7,000 PV, volador, metal)

**Orbita** a 280px del jugador, ataca cada 4s.
- **Paracaidistas:** 2 aterrizajes (aviso 1.2s), 15 dmg en R40
- **Bombardeo:** 6 bombas en linea (spacing 70px), aviso 1.2s, 22 dmg en R60
- **Fase 2 (<50% PV):** ataca cada 3s, invoca 6 drones a 340px
- Al morir suelta 100 XP en chatarra

### Coloso (20,000 PV, 26 dmg, 44 spd, metal)

Tres fases: 100-66%, 66-33%, 33-0%.
- **Pisotada:** salta y cae donde estaba el jugador (aviso 1.6s), R190, 34 dmg
- **Escombros:** 5+2/fase fragmentos (aviso 1.1s), 20 dmg, R46, spread 180px
- **Invocacion:** 6 necrofagos a 120px
- **Fase 3 (<33% PV):** ataca cada 2.1s (antes 3s), x1.35 velocidad

### Cofres de jefe

Rey Rata y Dirigible sueltan un **cofre de objeto** (3 a elegir 1):

| Objeto | Efecto |
|--------|--------|
| Dados | +40% suerte |
| Delantal | -60% RAD recibida |
| Patines | +35% velocidad |
| Nevera | +150% iman |
| Cinturon | +30% reduccion de cd |
| Cabezudo | +50% dano, -15% PV max |

---

## 7. Progresion de una partida (15 minutos)

### Oleadas

| Tiempo | Rate/s | Max vivos | Mezcla principal |
|--------|--------|-----------|-----------------|
| 0:00 | 1.3 (×0.7=0.91) | 40 | Drones, necrofagos |
| 1:00 | 2.0 (1.4) | 70 | + saqueadores |
| 2:00 | 2.6 (1.82) | 100 | + reptadores, aspiradoras |
| **3:00 — REY RATA** | 2.2 (1.54) | 90 | Respiro: drones, necrofagos, saqueadores |
| 4:00 | 3.2 (2.24) | 130 | + tiradores, hinchados, blindados |
| 5:00 | 3.8 (2.66) | 160 | + babosas, predicadores |
| **6:00 — DIRIGIBLE** | 3.0 (2.1) | 120 | Respiro: drones, necrofagos, saqueadores, reptadores |
| 7:00 | 4.4 (3.08) | 190 | + cortacespedes |
| 8:30 | 5.0 (3.5) | 220 | + excavadoras, torretas |
| **10:00 — COLOSO** | 4.0 (2.8) | 180 | Respiro |
| 11:00 | 5.6 (3.92) | 260 | Todo el bestiario |
| 12:30 | 6.4 (4.48) | 300 | Maximo caos |
| **15:00 — TORMENTA** | — | — | 5 dps +5/s hasta morir |

> Rate real = rate × SPAWN.rateMult (0.7). XP por baja × 3.125 para compensar.

### Eventos del director

- **Primer evento:** 1:30 (90s)
- **Cada:** 3 minutos (180s)
- **Silencio tras jefe:** 20s
- **Rotacion:** Suministro → Enjambre → Lluvia
  - **Suministro:** caja a 320px con 4 gemas de 5 XP + consumible
  - **Enjambre:** 28 drones en circulo de R380
  - **Lluvia radiactiva:** 12s con x1.3 spawn rate y x2 XP

### Hordas (emboscadas en formacion)

- **Primera:** 50s
- **Cada:** 45–70s
- **Aviso en pantalla:** 2.2s antes
- **Rotacion:** Anillo → Estampida → Muro

| Horda | Cantidad base | Escalado | Tipo segun minuto |
|-------|--------------|----------|-------------------|
| **Anillo** | 22 | +2.5/min (max 48) | Necrofago; >5min saqueador |
| **Estampida** | 18 | +1.5/min (max 34) | Dron; >4min reptador |
| **Muro** | 20 | +1.5/min (max 36) | Necrofago; >3:20 saqueador; >8min cortacesped |

### Objetivos del mapa

- **Primer objetivo:** 1:40 (100s)
- **Cada:** 80–110s
- **Rotacion:** Aguantar → Purgar
  - **Aguantar:** 12s dentro de la zona (limite 50s)
  - **Purgar:** 35 bajas dentro de la zona (limite 45s)
- **Recompensa:** cofre especial (tragaperras) + 40 cupones

### Dano recibido (escala con el tiempo)

El multiplicador de dano recibido sube de **x2 a x3** al llegar al 75% de la run (11:15).

| Minuto | Mult. | Necrofago (8 base) | Saqueador (10 base) | Excavadora (18 base) |
|--------|-------|--------------------|---------------------|----------------------|
| 0:00 | x2.0 | 16 | 20 | 36 |
| 3:00 | x2.27 | 18 | 23 | 41 |
| 6:00 | x2.53 | 20 | 25 | 46 |
| 10:00 | x2.87 | 23 | 29 | 52 |
| 11:15 | x3.0 | 24 | 30 | 54 |

> Sin defensas, un superviviente de 100 PV aguanta 5–6 golpes de los normales al inicio. Al minuto 10 son 4.

---

## 8. Mejoras del Bunker (Intendencia / Taller)

### Taller (por superviviente)

| Mejora | Niveles | Coste base | Crecimiento | Efecto por nivel |
|--------|---------|------------|-------------|-----------------|
| PV | 5 | 60 | x1.6 | +8 PV max |
| Dano | 5 | 80 | x1.6 | +5% dano |
| Velocidad | 5 | 60 | x1.6 | +3% velocidad |
| Iman | 3 | 50 | x1.7 | +15% iman |
| Cambios | 2 | 150 | x2.2 | +1 reroll por run |
| Consumibles | 2 | 120 | x2.0 | +1 de cada consumible al salir |

**Coste total maximo de todas las mejoras:** ~5,500 cupones

### Implantes (1 por superviviente)

| Implante | Bonus | Penalizacion | Precio |
|----------|-------|-------------|--------|
| Cortex | +10% dano | -5% velocidad | 400 |
| Piernas | +10% velocidad | -5 PV | 350 |
| Pulmon | +10% PV | -5% dano | 350 |
| Iman | +10% iman | -1 armadura | 300 |
| Reflejos | +10% reduccion cd | -5 PV | 450 |
| Blindaje | +10% reduccion dano | -5% velocidad | 450 |

### Mochila

- **Inicio:** stim x2, yodo x2, granada x3, turbo x1
- **Maximo por run:** 3 de cada tipo
- **Consumibles caen de enemigos:** 0.4% por baja (suerte sube la probabilidad)

---

## 9. Arbol de pasivas (cuenta global)

Tres ramas con nodos que se compran con cupones. **Cada nodo comprado encarece el siguiente.**

- **Coste base:** 80 cupones
- **Crecimiento:** x1.14 por nodo comprado
- **Multiplicador de tamano:** small x1, big x2.5, unique x4

### Rama Combate (arriba)

| Nodo | Tamano | Efecto |
|------|--------|--------|
| c1 | small | +3% dano |
| c2 | small | +3% dano |
| cB | **big** | +1 destierro por run |
| c3 | small | +3% critico |
| c4 | small | +5% dano |
| cU | **unico** | **Cazador:** +30% dano al enemigo mas cercano |

### Rama Supervivencia (abajo izq.)

| Nodo | Tamano | Efecto |
|------|--------|--------|
| s1 | small | +6 PV max |
| s2 | small | +6 PV max |
| sB | **big** | +1 bloqueo por run |
| s3 | small | +1 armadura |
| s4 | small | +10 PV max |
| sU | **unico** | **Sangre fria:** +50% dano con <50% PV |

### Rama Chatarreria (abajo der.)

| Nodo | Tamano | Efecto |
|------|--------|--------|
| k1 | small | +5 cupones por run |
| k2 | small | +5 cupones por run |
| kB | **big** | +1 cambio (reroll) por run |
| k3 | small | +10% iman |
| k4 | small | +10 cupones por run |
| kU | **unico** | **Contrabandista:** doble tirada en la tragaperras (se queda la mejor) |

### Puentes entre ramas

| Nodo | Conecta | Efecto |
|------|---------|--------|
| bCS | Combate ↔ Superv. | +0.2 regen |
| bSK | Superv. ↔ Chatarreria | +3% velocidad |
| bKC | Chatarreria ↔ Combate | +5% XP |

---

## 10. Economia de cupones

### Fuentes

| Fuente | Cantidad |
|--------|----------|
| Drop de enemigos | 5 cupones (1% por baja) |
| Cofre especial (tragaperras) | ~246 media (50–500) |
| Objetivo del mapa | 40 cupones |
| Reto diario (1er intento) | 150 cupones |
| Creditos por run | 10/min + 20/20 bajas + 50/jefe |

### Costes principales

| Destino | Rango |
|---------|-------|
| Taller (1 mejora) | 60–660 cupones |
| Implante | 300–450 cupones |
| Nodo del arbol | 80–300+ cupones |
| Gacha x1 | 100 cupones |
| Gacha x10 | 900 cupones |
| Consumible (mercader) | 30–60 cupones (pack de 2) |
| Manual de arma | 600 cupones |

---

## 11. Recogibles de campo

Probabilidad de drop al matar: **1.8%** (la suerte lo sube).

| Recogible | Peso | Efecto |
|-----------|------|--------|
| Botiquin | 6 | Cura 30% PV max |
| Iman | 3 | Atrae todo del mapa |
| Botas | 3 | x1.5 velocidad 10s |
| Crio-granada | 2 | Congela en pantalla 4s (jefes 1.2s) |
| Nuka-pila | 2 | x2 cadencia de armas 10s |
| Bomba | 1 | Mata todo en pantalla (jefes: 400 dmg) |

---

## 12. Radiacion

### Tramos

| RAD | Bonus dano | Penalizacion PV max | Enemigos irradiados | Drenaje PV/s |
|-----|-----------|---------------------|---------------------|-------------|
| 0–29 | 0% | 0% | 0% | 0 |
| 30–59 | +10% | -5% | 0% | 0 |
| 60–89 | +25% | -15% | +15% | 0 |
| 90–100 | +40% | -15% | +15% | 1 PV/s |

- **100 RAD = muerte** (salvo Kip, que es inmune)
- **Charco radiactivo:** +16.7 RAD/s (0 a 100 en 6s)
- **La RAD no baja sola.** Solo el yodo (consumible: -50 RAD) o el rasgo Yodo (-1 a -4 RAD/s)

---

## 13. Racha de bajas (streak)

| Bajas sin recibir dano | Multiplicador XP |
|------------------------|-----------------|
| 10+ | Visible en HUD |
| 100+ | x1.5 |
| 300+ | x2.0 |

Un golpe recibido (no esquivado) resetea la racha.

---

## 14. Modo infinito (post-Coloso)

Al derrotar al Coloso se puede elegir continuar.
- **+12% rate/min, +8% max/min, +15% PV/min** de enemigos
- **Elite cada 15s** (en vez de 30–50s)
- Hordas x0.7 mas frecuentes
- No vuelven jefes
- A los 15:00 llega la Tormenta (5 dps +5/s, inevitable)

---

## 15. Reto diario

- Misma semilla, superviviente y modificador para todos
- **Sin mejoras del Bunker** (taller, estrellas, arbol, implantes)
- Primer intento del dia: +150 cupones

### Modificadores

| Mod | Efecto |
|-----|--------|
| Elites | x2 frecuencia |
| Hordas | x2 frecuencia |
| Cristal | x2 dano dado y recibido |
| Irradiados | 25% de enemigos irradiados |
| Barriles | x2.5 barriles en el mapa |

---

## 16. Misiones diarias

3 al dia, se reinician a medianoche local.

| Mision | Objetivo | Recompensa |
|--------|----------|-----------|
| Matar 500 | 500 bajas | 120 cupones |
| Matar 1500 | 1500 bajas | 250 cupones |
| Sobrevivir 5 min | 5 minutos | 100 cupones |
| Sobrevivir 10 min con X | 10 min con superviviente especifico | 250 cupones |
| 3 partidas | 3 runs | 100 cupones |
| 1 jefe | Derrotar 1 jefe | 150 cupones |
| 5 consumibles | Usar 5 consumibles | 80 cupones |

---

## 17. Experiencia del jugador nuevo — Curva critica

### Primeros 60 segundos
- Solo drones y necrofagos, rate efectivo 0.91/s
- El jugador aprende a moverse y disparar con presion baja
- **Problema potencial:** el dano recibido ya es x2 desde el segundo 0 → un necrofago quita 16 PV de golpe a un Dot de 100 PV

### Minutos 1–3
- Aparecen saqueadores (40 PV, mas dano), reptadores (dan RAD)
- Primera horda a los 50s, primer elite a los 50s, primer evento a 1:30
- **1–2 subidas de nivel:** el jugador elige sus primeras tarjetas
- **Primer objetivo** a 1:40 (puede ser confuso sin tutorial)

### Minuto 3 — Rey Rata
- 3,000 PV, invoca drones, embiste 3 veces
- **Punto de inflexion:** si el jugador no tiene defensas (casco/chaleco), los 18 dmg × ~2.3 = ~41 PV por embestida
- Suelta cofre de objeto (primera mejora grande)

### Minutos 4–6
- Tiradores, hinchados, babosas, blindados, predicadores
- La complejidad sube mucho: hay que priorizar predicadores y esquivar babosas
- **Dano recibido x2.5+**: sin casco, 2–3 golpes matan

### Minuto 6 — Dirigible
- Volador, bombardeos, paracaidistas
- Requiere esquivar zonas marcadas + matar lo que invoca
- Suelta segundo cofre de objeto

### Minutos 7–10
- Cortacespedes (embisten), torretas (estaticas pero duras), excavadoras (tanques)
- Furia generalizada: los que sobreviven 10s se ponen agresivos
- El jugador deberia tener 3 armas + 2 objetos + rasgos defensivos

### Minuto 10 — Coloso
- 20,000 PV, tres fases, pisotadas de R190
- El combate mas largo: hay que esquivar pisotadas y escombros mientras se le baja la vida
- Victoria → cinematica + opcion de modo infinito

### Minutos 10–15 (infinito)
- Escalado agresivo: elites cada 15s, hordas frecuentes
- Sin mas jefes, la presion es por volumen y elites
- La Tormenta a los 15:00 garantiza que la run termina

### Curva de cupones (estimacion por run tipica, sin mejoras)
- Run corta (muerte al min 3): ~100–200 cupones
- Run media (muerte al min 6): ~400–600 cupones
- Run completa (Coloso muerto): ~1,000–1,500 cupones
- Run infinita (15 min): ~2,000+ cupones

> **Primera mejora del taller (PV +8): 60 cupones** — alcanzable en 1 run mala.
> **Gacha x10: 900 cupones** — requiere 1–2 runs buenas.
> **Arbol completo: ~3,500+ cupones** — muchas runs.

---

## 18. Gacha

| Tirada | Coste | Bonus |
|--------|-------|-------|
| x1 | 100 | — |
| x10 | 900 | Al menos 1 raro |
| x100 | 8,500 | — |

| Rareza | Probabilidad | Fichas por duplicado |
|--------|-------------|---------------------|
| Common | 70% | 1 |
| Rare | 24% | 2 |
| Epic | 5% | 4 |
| Legendary | 1% | 8 |

**Pity:** legendario asegurado a las 90 tiradas sin uno.
**Irradiado (shiny):** 1% de cualquier tirada (solo cosmetico).

---

## 19. Barriles explosivos

- **Maximo simultaneos:** 9
- **Aparecen cada:** 6s si faltan (grupos de 1–3)
- **Dano:** 70 + escalado temporal (mismo ratio que PV enemigos)
- **Radio:** 120px
- **Dano al jugador:** 8 (si estas dentro)
- **Encadenan** con otros barriles cercanos
