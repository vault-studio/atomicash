// Formatos de texto compartidos por las pantallas.

/** Segundos como mm:ss. */
export const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
