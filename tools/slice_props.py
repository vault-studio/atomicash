# Recorta los objetos sueltos de las láminas de ARTE/ (fondo negro, sin baldosa debajo) a PNG con transparencia en
# assets/props/ y escribe assets/props/props.json con su tamaño y su punto de apoyo.
# Uso: python tools/slice_props.py
#
# Cada objeto es una mancha separada de las demás; los trozos sueltos (piedrecillas, sombra) se juntan con el
# objeto más cercano dilatando la máscara. Se escalan todos con el mismo factor que las baldosas para que guarden
# su tamaño relativo, y el punto de apoyo es el centro de la huella: el centro de la base, subido un cuarto de
# su ancho.
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

OUT = Path('assets/props')
FACE = 480  # ancho de la cara de una baldosa en las láminas de ARTE/
TILE = 256  # ancho del rombo recortado
SCALE = TILE / FACE
BLACK = 10  # canal máximo por debajo del cual es fondo
SOFT = 40  # desde BLACK hasta BLACK + SOFT el fondo pasa a opaco (sombras suaves)
JOIN = 18  # px de dilatación para juntar los trozos sueltos de un objeto
PAD = 2
BAND = 0.2  # fracción de abajo del objeto que se toma como su base
SHEETS = {
    'obj_a': Path('ARTE/objetos_1x1_a.webp'),
    'obj_b': Path('ARTE/objetos_1x1_b.webp'),
}


def slice_sheet(name: str, path: Path) -> list[dict]:
    img = np.array(Image.open(path).convert('RGB')).astype(float)
    level = img.max(2)
    mask = nd.binary_opening(level > BLACK + SOFT / 2, iterations=1)
    lab, _ = nd.label(nd.binary_dilation(mask, iterations=JOIN))
    objs = []
    for sl in nd.find_objects(lab):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        if (y1 - y0) * (x1 - x0) < 4000:
            continue
        objs.append((y0, y1, x0, x1))
    # De arriba abajo y de izquierda a derecha.
    objs.sort(key=lambda b: (round((b[0] + b[1]) / 2 / (img.shape[0] / 2) - 0.5), b[2]))
    out = []
    for i, (y0, y1, x0, x1) in enumerate(objs):
        y0, x0 = max(0, y0 - PAD), max(0, x0 - PAD)
        y1, x1 = min(img.shape[0], y1 + PAD), min(img.shape[1], x1 + PAD)
        rgb = img[y0:y1, x0:x1]
        a = np.clip((level[y0:y1, x0:x1] - BLACK) / SOFT, 0, 1) * (lab[y0:y1, x0:x1] > 0)
        rgba = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
        w, h = max(1, round(rgba.width * SCALE)), max(1, round(rgba.height * SCALE))
        rgba = rgba.resize((w, h), Image.LANCZOS)
        # Apoyo: centro de la franja de abajo del objeto sólido (sin la sombra), subido un cuarto de su ancho.
        solid = mask[y0:y1, x0:x1]
        rows = np.where(solid.any(1))[0]
        bottom = rows.max() + 1
        band = solid[max(rows.min(), bottom - int((bottom - rows.min()) * BAND)) : bottom].any(0)
        cols = np.where(band)[0]
        cx = (cols.min() + cols.max() + 1) / 2 * SCALE
        foot_y = (bottom - (cols.max() - cols.min()) / 4) * SCALE
        info = {'file': f'{name}_{i:02d}.png', 'w': w, 'h': h, 'ax': round(cx / w, 3), 'ay': round(foot_y / h, 3)}
        rgba.save(OUT / info['file'], optimize=True)
        out.append(info)
    return out


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
props = [p for n, path in SHEETS.items() for p in slice_sheet(n, path)]
(OUT / 'props.json').write_text(json.dumps({'tile': TILE, 'props': props}, indent=2) + '\n', encoding='utf8', newline='\n')
for p in props:
    print(p['file'], p['w'], p['h'], p['ax'], p['ay'])
