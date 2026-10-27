# 02 — Gameplay

## 1. Bucle principal

```
Menú (Búnker) → elegir superviviente → elegir zona → RUN (máx. 15 min)
  → victoria (jefe final derrotado) o derrota
  → resultados: chatarra, créditos, XP de superviviente, misiones
  → Búnker: mejorar, abrir cajas, comprar en el mercader → nueva run
```

## 2. Controles

| Acción | PC | Móvil |
|---|---|---|
| Moverse | WASD / flechas | Joystick virtual: arrastrar en la mitad izquierda |
| Arma activa (cambiar foco/apuntado de habilidad manual) | 1–4, Q/E para ciclar | Tocar el icono del arma |
| Consumibles | 5–8 | Tocar el icono del consumible |
| Elegir mejora al subir de nivel | 1 / 2 / 3, R para cambiar opciones | Tocar tarjeta |
| Pausa | Esc | Botón pausa arriba a la derecha |

Las armas disparan solas apuntando al enemigo más cercano (salvo que su descripción diga otra cosa). Las teclas 1–4 solo sirven para armas con modo manual (ver `03_CONTENT.md`).

## 3. El superviviente en la run

- **Vida (PV)**, **velocidad**, **imán** (radio de recogida), **armadura** (reducción plana de daño), **suerte** (afecta a rarezas de mejoras y drops).
- **4 huecos de arma.** Empieza con 1 (su arma inicial).
- **1 hueco de objeto** (equipable con efecto pasivo). Si encuentras otro, eliges cuál te quedas.
- **4 huecos de consumible** (granadas, estimulantes, etc.), cargados antes de la run desde la Mochila.

## 4. Experiencia y subidas de nivel

- Los enemigos sueltan **chatarra** (XP de la run). Pequeña = 1, mediana = 5, grande = 25.
- XP necesaria para el nivel `n`: `10 + 6·(n−1) + floor(0.8·(n−1)^1.5)` (configurable).
- Al subir de nivel el juego se pausa y ofrece **3 tarjetas**:
  - Nueva arma (si hay hueco libre).
  - Subir nivel de un arma que tienes (máx. nivel 5).
  - Mejora pasiva del personaje (+PV, +velocidad, +imán, +daño %, −enfriamiento %).
- **Cambiar opciones (R)**: 1 uso gratis por run; más usos con mejoras permanentes.
- Rareza de la tarjeta: Común / Rara / Épica, con más efecto. La suerte sube las probabilidades.

## 5. Fusiones de taller ("Apaño")

- Si tienes **dos armas compatibles al nivel 5**, la siguiente subida de nivel ofrece la tarjeta **APAÑO**.
- Las dos armas se combinan en una **arma fusionada que ocupa un solo hueco**, liberando el otro.
- Tabla de fusiones en `03_CONTENT.md`. Pantalla propia con animación de soldadura (chispas).

## 6. Radiación (mecánica propia)

- Barra de **RADS** de 0 a 100 en el HUD.
- Sube al pisar charcos radiactivos, al recibir golpes de enemigos "irradiados" y con el tiempo dentro de zonas calientes del mapa.
- Efectos por tramo:
  - 0–29: nada.
  - 30–59: +10 % daño, −5 % PV máx.
  - 60–89: +25 % daño, −15 % PV máx., aparecen más enemigos irradiados (mejor botín).
  - 90–100: +40 % daño, pierdes 1 PV/s.
- Se baja con consumibles (**Yodo-Pak**) y con algunas mejoras/objetos.
- Idea de diseño: el jugador decide cuánto riesgo quiere a cambio de daño y botín.

## 7. Estructura de la run

- Mapa grande (4000×4000 px) que se repite en los bordes (toroidal) o con límites suaves; MVP: con límites y obstáculos (coches, ruinas).
- **Oleadas** definidas por tiempo en `src/config/waves.ts`: cada entrada dice minuto, tipos de enemigo, ritmo de aparición y máximo simultáneo.
- **Minijefes** en los minutos 5 y 10 (sueltan cofre de botín: objeto o subida de arma).
- **Jefe final** en el minuto 14. Si lo derrotas: victoria. Si llegas al 15 sin matarlo: llega la "Tormenta" (daño creciente hasta morir).
- **Eventos aleatorios** (1 cada ~3 min): caída de suministros, enjambre en anillo, lluvia radiactiva (sube RADS global, +botín).

## 8. Muerte y recompensas

Al terminar (gane o pierda):
- **Créditos** (moneda del Búnker) = minutos sobrevividos × 10 + enemigos/20 + bonus jefe.
- **XP del superviviente** (nivel permanente del personaje, máx. 30).
- Progreso de misiones y logros.

## 9. Meta-progresión (Búnker)

### Colección de supervivientes
- Se consiguen en **Cajas de suministros** o como recompensa de misiones.
- Duplicados → **Fichas del personaje**, que suben sus "Estrellas" (1–5; cada estrella +5 % stats base).
- Variante **Irradiada** (equivalente a "shiny"): 1 % de probabilidad, solo cosmética (paleta verde brillante + aura). Muy coleccionable.

### Mejoras por personaje
- Cada superviviente tiene su propio árbol pequeño (PV, daño, velocidad, imán, rerolls, hueco de consumible extra). Coste en créditos, creciente.
- Solo afectan cuando juegas con él.

### Perfil psicológico inicial
- Primera vez que se juega: test de 6 preguntas estilo "examen de aptitud del Ministerio" (en tono humorístico años 50). El resultado asigna el superviviente inicial entre 3. Se puede cambiar ("Elegir otro").

### Mercader ambulante (tienda)
- Vende con créditos: consumibles, **Implantes** (cambian un rasgo del personaje: +10 % a un stat, −5 % a otro), **Manuales** (enseñan a un personaje un arma inicial alternativa).
- Inventario que rota cada 24 h (hora local).

### Cajas de suministros (gacha sin dinero real)
- Se compran con créditos. Tirada ×1, ×10 (garantiza 1 rara+), ×100.
- Probabilidades visibles en pantalla (obligatorio): Común 70 %, Raro 24 %, Épico 5 %, Legendario 1 %.
- Garantía: Legendario asegurado cada 90 tiradas sin legendario.
- 1 tipo de caja por zona; cada caja tiene su propia lista de personajes.

### Misiones y logros
- Diarias (3): "Mata 500 enemigos", "Sobrevive 10 min con X", etc. → créditos.
- Logros permanentes → cosméticos y fichas.

## 10. Dificultad

- Normal en el MVP. Más adelante: Difícil (×1,5 PV y daño enemigo, ×1,5 créditos) y Pesadilla.

## 11. Fuera del MVP (Fases 4–5)

- Cuentas (invitado → cuenta vinculada con Google), guardado en la nube.
- Ranking: "Tiempo aguantado" y "Daño al Jefe Supremo" (modo infinito contra un jefe).
- Cooperativo hasta 4 en sala con código; amigos.
