# Recorta las baldosas isométricas de ARTE/tiles_yermo.webp y ARTE/tiles_deco.webp (6×5 cada una, fondo negro)
# a PNG con transparencia en assets/tiles/ y escribe assets/tiles/tiles.json con lo que hay en cada una.
# Uso: python tools/slice_tiles.py
#
# Cada baldosa de la lámina es un bloque: cara superior (rombo ~1,5:1, algo girado) y un canto de tierra
# debajo. Se buscan sus esquinas, se lleva la cara a un rombo 2:1 de 256×128 con una transformación afín y se
# tira el canto. Lo que sobresale por encima de la cara (vallas, postes, árboles) se conserva en un margen
# superior (`head` en tiles.json).
# DECISIÓN: la afín aplasta ~25 % en vertical también los objetos; a esta escala no se nota y evita costuras.
# DECISIÓN: los objetos van pintados en el suelo (calcomanía), sin capa aparte que tape a los personajes: los
# más altos apenas sobresalen 25 px de la cara, y separar el objeto del suelo pintado no es fiable.
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

OUT = Path('assets/tiles')
W, H = 256, 128
HEAD = 128  # margen superior para lo que sobresale
COLS, ROWS = 6, 5
BLACK = 28  # canal máximo por debajo del cual es fondo
WALL = 9  # alto del canto de tierra bajo la cara, en píxeles de la lámina
HALF = 122.5  # medio ancho de la cara, en píxeles de la lámina
INSET = 0.97
SHEETS = {'yermo': Path('ARTE/tiles_yermo.webp'), 'deco': Path('ARTE/tiles_deco.webp')}


def grid(mask: np.ndarray):
    """Centros aproximados de las 30 baldosas: rejilla regular a partir de los extremos del dibujo."""
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pw, ph = (x1 - x0) / COLS, (y1 - y0) / ROWS
    return [(int(x0 + (c + 0.5) * pw), int(y0 + (r + 0.5) * ph)) for r in range(ROWS) for c in range(COLS)], pw, ph


def edge_points(mask: np.ndarray, cx: int, cy: int) -> dict[int, np.ndarray]:
    """Puntos del borde inferior del canto a cada lado del centro de la celda (cx, cy)."""
    pts: dict[int, list[tuple[int, int]]] = {-1: [], 1: []}
    for side in (-1, 1):
        for d in range(25, 100, 5):
            x = cx + side * d
            y = cy
            while y < mask.shape[0] - 5 and not mask[y, x]:
                y += 1
            while y < mask.shape[0] - 5 and mask[y : y + 4, x].any():
                y += 1
            pts[side].append((x, y))
    return {k: np.array(v, float) for k, v in pts.items()}


def corners(pts: dict[int, np.ndarray], sl: float, sr: float):
    """Esquinas izquierda, derecha e inferior de la cara superior.

    Las baldosas de la lámina a veces se tocan por los lados, así que no se usan los extremos: con las pendientes
    de toda la lámina (la perspectiva es la misma) se toma la mediana de la ordenada en el origen de los puntos del
    borde inferior del canto de cada lado (inmune a un barril que asome), y su cruce da la esquina de abajo.
    """
    il = float(np.median(pts[-1][:, 1] - sl * pts[-1][:, 0]))
    ir = float(np.median(pts[1][:, 1] - sr * pts[1][:, 0]))
    bx = (ir - il) / (sl - sr)
    by = sl * bx + il - WALL
    B = np.array([bx, by])
    L = np.array([bx - HALF, by - sl * HALF])
    R = np.array([bx + HALF, by + sr * HALF])
    # Un poco hacia dentro, para no arrastrar el borde negro ni la arista del canto.
    C = (L + R) / 2
    return C + (L - C) * INSET, C + (R - C) * INSET, C + (B - C) * INSET


def affine_for(L, R, B):
    """Coeficientes para Image.transform(AFFINE): de coordenadas destino a origen."""
    dst = np.array([[0, HEAD + H / 2, 1], [W, HEAD + H / 2, 1], [W / 2, HEAD + H, 1]], float)
    src = np.array([L, R, B], float)
    m = np.linalg.solve(dst, src)  # 3×2
    return (m[0, 0], m[1, 0], m[2, 0], m[0, 1], m[1, 1], m[2, 1])


