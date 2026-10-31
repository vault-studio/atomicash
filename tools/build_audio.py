# Audio del juego: ARTE/audio/raw (descargas CC0 / dominio público, ver assets/audio/CREDITS.md) → assets/audio.
# Corta los golpes de las grabaciones largas, mezcla capas, iguala la sonoridad de las variantes de cada sonido,
# limita los picos sin recortar y codifica en AAC (.m4a, lo decodifican todos los navegadores). Comprueba lo
# codificado (pico real, duración, sonoridad) y escribe assets/audio/audio.json con las variantes de cada sonido.
#   python tools/build_audio.py            todo
#   python tools/build_audio.py sfx        solo efectos (o: amb, music, o un id: python tools/build_audio.py shotgun)
import json, os, shutil, subprocess, sys, tempfile
from math import gcd

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.ndimage import median_filter, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

SR = 48000
RAW = 'ARTE/audio/raw/'
OUT = 'assets/audio/'
BSB = RAW + 'sfx/bsb/'
OGA = RAW + 'sfx/oga/'
X = OGA + 'x/'
GUN = X + 'Prepared_SFX_Library/Prepared SFX Library/'
FFMPEG = shutil.which('ffmpeg') or os.path.expandvars(
    r'%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe'
    r'\ffmpeg-9.0.1-essentials_build\bin\ffmpeg.exe')
rng = np.random.default_rng(7)
meter = pyln.Meter(SR)

# Techo de pico real antes de codificar; el AAC se pasa (en golpes muy secos hasta 1 dB), así que lo codificado se
# comprueba aparte. Los efectos van más abajo: si el códec obligara a bajar una variante, se desigualaría.
CEIL = -1.5
CEIL_SFX = -2.5
CEIL_ENCODED = -1.0
# Sonoridad de referencia de los efectos (ventana más fuerte); la mezcla la decide src/config/audio.ts.
SFX_TARGET = -18.0
# Como mucho tanto limitador (dB) para llegar a la referencia: más aplastaría el ataque. Los disparos tienen picos
# muy por encima de su cuerpo; 6 dB con anticipación es lo habitual en armas de juego.
MAX_GR = 6.0
# Variantes de un mismo sonido: misma sonoridad (± LU) y duración parecida (± fracción de la mediana).
SPREAD = 2.0
DUR_TOL = 0.5

# ---------- utilidades ----------

_cache = {}


