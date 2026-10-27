# AGENTS.md — Reglas para agentes programadores

Estas reglas son obligatorias. Si una tarea choca con ellas, para y explica el conflicto en vez de saltártelas.

## 1. Propiedad intelectual (CRÍTICO)

El juego se **inspira** en el retrofuturismo atómico de los 50 y en el género post-apocalíptico, pero es una IP **original**. Está prohibido usar en código, textos, assets, nombres de archivo o comentarios:

- Nombres, logos o marcas de Fallout, Bethesda, Interplay, Wasteland ni Pokémon.
- Personajes, mascotas o iconografía reconocible: chico mascota rubio con el pulgar arriba, ordenador de muñeca de la saga, armadura de poder con su silueta característica, refresco de cola de la saga, chapas de botella como moneda, sistema de atributos de 7 letras.
- Facciones, criaturas o términos propios de esas sagas (hermandades de acero, supermutantes, garras de la muerte, "el Yermo", "Refugio + número" como búnker de la empresa de la saga, etc.).
- Sprites, música o efectos de sonido de terceros sin licencia compatible con uso comercial.

Lo que sí es libre y queremos: estética años 50, átomos, radiación, búnkeres, robots de chapa, carteles propagandísticos inventados, terminales de fósforo verde, coches con aletas, carteles de neón, desierto, chatarra. **Todos los nombres y diseños deben ser inventados.** Ante la duda, invéntalo de nuevo.

## 2. Convenciones de Vault Studio

- TypeScript `strict: true`. Sin `any` salvo justificado en comentario.
- Estado global con **Zustand + persist**.
- **i18n ES + EN desde el día uno.** Ningún texto visible hardcodeado: todo en `src/i18n/{es,en}.json`.
- **Local-first**: el juego debe funcionar completo como invitado, sin red.
- Sin anuncios en el flujo de juego (run). Si algún día hay monetización, solo en menús y nunca pay-to-win.
- Al entregar código: **archivos completos**, no fragmentos ni "// ... resto igual".
- Package ID con patrón `com.vaultstudio.[nombre]`.

## 3. Arquitectura

- El **motor** (`src/engine/`) y la **configuración** (`src/config/`) son TypeScript puro: cero imports de React, DOM o librerías de render. Así se puede portar a React Native / Capacitor sin reescribir.
- Todo número de balance (vida, daño, velocidad, precios, probabilidades) vive en `src/config/`. **Nunca** números mágicos en el motor.
- El render lee el estado del motor; nunca al revés.

## 4. Definición de "hecho"

Una tarea está terminada solo si:

1. Compila sin errores ni warnings de TypeScript (`npm run typecheck`).
2. Pasa lint (`npm run lint`) y los tests (`npm run test`).
3. Cumple los criterios de aceptación de su tarea en `06_ROADMAP.md`.
4. Mantiene ≥ 60 FPS con 300 enemigos en pantalla en un portátil medio (y ≥ 45 FPS en un Android de gama media) cuando la tarea toque el motor o el render.
5. Los textos nuevos existen en ES y EN.
6. Se ha actualizado `CHANGELOG.md` con una línea.

## 5. Forma de trabajar

- Empieza con formas primitivas (círculos, triángulos, rectángulos de color). Los sprites llegan en la Fase 2.
- Una tarea = una rama = un PR. Mensajes de commit en español, formato `tipo(ámbito): descripción` (`feat(engine): spatial hash para colisiones`).
- No añadas dependencias fuera de las listadas en `05_TECH.md` sin justificarlo en el PR.
- Si falta información, elige la opción más simple, déjala anotada como `// DECISIÓN:` y sigue.
