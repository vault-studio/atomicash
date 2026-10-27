# Recorta las 9 baldosas isométricas de ARTE/tiles_suelo.png (rejilla 3×3, fondo opaco)
# a PNG con transparencia de 256×128 (rombo 2:1) en assets/tiles/.
# Uso: python tools/slice_tiles.py
# DECISIÓN: la hoja original es un concepto con fondo; el rombo superior se aísla con una máscara
# y se aplasta un ~20 % en vertical para pasar de ~1,6:1 a la proyección 2:1 del juego.
from pathlib import Path

from PIL import Image, ImageDraw

SRC = Path('ARTE/tiles_suelo.png')
OUT = Path('assets/tiles')
COLS, ROWS = 3, 3
# Vértices del rombo dentro de cada celda (medidos sobre la hoja), con un margen hacia dentro.
TOP, LEFT, RIGHT, BOTTOM = (258, 30), (32, 172), (488, 172), (258, 314)
W, H = 256, 128

img = Image.open(SRC).convert('RGBA')
cw, ch = img.width / COLS, img.height / ROWS
OUT.mkdir(parents=True, exist_ok=True)
for r in range(ROWS):
    for c in range(COLS):
        ox, oy = round(c * cw), round(r * ch)
        box = (ox + LEFT[0], oy + TOP[1], ox + RIGHT[0], oy + BOTTOM[1])
        tile = img.crop(box).resize((W, H), Image.LANCZOS)
        mask = Image.new('L', (W, H), 0)
        ImageDraw.Draw(mask).polygon([(W / 2, 0), (W, H / 2), (W / 2, H), (0, H / 2)], fill=255)
        tile.putalpha(mask)
        tile.save(OUT / f'suelo_{r * COLS + c}.png', optimize=True)
print('ok', sorted(p.name for p in OUT.glob('*.png')))