def load(path, stereo=False):
    """Lee a float32 a 48 kHz; mono salvo `stereo`."""
    key = (path, stereo)
    if key not in _cache:
        x, sr = sf.read(path, always_2d=True, dtype='float32')
        if sr != SR:
            g = gcd(SR, sr)
            x = resample_poly(x, SR // g, sr // g, axis=0).astype(np.float32)
        x = x[:, :2] if stereo else x.mean(1)
        if stereo and x.shape[1] == 1:
            x = np.repeat(x, 2, 1)
        _cache[key] = x
    return _cache[key].copy()


def db(v):
    return 10 ** (v / 20)


def mono(x):
    return x if x.ndim == 1 else x.mean(1)


def env(x, hop=0.005):
    h = int(SR * hop)
    n = len(x) // h
    if x.ndim == 2:
        x = np.abs(x).max(1)
    return np.abs(x[: n * h]).reshape(n, h).max(1), h


def tail_end(x, floor_db=-48):
    """Último punto por encima de `floor_db` respecto al pico."""
    e, h = env(x)
    idx = np.nonzero(e > e.max() * db(floor_db))[0]
    return (idx[-1] + 1) * h if len(idx) else len(x)


def trim(x, floor_db=-45, pre=0.003):
    e, h = env(x)
    idx = np.nonzero(e > e.max() * db(floor_db))[0]
    if not len(idx):
        return x
    a = max(0, idx[0] * h - int(pre * SR))
    return x[a: tail_end(x)]


def trim_attack(x, att_db=-18, pre=0.002):
    """Empieza 2 ms antes del ataque de verdad: impactos e interfaz suenan en el mismo fotograma que el golpe."""
    e, h = env(x, 0.001)
    idx = np.nonzero(e > e.max() * db(att_db))[0]
    a = max(0, idx[0] * h - int(pre * SR)) if len(idx) else 0
    x = x[a:]
    return fade(x[: tail_end(x)], 0.0005, min(0.03, len(x) / SR / 4))


def fade(x, fin=0.002, fout=0.02):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        r = np.linspace(0, 1, a)
        x[:a] *= r[:, None] if x.ndim == 2 else r
    if b and len(x) > b:
        r = np.linspace(1, 0, b) ** 2
        x[-b:] *= r[:, None] if x.ndim == 2 else r
    return x


def cut(x, t0, t1=None):
    return x[int(t0 * SR): None if t1 is None else int(t1 * SR)]


def maxlen(x, s, fout=0.03):
    if len(x) > s * SR:
        x = x[: int(s * SR)]
    return fade(x, 0.001, fout)


def hits(path, k, minsep=0.25, maxl=0.6, floor_db=-20, stereo=False):
    """
    Los `k` golpes más fuertes de una grabación con varios (disparos, chispas, monedas). Detección con histéresis
    (no se rearma hasta que la señal cae 10 dB por debajo del umbral) para no confundir el eco de un disparo con otro,
    y cada golpe solo se corta en el siguiente si llega lejos y casi igual de fuerte.
    """
    x = load(path, stereo)
    e, h = env(mono(x))
    thr = e.max() * db(floor_db)
    ons, armed = [], True
    for i in range(1, len(e)):
        if armed and e[i] > thr:
            ons.append(i)
            armed = False
        elif not armed and e[i] < thr * db(-10):
            armed = True
    loud = {i: e[i: i + 10].max() for i in ons}
    picked = []
    for i in sorted(ons, key=lambda i: -loud[i]):
        if all(abs(i - j) * h > minsep * SR for j in picked):
            picked.append(i)
        if len(picked) == k:
            break
    out = []
    for i in sorted(picked):
        a = max(0, i * h - int(0.004 * SR))
        seg = x[a: a + int(maxl * SR)]
        nxt = [j for j in ons if (j - i) * h > minsep * SR and loud[j] > loud[i] * db(-6)]
        if nxt:
            seg = seg[: nxt[0] * h - a - int(0.004 * SR)]
        out.append(fade(seg[: tail_end(seg)], 0.001, min(0.05, len(seg) / SR / 4)))
    return out


def band(x, lo=None, hi=None, order=2):
    if lo:
        x = sosfilt(butter(order, lo, 'hp', fs=SR, output='sos'), x, axis=0)
    if hi:
        x = sosfilt(butter(order, hi, 'lp', fs=SR, output='sos'), x, axis=0)
    return x.astype(np.float32)


def pitch(x, semis):
    """Cambia tono y duración a la vez (como una cinta)."""
    if not semis:
        return x
    r = 2 ** (semis / 12)
    up, down = int(round(1000 / r)), 1000
    g = gcd(up, down)
    return resample_poly(x, up // g, down // g, axis=0).astype(np.float32)


def sat(x, drive=2.0):
    """Distorsión de diseño (megáfono); no se usa para controlar picos."""
    return (np.tanh(x * drive) / np.tanh(drive)).astype(np.float32)


def thump(f0=70, f1=32, dur=0.35, click=0.0):
    """Golpe grave sintético para dar peso a explosiones y golpes."""
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * (6 / dur))
    if click:
        n = rng.standard_normal(len(t)) * np.exp(-t * 400) * click
        y = y + band(n.astype(np.float32), 800, 6000)
    return fade(y.astype(np.float32), 0.001, 0.05)


def ting(f=2200, dur=0.18):
    """Campanita corta (cuerpo de la chatarra al recogerla)."""
    t = np.arange(int(dur * SR)) / SR
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * 28)
    return fade(y.astype(np.float32), 0.0005, 0.02)


def mix(*layers):
    """Capas (señal, retardo s, ganancia dB)."""
    n = max(int(d * SR) + len(s) for s, d, _ in layers)
    st = any(s.ndim == 2 for s, _, _ in layers)
    out = np.zeros((n, 2) if st else n, np.float32)
    for s, d, g in layers:
        if st and s.ndim == 1:
            s = np.repeat(s[:, None], 2, 1)
        a = int(d * SR)
        out[a: a + len(s)] += s * db(g)
    return out


