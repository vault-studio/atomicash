# Recorta las láminas de destrozos y efectos grandes de ARTE/ y añade sus piezas a los índices de assets/.
# Uso: python tools/slice_destrozos.py
#
# Ejecutar DESPUÉS de slice_tiles.py, slice_props.py y slice_fx.py: esos reescriben sus índices enteros y este solo
# añade o sustituye sus entradas (fx.json, tiles.json y props.json).
#   ARTE/fx_explosiones.webp     → perdigón y explosiones grandes (fuego y hielo)
#   ARTE/fx_auras.webp           → auras del Geiger y del Núcleo inestable
#   ARTE/fx_lluvias.webp         → lo que cae en las lluvias, el obús y el impacto de escombros
#   ARTE/tiles_suelo_roto.webp   → baldosas de suelo roto
#   ARTE/objetos_escombros.webp  → montones de escombros (2 de tierra y 2 de chatarra)
#
# En las tiras que se apoyan en el suelo los frames conservan su sitio dentro de la celda (si no, la animación baila);
# en las que vuelan se centran en su contenido.
import json
from pathlib import Path

import numpy as np
from PIL import Image

FX = Path('assets/fx')
TILES = Path('assets/tiles')
PROPS = Path('assets/props')
ALPHA = 24  # alfa por debajo del cual el píxel es ruido del fondo
PAD = 2
BLACK = 10  # como slice_props.py: canal máximo que aún es fondo negro
SOFT = 40  # de BLACK a BLACK + SOFT el fondo pasa a opaco (sombras suaves)
TILE_W = 288  # ancho de una baldosa rota: el rombo mide 256 y los bordes deshilachados pisan a las vecinas
RUBBLE_W = 380  # ancho de un montón; el juego lo encoge con `PROPS.scale`, como a los demás objetos de una casilla
RUBBLE_FW = 0.63  # fracción del ancho que cuenta como base: el faldón de tierra suelta se puede pisar
RING_WIDE = 2  # proporción de un círculo del suelo en isométrico

# (nombre, y0, y1, frames, x0, x1). Frames a partes iguales dentro de x0–x1.
GROUNDED = {
    'ARTE/fx_explosiones.webp': [
        ('big_blast', 170, 395, 8, 0, 2000),
        ('ice_blast', 410, 625, 8, 0, 2000),
    ],
    'ARTE/fx_lluvias.webp': [('debris', 785, 1000, 6, 0, 1536)],
}
# (nombre, y0, y1, ancho del frame final). Frames separados por columnas vacías.
FLYING = {
    'ARTE/fx_explosiones.webp': [('pellet', 60, 125, 96)],
    'ARTE/fx_lluvias.webp': [
        ('fall_scrap', 20, 245, 128),
        ('fall_acid', 270, 485, 64),
        ('fall_shell', 485, 780, 64),
    ],
}
# (nombre, y0, y1): 6 frames en bucle.
AURAS = [('aura_geiger', 40, 290), ('aura_core', 380, 640)]
RUBBLE = ['rubble_0', 'rubble_1', 'rubble_2', 'rubble_3']


def load(path):
    a = np.array(Image.open(path).convert('RGBA'), dtype=np.uint8)
    a[a[..., 3] < ALPHA] = 0
    return a


def box(alpha, floor=1):
    ys = np.where((alpha >= floor).any(axis=1))[0]
    xs = np.where((alpha >= floor).any(axis=0))[0]
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


def save_strip(name, frames):
    w, h = frames[0].shape[1], frames[0].shape[0]
    Image.fromarray(np.hstack(frames), 'RGBA').save(FX / f'{name}.png', optimize=True)
    return {'file': f'{name}.png', 'frames': len(frames), 'w': w, 'h': h}


def grounded(a, y0, y1, n, x0, x1):
    cw = (x1 - x0) / n
    cells = [a[y0:y1, round(x0 + i * cw) : round(x0 + (i + 1) * cw)] for i in range(n)]
    cells = [c[:, : min(x.shape[1] for x in cells)] for c in cells]
    boxes = [box(c[..., 3]) for c in cells]
    l, t = min(b[0] for b in boxes), min(b[1] for b in boxes)
    r, b = max(b[2] for b in boxes), max(b[3] for b in boxes)
    return [c[t:b, l:r] for c in cells]


