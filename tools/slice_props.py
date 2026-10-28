# Recorta los objetos sueltos de las láminas de ARTE/ (fondo negro, sin baldosa debajo) a PNG con transparencia en
# assets/props/ y escribe assets/props/props.json con su tamaño, su punto de apoyo y el ancho de su base.
# Uso: python tools/slice_props.py
#
# Las láminas son rejillas de objetos (3×2 o 2×2) con un objeto por celda: cada trozo suelto (piedrecillas, matojos) va al
# objeto de la celda donde cae su centro, aunque el dibujo se salga un poco de ella. Los de una casilla se escalan con el mismo factor que las baldosas para
# que guarden su tamaño relativo (el juego los encoge después); los de 2 casillas en fila y los edificios de 3×3 se
# escalan para que su base llene su huella (384 y 768 px de ancho). El punto de apoyo es el centro de la huella: el centro
# de la base, subido un cuarto de su ancho (vale también para la fila de dos rombos).
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
MIN_PIECE = 20  # px de un trozo suelto para no tomarlo por ruido del fondo
PAD = 2
FILL = 0.9  # fracción del ancho de la huella que ocupa la base de los objetos de varias casillas
# Ancho de la huella en px de baldosa según las casillas que ocupa.
FOOT = {1: TILE, 2: TILE * 1.5, 9: TILE * 3}
BAND = 0.5  # fracción de abajo de un objeto de una casilla que se toma como su base (los demás, entero)
# Objetos descartados (nombre_índice): farola, carrito y neumáticos.
SKIP = {'obj_b_01', 'obj_b_02', 'obj_b_05'}
# Lámina → (casillas que ocupa cada objeto, columnas, filas). Los de 2 van en fila hacia abajo a la derecha (eje x
# del mundo).
SHEETS = {
    'obj_a': (Path('ARTE/objetos_1x1_a.webp'), 1, 3, 2),
    'obj_b': (Path('ARTE/objetos_1x1_b.webp'), 1, 3, 2),
    'long': (Path('ARTE/objetos_2x1.webp'), 2, 3, 2),
    'big': (Path('ARTE/objetos_2x2.webp'), 9, 2, 2),
}


def slice_sheet(name: str, path: Path, cells: int, ncol: int, nrow: int) -> list[dict]:
    img = np.array(Image.open(path).convert('RGB')).astype(float)
    level = img.max(2)
    mask = nd.binary_opening(level > BLACK + SOFT / 2, iterations=1)
    # Trozos por celda de la rejilla (de arriba abajo y de izquierda a derecha), con la sombra suave alrededor.
    lab, k = nd.label(nd.binary_dilation(mask, iterations=3))
    sizes = nd.sum(mask, lab, range(1, k + 1))
    centers = nd.center_of_mass(mask, lab, range(1, k + 1))
    owner = np.zeros(k + 1, int) - 1
    for n, ((cy, cx), size) in enumerate(zip(centers, sizes)):
        if size >= MIN_PIECE:
            col = min(ncol - 1, int(cx / img.shape[1] * ncol))
            row = min(nrow - 1, int(cy / img.shape[0] * nrow))
            owner[n + 1] = row * ncol + col
    out = []
    for i in range(ncol * nrow):
        if f'{name}_{i:02d}' in SKIP:
            continue
        mine = owner[lab] == i
        ys, xs = np.where(mine)
        y0, x0 = max(0, ys.min() - PAD), max(0, xs.min() - PAD)
        y1, x1 = min(img.shape[0], ys.max() + 1 + PAD), min(img.shape[1], xs.max() + 1 + PAD)
        rgb = img[y0:y1, x0:x1]
        a = np.clip((level[y0:y1, x0:x1] - BLACK) / SOFT, 0, 1) * mine[y0:y1, x0:x1]
        # Apoyo: centro de la franja de abajo del objeto sólido (sin la sombra), subido un cuarto de su ancho.
        solid = mask[y0:y1, x0:x1] & mine[y0:y1, x0:x1]
        rows = np.where(solid.any(1))[0]
        bottom = rows.max() + 1
        band_h = (bottom - rows.min()) * (BAND if cells == 1 else 1)
        band = solid[max(rows.min(), bottom - int(band_h)) : bottom].any(0)
        cols = np.where(band)[0]
        scale = SCALE if cells == 1 else FOOT[cells] * FILL / (cols.max() - cols.min() + 1)
        rgba = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
        w, h = max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))
        rgba = rgba.resize((w, h), Image.LANCZOS)
        cx = (cols.min() + cols.max() + 1) / 2 * scale
        foot_y = (bottom - (cols.max() - cols.min()) / 4) * scale
        info = {
            'file': f'{name}_{i:02d}.png',
            'cells': cells,
            'w': w,
            'h': h,
            'ax': round(cx / w, 3),
            'ay': round(foot_y / h, 3),
            # Ancho de la base en px de baldosa (256 = una casilla): de aquí sale el radio de choque.
            'fw': round((cols.max() - cols.min() + 1) * scale),
        }
        rgba.save(OUT / info['file'], optimize=True)
        out.append(info)
    return out


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
props = [p for n, sheet in SHEETS.items() for p in slice_sheet(n, *sheet)]
(OUT / 'props.json').write_text(json.dumps({'tile': TILE, 'props': props}, indent=2) + '\n', encoding='utf8', newline='\n')
for p in props:
    print(p['file'], p['cells'], p['w'], p['h'], p['ax'], p['ay'], p['fw'])
