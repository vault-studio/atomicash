# =====================================================================
#  Atomic Ash · render_rigido.py
#  Sprites de enemigos de una sola malla sin esqueleto (aspiradora,
#  babosa, cortacésped, torreta, excavadora y el Dirigible). El
#  movimiento es procedural: el
#  modelo entero se desplaza, se inclina y se deforma por escala.
#
#  Uso:
#    blender -b -P tools/render_rigido.py -- <modelo.fbx|.glb> <carpeta_salida> <id> [preview]
#
#  Deja los fotogramas en <salida>/_frames y un _render.json; las hojas
#  las monta tools/pack_frames.py. Misma cámara, escala y luz que
#  render_volador.py (dron) y las hojas de Mixamo.
# =====================================================================

import bpy
import json
import math
import os
import random
import sys
from mathutils import Vector

# ----- común con render_volador.py (no cambiar por enemigo) -----
CELL = 256
PIVOT = (128, 200)
ORTHO = 2.8
PITCH = 60.0
SAMPLES = 24
DIRECTIONS = [("S", 0), ("SW", -45), ("W", -90), ("NW", -135),
              ("N", 180), ("NE", 135), ("E", 90), ("SE", 45)]

# ----- propio de cada enemigo -----
# fit: medida máxima (largo/ancho, alto) en metros que puede ocupar en la celda.
# anims: nombre -> (frames, fps, loop)
PROFILES = {
    "aspiradora": dict(fit=(2.1, 1.5), anims={"move": (8, 12, True), "attack": (8, 16, False), "death": (12, 12, False)}),
    "babosa": dict(fit=(2.4, 0.9), anims={"move": (12, 10, True), "attack": (8, 14, False), "death": (12, 10, False)}),
    "cortacesped": dict(fit=(2.3, 1.3), anims={"move": (8, 16, True), "attack": (10, 16, False), "death": (12, 12, False)}),
    "torreta": dict(fit=(1.3, 1.6), anims={"idle": (8, 8, True), "attack": (8, 16, False), "death": (12, 12, False)}),
    "excavadora": dict(fit=(2.2, 1.3), anims={"move": (8, 12, True), "attack": (10, 14, False), "death": (12, 12, False)}),
    # Vuela: el juego lo eleva (FLY_HEIGHT), aquí se renderiza a ras de suelo.
    "dirigible": dict(fit=(2.2, 1.4), anims={"move": (12, 8, True), "attack_1": (10, 12, False),
                                             "attack_2": (10, 12, False), "death": (14, 10, False)}),
}
# -----------------------------------------------------------------


