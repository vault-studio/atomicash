# Recorta la lámina de objetos del mapa (ARTE/objetos_mapa.webp, rejilla 6×3 sobre fondo negro) a PNG con transparencia
# en assets/pickups/ y escribe assets/pickups/pickups.json con el punto de apoyo de cada uno.
# Uso: python tools/slice_pickups.py
#
# Cada trozo suelto (chispas, humo, pastillas) va al objeto de la celda donde cae su centro. El lado mayor se reduce a
# MAX px; el juego los escala después según el radio del recogible y los apoya por el centro de la base del objeto
# sólido (`ay`, fracción de la altura).
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC = Path('ARTE/objetos_mapa.webp')
OUT = Path('assets/pickups')
MAX = 160
BLACK = 10  # canal máximo por debajo del cual es fondo
SOFT = 40  # desde BLACK hasta BLACK + SOFT el fondo pasa a opaco (brillos y humo)
SOLID = 90  # canal máximo a partir del cual el píxel es del objeto y no de su brillo
MIN_PIECE = 20
PAD = 2
NCOL, NROW = 6, 3
# Orden de la lámina, de izquierda a derecha y de arriba abajo.
NAMES = [
    'crate', 'chest', 'cache', 'medkit', 'magnet', 'bomb',
    'freeze', 'nuka', 'gem1', 'gem5', 'gem25', 'stim',
    'coupon', 'barrel', 'barrel_lit', 'beacon', 'mine', 'iodine',
]

img = np.array(Image.open(SRC).convert('RGB')).astype(float)
level = img.max(2)
mask = nd.binary_opening(level > BLACK + SOFT / 2, iterations=1)
lab, k = nd.label(nd.binary_dilation(mask, iterations=3))
sizes = nd.sum(mask, lab, range(1, k + 1))
centers = nd.center_of_mass(mask, lab, range(1, k + 1))
owner = np.zeros(k + 1, int) - 1
for n, ((cy, cx), size) in enumerate(zip(centers, sizes)):
    if size >= MIN_PIECE:
        col = min(NCOL - 1, int(cx / img.shape[1] * NCOL))
        row = min(NROW - 1, int(cy / img.shape[0] * NROW))
        owner[n + 1] = row * NCOL + col

OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
index = {}
for i, name in enumerate(NAMES):
    mine = owner[lab] == i
    ys, xs = np.where(mine)
    y0, x0 = max(0, ys.min() - PAD), max(0, xs.min() - PAD)
    y1, x1 = min(img.shape[0], ys.max() + 1 + PAD), min(img.shape[1], xs.max() + 1 + PAD)
    rgb = img[y0:y1, x0:x1]
    a = np.clip((level[y0:y1, x0:x1] - BLACK) / SOFT, 0, 1) * mine[y0:y1, x0:x1]
    rgba = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
    scale = min(1, MAX / max(rgba.size))
    w, h = max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))
    rgba = rgba.resize((w, h), Image.LANCZOS)
    # Base y tamaño del cuerpo sólido (sin brillo ni chispas), para escalar y apoyar todos igual.
    solid = (level[y0:y1, x0:x1] > SOLID) & mine[y0:y1, x0:x1]
    sy, sx = np.where(solid)
    bottom = sy.max() + 1
    index[name] = {
        'file': f'{name}.png',
        'ay': round(float(bottom / (y1 - y0)), 3),
        # Ancho del cuerpo en px de la textura: el juego lo iguala a un múltiplo del radio.
        'bw': round(float((sx.max() - sx.min() + 1) * scale)),
    }
    rgba.save(OUT / f'{name}.png', optimize=True)
    print(name, w, h, index[name])


def boots() -> None:
    """
    Botas de velocidad: no están en la lámina del mapa; salen de la ficha `boots` de ARTE/iconos_rasgos.webp
    (segunda de la primera fila), recortando la bota marrón de la piedra gris y de las rayas de velocidad claras.
    """
    sheet = Image.open('ARTE/iconos_rasgos.webp').convert('RGB')
    light = np.asarray(sheet.convert('L')) > 45

    def runs(a: np.ndarray) -> list[tuple[int, int]]:
        out, start = [], None
        for i, v in enumerate(list(a) + [0]):
            if v > 0.15 and start is None:
                start = i
            elif v <= 0.15 and start is not None:
                out.append((start, i))
                start = None
        return out

    (x0, x1), (y0, y1) = runs(light.mean(0))[1], runs(light.mean(1))[0]
    side = min(x1 - x0, y1 - y0) * 0.93
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = tuple(round(v) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))
    c = np.asarray(sheet.crop(box)).astype(float)
    h, w = c.shape[:2]
    lum, warm = c.mean(2), c[..., 0] - c[..., 2]
    # La bota es cálida (rojo > azul); la piedra es gris. Las rayas son claras y están a la izquierda.
    fg = nd.binary_fill_holes(nd.binary_closing(warm > 22, iterations=4))
    streaks = nd.binary_dilation(lum > 125, iterations=2) & (np.arange(w)[None, :] < 0.4 * w)
    fg = nd.binary_opening(fg & ~streaks, iterations=3)
    lab, k = nd.label(fg)
    fg = lab == 1 + int(np.argmax(nd.sum(fg, lab, range(1, k + 1))))
    fg = nd.binary_fill_holes(nd.binary_closing(fg, iterations=3))
    a = nd.gaussian_filter(fg.astype(float), 0.8)
    rgba = Image.fromarray(np.dstack([c, a * 255]).astype(np.uint8), 'RGBA')
    scale = min(1, MAX / max(rgba.size))
    rgba = rgba.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    ys, xs = np.where(fg)
    index['boots'] = {
        'file': 'boots.png',
        'ay': round(float((ys.max() + 1) / h), 3),
        'bw': round(float((xs.max() - xs.min() + 1) * scale)),
    }
    rgba.save(OUT / 'boots.png', optimize=True)
    print('boots', rgba.size, index['boots'])


boots()
(OUT / 'pickups.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf8', newline='\n')
