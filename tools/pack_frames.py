"""Monta las hojas de sprites a partir de los fotogramas de render_rigido.py.

Uso: python tools/pack_frames.py <carpeta_render> <id> [<id_extra> ...] [--cat=bosses]

Lee <carpeta_render>/_render.json y _frames/<anim>_<dir>_<nn>.png y escribe
assets/sprites/<cat>/<id>/<id>_<anim>.png + .json (cat = enemies si no se dice) (filas = direcciones,
columnas = fotogramas). Cada <id_extra> recibe una copia con su propio ID
(la cría de la aspiradora usa las hojas de la madre a otra escala).
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--cat=')]
cat = next((a[6:] for a in sys.argv[1:] if a.startswith('--cat=')), 'enemies')
OUT = ROOT / 'assets' / 'sprites' / cat

src = Path(args[0])
ids = args[1:]
info = json.loads((src / '_render.json').read_text(encoding='utf8'))
cell = info['cell']
dirs = info['directions']

for anim, a in info['anims'].items():
    n = a['frames']
    sheet = Image.new('RGBA', (cell * n, cell * len(dirs)))
    for r, d in enumerate(dirs):
        for c in range(n):
            sheet.paste(Image.open(src / '_frames' / f'{anim}_{d}_{c:02d}.png').convert('RGBA'), (c * cell, r * cell))
    for gid in ids:
        dest = OUT / gid
        dest.mkdir(parents=True, exist_ok=True)
        meta = dict(id=gid, anim=anim, cell=[cell, cell], pivot=info['pivot'], directions=dirs, frames=n, fps=a['fps'],
                    loop=a['loop'])
        sheet.save(dest / f'{gid}_{anim}.png', optimize=True)
        (dest / f'{gid}_{anim}.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf8', newline='\n')
        print(f'{cat}/{gid}_{anim}: {n} fotogramas a {a["fps"]} fps, {sheet.width}×{sheet.height}')
