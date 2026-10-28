# Recorta las baldosas isométricas de las láminas de ARTE/ (3×2 cada una, fondo negro) a PNG con transparencia en
# assets/tiles/ y escribe assets/tiles/tiles.json con lo que hay en cada una.
# Uso: python tools/slice_tiles.py
#
# Cada baldosa de la lámina es un bloque suelto: cara superior (rombo ~1,4:1) y un canto de tierra debajo. Se buscan
# sus esquinas, se lleva la cara a un rombo 2:1 de 256×128 con una transformación afín y se tira el canto. Lo que
# sobresale por encima de la cara (árbol, poste, señales, surtidor) va aparte en `_top.png`, que el juego ordena en
# profundidad con los personajes para que puedan pasar por detrás.
# DECISIÓN: la afín aplasta ~30 % en vertical también los objetos; a esta escala apenas se nota y evita costuras.
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

OUT = Path('assets/tiles')
W, H = 256, 128
HEAD = 256  # margen superior para lo que sobresale
BLACK = 28  # canal máximo por debajo del cual es fondo
INSET = 0.98  # la cara se toma un poco hacia dentro para no arrastrar la arista
RIM = 0.965  # desde aquí hasta el borde de la cara se rellena con el interior
LIGHT = 30  # radio (px) de la luz de baja frecuencia que se aplana en las láminas de FLATTEN
FLATTEN = ('suelo',)
MIN_TOP = 8  # px que tiene que sobresalir un objeto para ir aparte
# DECISIÓN: el suelo es solo arena y lagos de ácido; la decoración irá aparte, como objetos sin baldosa.
SHEETS = {
    'suelo': Path('ARTE/tiles_suelo_acido.webp'),
}

yy, xx = np.mgrid[0 : HEAD + H, 0:W]
cxw, cyw = W / 2, HEAD + H / 2
dist = np.abs(xx - cxw) / (W / 2) + np.abs(yy - cyw) / (H / 2)
in_face = dist <= 1.0
# Por encima de los lados de abajo / de arriba del rombo de destino.
above_lower = (yy - cyw) / (H / 2) <= 1 - np.abs(xx - cxw) / (W / 2)
above_upper = (cyw - yy) / (H / 2) >= 1 - np.abs(xx - cxw) / (W / 2)
face = in_face[HEAD:]


def blobs(mask: np.ndarray) -> list[np.ndarray]:
    """Una máscara por baldosa, de arriba abajo y de izquierda a derecha."""
    lab, k = nd.label(mask)
    sizes = nd.sum(mask, lab, range(1, k + 1))
    out = [lab == i + 1 for i, s in enumerate(sizes) if s > 20000]
    centers = [np.argwhere(b).mean(0) for b in out]
    order = sorted(range(len(out)), key=lambda i: (round(centers[i][0] / 300), centers[i][1]))
    return [out[i] for i in order]


def corners(blob: np.ndarray):
    """Esquinas izquierda, derecha e inferior de la cara superior (las de los lados no las tocan los objetos)."""
    ys, xs = np.where(blob)
    lx, rx = xs.min(), xs.max()
    lcol, rcol = ys[xs <= lx + 1], ys[xs >= rx - 1]
    L = np.array([lx, lcol.min()], float)
    R = np.array([rx, rcol.min()], float)
    # Alto del canto: lo que sigue habiendo tierra bajo las esquinas de los lados.
    wall = ((lcol.max() - lcol.min()) + (rcol.max() - rcol.min())) / 2
    bottom = ys.max()
    B = np.array([xs[ys >= bottom - 1].mean(), bottom - wall], float)
    C = (L + R) / 2
    return C + (L - C) * INSET, C + (R - C) * INSET, C + (B - C) * INSET


def affine_for(L, R, B):
    """Coeficientes para Image.transform(AFFINE): de coordenadas destino a origen."""
    dst = np.array([[0, cyw, 1], [W, cyw, 1], [W / 2, HEAD + H, 1]], float)
    m = np.linalg.solve(dst, np.array([L, R, B], float))
    return (m[0, 0], m[1, 0], m[2, 0], m[0, 1], m[1, 1], m[2, 1])


