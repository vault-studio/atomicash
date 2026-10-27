# Iconos de la PWA (192, 512 y maskable) dibujados con geometría: esfera de contador Geiger en fósforo verde.
# Uso: python tools/make_icons.py
import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path('assets/app')
BG, GREEN, OCRE, RED = (11, 20, 13, 255), (60, 255, 107, 255), (200, 164, 107, 255), (215, 38, 61, 255)


def icon(size: int, pad: float) -> Image.Image:
    s = size * 4  # supermuestreo para suavizar
    img = Image.new('RGBA', (s, s), BG)
    d = ImageDraw.Draw(img)
    cx, cy = s / 2, s * 0.62
    r = s * (0.5 - pad)
    w = max(6, s // 22)
    # Arco de la escala (de 200° a 340°) con la zona roja al final.
    box = [cx - r, cy - r, cx + r, cy + r]
    d.arc(box, 200, 305, fill=GREEN, width=w)
    d.arc(box, 305, 340, fill=RED, width=w)
    for k in range(8):
        a = math.radians(200 + k * 20)
        r0, r1 = r - w * 2.4, r - w * 1.2
        d.line([cx + math.cos(a) * r0, cy + math.sin(a) * r0, cx + math.cos(a) * r1, cy + math.sin(a) * r1], fill=GREEN, width=w // 2)
    a = math.radians(318)
    d.line([cx, cy, cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.8], fill=OCRE, width=w)
    p = w * 1.3
    d.ellipse([cx - p, cy - p, cx + p, cy + p], fill=OCRE)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
icon(192, 0.08).save(OUT / 'icon-192.png', optimize=True)
icon(512, 0.08).save(OUT / 'icon-512.png', optimize=True)
icon(512, 0.2).save(OUT / 'icon-maskable.png', optimize=True)
icon(180, 0.12).save(OUT / 'apple-touch-icon.png', optimize=True)
print('ok')