def flying(a, y0, y1, width):
    band = a[y0:y1]
    used = (band[..., 3] > 60).any(axis=0)
    spans, start = [], None
    for x, on in enumerate(used):
        if on and start is None:
            start = x
        elif not on and start is not None:
            spans.append((start, x))
            start = None
    # Las gotitas sueltas quedan pegadas a su frame: dos trozos cercanos son el mismo frame.
    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < 40:
            merged[-1] = (merged[-1][0], s[1])
        else:
            merged.append(s)
    pieces = []
    for x0, x1 in merged:
        c = band[:, x0:x1]
        l, t, r, b = box(c[..., 3])
        pieces.append(c[t:b, l:r])
    bw, bh = max(p.shape[1] for p in pieces), max(p.shape[0] for p in pieces)
    k = width / bw
    h = max(1, round(bh * k))
    out = []
    for p in pieces:
        im = Image.fromarray(p, 'RGBA')
        pw, ph = max(1, round(p.shape[1] * k)), max(1, round(p.shape[0] * k))
        canvas = Image.new('RGBA', (width, h), (0, 0, 0, 0))
        canvas.paste(im.resize((pw, ph), Image.LANCZOS), ((width - pw) // 2, (h - ph) // 2))
        out.append(np.array(canvas))
    return out


def auras(a, y0, y1):
    """Estira cada aura para que su anillo quede 2:1 como los círculos del suelo y mide el anillo dentro del frame."""
    frames = grounded(a, y0, y1, 6, 0, 2000)
    # El frame 1 es el más limpio: su anillo marca el tamaño de referencia.
    al = frames[0][..., 3].astype(float)
    ring = al > al.max() * 0.45
    ys, xs = np.where(ring)
    left, right, top, bottom = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rw, rh = right - left, bottom - top
    stretch = rw / (RING_WIDE * rh)
    h = round(frames[0].shape[0] * stretch)
    out = [np.array(Image.fromarray(f, 'RGBA').resize((f.shape[1], h), Image.LANCZOS)) for f in frames]
    meta = {
        'ring': round(rw / frames[0].shape[1], 3),
        'ax': round((left + right) / 2 / frames[0].shape[1], 3),
        'ay': round((top + bottom) / 2 / frames[0].shape[0], 3),
    }
    return out, meta


def tiles():
    a = load('ARTE/tiles_suelo_roto.webp')
    out = []
    n = 3
    cw = a.shape[1] / n
    for i in range(n):
        c = a[:, round(i * cw) : round((i + 1) * cw)]
        l, t, r, b = box(c[..., 3], 90)
        c = c[t:b, l:r]
        h = TILE_W // 2
        name = f'roto_{i}.png'
        Image.fromarray(c, 'RGBA').resize((TILE_W, h), Image.LANCZOS).save(TILES / name, optimize=True)
        out.append({'file': name, 'head': 0})
    return out


def rubble():
    a = np.array(Image.open('ARTE/objetos_escombros.webp').convert('RGB'), dtype=np.uint8)
    h, w = a.shape[:2]
    out = []
    for k, name in enumerate(RUBBLE):
        col, row = k % 2, k // 2
        c = a[row * h // 2 : (row + 1) * h // 2, col * w // 2 : (col + 1) * w // 2]
        alpha = np.clip((c.max(axis=2).astype(float) - BLACK) / SOFT, 0, 1)
        rgba = np.dstack([c, (alpha * 255).astype(np.uint8)])
        l, t, r, b = box(rgba[..., 3], 60)
        l, t, r, b = max(0, l - PAD), max(0, t - PAD), r + PAD, b + PAD
        rgba = rgba[t:b, l:r]
        k_ = RUBBLE_W / rgba.shape[1]
        size = (RUBBLE_W, round(rgba.shape[0] * k_))
        Image.fromarray(rgba, 'RGBA').resize(size, Image.LANCZOS).save(PROPS / f'{name}.png', optimize=True)
        # Apoyo: como en slice_props.py, el centro de la base subido un cuarto de su ancho (aquí, de su ancho útil).
        fw = RUBBLE_W * RUBBLE_FW
        ay = max(0.0, 1 - (fw / 4) / size[1])
        out.append(
            {'file': f'{name}.png', 'cells': 1, 'w': size[0], 'h': size[1], 'ax': 0.5, 'ay': round(ay, 3), 'fw': round(fw)}
        )
    return out


def main():
    index = json.loads((FX / 'fx.json').read_text(encoding='utf8'))
    for sheet, rows in GROUNDED.items():
        a = load(sheet)
        for name, y0, y1, n, x0, x1 in rows:
            index[name] = save_strip(name, grounded(a, y0, y1, n, x0, x1))
    for sheet, rows in FLYING.items():
        a = load(sheet)
        for name, y0, y1, width in rows:
            index[name] = save_strip(name, flying(a, y0, y1, width))
    a = load('ARTE/fx_auras.webp')
    for name, y0, y1 in AURAS:
        frames, meta = auras(a, y0, y1)
        index[name] = save_strip(name, frames)
        print(name, meta)
    (FX / 'fx.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf8')

    t = json.loads((TILES / 'tiles.json').read_text(encoding='utf8'))
    t['sets']['roto'] = tiles()
    (TILES / 'tiles.json').write_text(json.dumps(t, indent=2) + '\n', encoding='utf8')

    p = json.loads((PROPS / 'props.json').read_text(encoding='utf8'))
    p['props'] = [x for x in p['props'] if not x['file'].startswith('rubble_')] + rubble()
    (PROPS / 'props.json').write_text(json.dumps(p, indent=2) + '\n', encoding='utf8')
    for k in sorted(index):
        if k in {r[0] for rows in GROUNDED.values() for r in rows} | {r[0] for rows in FLYING.values() for r in rows} | {r[0] for r in AURAS}:
            print(k, index[k])


if __name__ == '__main__':
    main()