def log(m):
    print("[rigido] " + m, flush=True)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(a) < 3:
        raise SystemExit("Uso: -- <modelo> <salida> <id> [preview]")
    return a[0], a[1], a[2], (len(a) > 3 and a[3] == "preview")


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    # GPU si la hay; si no, CPU.
    sc.cycles.device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                sc.cycles.device = "GPU"
                log("GPU: " + kind)
                break
    except Exception as err:  # noqa: BLE001
        log("sin GPU ({})".format(err))
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = CELL
    sc.render.resolution_y = CELL
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.52, 0.47, 1)
    bg.inputs[1].default_value = 0.6
    cam_d = bpy.data.cameras.new("Cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = ORTHO
    cam_d.shift_x = (PIVOT[0] - CELL / 2) / CELL
    cam_d.shift_y = (PIVOT[1] - CELL / 2) / CELL
    cam = bpy.data.objects.new("Cam", cam_d)
    sc.collection.objects.link(cam)
    p = math.radians(PITCH)
    cam.location = (0, -20 * math.sin(p), 20 * math.cos(p))
    cam.rotation_euler = (p, 0, 0)
    sc.camera = cam

    def sun(name, energy, color, rot):
        d = bpy.data.lights.new(name, "SUN")
        d.energy = energy
        d.color = color
        d.angle = math.radians(8)
        o = bpy.data.objects.new(name, d)
        o.rotation_euler = [math.radians(v) for v in rot]
        sc.collection.objects.link(o)
    sun("Key", 3.2, (1.0, 0.92, 0.78), (40, 0, -35))
    sun("Fill", 0.9, (0.75, 0.85, 1.0), (60, 0, 140))
    sun("Rim", 1.6, (1.0, 0.95, 0.85), (70, 0, 200))


# ---------------------------------------------------------------------
#  Poses. t en [0,1]. Devuelve un dict con (todo opcional):
#   fwd  avance hacia el frente (m)      hop  despegue del suelo (m)
#   pitch morro abajo (º)  roll ladeo (º)  yaw giro (º)
#   sx, sy, sz  escala (y = largo)       sink hundirse en el suelo (m)
#   jit  vibración aleatoria (m)
# ---------------------------------------------------------------------
def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def pose_aspiradora(anim, t):
    s = math.sin(t * math.tau)
    if anim == "move":
        # rueda a trompicones, el depósito se balancea
        return dict(hop=0.015 * abs(math.sin(t * math.tau * 2)), roll=2.5 * s, pitch=1.5 * math.cos(t * math.tau * 2),
                    yaw=3 * math.sin(t * math.tau + 0.7))
    if anim == "attack":
        # se echa atrás y embiste con la boquilla
        if t < 0.35:
            u = ease(t / 0.35)
            return dict(fwd=-0.12 * u, pitch=-8 * u)
        u = (t - 0.35) / 0.65
        e = math.sin(min(1.0, u * 1.6) * math.pi / 2)
        back = ease((u - 0.55) / 0.45)
        return dict(fwd=-0.12 + 0.32 * e - 0.2 * back, pitch=-8 + 18 * e - 10 * back, sy=1 + 0.06 * e * (1 - back))
    if anim == "death":
        # chisporrotea, da un respingo y vuelca de lado
        shake = 1 - ease(t / 0.4)
        fall = ease((t - 0.3) / 0.6)
        return dict(jit=0.03 * shake, hop=0.12 * math.sin(min(1, t / 0.35) * math.pi), roll=95 * fall, yaw=25 * fall)
    return {}


def pose_babosa(anim, t):
    s = math.sin(t * math.tau)
    if anim == "move":
        # ondas de reptación: se estira y se encoge
        return dict(sy=1 + 0.08 * s, sz=1 - 0.07 * s, sx=1 - 0.03 * s, fwd=0.05 * s, yaw=3 * math.sin(t * math.tau + 1.2))
    if anim == "attack":
        # se yergue y cae con todo el peso
        if t < 0.45:
            u = ease(t / 0.45)
            return dict(pitch=-14 * u, sz=1 + 0.18 * u, sy=1 - 0.08 * u)
        u = ease((t - 0.45) / 0.25)
        r = ease((t - 0.7) / 0.3)
        return dict(pitch=-14 + 22 * u - 8 * r, sz=1.18 - 0.38 * u + 0.2 * r, sy=0.92 + 0.2 * u - 0.12 * r,
                    sx=1 + 0.12 * u * (1 - r), fwd=0.1 * u * (1 - r))
    if anim == "death":
        # se retuerce y se derrama en un charco
        twist = (1 - ease(t / 0.5)) * math.sin(t * 20)
        melt = ease((t - 0.2) / 0.8)
        return dict(yaw=10 * twist, roll=6 * twist, sz=1 - 0.72 * melt, sx=1 + 0.35 * melt, sy=1 + 0.12 * melt)
    return {}


def pose_cortacesped(anim, t):
    if anim == "move":
        # motor al ralentí: tiembla y cabecea
        return dict(jit=0.008, pitch=1.2 * math.sin(t * math.tau * 2), roll=1.5 * math.sin(t * math.tau))
    if anim == "attack":
        # acelera en el sitio: tiembla cada vez más y levanta el morro antes de salir disparado
        u = ease(t / 0.8)
        go = ease((t - 0.8) / 0.2)
        return dict(jit=0.006 + 0.03 * u, pitch=-10 * u + 14 * go, fwd=-0.08 * u + 0.25 * go, hop=0.02 * u * (1 - go))
    if anim == "death":
        # salta por los aires y cae panza arriba
        up = math.sin(min(1.0, t / 0.7) * math.pi)
        flip = ease(t / 0.75)
        return dict(hop=0.5 * up, roll=180 * flip, yaw=40 * flip, jit=0.02 * (1 - flip))
    return {}


def pose_torreta(anim, t):
    if anim in ("idle", "move"):
        # zumbido: respira y vigila
        return dict(sz=1 + 0.012 * math.sin(t * math.tau), yaw=4 * math.sin(t * math.tau))
    if anim == "attack":
        # ráfaga de tres: un retroceso por disparo
        k = (t * 3) % 1.0
        kick = math.exp(-k * 6) * (1 if t < 0.9 else 0.5)
        return dict(pitch=-7 * kick, fwd=-0.06 * kick, sz=1 - 0.02 * kick)
    if anim == "death":
        # se le rompe la base: tiembla, se hunde y cae hacia delante
        shake = 1 - ease(t / 0.5)
        fall = ease((t - 0.35) / 0.65)
        return dict(jit=0.025 * shake, pitch=70 * fall, roll=15 * fall, sink=0.05 * fall)
    return {}


def pose_excavadora(anim, t):
    if anim == "move":
        # orugas: avanza a tirones con el motor en marcha
        return dict(jit=0.006, pitch=1.5 * math.sin(t * math.tau * 2), roll=1.2 * math.sin(t * math.tau),
                    fwd=0.02 * math.sin(t * math.tau * 2))
    if anim == "attack":
        # se encabrita hacia atrás y deja caer la pala con todo el peso
        if t < 0.45:
            u = ease(t / 0.45)
            return dict(pitch=-12 * u, fwd=-0.06 * u)
        u = ease((t - 0.45) / 0.2)
        r = ease((t - 0.7) / 0.3)
        return dict(pitch=-12 + 20 * u - 8 * r, fwd=-0.06 + 0.18 * u - 0.12 * r, jit=0.02 * u * (1 - r))
    if anim == "death":
        # el motor revienta: tiembla, da un bote y vuelca de lado
        shake = 1 - ease(t / 0.45)
        fall = ease((t - 0.35) / 0.65)
        return dict(jit=0.03 * shake, hop=0.1 * math.sin(min(1, t / 0.3) * math.pi), roll=80 * fall, yaw=15 * fall)
    return {}


def pose_dirigible(anim, t):
    s = math.sin(t * math.tau)
    if anim == "move":
        # flota: sube y baja despacio y se mece con el viento
        return dict(hop=0.05 + 0.04 * s, roll=3 * math.sin(t * math.tau + 0.8), pitch=2 * s)
    if anim == "attack_1":
        # abre la bodega: frena, se ladea y suelta la carga con un respingo
        u = math.sin(min(1.0, t / 0.6) * math.pi)
        kick = math.exp(-max(0.0, t - 0.5) * 8) if t > 0.5 else 0
        return dict(hop=0.05 + 0.06 * kick, roll=7 * u, yaw=4 * u, pitch=-3 * u)
    if anim == "attack_2":
        # pasada de bombardeo: morro abajo y acelera
        u = math.sin(t * math.pi)
        return dict(hop=0.05 - 0.03 * u, pitch=9 * u, fwd=0.14 * u, jit=0.006 * u)
    if anim == "death":
        # pierde gas: tiembla, cae de morro girando y se desinfla contra el suelo
        shake = 1 - ease(t / 0.4)
        fall = ease((t - 0.2) / 0.8)
        return dict(jit=0.025 * shake, hop=0.05 * (1 - fall), pitch=28 * fall, roll=22 * fall, yaw=30 * fall,
                    sz=1 - 0.35 * fall, sx=1 + 0.08 * fall)
    return {}


POSES = {"aspiradora": pose_aspiradora, "babosa": pose_babosa, "cortacesped": pose_cortacesped, "torreta": pose_torreta,
         "excavadora": pose_excavadora, "dirigible": pose_dirigible}


def main():
    src, dst, cid, preview = args()
    prof = PROFILES[cid]
    pose_fn = POSES[cid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene()
    sc = bpy.context.scene

    before = set(bpy.data.objects)
    if src.lower().endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=src)
    else:
        bpy.ops.import_scene.fbx(filepath=src)
    body = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
    for o in [o for o in bpy.data.objects if o not in before and o is not body]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    vs = [v.co.copy() for v in body.data.vertices]
    xs, ys, zs = [v.x for v in vs], [v.y for v in vs], [v.z for v in vs]
    cx, cy, zmin = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    horiz = max(max(xs) - min(xs), max(ys) - min(ys))
    s = min(prof["fit"][0] / horiz, prof["fit"][1] / (max(zs) - zmin))
    log("escala {:.3f} (largo {:.2f} m, alto {:.2f} m)".format(s, horiz * s, (max(zs) - zmin) * s))
    # Muestra de vértices (centrados y escalados) para apoyar el modelo en el suelo en cada pose.
    step = max(1, len(vs) // 1500)
    sample = [Vector(((v.x - cx) * s, (v.y - cy) * s, (v.z - zmin) * s)) for v in vs[::step]]
    hz = (max(zs) - zmin) * s

    rig = bpy.data.objects.new("Pivot", None)      # gira para las 8 direcciones
    sc.collection.objects.link(rig)
    ctrl = bpy.data.objects.new("Ctrl", None)      # pose; su origen está en el centro del modelo
    sc.collection.objects.link(ctrl)
    ctrl.parent = rig
    body.parent = ctrl
    body.scale = (s, s, s)
    body.location = (-cx * s, -cy * s, -zmin * s - hz / 2)

    out_frames = os.path.join(dst, "_frames")
    os.makedirs(out_frames, exist_ok=True)
    report = {}
    for anim, (n, fps, loop) in prof["anims"].items():
        ts = [i / n for i in range(n)] if loop else [i / (n - 1) for i in range(n)]
        if preview:
            ts = [ts[len(ts) // 2]]
        for dname, deg in DIRECTIONS:
            rig.rotation_euler = (0, 0, math.radians(deg))
            for i, t in enumerate(ts):
                random.seed(hash((anim, i)) & 0xffff)
                p = pose_fn(anim, t)
                jit = p.get("jit", 0.0)
                sx, sy, sz = p.get("sx", 1.0), p.get("sy", 1.0), p.get("sz", 1.0)
                ctrl.rotation_euler = (math.radians(p.get("pitch", 0.0)), math.radians(p.get("roll", 0.0)),
                                       math.radians(p.get("yaw", 0.0)))
                ctrl.scale = (sx, sy, sz)
                ctrl.location = (random.uniform(-jit, jit), -p.get("fwd", 0.0) + random.uniform(-jit, jit), 0)
                # Apoya el punto más bajo de la pose en el suelo.
                m = ctrl.matrix_basis
                low = min((m @ (v - Vector((0, 0, hz / 2)))).z for v in sample)
                ctrl.location.z = -low + p.get("hop", 0.0) - p.get("sink", 0.0) + random.uniform(0, jit)
                bpy.context.view_layer.update()
                sc.render.filepath = os.path.join(out_frames, "{}_{}_{:02d}.png".format(anim, dname, i))
                bpy.ops.render.render(write_still=True)
            log("  {} {} listo".format(anim, dname))
        report[anim] = dict(frames=len(ts), fps=fps, loop=loop)

    with open(os.path.join(dst, "_render.json"), "w") as fh:
        json.dump(dict(id=cid, cell=CELL, pivot=PIVOT, directions=[d for d, _ in DIRECTIONS], anims=report), fh, indent=2)
    log("Frames renderizados en " + out_frames)


main()
