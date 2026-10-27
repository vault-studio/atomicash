# Changelog

## 0.1.0 — 2026-10-27

- feat(F1-05): oleadas por tiempo en `config/waves.ts` (ritmo, máximo de vivos y mezcla); aparición siempre fuera de la cámara real, también en monitores grandes, y recolocación de los que se quedan atrás.
- feat(F1-04): pool denso y spatial hash de celdas de 64 px sin allocations; enemigos que persiguen y se separan, límite de 400 vivos reciclando el más lejano. Test: 1 000 enemigos durante 2 000 ticks sin ningún GC.
- feat(F1-03): joystick virtual analógico en la mitad izquierda (táctil y ratón), entrada unificada con teclado y run congelada con aviso al poner el móvil en vertical.
- feat(F1-01/F1-02): proyecto Vite + React 18 + TS strict + PixiJS v8 + i18n ES/EN + Vitest + ESLint/Prettier; motor de paso fijo a 60 Hz con `World`, registro de entidades y cargador de sprite sheets de la biblia de arte (placeholder si falta la hoja, 8 direcciones, `death` de una sola vez).
