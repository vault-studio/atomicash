// Object pooling denso (05_TECH.md §3): los objetos vivos ocupan items[0..count).
// Liberar intercambia con el último, así que recorrer y liberar se hace de atrás hacia delante.
// Solo se reserva memoria cuando el pool crece por encima de lo que ya tenía.

export class Pool<T> {
  readonly items: T[] = [];
  count = 0;

  constructor(
    private readonly create: () => T,
    prealloc = 0,
  ) {
    for (let i = 0; i < prealloc; i++) this.items.push(create());
  }

  /** Devuelve un objeto libre (reutilizado si existe). El llamador debe reinicializar sus campos. */
  acquire(): T {
    if (this.count === this.items.length) this.items.push(this.create());
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
