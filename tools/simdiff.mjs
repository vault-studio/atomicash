/* global process, console */
// Compara dos exportaciones de estadísticas (carpetas con un .json por partida, o dos summary.csv de `npm run balance`).
// Uso: node tools/simdiff.mjs out/sim-antes out/sim · Con una sola carpeta (summary.csv), resume: media de
// supervivencia, victorias y de qué se muere cada grupo.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [a, b] = process.argv.slice(2);
if (!a) {
  console.error('Uso: node tools/simdiff.mjs <antes> <después> | <carpeta>');
  process.exit(1);
}

/** Lee summary.csv (una fila por partida) y agrupa por personaje y build medias de las columnas numéricas. */
function loadCsv(dir) {
  const [head, ...lines] = readFileSync(join(dir, 'summary.csv'), 'utf8').trim().split('\n');
  const cols = head.split(',');
  const groups = new Map();
  for (const line of lines) {
    const cells = line
      .match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      .map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
    const key = [row.char, row.start ?? '', row.bot ?? ''].filter(Boolean).join(' ');
    const g = groups.get(key) ?? { n: 0, sum: {}, wins: 0, deaths: {} };
    g.n++;
    if (row.won === 'true') g.wins++;
    else if (row.deathCause) g.deaths[row.deathCause] = (g.deaths[row.deathCause] ?? 0) + 1;
    for (const c of cols) {
      const v = Number(row[c]);
      if (row[c] !== '' && Number.isFinite(v)) g.sum[c] = (g.sum[c] ?? 0) + v;
    }
    groups.set(key, g);
  }
  return groups;
}

const KEYS = [
  'time',
  'act',
  'level',
  'level120',
  'level240',
  'kills',
  'surrounded',
  'stuns',
  'chargesHit',
  'chargesDodged',
  'shellsHit',
  'shellsDodged',
  'rages',
];
const fmt = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));

if (!b) {
  const all = { n: 0, time: 0, wins: 0 };
  for (const [key, g] of loadCsv(a)) {
    const deaths = Object.entries(g.deaths)
      .sort((x, y) => y[1] - x[1])
      .map(([c, n]) => `${c} ${n}`)
      .join(', ');
    console.log(
      `${key} (n=${g.n}): ${fmt(g.sum.time / g.n)} s · acto ${fmt((g.sum.act ?? 0) / g.n)} · nivel 120 s ${fmt((g.sum.level120 ?? 0) / g.n)} · 240 s ${fmt((g.sum.level240 ?? 0) / g.n)} · victorias ${g.wins}/${g.n} · muere por: ${deaths || '—'}`,
    );
    all.n += g.n;
    all.time += g.sum.time;
    all.wins += g.wins;
  }
  console.log(`TOTAL (n=${all.n}): ${fmt(all.time / all.n)} s · victorias ${all.wins}/${all.n}`);
  process.exit(0);
}

if (!existsSync(join(a, 'summary.csv')) || !existsSync(join(b, 'summary.csv'))) {
  // Carpetas de JSON sueltos (npm run sim antiguo): compara los campos básicos.
  for (const f of readdirSync(b).filter((x) => x.endsWith('.json'))) {
    if (!existsSync(join(a, f))) continue;
    const ra = JSON.parse(readFileSync(join(a, f), 'utf8'));
    const rb = JSON.parse(readFileSync(join(b, f), 'utf8'));
    console.log(
      f,
      KEYS.filter((k) => k in ra && k in rb)
        .map((k) => `${k} ${ra[k]}→${rb[k]}`)
        .join(' · '),
    );
  }
  process.exit(0);
}

const ga = loadCsv(a);
const gb = loadCsv(b);
for (const [key, g] of gb) {
  const o = ga.get(key);
  const cols = new Set([...KEYS, ...Object.keys(g.sum).filter((c) => /^(taken|dealt)\./.test(c))]);
  const parts = [];
  for (const c of cols) {
    const vb = (g.sum[c] ?? 0) / g.n;
    const va = o ? (o.sum[c] ?? 0) / o.n : NaN;
    if (!vb && !va) continue;
    parts.push(o ? `${c} ${fmt(va)}→${fmt(vb)}` : `${c} ${fmt(vb)}`);
  }
  console.log(`${key} (n=${g.n}${o ? ` vs ${o.n}` : ', nuevo'}): ${parts.join(' · ')}`);
}
