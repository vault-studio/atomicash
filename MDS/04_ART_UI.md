# 04 — Arte, UI y audio

## 1. Dirección de arte

- **Retrofuturismo atómico 1950s en ruinas**: optimismo de anuncio publicitario contra el desastre. Humor seco.
- **Pixel art** 32×32 para personajes y enemigos (jefes 64×64 o 96×96), vista cenital con ligera perspectiva (3/4).
- Animaciones mínimas: andar (4 frames), golpe recibido (flash blanco 80 ms), muerte (3 frames + partículas).
- Todo el arte es **original**. Ver `AGENTS.md` §1.

### Paleta base

| Uso | Color | Hex |
|---|---|---|
| Fondo / tierra | Ocre polvo | `#C8A46B` |
| Sombras | Marrón quemado | `#5A3E2B` |
| Cielo / ambiente | Naranja atardecer | `#E07A3F` |
| UI principal (fósforo) | Verde CRT | `#3CFF6B` |
| UI fondo | Negro verdoso | `#0B140D` |
| Acento retro | Turquesa cromado | `#3FB8AF` |
| Acento retro 2 | Rojo cereza | `#D7263D` |
| Radiación | Verde ácido | `#9DFF00` |
| Texto claro | Crema | `#F3E9D2` |

### Tipografías (licencia OFL)

- Interfaz tipo terminal: **VT323** (Google Fonts).
- Títulos tipo cartel: **Bungee** o **Rubik Mono One**.
- Números del HUD: **Pixelify Sans**.

### Efectos

- Filtro CRT opcional en menús: scanlines + viñeta + ligero brillo (desactivable en Ajustes → Accesibilidad).
- Partículas de polvo en suspensión en la run (muy sutiles).
- Daño flotante en números (desactivable).

## 2. Pantallas

### Búnker (menú principal)
Interfaz de terminal de fósforo verde en una pared de búnker. Opciones como entradas de terminal:

```
> EXPEDICIÓN        Salir al páramo
> SUPERVIVIENTES    Tu colección
> TALLER            Mejoras por personaje
> MERCADER          Estimulantes, implantes y manuales
> MOCHILA           Consumibles
> SUMINISTROS       Cajas por zona
> TABLÓN            Misiones, logros y perfil
> AJUSTES           Sonido, gráficos, controles, accesibilidad
```

### Selección de superviviente
Rejilla de tarjetas estilo "ficha de empleado" con foto pixel art, estrellas y rareza (borde de color: gris / azul / morado / dorado; irradiado con brillo verde).

### Perfil psicológico
Formulario de examen con casillas; tono humorístico de cuestionario oficial de los 50.

### Cajas de suministros
Caja metálica que se abre con chispas; ×10 y ×100 muestran rejilla de resultados con botón "Saltar". Probabilidades siempre visibles.

### HUD de la run
- Arriba izquierda: barra de PV + barra de RADS (verde ácido con icono de trébol radiactivo genérico).
- Arriba centro: temporizador `MM:SS` y barra de XP a lo ancho.
- Arriba derecha: contador de muertes, pausa.
- Abajo izquierda (móvil): zona de joystick.
- Abajo derecha: 4 iconos de arma con nivel, 4 de consumibles, 1 de objeto.

### Subida de nivel
3 tarjetas grandes estilo carta de menú de diner; teclas `1 2 3` visibles; botón "Cambiar (R)".

### Resultados
Ticket impreso de máquina registradora que va saliendo: tiempo, muertes, créditos, XP.

## 3. Responsive

- Solo horizontal. Diseño base 1280×720, escalado manteniendo proporción.
- Botones táctiles ≥ 48 px. Safe areas (`viewport-fit=cover`).

## 4. Audio

- Música original (o con licencia CC0/CC-BY compatible con uso comercial): swing/doo-wop instrumental distorsionado para menús; electrónica retro con tensión para la run.
- SFX: clics de terminal, Geiger crepitante al subir RADS, explosiones cortas.
- Volúmenes separados: música / efectos. Silencio si la pestaña pierde foco.

## 5. Placeholders (Fase 1)

Hasta tener sprites: jugador = triángulo crema, enemigos = círculos de color por tipo, proyectiles = rectángulos, chatarra = rombos amarillos, jefes = círculo grande con anillo.
