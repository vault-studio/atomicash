# Recorta las hojas de iconos de ARTE/ (rejilla 6×3 de fichas sobre fondo negro) a PNG de 128×128 en assets/icons/.
# Uso: python tools/slice_icons.py
#
# Cada ficha se localiza por su caja de píxeles claros dentro de su celda; se quita el borde de chapa y se recorta el
# cuadrado central (las fichas de rasgos son algo más altas que anchas). El orden de las fichas es el de las listas de
# abajo, de izquierda a derecha y de arriba abajo; coincide con el orden de WEAPONS y TRAITS en src/config.
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 128
DARK = 45  # luminancia por debajo de la cual es fondo
# La lámina del HUD tiene una casilla vacía que oscurece su última columna: con DARK se partiría en tres.
DARK_BY_SHEET = {'ARTE/iconos_hud.webp': 30}
LINE = 0.15  # fracción mínima de píxeles claros para que una fila o columna sea parte de una ficha
INSET = 0.035  # fracción de la ficha que se recorta por cada lado para quitar el borde

SHEETS = {
    'ARTE/iconos_armas.webp': (
        Path('assets/icons'),
        [
            'llave', 'pistola_clavos', 'jeringa', 'coctel', 'tesla', 'geiger',
            'escopeta_chatarra', 'megafono', 'rifle_cerrojo', 'martillo_pilon', 'petardos', 'desfibrilador',
            'nucleo_cobalto', 'dinamo', 'remachadora', 'nucleo_inestable', 'dardos_incendiarios',
        ],
    ),
    'ARTE/iconos_rasgos.webp': (
        Path('assets/icons/traits'),
        [
            'ammo', 'boots', 'manual', 'helmet', 'plate', 'suture',
            'magnet', 'cat', 'scope', 'ration', 'oil', 'iodine',
            'fuse', 'tips', 'adren', 'rabbit', 'stock',
        ],
    ),
    # Consumibles, objetos de jefe y la carta de curación.
    'ARTE/iconos_hud.webp': (
        Path('assets/icons/hud'),
        [
            'stim', 'iodine', 'grenade', 'turbo', 'dice', 'apron',
            'skates', 'fridge', 'belt', 'bobble', 'heal',
        ],
    ),
}


def runs(a: np.ndarray) -> list[tuple[int, int]]:
    """Tramos consecutivos de `a` por encima de LINE."""
    out, start = [], None
    for i, v in enumerate(a):
        if v > LINE and start is None:
            start = i
        elif v <= LINE and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(a)))
    return out


for src, (out_dir, names) in SHEETS.items():
    img = Image.open(src).convert('RGB')
    light = np.asarray(img.convert('L')) > DARK_BY_SHEET.get(src, DARK)
    cols, rows = runs(light.mean(0)), runs(light.mean(1))
    cells = [(x, y) for y in rows for x in cols]
    assert len(cells) >= len(names), f'{src}: {len(cells)} celdas para {len(names)} iconos'
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, ((x0, x1), (y0, y1)) in zip(names, cells):
        w, h = x1 - x0, y1 - y0
        side = min(w, h) * (1 - 2 * INSET)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        box = tuple(round(v) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))
        img.crop(box).resize((SIZE, SIZE), Image.LANCZOS).save(out_dir / f'{name}.png', optimize=True)
    print(f'{src}: {len(names)} iconos en {out_dir}')

# Iconos derivados mientras no haya ficha propia: el de daño crítico es la mira del crítico teñida de rojo.
DERIVED = {'assets/icons/traits/hollow.png': ('assets/icons/traits/scope.png', (1.35, 0.55, 0.5))}
for dst, (src, (kr, kg, kb)) in DERIVED.items():
    a = np.asarray(Image.open(src).convert('RGB')).astype(float)
    lum = a.mean(2, keepdims=True)
    tinted = np.clip(lum * np.array([kr, kg, kb]) * 1.15, 0, 255)
    Image.fromarray(tinted.astype(np.uint8)).save(dst, optimize=True)
    print(f'{dst} (derivado de {src})')
