// Actos de la campaña. Sus nombres están en i18n (`acts.1`…).
// DECISIÓN: de momento solo se juega el acto 1. Los actos 2 y 3 solo tienen su suelo y sus objetos, y se ven desde el
// depurador; cambian el aspecto del mapa, no los enemigos ni el balance.
export const ACT_IDS = [1, 2, 3] as const;
export type ActId = (typeof ACT_IDS)[number];

export const isActId = (n: number): n is ActId => (ACT_IDS as readonly number[]).includes(n);
