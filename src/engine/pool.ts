// Object pooling denso (05_TECH.md §3): los objetos vivos ocupan items[0..count).
// Liberar intercambia con el último, así que recorrer y liberar se hace de atrás hacia delante.
// Solo se reserva memoria cuando el pool crece por encima de lo que ya tenía.

/**
 * Deja como decimales los campos numéricos de `o` sin cambiar sus valores. Un objeto que nace con `x: 0` tiene un campo
 * entero: la primera vez que guarda un decimal, V8 cambia el mapa de ese tipo de objeto y luego migra los demás uno a
 * uno, a media partida. Cada cambio deshace lo optimizado del bucle de IA, que vuelve a correr sin optimizar y a reservar
 * memoria en cada operación con decimales. Solo para crear objetos (recorre sus claves): nunca en el bucle caliente.
 */
export function decimalFields<T extends object>(o: T): T {
  const fields = o as Record<string, unknown>;
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (typeof v !== 'number') continue;
    fields[k] = 0.5;
    fields[k] = v;
  }
  return o;
}

export class Pool<T extends object> {
  readonly items: T[] = [];
  count = 0;

  constructor(
    private readonly create: () => T,
    prealloc = 0,
  ) {
    for (let i = 0; i < prealloc; i++) this.grow();
  }

  private grow(): void {
    this.items.push(decimalFields(this.create()));
  }

  /** Devuelve un objeto libre (reutilizado si existe). El llamador debe reinicializar sus campos. */
  acquire(): T {
    if (this.count === this.items.length) this.grow();
    return this.items[this.count++] as T;
  }

  /** Libera el objeto de la posición `i` moviendo el último vivo a su hueco. */
  releaseAt(i: number): void {
    const last = --this.count;
    if (i !== last) {
      const tmp = this.items[i] as T;
      this.items[i] = this.items[last] as T;
      this.items[last] = tmp;
    }
  }

  clear(): void {
    this.count = 0;
  }
}
