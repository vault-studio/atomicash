// Genera assets/manifest.json con todas las hojas de sprites (node make-manifest.mjs)
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = 'assets/sprites', out = [];
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.json') && existsSync(p.replace(/\.json$/, '.png'))) out.push(relative(root, p).replace(/\\/g, '/').replace(/\.json$/, ''));
  }
}
if (!existsSync(root)) { console.error('No existe ' + root); process.exit(1); }
walk(root); out.sort();
writeFileSync('assets/manifest.json', JSON.stringify(out, null, 2));
console.log(`assets/manifest.json: ${out.length} hojas`);
