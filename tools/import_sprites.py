# Importa las hojas de sprites de NOVEDADES/ a assets/sprites/ con el ID y la ruta que espera el juego.
# Uso: python tools/import_sprites.py
#
# Las hojas llegan con hasta 48 fotogramas por fila (12 288 px de ancho): muchos móviles no cargan texturas de más
# de 4096 px, así que cada animación se queda en 16 fotogramas como mucho, tomados a intervalos iguales del tramo
# útil, y se ajustan los fps. El JSON sigue el contrato de la biblia de arte (filas = 8 direcciones).
import json
from pathlib import Path

from PIL import Image

SRC = Path('NOVEDADES')
OUT = Path('assets/sprites')
CELL = 256

# Carpeta de NOVEDADES → (categoría, ID en el juego).
SOURCES = {
    'gus': ('characters', 'gus'),
    'mensajero': ('characters', 'benny'),
    'saqueador': ('enemies', 'saqueador'),
    'kingrat': ('bosses', 'rey_rata'),
}

# Por animación: fotogramas finales y fps. `span` = fotogramas de origen que forman la animación (el resto repite).
DEFAULT = {
    'idle': {'frames': 12, 'fps': 10},
    'run': {'frames': 12, 'fps': 16},
    'death': {'frames': 16, 'fps': 12},
    'hit': {'frames': 8, 'fps': 16},
    'attack_1': {'frames': 16, 'fps': 12},
    'attack_2': {'frames': 16, 'fps': 12},
    'victory': {'frames': 16, 'fps': 12},
}
OVERRIDE = {
    # 48 fotogramas = 4 vueltas del mismo ciclo de 12; el saqueador camina, no corre.
    ('saqueador', 'run'): {'frames': 12, 'fps': 12, 'span': 12},
    # Un ciclo de paso pesado en 32: más lento que el de los supervivientes.
    ('rey_rata', 'run'): {'frames': 16, 'fps': 10},
}


def resample(img: Image.Image, src_frames: int, rows: int, n: int, span: int, loop: bool) -> Image.Image:
    """Fotogramas a intervalos iguales de los `span` primeros; en bucle no se repite el primero al final."""
    n = min(n, span)
    step = span / n if loop else (span - 1) / max(1, n - 1)
    out = Image.new('RGBA', (n * CELL, rows * CELL))
    for k in range(n):
        src = min(src_frames - 1, round(k * step))
        out.paste(img.crop((src * CELL, 0, (src + 1) * CELL, rows * CELL)), (k * CELL, 0))
    return out


for folder, (category, gid) in SOURCES.items():
    dest = OUT / category / gid
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob(f'{gid}_*'):
        old.unlink()
    for path in sorted((SRC / folder).glob('*.json')):
        meta = json.loads(path.read_text(encoding='utf8'))
        anim = meta['anim']
        if anim not in DEFAULT:
            print(f'{category}/{gid}: animación «{anim}» desconocida, se omite (válidas: {", ".join(DEFAULT)})')
            continue
        rule = {**DEFAULT[anim], **OVERRIDE.get((gid, anim), {})}
        img = Image.open(path.with_suffix('.png')).convert('RGBA')
        rows = img.height // CELL
        sheet = resample(img, meta['frames'], rows, rule['frames'], rule.get('span', meta['frames']), meta['loop'])
        meta.update(id=gid, frames=sheet.width // CELL, fps=rule['fps'])
        name = f'{gid}_{anim}'
        sheet.save(dest / f'{name}.png', optimize=True)
        (dest / f'{name}.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf8', newline='\n')
        print(f'{category}/{name}: {meta["frames"]} fotogramas a {meta["fps"]} fps, {sheet.width}×{sheet.height}')