def slice_sheet(name: str, path: Path) -> list[dict]:
    img = Image.open(path).convert('RGB')
    arr = np.array(img).astype(int)
    mask = nd.binary_opening(arr.max(2) > BLACK, iterations=1)
    centers, pw, ph = grid(mask)
    out = []
    yy, xx = np.mgrid[0 : HEAD + H, 0:W]
    # Rombo de la cara y semiplano «por encima de los dos lados inferiores» en el destino.
    cxw, cyw = W / 2, HEAD + H / 2
    dist = np.abs(xx - cxw) / (W / 2) + np.abs(yy - cyw) / (H / 2)
    in_face = dist <= 1.0
    above_lower = (yy - cyw) / (H / 2) <= 1 - np.abs(xx - cxw) / (W / 2)
    above_upper = (cyw - yy) / (H / 2) >= 1 - np.abs(xx - cxw) / (W / 2)
    edges = [edge_points(mask, cx, cy) for cx, cy in centers]
    sl = float(np.median([np.polyfit(*e[-1].T, 1)[0] for e in edges]))
    sr = float(np.median([np.polyfit(*e[1].T, 1)[0] for e in edges]))
    found = [corners(e, sl, sr) for e in edges]
    # Huella de cada baldosa en la lámina (cara + canto), para no confundir la vecina de arriba con un objeto.
    feet = []
    for L, R, B in found:
        thick = WALL + 4
        T = L + R - B
        im = Image.new('L', img.size, 0)
        ImageDraw.Draw(im).polygon([tuple(T), tuple(R), tuple(R + [0, thick]), tuple(B + [0, thick]),
                                    tuple(L + [0, thick]), tuple(L)], fill=255)
        feet.append(nd.binary_dilation(np.array(im) > 0, iterations=4))
    for i, (L, R, B) in enumerate(found):
        others = Image.fromarray((np.logical_or.reduce([f for j, f in enumerate(feet) if j != i]) * 255).astype(np.uint8))
        tile = img.transform((W, HEAD + H), Image.AFFINE, affine_for(L, R, B), resample=Image.BICUBIC)
        t = np.array(tile).astype(int)
        # Si la baldosa de la lámina está algo girada, el borde de la cara recoge fondo negro, que en el juego se ve
        # como rayas oscuras: esos píxeles toman el color más cercano de la cara.
        edge = in_face & (dist > 0.85) & (t.max(2) < 45)
        if edge.any():
            iy, ix = nd.distance_transform_edt(edge | ~in_face, return_distances=False, return_indices=True)
            t[edge] = t[iy[edge], ix[edge]]
        solid = t.max(2) > BLACK
        # Lo que sobresale: no negro, por encima de la cara y conectado con ella (nada de la baldosa vecina).
        other = np.array(others.transform((W, HEAD + H), Image.AFFINE, affine_for(L, R, B), resample=Image.NEAREST)) > 0
        stick = solid & above_upper & ~in_face & ~other
        lab, _ = nd.label(stick | in_face)
        keep = lab == lab[int(cyw), int(cxw)]
        alpha = (in_face | (stick & keep)) & above_lower
        a = nd.gaussian_filter(alpha.astype(float), 0.6)
        a[in_face] = 1.0
        rgba = np.dstack([t.astype(np.uint8), (np.clip(a, 0, 1) * 255).astype(np.uint8)])
        face = t[in_face]
        r, g, b = face[:, 0], face[:, 1], face[:, 2]
        acid = float(((g > 100) & (g >= r * 0.85) & (g - b > 80)).mean())
        rows = np.where((stick & keep).any(1))[0]
        head = max(0, int(HEAD - rows.min())) if len(rows) else 0
        # Recorta el margen superior que no se usa.
        rgba = rgba[HEAD - head :]
        fname = f'{name}_{i:02d}.png'
        Image.fromarray(rgba, 'RGBA').save(OUT / fname, optimize=True)
        info = {'file': fname, 'head': head, 'acid': acid > 0.04}
        out.append(info)
    return out


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
meta = {'width': W, 'height': H, 'sets': {n: slice_sheet(n, p) for n, p in SHEETS.items()}}
(OUT / 'tiles.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf8', newline='\n')
for n, tiles in meta['sets'].items():
    print(n, len(tiles), 'acido:', [t['file'] for t in tiles if t['acid']])