def flatten_light(rgb: np.ndarray, ref: np.ndarray) -> None:
    """Cada baldosa trae su propia luz (una esquina más clara) y al juntarlas se nota la rejilla: se divide por la
    luz de baja frecuencia de la cara y se multiplica por su media. La luz se mide solo en `ref` (la arena), para que
    el brillo del ácido no cuente como luz de la lámina."""
    f = rgb[-H:]
    wsum = nd.gaussian_filter(ref.astype(float), LIGHT)
    low = np.dstack([nd.gaussian_filter(f[..., c] * ref, LIGHT) for c in range(3)]) / np.maximum(wsum, 1e-3)[..., None]
    f[face] = (f * f[ref].mean(0) / np.maximum(low, 1))[face]


def slice_sheet(name: str, path: Path) -> list[dict]:
    img = Image.open(path).convert('RGB')
    mask = nd.binary_opening(np.array(img).max(2) > BLACK, iterations=2)
    out = []
    for i, blob in enumerate(blobs(mask)):
        coef = affine_for(*corners(blob))
        t = np.array(img.transform((W, HEAD + H), Image.AFFINE, coef, resample=Image.BICUBIC)).astype(float)
        mine = np.array(Image.fromarray(blob).transform((W, HEAD + H), Image.AFFINE, coef, resample=Image.NEAREST))
        # Arista: el bisel oscuro y el fondo negro que pueda colarse toman el color más cercano del interior.
        edge = in_face & ((dist > RIM) | (t.max(2) < 45))
        iy, ix = nd.distance_transform_edt(edge | ~in_face, return_distances=False, return_indices=True)
        t[edge] = t[iy[edge], ix[edge]]
        r, g, b = t[..., 0], t[..., 1], t[..., 2]
        green = (g > 100) & (g >= r * 0.85) & (g - b > 80)
        acid = float(green[in_face].mean())
        if name in FLATTEN:
            flatten_light(t, face & ~nd.binary_dilation(green[HEAD:], iterations=12))
        # Lo que sobresale: de esta baldosa, no negro y por encima de la cara.
        stick = mine & (t.max(2) > BLACK) & above_upper & ~in_face & above_lower
        stick &= nd.binary_opening(stick, iterations=1)
        rows = np.where(stick.any(1))[0]
        head = max(0, int(HEAD - rows.min())) if len(rows) else 0
        a = nd.gaussian_filter((in_face | stick).astype(float), 0.6)
        a[in_face] = 1.0
        rgba = np.dstack([np.clip(t, 0, 255), np.clip(a, 0, 1) * 255]).astype(np.uint8)[HEAD - head :]
        info: dict = {'file': f'{name}_{i:02d}.png', 'head': head}
        if acid > 0.04:
            info['acid'] = round(acid, 3)
        if head >= MIN_TOP:
            # Suelo sin lo que sobresale y, aparte, solo lo que sobresale (mismo lienzo y ancla).
            top = rgba.copy()
            top[..., 3] = np.where(stick[HEAD - head :], top[..., 3], 0)
            rgba[..., 3] = np.where(in_face[HEAD - head :], rgba[..., 3], 0)
            info['top'] = f'{name}_{i:02d}_top.png'
            Image.fromarray(top, 'RGBA').save(OUT / info['top'], optimize=True)
        Image.fromarray(rgba, 'RGBA').save(OUT / info['file'], optimize=True)
        out.append(info)
    return out


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
meta = {'width': W, 'height': H, 'sets': {n: slice_sheet(n, p) for n, p in SHEETS.items()}}
(OUT / 'tiles.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf8', newline='\n')
for n, tiles in meta['sets'].items():
    print(n, [(t['file'][-6:-4], t['head'], t.get('acid', ''), 'top' if 'top' in t else '') for t in tiles])
