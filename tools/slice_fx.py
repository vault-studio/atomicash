# Recorta las láminas de efectos (ARTE/fx_*.webp y la bala de ARTE/gun_fx_sheet.png) en tiras de animación PNG en
# assets/fx/ y escribe assets/fx/fx.json con el número de frames y su tamaño.
# Uso: python tools/slice_fx.py
#
# Las láminas no siguen una rejilla exacta: cada fila tiene su franja de alto (a mano, abajo) y dentro de ella los
# frames se separan por columnas vacías (o a partes iguales con `even`, cuando los brillos se tocan). Todos los frames
# de una tira comparten tamaño y se centran en el centro de su contenido, para que la animación no baile.
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

OUT = Path('assets/fx')
ALPHA = 24  # alfa por debajo del cual la columna cuenta como vacía
PAD = 4

# (nombre, y0, y1, frames, opciones). Opciones: x (x0, x1) limita la franja; even reparte a partes iguales;
# take (i, j) se queda con esos frames; drop_largest quita el trozo más grande de cada frame (el megáfono, que no
# queremos, de las ondas); floor sube el alfa mínimo (fondo semitransparente); max es el lado mayor final en px.
SHEETS = {
    'ARTE/fx_suelo_eventos.webp': [
        ('zone_ring', 0, 250, 1, {'max': 512}),
        ('zone_glow', 250, 398, 6, {'even': (21, 1522), 'max': 384}),
        ('zone_motes', 398, 600, 6, {'even': (21, 1522), 'max': 256}),
        ('tele_circle', 600, 800, 1, {'x': (0, 620), 'max': 384}),
        ('tele_disc', 600, 800, 1, {'x': (620, 1220), 'max': 384}),
    ],
    'ARTE/fx_fuego_acido.webp': [
        ('fire_pool', 0, 125, 6, {'max': 192}),
        ('burn', 125, 242, 4, {'max': 128}),
        ('fire_blast', 242, 405, 7, {'max': 192}),
        ('acid_pool', 500, 620, 6, {'max': 192}),
        ('acid_splash', 620, 744, 5, {'max': 160}),
        ('acid_spit', 905, 1000, 2, {'max': 128}),
    ],
    'ARTE/fx_proyectiles.webp': [
        ('nail', 25, 130, 1, {'x': (0, 330), 'max': 96}),
        ('syringe', 130, 262, 1, {'x': (0, 370), 'max': 96}),
        ('rivet', 262, 340, 1, {'max': 96}),
        ('dart', 340, 432, 2, {'max': 96}),
        ('molotov', 432, 592, 4, {'max': 96}),
        ('wrench', 592, 720, 4, {'take': (0, 1), 'max': 128}),
        ('coil', 720, 878, 4, {'max': 128}),
        ('ebullet', 878, 972, 2, {'max': 96}),
    ],
    'ARTE/fx_extras.webp': [
        ('wave', 0, 94, 5, {'drop_largest': True, 'max': 128}),
        ('slam', 94, 192, 6, {'max': 192}),
        ('heal', 192, 293, 4, {'max': 128}),
        ('stun', 293, 360, 4, {'max': 96}),
        ('ice', 360, 458, 5, {'max': 128}),
        ('spawn', 458, 549, 6, {'max': 160}),
        ('death', 549, 642, 5, {'max': 160}),
        ('levelup', 697, 806, 9, {'max': 160}),
    ],
    'ARTE/gun_fx_sheet.png': [
        ('bullet', 45, 115, 1, {'x': (165, 335), 'floor': 80, 'max': 96}),
    ],
}


def spans(alpha: np.ndarray, n: int, name: str) -> list[tuple[int, int]]:
    """Columnas ocupadas de la franja, unidas por los huecos más estrechos hasta quedar `n`."""
    cols = nd.binary_closing(alpha.max(0) > ALPHA, iterations=3)
    lab, k = nd.label(cols)
    out = [(s.start, s.stop) for (s,) in nd.find_objects(lab) if s.stop - s.start > 3]
    if len(out) < n:
        raise SystemExit(f'{name}: {len(out)} frames, se esperaban {n}')
    while len(out) > n:
        gaps = [out[i + 1][0] - out[i][1] for i in range(len(out) - 1)]
        i = int(np.argmin(gaps))
        out[i : i + 2] = [(out[i][0], out[i + 1][1])]
    return out


def drop_largest(rgba: np.ndarray) -> np.ndarray:
    lab, k = nd.label(nd.binary_dilation(rgba[:, :, 3] > ALPHA, iterations=2))
    if k > 1:
        sizes = nd.sum(np.ones(lab.shape), lab, range(1, k + 1))
        rgba = rgba.copy()
        rgba[lab == 1 + int(np.argmax(sizes)), 3] = 0
    return rgba


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
index = {}
for src, rows in SHEETS.items():
    img = np.array(Image.open(src).convert('RGBA')).astype(float)
    for name, y0, y1, n, o in rows:
        x0, x1 = o.get('x', (0, img.shape[1]))
        band = img[y0:y1, x0:x1].copy()
        if 'floor' in o:
            f = o['floor']
            band[:, :, 3] = np.clip((band[:, :, 3] - f) / (255 - f), 0, 1) * 255
        if 'even' in o:
            a, b = o['even']
            step = (b - a) / n
            fr = [(round(a + i * step) - x0, round(a + (i + 1) * step) - x0) for i in range(n)]
        else:
            fr = spans(band[:, :, 3], n, name)
        frames = [band[:, s:e] for s, e in fr]
        if o.get('drop_largest'):
            frames = [drop_largest(f) for f in frames]
        if 'take' in o:
            frames = frames[o['take'][0] : o['take'][1]]
        # Recorte común: alto de lo ocupado en toda la tira; ancho del frame más ancho, centrado en su contenido.
        rows_used = np.any([f[:, :, 3].max(1) > ALPHA for f in frames], axis=0)
        ry = np.where(rows_used)[0]
        top, bot = max(0, ry.min() - PAD), min(band.shape[0], ry.max() + 1 + PAD)
        boxes = []
        for f in frames:
            cx = np.where(f[:, :, 3].max(0) > ALPHA)[0]
            boxes.append((cx.min(), cx.max() + 1))
        fw = max(b - a for a, b in boxes) + PAD * 2
        fh = bot - top
        strip = np.zeros((fh, fw * len(frames), 4))
        for i, (f, (a, b)) in enumerate(zip(frames, boxes)):
            c = (a + b) // 2
            l = c - fw // 2
            sl0, sl1 = max(0, l), min(f.shape[1], l + fw)
            strip[:, i * fw + sl0 - l : i * fw + sl1 - l] = f[top:bot, sl0:sl1]
        scale = min(1, o['max'] / max(fw, fh))
        w, h = max(1, round(fw * scale)), max(1, round(fh * scale))
        im = Image.fromarray(strip.astype(np.uint8), 'RGBA').resize((w * len(frames), h), Image.LANCZOS)
        im.save(OUT / f'{name}.png', optimize=True)
        index[name] = {'file': f'{name}.png', 'frames': len(frames), 'w': w, 'h': h}
        print(name, len(frames), w, h)
(OUT / 'fx.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf8', newline='\n')
