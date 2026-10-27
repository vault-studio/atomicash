# Changelog

## 0.1.0 — 2026-10-27

- feat(F1-06…F1-09): combate completo portado del prototipo al motor sin allocations: 13 armas + 4 Apaños (llave, clavos, jeringas, cóctel, tesla, Geiger, escopeta, megáfono, rifle, martillo, petardos, desfibrilador, cobalto; dinamo, remachadora, núcleo inestable, dardos incendiarios), daño con crítico/empuje, bajas con chatarra 25/5/1 e imán, XP con la curva de `02_GAMEPLAY.md`, tarjetas de nivel (1/2/3/R) que pausan el motor, HUD (PV, RAD, tiempo, XP, armas, objeto, consumibles táctiles), pausa y resultados en ticket con «Volver a jugar» sin recargar. Incluye ya la IA de los 11 enemigos, irradiados, RAD, jefes, Tormenta, objetos, consumibles y eventos (se cierran en F2).
- feat(F1-05): oleadas por tiempo en `config/waves.ts` (ritmo, máximo de vivos y mezcla); aparición siempre fuera de la cámara real, también en monitores grandes, y recolocación de los que se quedan atrás.
- feat(F1-04): pool denso y spatial hash de celdas de 64 px sin allocations; enemigos que persiguen y se separan, límite de 400 vivos reciclando el más lejano. Test: 1 000 enemigos durante 2 000 ticks sin ningún GC.
- feat(F1-03): joystick virtual analógico en la mitad izquierda (táctil y ratón), entrada unificada con teclado y run congelada con aviso al poner el móvil en vertical.
- feat(F1-01/F1-02): proyecto Vite + React 18 + TS strict + PixiJS v8 + i18n ES/EN + Vitest + ESLint/Prettier; motor de paso fijo a 60 Hz con `World`, registro de entidades y cargador de sprite sheets de la biblia de arte (placeholder si falta la hoja, 8 direcciones, `death` de una sola vez).
