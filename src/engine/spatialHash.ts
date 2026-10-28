// Spatial hash de rejilla fija para colisiones de círculos (05_TECH.md §3, celdas de 64 px).
// La rejilla se repite (coordenadas módulo su tamaño) porque el mapa no tiene bordes: dos puntos lejanos pueden
// caer en la misma celda, pero `query` comprueba la distancia real, así que solo cuesta algún candidato de más.
// Se reconstruye cada tick con una ordenación por conteo sobre arrays tipados: sin allocations
// mientras el número de entidades no supere la capacidad reservada.

export interface Circle {
  x: number;
  y: number;
  r: number;
}

const wrap = (i: number, n: number): number => ((i % n) + n) % n;

export class SpatialHash<T extends Circle = Circle> {
  readonly cols: number;
  readonly rows: number;
  private readonly inv: number;
  /** cellStart[c]..cellStart[c+1] son las entradas de la celda c. */
  private readonly cellStart: Int32Array;
  private readonly cursor: Int32Array;
  private entries: Int32Array;
  private src: readonly T[] = [];
  private n = 0;

  constructor(
    worldSize: number,
    readonly cellSize: number,
    capacity: number,
  ) {
    this.cols = Math.max(1, Math.ceil(worldSize / cellSize));
    this.rows = this.cols;
    this.inv = 1 / cellSize;
    this.cellStart = new Int32Array(this.cols * this.rows + 1);
    this.cursor = new Int32Array(this.cols * this.rows);
    this.entries = new Int32Array(Math.max(1, capacity));
  }

  get capacity(): number {
    return this.entries.length;
  }

  get size(): number {
    return this.n;
  }

  private col(x: number): number {
    return wrap(Math.floor(x * this.inv), this.cols);
  }

  private row(y: number): number {
    return wrap(Math.floor(y * this.inv), this.rows);
  }

  /** Indexa items[0..count) por la celda de su centro. Los índices devueltos por `query` son de este array. */
  build(items: readonly T[], count: number): void {
    if (count > this.entries.length) this.entries = new Int32Array(Math.max(count, this.entries.length * 2));
    this.src = items;
    this.n = count;
    const start = this.cellStart;
    const cur = this.cursor;
    start.fill(0);
    for (let i = 0; i < count; i++) {
      const it = items[i] as T;
      start[this.row(it.y) * this.cols + this.col(it.x) + 1]!++;
    }
    for (let c = 1; c < start.length; c++) start[c]! += start[c - 1]!;
    // Copia a mano: `subarray` crearía una vista nueva en cada tick.
    for (let c = 0; c < cur.length; c++) cur[c] = start[c]!;
    for (let i = 0; i < count; i++) {
      const it = items[i] as T;
      this.entries[cur[this.row(it.y) * this.cols + this.col(it.x)]!++] = i;
    }
  }

  /**
   * Escribe en `out` los índices de los items cuyo círculo toca el círculo (x, y, r).
   * Devuelve cuántos ha escrito (como mucho `out.length`). `maxR` es el radio máximo de los items,
   * necesario para no perder vecinos cuyo centro cae en una celda contigua.
   */
  query(x: number, y: number, r: number, maxR: number, out: Int32Array): number {
    const reach = r + maxR;
    // Celdas sin repetir: si el radio abarca más que la rejilla, basta con recorrerla una vez.
    const c0 = Math.floor((x - reach) * this.inv);
    const c1 = Math.min(Math.floor((x + reach) * this.inv), c0 + this.cols - 1);
    const r0 = Math.floor((y - reach) * this.inv);
    const r1 = Math.min(Math.floor((y + reach) * this.inv), r0 + this.rows - 1);
    const items = this.src;
    let k = 0;
    for (let ry = r0; ry <= r1; ry++) {
      const cy = wrap(ry, this.rows);
      for (let rx = c0; rx <= c1; rx++) {
        const cell = cy * this.cols + wrap(rx, this.cols);
        const end = this.cellStart[cell + 1]!;
        for (let e = this.cellStart[cell]!; e < end; e++) {
          const i = this.entries[e]!;
          const it = items[i] as T;
          const dx = it.x - x;
          const dy = it.y - y;
          const rr = r + it.r;
          if (dx * dx + dy * dy < rr * rr) {
            if (k >= out.length) return k;
            out[k++] = i;
          }
        }
      }
    }
    return k;
  }
}