def true_peak(x):
    """Pico con sobremuestreo ×4 (dBTP)."""
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def lufs_peak(x, win=0.4):
    """Sonoridad (LUFS) de la ventana más fuerte: la medida de los efectos cortos."""
    w = int(win * SR)
    if len(mono(x)) < w:
        pad = w - len(mono(x))
        x = np.pad(x, (0, pad)) if x.ndim == 1 else np.pad(x, ((0, pad), (0, 0)))
    m = mono(x)
    e = np.convolve(m ** 2, np.ones(max(1, w // 8)), 'valid')
    c = int(np.argmax(e))
    a = max(0, min(len(m) - w, c - w // 2))
    seg = x[a: a + w]
    # pyloudnorm mide en bloques de 400 ms: las ventanas cortas se repiten hasta llenarlo (misma sonoridad).
    reps = int(np.ceil((0.45 * SR) / len(seg)))
    seg = np.tile(seg, reps) if seg.ndim == 1 else np.tile(seg, (reps, 1))
    return meter.integrated_loudness(seg)


def limit(x, ceil=CEIL, look=0.002, smooth=0.008):
    """
    Limitador con anticipación: ganancia por muestra para que el pico real no pase del techo, que empieza a bajar
    antes del pico y vuelve suave. No distorsiona (ni recorte ni tanh).
    """
    c = db(ceil)
    up = np.abs(resample_poly(x, 4, 1, axis=0))
    if up.ndim == 2:
        up = up.max(1)
    pk = up[: len(x) * 4].reshape(-1, 4).max(1)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    if need.min() >= 1.0:
        return x
    la, sm = int(look * SR) * 2 + 1, int(smooth * SR) * 2 + 1
    g = minimum_filter1d(need, la + sm)
    g = uniform_filter1d(g, sm)
    g = np.minimum(g, need)
    y = x * (g[:, None] if x.ndim == 2 else g)
    # Seguridad: si algo se coló, se escala todo (no se recorta).
    tp = true_peak(y)
    if tp > ceil:
        y = y * db(ceil - tp)
    return y.astype(np.float32)


def declick(x, k=9, thr=8.0):
    """Quita los chasquidos sueltos del disco (muestras que saltan muy por encima de su entorno)."""
    out = x.copy()
    for ch in range(1 if x.ndim == 1 else x.shape[1]):
        s = out if x.ndim == 1 else out[:, ch]
        med = median_filter(s, size=k, mode='nearest')
        d = s - med
        mad = np.median(np.abs(d)) * 1.4826 + 1e-9
        bad = np.abs(d) > thr * mad
        s[bad] = med[bad]
    return out


def norm_long(x, target):
    """Pistas largas: sonoridad integrada al objetivo y limitador para que quepa sin pasarse del techo."""
    x = x * db(target - meter.integrated_loudness(x))
    return limit(x, CEIL, look=0.003, smooth=0.025)


def seamless(x, xf=2.0):
    """Loop sin costura: el final se funde con el principio."""
    n = int(xf * SR)
    head, body, tail = x[:n], x[n:-n] if len(x) > 3 * n else x[n:], x[-n:]
    r = np.linspace(0, 1, n)
    r = (r[:, None] if x.ndim == 2 else r)
    joined = tail * np.sqrt(1 - r) + head * np.sqrt(r)
    return np.concatenate([body, joined]).astype(np.float32)


def decode(path, ch):
    r = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ar', str(SR), '-'],
                       capture_output=True, check=True)
    y = np.frombuffer(r.stdout, np.float32)
    return y.reshape(-1, ch) if ch > 1 else y


def encode(x, path, kbps):
    """Codifica y comprueba lo codificado: si el AAC se pasa del techo, se repite con menos ganancia."""
    assert np.abs(x).max() <= 1.0, path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        tmp = t.name
    ch = 1 if x.ndim == 1 else x.shape[1]
    for _ in range(4):
        sf.write(tmp, x, SR, subtype='FLOAT')
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'aac', '-b:a', f'{kbps}k',
                        '-movflags', '+faststart', path], check=True)
        y = decode(path, ch)
        pk = true_peak(y)
        if pk <= CEIL_ENCODED:
            break
        x = x * db(CEIL_ENCODED - pk - 0.2)
    os.remove(tmp)
    return y


def stats(x):
    return {'dur': round(len(mono(x)) / SR, 3), 'peak': round(float(true_peak(x)), 1)}


# ---------- recetas de efectos: id → lista de variantes ----------

def L(p, stereo=False):
    return load(p, stereo)


def r_nail():
    # Pistola de clavos: el chasquido seco de una .22 más aguda y el «tic» del clavo en la chapa.
    shots = (hits(GUN + 'Ruger Mark III/R_35P.wav', 2, minsep=0.5, maxl=0.3)
             + hits(GUN + 'Ruger Mark III/R_30P.wav', 2, minsep=0.5, maxl=0.3)
             + hits(GUN + 'Walther PPQ/X_31P.wav', 2, minsep=0.5, maxl=0.3))
    tick = [trim(L(X + f'100-CC0-wood-metal-SFX/metal_hit_0{i}.ogg')) for i in (1, 3, 5)]
    out = []
    for i, s in enumerate(shots):
        s = band(pitch(s, 3), 350)
        t = band(pitch(maxlen(tick[i % 3], 0.12), 7), 1500)
        out.append(maxlen(mix((s, 0, 0), (t, 0.004, -15)), 0.3, 0.08))
    return out


def r_rivet():
    # Remachadora: golpe neumático más gordo, .45 con el metal del remache.
    shots = (hits(GUN + '1911/A_42P.wav', 2, minsep=0.5, maxl=0.45)
             + hits(GUN + '1911/A_34P.wav', 3, minsep=0.5, maxl=0.45))
    clank = [trim(L(X + f'100-CC0-wood-metal-SFX/metal_hit_0{i}.ogg')) for i in (2, 4)]
    return [maxlen(mix((band(pitch(s, 1), 200), 0, 0), (band(maxlen(clank[i % 2], 0.2), 400), 0.006, -9)), 0.4, 0.1)
            for i, s in enumerate(shots)]


def r_shotgun():
    shots = (hits(GUN + 'Mossberg/N_30P.wav', 1, maxl=0.9) + hits(GUN + 'Model 12/K_22P.wav', 1, maxl=0.9)
             + hits(GUN + 'Nova/O_21P.wav', 1, maxl=0.9) + hits(GUN + 'Mossberg/N_26P.wav', 2, minsep=0.8, maxl=0.9)
             + hits(GUN + 'Model 12/K_17P.wav', 1, maxl=0.9))
    return [maxlen(band(s, 60), 0.9, 0.25) for s in shots]


def r_rifle():
    shots = (hits(GUN + 'Mosin Nagant/M_21P.wav', 1, maxl=1.3)
             + hits(GUN + 'Mosin Nagant/M_26P.wav', 2, minsep=0.8, maxl=1.3)
             + hits(GUN + '1917/B_24P.wav', 1, maxl=1.3) + hits(GUN + 'Arisaka/E_25P.wav', 1, maxl=1.3))
    bolt = trim(L(X + 'shotgunsounds/ShotgunSounds/Shell in Chamber.mp3'))
    bolt = band(maxlen(bolt * db(-6), 0.35), 500)
    return [maxlen(mix((band(s, 50), 0, 0), (bolt, 0.55, -16)), 1.0, 0.1) for s in shots]


def r_eshot():
    # Disparos de los enemigos: lejanos y apagados para no confundirse con los tuyos.
    shots = (hits(GUN + 'SKS/U_19P.wav', 2, minsep=0.8, maxl=0.6)
             + hits(GUN + 'AR-15/D_24P.wav', 2, minsep=0.8, maxl=0.6))
    return [maxlen(band(s, 150, 3800), 0.6, 0.2) for s in shots]


def r_shot():
    # Núcleo de cobalto: zumbido de energía pesado.
    a = [trim(L(X + f'sci-fi-sfx/{n}.ogg')) for n in ('shoot_01', 'shoot_02', 'retro_laser_01', 'retro_laser_02')]
    return [maxlen(mix((band(pitch(s, -4), 80, 9000), 0, 0), (thump(90, 40, 0.25), 0, -10)), 0.45, 0.12) for s in a]


def r_dart():
    sw = [trim(L(X + f'swishes/swishes/swish-{i}.wav')) for i in (1, 2, 5, 6, 10, 11)]
    return [maxlen(band(pitch(s, 3), 900), 0.15, 0.04) for s in sw]


def r_throw():
    sw = [trim(L(X + f'swishes/swishes/swish-{i}.wav')) for i in (3, 7, 9, 4, 13)]
    return [maxlen(band(pitch(s, -4), 200), 0.3, 0.08) for s in sw]


def r_molotov():
    glass = [trim(L(X + f'sfx_breaking_and_falling/bfh1_glass_breaking_0{i}.ogg')) for i in (1, 2, 4, 5)]
    fire = [trim(L(BSB + '1340.ogg')), trim(L(BSB + '1341.ogg'))]
    out = []
    for i, g in enumerate(glass):
        f = maxlen(fire[i % 2], 1.3, 0.6)
        out.append(maxlen(mix((maxlen(g, 0.8, 0.2), 0, 0), (band(f, 80), 0.04, -3), (thump(80, 40, 0.3), 0, -10)),
                          1.4, 0.4))
    return out


def r_pop():
    a = [trim_attack(L(BSB + f'{i}.ogg')) for i in (1137, 1138, 1139, 1140)]
    b = [trim_attack(L(X + f'25-CC0-bang-sfx/bang_0{i}.ogg')) for i in (2, 4, 8)]
    return [maxlen(band(s, 120), 0.6, 0.2) for s in a + b]


def r_boom():
    base = [trim(L(X + f'25-CC0-bang-sfx/cannon_0{i}.ogg')) for i in (1, 2, 4)] + [trim(L(BSB + '1023.ogg'))]
    debris = [trim(L(X + f'sfx_breaking_and_falling/bfh1_rock_falling_0{i}.ogg')) for i in (1, 3, 5, 7)]
    out = []
    for i, s in enumerate(base):
        out.append(maxlen(mix((band(s, 30), 0, 0), (thump(65, 28, 0.6, 0.4), 0, -4),
                              (band(maxlen(debris[i], 1.2, 0.5), 300), 0.12, -14)), 1.8, 0.7))
    return out


def r_slam():
    a = [trim(L(X + '100-CC0-wood-metal-SFX/metal_slam_01.ogg'))] + \
        [trim(L(X + f'100-CC0-wood-metal-SFX/hammer_0{i}.ogg')) for i in (1, 2, 3, 4)]
    clang = [trim(L(X + f'cast_iron_clangs/cast iron clangs - Marker #{i}.wav')) for i in (1, 5, 9, 12, 15)]
    rock = trim(L(X + 'sfx_breaking_and_falling/bfh1_rock_hit_01.ogg'))
    out = []
    for i, s in enumerate(a):
        out.append(maxlen(mix((band(pitch(s, -4), 40), 0, 0), (band(pitch(maxlen(clang[i], 0.6), -7), 60), 0, -6),
                              (thump(75, 30, 0.45, 0.6), 0, -2), (band(rock, 100), 0.01, -8)), 1.0, 0.35))
    return out


def r_sonic():
    # Megáfono: chillido de acople distorsionado y el golpe de presión.
    al = L(X + 'sfx_loops/alarm_01.ogg')
    al3 = L(X + 'sfx_loops/alarm_03.ogg')
    out = []
    for src, p, t0 in ((al, 0, 0.0), (al, -2, 0.4), (al, 2, 0.9), (al3, -3, 0.0), (al3, 0, 0.5)):
        s = band(sat(pitch(maxlen(cut(src, t0), 0.45, 0.2), p), 3.5), 500, 3200, 3)
        out.append(maxlen(mix((s, 0, -3), (thump(110, 50, 0.3, 0.3), 0, -4)), 0.5, 0.2))
    return out


def r_tesla():
    # Chispas con su cola, no el chasquido suelto.
    a = hits(OGA + 'snaploop.wav', 4, minsep=0.4, maxl=0.3) + hits(BSB + '0952.ogg', 2, minsep=0.6, maxl=0.35)
    return [maxlen(band(s, 400), 0.3, 0.08) for s in a if len(s) > 0.08 * SR]


def r_defib():
    shock = hits(BSB + '0134.ogg', 4, minsep=0.6, maxl=0.4)
    knock = trim(L(OGA + 'hit.wav'))
    return [maxlen(mix((band(s, 300), 0.02, 0), (band(maxlen(knock, 0.25), 60, 2000), 0, -8)), 0.45, 0.12)
            for s in shock]


def r_zap():
    a = [trim_attack(L(OGA + 'spark.wav')), trim_attack(L(OGA + 'continuousspark.wav'))] + \
        hits(BSB + '0950.ogg', 3, minsep=0.5, maxl=0.25)
    return [maxlen(band(s, 600), 0.25, 0.06) for s in a if len(s) > 0.08 * SR]


def r_hit():
    a = [trim_attack(L(X + f'independent_nu_ljudbank-wet_squish_slurp_impacts/impsplat/impactsplat0{i}.mp3.flac'))
         for i in (1, 2, 3, 4, 6, 7, 8)] + [trim_attack(L(X + 'wet_breaks/Wet Break 4.wav'))]
    return [maxlen(band(s, 180), 0.22, 0.08) for s in a]


def r_hitMetal():
    a = [trim_attack(L(X + f'100-CC0-wood-metal-SFX/metal_hit_0{i}.ogg')) for i in range(1, 6)] + \
        [trim_attack(L(X + f'sfx_breaking_and_falling/bfh1_metal_hit_0{i}.ogg')) for i in (1, 3, 5)]
    return [maxlen(band(s, 250, 9000), 0.25, 0.1) for s in a]


def r_kill():
    voice = [trim(L(X + f'80-CC0-creature-sfx-2/die_0{i}.ogg')) for i in range(1, 5)] + \
            [trim(L(X + f'80-CC0-creature-SFX_0/hurt_0{i}.ogg')) for i in (1, 3)]
    squish = [trim_attack(L(X + f'wet_breaks/Wet Break {i}.wav')) for i in (1, 3, 5, 7, 9, 2)]
    return [maxlen(mix((band(maxlen(squish[i], 0.35), 150), 0, 0), (band(maxlen(v, 0.5, 0.2), 120), 0.01, -5)),
                   0.55, 0.2) for i, v in enumerate(voice)]


def r_killMetal():
    fall = [trim_attack(L(X + f'sfx_breaking_and_falling/bfh1_metal_falling_0{i}.ogg')) for i in range(1, 6)]
    spark = trim_attack(L(OGA + 'spark.wav'))
    return [maxlen(mix((band(maxlen(f, 0.6, 0.25), 120, 9000), 0, 0), (band(spark, 1000), 0.02, -9)), 0.65, 0.25)
            for f in fall]


def r_pickup():
    # Monedas con cuerpo y una campanita debajo; el tono sube en el motor (cadena de recogidas).
    c = hits(BSB + '0193.ogg', 6, minsep=0.3, maxl=0.22, floor_db=-14)
    return [maxlen(mix((band(s, 300, 9000), 0, 0), (ting(2000 + 120 * i), 0, -10)), 0.22, 0.08)
            for i, s in enumerate(c)]


def r_hurt():
    v = [trim(L(X + f'slightscreams/slightscream-{i:02d}.flac')) for i in (1, 3, 6, 8, 11, 14)]
    punch = [trim_attack(L(X + f'sfx_100_v2/sfx100v2_hit_0{i}.ogg')) for i in (1, 2, 3)]
    return [maxlen(mix((band(maxlen(punch[i % 3], 0.2), 80), 0, -4), (band(s, 120), 0.015, 0)), 0.65, 0.15)
            for i, s in enumerate(v)]


def r_dodge():
    sw = [trim(L(X + f'swishes/swishes/swish-{i}.wav')) for i in (4, 8, 12, 6, 10)]
    return [maxlen(band(pitch(s, -2), 300), 0.25, 0.08) for s in sw]


def r_boss():
    # Sirena de defensa civil arrancando y una alarma semimecánica.
    s1 = band(trim(L(BSB + '3259.ogg')), 120, 7000)
    s2 = band(trim(L(BSB + '0172.ogg')), 120, 7000)
    return [fade(cut(s1, 0, 5.5), 0.05, 1.6), fade(cut(s2, 0, 4.5), 0.05, 1.4)]


def r_level():
    bell = trim_attack(L(BSB + '2844.ogg'))
    key = trim_attack(L(BSB + '2842.ogg'))
    return [maxlen(mix((band(maxlen(key, 0.1), 300), 0, -6), (bell, 0.05, 0)), 1.6, 0.6)]


def r_chest():
    lid = trim_attack(L(X + '100-CC0-wood-metal-SFX/metal_open_01.ogg'))
    chest = trim_attack(L(OGA + 'open_chest_0.wav'))
    coins = trim(L(BSB + '0194.ogg'))
    return [maxlen(mix((chest / (np.abs(chest).max() + 1e-9) * 0.5, 0, 0), (band(lid, 150), 0.0, -6),
                       (band(maxlen(coins, 1.2, 0.6), 700), 0.35, -8)), 1.8, 0.6)]


def r_select():
    k = [trim_attack(L(X + f'unicae_games_keyboard_soundpack_1_0/Single Keys/keypress-00{i}.wav'))
         for i in (1, 2, 3, 4)]
    return [maxlen(band(s, 400), 0.12, 0.04) for s in k]


def r_death():
    g = hits(OGA + 'death_pain_grunts.wav', 1, maxl=1.4, floor_db=-6)[0]
    thunder = trim(L(BSB + '3113.ogg'))
    return [maxlen(mix((band(g, 100), 0, 0), (thump(55, 25, 1.2, 0.2), 0.05, -6),
                       (band(maxlen(thunder, 2.5, 1.5), 30, 1500), 0.1, -8)), 3.0, 1.4)]


def r_win():
    bell = trim_attack(L(BSB + '2844.ogg'))
    coins = trim(L(BSB + '0194.ogg'))
    return [maxlen(mix((bell, 0, 0), (pitch(bell, 4), 0.18, -3), (pitch(bell, 7), 0.36, -2),
                       (band(maxlen(coins, 1.8, 0.8), 700), 0.2, -9)), 2.4, 0.9)]


def r_victory():
    bell = trim_attack(L(BSB + '2844.ogg'))
    boom = trim(L(X + '25-CC0-bang-sfx/cannon_02.ogg'))
    return [maxlen(mix((band(boom, 30), 0, -3), (thump(60, 28, 0.8, 0.3), 0, -4), (bell, 0.25, -2),
                       (pitch(bell, 5), 0.45, -4), (pitch(bell, 12), 0.65, -6)), 3.0, 1.2)]


def r_geiger():
    # Chasquido de tubo Geiger: impulso con resonancia muy corta del altavoz del contador. Con cola en silencio para
    # que dure más que un bloque de AAC y el códec no lo deforme.
    out = []
    for f in (3200, 3900, 4600, 2800):
        n = int(0.006 * SR)
        t = np.arange(n) / SR
        y = np.sin(2 * np.pi * f * t) * np.exp(-t * 2200) + rng.standard_normal(n) * np.exp(-t * 6000) * 0.6
        y[0] = 1.0
        y = fade(band(y.astype(np.float32), 700, 9000), 0, 0.001)
        out.append(np.pad(y, (0, int(0.03 * SR))))
    return out


SFX = {k[2:]: v for k, v in globals().items() if k.startswith('r_')}


def finish_sfx(vs):
    """
    Iguala las variantes de un sonido: sin graves por debajo de 25 Hz (sin offset), misma sonoridad entre ellas
    (las que no llegan sin aplastarlas se quedan cerca) y picos limitados bajo el techo.
    """
    vs = [band(v, 25) for v in vs]
    short = np.median([len(mono(v)) for v in vs]) < 0.2 * SR
    win = 0.1 if short else 0.4
    out = []
    for v in vs:
        g = min(SFX_TARGET - lufs_peak(v, win), (CEIL_SFX + MAX_GR) - true_peak(v))
        out.append(limit(v * db(g), CEIL_SFX))
    # Pasadas siguientes: todas a la sonoridad mediana (bajar siempre se puede; subir, lo que deje el limitador).
    for _ in range(3):
        lv = [lufs_peak(v, win) for v in out]
        med = float(np.median(lv))
        out = [limit(v * db(min(med - l, (CEIL_SFX + MAX_GR) - true_peak(v))), CEIL_SFX) if abs(med - l) > 0.5 else v
               for v, l in zip(out, lv)]
    return out, win


# ---------- ambientes y música ----------

def stereo_bed(path, a, b, n):
    """Lecho estéreo con dos tramos distintos de la misma grabación (izquierda y derecha no se correlacionan)."""
    x = L(path)
    return np.stack([cut(x, a, a + n), cut(x, b, b + n)], 1)


AMB = {
    # Lecho de la run: viento grave del páramo, estéreo, loop de 40 s.
    'wind': lambda: seamless(band(declick(stereo_bed(BSB + '0595.ogg', 2, 46, 42), 9, 6), 40, 6000), 2.0),
    # Búnker (menús): viento colándose por las rendijas y zumbido de la instalación eléctrica.
    'bunker': lambda: seamless(mix((band(cut(L(BSB + '1714.ogg', True), 10, 52), 40, 5000), 0, 0),
                                   (band(np.tile(cut(L(BSB + '2118.ogg', True), 1, 8.5), (6, 1)), 50, 2500), 0, -22)),
                               2.0),
}
# Golpes sueltos del ambiente (truenos lejanos, ráfagas, una explosión a lo lejos), al azar y colocados en el estéreo.
AMB_ONE = {
    'thunder': lambda: [maxlen(band(trim(L(BSB + f'{i}.ogg')), 25, 1800), 9, 3) for i in (2718, 3113, 3114, 3115, 3179)],
    'gust': lambda: [fade(band(cut(L(BSB + '0147.ogg'), t, t + 7), 150, 7000), 1.5, 2.5) for t in (12, 40, 71)],
    'far': lambda: [maxlen(band(trim(L(BSB + '1023.ogg')), 30, 900), 4, 2)],
}
# Pista, sonoridad integrada objetivo, estéreo.
MUSIC = {
    'menu_1': (RAW + 'music/menu_it_had_to_be_you.mp3', -19, False),
    'menu_2': (RAW + 'music/menu_aint_we_got_fun.mp3', -19, False),
    'menu_3': (RAW + 'music/menu_whispering.mp3', -19, False),
    'run_1': (RAW + 'music/run_the_world_fell_silent_loop.flac', -21, True),
    'run_2': (RAW + 'music/run_outpost_loop.flac', -21, True),
    'run_3': (RAW + 'music/run_dirty_rain_loop.flac', -21, True),
    'boss_1': (RAW + 'music/boss_industrial_cinematic.mp3', -17, True),
}
# Estéreo tan ancho que perdería volumen en el altavoz mono de un móvil: se estrecha (lados −3 dB).
NARROW = {'run_1'}
# Margen de loop: el lecho se escribe con 1 s de su final delante y 1 s de su principio detrás, y el motor
# repite solo el tramo del medio; así los bordes del AAC (que no son exactos) nunca suenan.
LOOP_PAD = 1.0


def build_sfx(index, only=None):
    for sid, fn in SFX.items():
        if only and only not in (sid, 'sfx'):
            continue
        vs, win = finish_sfx(fn())
        durs = [len(mono(v)) / SR for v in vs]
        med = float(np.median(durs))
        odd = [round(d, 3) for d in durs if abs(d - med) > DUR_TOL * med]
        index['sfx'][sid] = []
        lv = []
        for i, v in enumerate(vs):
            name = f'sfx/{sid}_{i + 1}.m4a'
            y = encode(v, OUT + name, 96)
            lv.append(lufs_peak(y, win))
            index['sfx'][sid].append({'file': name, **stats(y)})
        spread = max(lv) - min(lv)
        flag = (' SPREAD' if spread > SPREAD else '') + (f' DUR{odd}' if odd else '')
        print(f'{sid:10s} n={len(vs)} lufs={np.median(lv):6.1f} spread={spread:4.1f} dur={med:5.2f}{flag}')


def build_amb(index):
    for aid, fn in AMB.items():
        x = norm_long(fn(), -30)
        pad = int(LOOP_PAD * SR)
        padded = np.concatenate([x[-pad:], x, x[:pad]])
        name = f'amb/{aid}.m4a'
        y = encode(padded, OUT + name, 112 if x.ndim == 2 else 80)
        index['amb'][aid] = {'file': name, 'loop': True, 'loopStart': LOOP_PAD,
                             'loopEnd': round(LOOP_PAD + len(x) / SR, 6), **stats(y)}
        print(aid, index['amb'][aid])
    for aid, fn in AMB_ONE.items():
        vs, _ = finish_sfx(fn())
        index['amb'][aid] = []
        for i, v in enumerate(vs):
            v = limit(v * db(-24 - lufs_peak(v)))
            name = f'amb/{aid}_{i + 1}.m4a'
            y = encode(v, OUT + name, 80)
            index['amb'][aid].append({'file': name, **stats(y)})
        print(aid, len(index['amb'][aid]))


def build_music(index):
    for mid, (src, target, stereo) in MUSIC.items():
        x = load(src, stereo)
        loop = mid.startswith('run_')
        if not stereo:
            # Disco de 78: sin chasquidos sueltos (marcan los picos y bajarían todo el volumen al limitar).
            x = declick(x)
        # Los loops ya vienen cortados a medida: recortar silencios rompería la costura.
        x = band(x if loop else trim(x, -40), 45 if stereo else 70, None if stereo else 9000)
        if mid in NARROW:
            m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2 * db(-3)
            x = np.stack([m + s, m - s], 1).astype(np.float32)
        if not loop:
            x = fade(x, 0.3, 2.5)
        v = norm_long(x, target)
        name = f'music/{mid}.m4a'
        y = encode(v, OUT + name, 128 if stereo else 96)
        lu = meter.integrated_loudness(y)
        index['music'][mid] = {'file': name, 'loop': loop, **stats(y)}
        print(f'{mid}: {lu:.1f} LUFS (objetivo {target}) {stats(y)}')
        assert abs(lu - target) <= 1.0, (mid, lu)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    path = OUT + 'audio.json'
    index = json.load(open(path)) if os.path.exists(path) and arg else {'sfx': {}, 'amb': {}, 'music': {}}
    if arg in (None, 'music'):
        build_music(index)
    if arg in (None, 'amb'):
        build_amb(index)
    if arg is None or arg == 'sfx' or arg in SFX:
        if arg is None or arg == 'sfx':
            # Sin restos de una versión anterior con más variantes.
            index['sfx'] = {}
            if os.path.isdir(OUT + 'sfx'):
                for f in os.listdir(OUT + 'sfx'):
                    os.remove(OUT + 'sfx/' + f)
        build_sfx(index, arg)
    with open(path, 'w') as fh:
        json.dump(index, fh, indent=1)


if __name__ == '__main__':
    main()
