# =====================================================================
#  Atomic Ash · render_rig.py
#  Sprites de modelos de una sola malla y sin esqueleto que necesitan
#  piezas móviles: Liquidador, Bidonero, Sabueso Geiger, Nevera de asalto
#  y Motorista. Como en render_mortero.py, aquí se monta el esqueleto, se
#  reparten los pesos y se anima por código; cada modelo trae sus huesos,
#  su reparto y sus poses.
#
#  Uso:
#    blender -b -P tools/render_rig.py -- <modelo.fbx> <carpeta_salida> <id> [preview]
#
#  Deja los fotogramas en <salida>/_frames y un _render.json; las hojas
#  las monta tools/pack_frames.py. Pasa rutas absolutas: las relativas
#  acaban en C:\out. Misma cámara, escala y luz que render_rigido.py.
# =====================================================================

import json
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_mortero import glow, leg, lowest, rot, segment_dist, smooth  # noqa: E402
from render_rigido import CELL, DIRECTIONS, PIVOT, log, setup_scene  # noqa: E402

TAU = 2 * math.pi
ROOT = ((0, 0, 0.9), (0, 0, 1.0), None)


def sided(p, s):
    return (s * p[0], p[1], p[2])


def humanoid(y, hip, waist, chest, neck, top, shoulder, elbow, hand, hipx, knee, ankle, toe):
    """Huesos de un humanoide; las medidas van en el lado x > 0 y el otro lado sale en espejo."""
    b = {"root": ROOT, "hips": ((0, y, hip), (0, y, waist), "root"), "spine": ((0, y, waist), (0, y, chest), "hips"),
         "chest": ((0, y, chest), (0, y, neck), "spine"), "head": ((0, y, neck), (0, y, top), "chest")}
    for side, s in (("A", 1), ("B", -1)):
        b["uarm" + side] = (sided(shoulder, s), sided(elbow, s), "chest")
        b["farm" + side] = (sided(elbow, s), sided(hand, s), "uarm" + side)
        b["thigh" + side] = (sided((hipx, y, hip - 0.04), s), sided(knee, s), "hips")
        b["shin" + side] = (sided(knee, s), sided(ankle, s), "thigh" + side)
        b["foot" + side] = (sided(ankle, s), sided(toe, s), "shin" + side)
    return b


def to_weights(co, bones, allow_of):
    """Pesos por cercanía a cada hueso, solo entre los que permite `allow_of`; como mucho 3 por vértice."""
    names = list(bones)
    idx = {n: i for i, n in enumerate(names)}
    d = np.stack([segment_dist(co, np.array(bones[n][0], float), np.array(bones[n][1], float)) for n in names], axis=1)
    allow = np.zeros_like(d, dtype=bool)

    def let(mask, *ns):
        for n in ns:
            allow[mask, idx[n]] = True

    allow_of(let)
    missing = ~allow.any(axis=1)
    if missing.any():
        raise SystemExit("{} vértices sin hueso".format(int(missing.sum())))
    w = np.where(allow, (1 / (d + 0.02)) ** 6, 0.0)
    order = np.argsort(-w, axis=1)
    w[np.arange(len(w))[:, None], order[:, 3:]] = 0
    w /= w.sum(axis=1, keepdims=True)
    return names, w


def humanoid_weights(co, bones, gear, head_z, arm_r, arm_minx, arm_out=None):
    """`arm_out`: de esta x hacia fuera todo es brazo, por gordos que sean la manga o el guante."""
    x, y, z = co.T
    arm = np.zeros(len(co), bool)
    for side, s in (("A", 1), ("B", -1)):
        for n in ("uarm", "farm"):
            near = segment_dist(co, np.array(bones[n + side][0], float), np.array(bones[n + side][1], float)) < arm_r
            arm |= near & (x * s > arm_minx)
        if arm_out is not None:
            arm |= (x * s > arm_out) & (z > 0.6)
    arm &= ~gear
    hip = bones["hips"][0][2]
    legs = (z < hip + 0.03) & ~gear & ~arm
    torso = ~arm & ~gear & ~legs

    def allow(let):
        let(gear, "chest")
        let(torso, "hips", "spine", "chest")
        let(torso & (z > head_z), "head")
        for name, mask in (("A", x >= 0), ("B", x < 0)):
            let(arm & mask, "chest", "uarm" + name, "farm" + name)
            let(legs & mask, "hips", "thigh" + name, "shin" + name, "foot" + name)

    return to_weights(co, bones, allow)


# --------------------------------------------------------------------
#  Liquidador: traje antirradiación, pulveriza con la mano y cae de bruces
# --------------------------------------------------------------------
LIQ_BONES = humanoid(-0.13, 0.86, 1.0, 1.16, 1.40, 1.78, (0.25, -0.13, 1.34), (0.41, -0.13, 1.12), (0.57, -0.13, 0.88),
                     0.12, (0.14, -0.13, 0.50), (0.16, -0.12, 0.13), (0.16, -0.30, 0.05))


def liq_weights(co):
    x, y, z = co.T
    gear = (y > 0.03) & (z > 0.75)
    return humanoid_weights(co, LIQ_BONES, gear, 1.38, 0.14, 0.2)


def liq_stance():
    return {"uarmA": (0, 30, 0), "uarmB": (0, -30, 0), "farmA": (-14, 0, 0), "farmB": (-14, 0, 0)}


def liq_move(t):
    a = TAU * t
    s, c = math.sin(a), math.cos(a)
    p = liq_stance()
    leg(p, "A", -4 - 25 * s, 8 + 34 * max(0.0, c))
    leg(p, "B", -4 + 25 * s, 8 + 34 * max(0.0, -c))
    p["uarmA"] = (20 * s, 30, 0)
    p["uarmB"] = (-20 * s, -30, 0)
    p["hips"] = (2, 2 * s, 6 * s)
    p["spine"] = (3, 0, 0)
    p["chest"] = (3, -2 * s, -7 * s)
    p["head"] = (-3, 0, 3 * s)
    return p


def liq_attack(t):
    k = smooth(0.0, 0.3, t) * (1 - smooth(0.82, 1.0, t))
    w = math.sin(t * TAU * 3) * k
    p = liq_stance()
    leg(p, "A", 6 * k, 8 * k + 3)
    leg(p, "B", -28 * k, 30 * k + 3)
    p["hips"] = (4 * k, 0, -14 * k)
    p["spine"] = (4 * k, 0, 0)
    p["chest"] = (4 * k, 0, -10 * k)
    p["head"] = (-8 * k, 0, 18 * k)
    # Apunta con el brazo derecho y sujeta la muñeca con la otra mano; el chorro le hace temblar.
    p["uarmA"] = (-84 * k + 2 * w, 30 - 8 * k, 0)
    p["farmA"] = (-14 + 10 * k, 0, 0)
    p["uarmB"] = (-52 * k, -30 - 8 * k, 0)
    p["farmB"] = (-14 - 62 * k, 0, 0)
    return p


def liq_death(t):
    f = smooth(0.06, 0.74, t)
    knees = smooth(0.0, 0.38, t)
    bounce = math.sin(max(0.0, (t - 0.74) / 0.26) * math.pi) * 0.05
    p = liq_stance()
    # Se le doblan las rodillas y las botellas de la espalda lo tumban de bruces.
    leg(p, "A", -10 * knees, 28 * knees - 16 * f, 6 * f)
    leg(p, "B", -26 * knees, 40 * knees - 22 * f, 6 * f)
    p["hips"] = (84 * f - 30 * bounce, 0, 10 * f)
    p["spine"] = (4 * f, 0, 0)
    p["head"] = (-14 * f, 10 * f, 0)
    p["uarmA"] = (-30 * f, 30 + 30 * f, 0)
    p["uarmB"] = (-14 * f, -30 - 44 * f, 0)
    return p


def liq_setup(sc, rig, body, arm):
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.2, radius2=0.035, depth=1)
    o = bpy.context.active_object
    # Punta en el origen, hacia +Z: así crece estirando z.
    for v in o.data.vertices:
        v.co.z = 0.5 - v.co.z
    o.data.materials.append(glow("Jet", (0.32, 1.0, 0.06), 1.1))
    o.rotation_mode = "QUATERNION"
    o.parent = rig
    return dict(jet=o)


def liq_frame(ctx, rig, arm, anim, t):
    o = ctx["jet"]
    amt = smooth(0.26, 0.36, t) * (1 - smooth(0.76, 0.86, t)) if anim == "attack" else 0.0
    o.hide_render = amt < 0.05
    if o.hide_render:
        return
    a, b = bone_ends(rig, arm, "farmA")
    d = (b - a).normalized()
    o.location = b + d * 0.02
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    flick = 0.9 + 0.2 * random.random()
    o.scale = (amt * flick * 0.8, amt * flick * 0.8, amt * flick * 0.62)


# --------------------------------------------------------------------
#  Bidonero: corpulento, se saca un bidón de la espalda y lo tira a dos manos
# --------------------------------------------------------------------
BID_BONES = humanoid(-0.14, 0.86, 0.98, 1.12, 1.33, 1.72, (0.31, -0.12, 1.27), (0.44, -0.12, 1.05), (0.56, -0.12, 0.74),
                     0.17, (0.22, -0.14, 0.46), (0.25, -0.12, 0.14), (0.25, -0.35, 0.05))
DRUM_BOX = ((0.2, 0.45), (-0.2, 0.25), (1.38, 1.76))


def bid_weights(co):
    x, y, z = co.T
    # La mochila, sin el dorso de los brazos, que le queda a la misma altura.
    gear = ((y > -0.03) & (z > 0.86) & (np.abs(x) < 0.27)) | ((y > -0.03) & (z > 1.33)) | ((np.abs(x) > 0.2) & (z > 1.4))
    return humanoid_weights(co, BID_BONES, gear, 1.33, 0.16, 0.27, 0.345)


def bid_stance():
    return {"uarmA": (0, 22, 0), "uarmB": (0, -22, 0), "farmA": (-10, 0, 0), "farmB": (-10, 0, 0)}


def bid_move(t):
    a = TAU * t
    s, c = math.sin(a), math.cos(a)
    p = bid_stance()
    # Anda como un pato: le pesan la barriga y los bidones.
    leg(p, "A", -3 - 17 * s, 7 + 26 * max(0.0, c))
    leg(p, "B", -3 + 17 * s, 7 + 26 * max(0.0, -c))
    p["uarmA"] = (11 * s, 22, 0)
    p["uarmB"] = (-11 * s, -22, 0)
    p["root"] = (0, 5 * s, 3 * s)
    p["hips"] = (2, 0, 0)
    p["spine"] = (4, 0, 0)
    p["chest"] = (3, -3 * s, -4 * s)
    p["head"] = (-5, 2 * s, 0)
    return p


BID_RELEASE = 0.5


def bid_attack(t):
    up = smooth(0.0, 0.34, t)
    go = smooth(0.42, 0.56, t)
    back = smooth(0.74, 1.0, t)
    k = up * (1 - back)
    g = go * (1 - back)
    p = bid_stance()
    leg(p, "A", 10 * k - 4 * go, 6 * k + 3)
    leg(p, "B", -18 * k - 26 * g, 26 * k + 12 * g + 3)
    p["hips"] = (-5 * k + 8 * g, 0, 0)
    p["spine"] = (-8 * k + 16 * g, 0, 0)
    p["chest"] = (-8 * k + 18 * g, 0, 0)
    p["head"] = (6 * k - 12 * g, 0, 0)
    # Los dos brazos suben por encima de la cabeza y bajan de golpe al soltar.
    swing = (-160 * up + 100 * go) * (1 - back)
    p["uarmA"] = (swing, 22 + 4 * k, 0)
    p["uarmB"] = (swing, -22 - 4 * k, 0)
    bend = -10 - 48 * up * (1 - go)
    p["farmA"] = (bend, 0, 0)
    p["farmB"] = (bend, 0, 0)
    return p


def bid_death(t):
    f = smooth(0.08, 0.72, t)
    bounce = math.sin(max(0.0, (t - 0.72) / 0.28) * math.pi) * 0.06
    p = bid_stance()
    leg(p, "A", -30 * f, 42 * f, 10 * f)
    leg(p, "B", -12 * f, 18 * f, 8 * f)
    # Los bidones lo tiran de espaldas.
    p["hips"] = (-78 * f + 40 * bounce, 0, -10 * f)
    p["spine"] = (-6 * f, 0, 0)
    p["head"] = (14 * f, -8 * f, 0)
    p["uarmA"] = (-30 * f, 22 + 34 * f, 0)
    p["uarmB"] = (-16 * f, -22 - 40 * f, 0)
    return p


def bid_setup(sc, rig, body, arm):
    # El bidón que coge y lanza: oxidado y con el residuo verde asomando.
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.15, depth=0.36)
    o = bpy.context.active_object
    rust = bpy.data.materials.new("Drum")
    rust.use_nodes = True
    bsdf = rust.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.1, 0.075, 0.04, 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    o.data.materials.append(rust)
    o.parent = rig
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.13, depth=0.03, location=(0, 0, 0.18))
    cap = bpy.context.active_object
    cap.data.materials.append(solid("Waste", (0.5, 1.0, 0.1), 1.2))
    cap.parent = o
    return dict(drum=o, cap=cap, release={})


def bid_frame(ctx, rig, arm, anim, t):
    o = ctx["drum"]
    o.hide_render = anim != "attack" or not 0.14 <= t <= 0.84
    ctx["cap"].hide_render = o.hide_render
    if o.hide_render:
        return
    # Hasta soltarlo va entre las dos manos; después sale en arco hacia delante.
    a = bone_ends(rig, arm, "farmA")[1]
    b = bone_ends(rig, arm, "farmB")[1]
    hands = (a + b) / 2 + Vector((0, -0.06, 0.12))
    if t <= BID_RELEASE:
        o.location = hands
        o.rotation_euler = (math.radians(-40 * t / BID_RELEASE), 0, 0)
        ctx["release"][rig.rotation_euler.z] = hands.copy()
        return
    u = (t - BID_RELEASE) / 0.34
    start = ctx["release"].get(rig.rotation_euler.z, hands)
    o.location = start + Vector((0, -1.5 * u, 0.5 * u - 0.5 * u * u))
    o.rotation_euler = (math.radians(-40 - 260 * u), 0, 0)


# --------------------------------------------------------------------
#  Sabueso Geiger: perro robot sobre ruedas; cabeza, patas y antena se mueven
# --------------------------------------------------------------------
SAB_HEAD = (-0.46, 0.92)
SAB_BONES = {"root": ROOT, "body": ((0, -0.4, 0.75), (0, 0.8, 0.75), "root"),
             "head": ((0, SAB_HEAD[0], SAB_HEAD[1]), (0, -0.8, 1.05), "body"),
             "antenna": ((0, 0.76, 1.1), (0, 0.76, 1.8), "body")}
for _n, _s in (("A", 1), ("B", -1)):
    SAB_BONES["front" + _n] = ((_s * 0.29, -0.38, 0.62), (_s * 0.29, -0.57, 0.14), "body")
    SAB_BONES["rear" + _n] = ((_s * 0.29, 0.85, 0.62), (_s * 0.29, 0.87, 0.14), "body")


def sab_weights(co):
    x, y, z = co.T
    head = (y < -0.36) & (z > 0.9)
    ant = (y > 0.6) & (y < 0.92) & (z > 1.22)
    legs = (np.abs(x) > 0.19) & (z < 0.5)
    rest = ~head & ~ant & ~legs

    def allow(let):
        let(rest, "body")
        let(head, "head")
        let(ant, "antenna")
        for n, m in (("A", x >= 0), ("B", x < 0)):
            let(legs & m & (y < 0.1), "front" + n)
            let(legs & m & (y >= 0.1), "rear" + n)

    return to_weights(co, SAB_BONES, allow)


def sab_move(t):
    a = TAU * t
    s, c = math.sin(a), math.cos(a)
    p = {"root": (-2.5 + 2.2 * s, 1.2 * c, 0), "head": (-4 + 5 * c, 2 * s, 0), "antenna": (-11 * s, 5 * c, 0),
         "lift": 0.02 * abs(s), "jit": 0.004}
    for n in "AB":
        p["front" + n] = (13 * s, 0, 0)
        p["rear" + n] = (-13 * s, 0, 0)
    return p


def sab_attack(t):
    # El choque: clava el morro, muerde el aire y rebota.
    hit = math.exp(-t * 5)
    bite = math.sin(min(1.0, t * 2.2) * math.pi)
    bounce = math.sin(math.pi * t)
    return {"root": (6 * bite - 8 * bounce * (1 - bite), 0, 0, 0, -0.18 * bite + 0.1 * bounce, 0), "head": (-22 * bite, 0, 0),
            "antenna": (30 * hit - 14 * math.sin(t * 9) * (1 - t), 0, 0), "jit": 0.025 * hit}


# --------------------------------------------------------------------
#  Motorista: moto rígida; solo giran las ruedas. El ataque es el derrape.
# --------------------------------------------------------------------
MOT_WHEEL = dict(F=(-0.981, 0.375, 0.378), R=(0.94, 0.385, 0.378))  # y, z y radio
MOT_BONES = {"root": ROOT}
for _n, (_y, _z, _r) in MOT_WHEEL.items():
    MOT_BONES["wheel" + _n] = ((0, _y, _z), (0.1, _y, _z), "root")


def mot_masks(co):
    x, y, z = co.T
    return {n: (np.abs(x) < 0.085) & (np.hypot(y - wy, z - wz) < r) for n, (wy, wz, r) in MOT_WHEEL.items()}


def mot_weights(co):
    masks = mot_masks(co)
    rest = ~masks["F"] & ~masks["R"]

    def allow(let):
        let(rest, "root")
        let(masks["F"], "wheelF")
        let(masks["R"], "wheelR")

    return to_weights(co, MOT_BONES, allow)


def mot_prepare(body):
    m = mot_masks(mesh_co(body))
    cut_part(body, m["F"] | m["R"])


def mot_move(t):
    a = TAU * t
    spin = -360 * t
    return {"root": (1.0 * math.sin(a * 2), 1.5 * math.sin(a), 0), "wheelF": (spin, 0, 0), "wheelR": (spin, 0, 0), "jit": 0.006}


def mot_attack(t):
    # Derrape: la trasera se va de lado, se tumba y frena clavando la delantera.
    k = math.sin(t * math.pi)
    spin = -300 * t * (1 - t * 0.5)
    return {"root": (-5 * k, 26 * k, 62 * k), "wheelF": (spin * 0.4, 0, 0), "wheelR": (spin, 0, 0), "jit": 0.012 * k}


# --------------------------------------------------------------------
#  Nevera de asalto: cuatro patas, la puerta se abre como una boca y escupe
#  bloques de hielo
# --------------------------------------------------------------------
NEV_HINGE = (0.40, -0.325)
NEV_DOOR_Y = -0.315
NEV_BONES = {"root": ROOT, "body": ((0, 0, 0.6), (0, 0, 1.6), "root"),
             "door": ((NEV_HINGE[0], NEV_HINGE[1], 0.52), (NEV_HINGE[0], NEV_HINGE[1], 1.33), "body")}
NEV_LEGS = {"FA": (1, -1), "FB": (-1, -1), "RA": (1, 1), "RB": (-1, 1)}
for _n, (_sx, _sy) in NEV_LEGS.items():
    NEV_BONES["leg" + _n] = ((_sx * 0.32, _sy * 0.22, 0.44), (_sx * 0.37, _sy * 0.36, 0.13), "body")
    NEV_BONES["foot" + _n] = ((_sx * 0.37, _sy * 0.36, 0.13), (_sx * 0.37, _sy * 0.5, 0.03), "leg" + _n)


def nev_door_mask(co):
    x, y, z = co.T
    return (y < NEV_DOOR_Y) & (z > 0.5) & (z < 1.335) & (x < NEV_HINGE[0] + 0.04) & (x > -0.45)


def nev_weights(co):
    x, y, z = co.T
    door = nev_door_mask(co)
    legs = (z < 0.5) & (np.abs(x) > 0.17)
    rest = ~door & ~legs

    def allow(let):
        let(rest, "body")
        let(door, "door")
        for n, (sx, sy) in NEV_LEGS.items():
            m = legs & (x * sx > 0) & (y * sy >= 0)
            let(m & (z >= 0.14), "leg" + n)
            let(m & (z < 0.14), "foot" + n)

    return to_weights(co, NEV_BONES, allow)


def nev_move(t):
    a = TAU * t
    s, c = math.sin(a), math.cos(a)
    p = {"root": (1.5 * c, 5 * s, 2.5 * s), "lift": 0.02 * abs(c)}
    # Trote: se mueven a la vez las patas opuestas.
    for n, k in (("FA", 1), ("RB", 1), ("FB", -1), ("RA", -1)):
        sw = 15 * s * k
        p["leg" + n] = (sw, 0, 0)
        p["foot" + n] = (-sw, 0, 0)
    return p


SPITS = (0.4, 0.5, 0.6, 0.7)


def nev_open(t):
    return smooth(0.08, 0.32, t) * (1 - smooth(0.84, 1.0, t))


def nev_attack(t):
    k = nev_open(t)
    kick = sum(math.exp(-((t - s) ** 2) / 0.0014) for s in SPITS)
    return {"root": (-5 * k - 4 * kick, 0, 0, 0, 0.05 * kick, 0), "door": (0, 0, 78 * k), "jit": 0.006 * kick}


def nev_setup(sc, rig, body, arm):
    # La boca: el fondo azul que se ve al abrir la puerta.
    bpy.ops.mesh.primitive_cube_add(size=1)
    back = bpy.context.active_object
    back.scale = (0.74, 0.03, 0.8)
    back.location = (0, NEV_DOOR_Y + 0.012, 0.92)
    back.parent = rig
    back.data.materials.append(solid("MouthGlow", (0.03, 0.13, 0.28), 1.0))
    shelves = []
    for z in (0.74, 1.0, 1.24):
        bpy.ops.mesh.primitive_cube_add(size=1)
        c = bpy.context.active_object
        c.scale = (0.72, 0.05, 0.022)
        c.location = (0, NEV_DOOR_Y - 0.01, z)
        c.parent = rig
        c.data.materials.append(solid("Shelf", (0.3, 0.6, 0.8), 0.8))
        shelves.append(c)
    ice = bpy.data.materials.new("Ice")
    ice.use_nodes = True
    bsdf = ice.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.55, 0.82, 1.0, 1)
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Emission Color"].default_value = (0.4, 0.75, 1.0, 1)
    bsdf.inputs["Emission Strength"].default_value = 0.25
    blocks = []
    for i in range(len(SPITS)):
        bpy.ops.mesh.primitive_cube_add(size=1)
        b = bpy.context.active_object
        b.scale = (0.17, 0.17, 0.17)
        b.parent = rig
        b.data.materials.append(ice)
        blocks.append(b)
    return dict(back=back, shelves=shelves, blocks=blocks)


def nev_frame(ctx, rig, arm, anim, t):
    for o in [ctx["back"], *ctx["shelves"]]:
        o.hide_render = anim != "attack" or nev_open(t) < 0.03
    for i, b in enumerate(ctx["blocks"]):
        u = (t - SPITS[i] + 0.02) / 0.22
        b.hide_render = anim != "attack" or not 0 <= u <= 1
        if b.hide_render:
            continue
        b.location = ((-1) ** i * 0.14 * u, NEV_DOOR_Y - 0.1 - 1.15 * u, 1.0 + 0.75 * u - 0.45 * u * u)
        b.rotation_euler = (2.6 * u + i, 1.7 * u, i * 0.8)


def nev_prepare(body):
    cut_part(body, nev_door_mask(mesh_co(body)))


# --------------------------------------------------------------------

MODELS = {
    "liquidador": dict(bones=LIQ_BONES, weights=liq_weights, setup=liq_setup, frame=liq_frame,
                       anims={"move": (8, 10, True, liq_move), "attack": (10, 12, False, liq_attack),
                              "death": (12, 12, False, liq_death)}),
    "bidonero": dict(bones=BID_BONES, weights=bid_weights, setup=bid_setup, frame=bid_frame,
                     anims={"move": (8, 8, True, bid_move), "attack": (12, 12, False, bid_attack),
                            "death": (12, 12, False, bid_death)}),
    "sabueso": dict(bones=SAB_BONES, weights=sab_weights, fit=2.1,
                    anims={"move": (8, 14, True, sab_move), "attack": (8, 14, False, sab_attack)}),
    "motorista": dict(bones=MOT_BONES, weights=mot_weights, fit=2.3, prepare=mot_prepare,
                      anims={"move": (8, 14, True, mot_move), "attack": (10, 12, False, mot_attack)}),
    "nevera": dict(bones=NEV_BONES, weights=nev_weights, setup=nev_setup, frame=nev_frame, prepare=nev_prepare,
                   anims={"move": (8, 8, True, nev_move), "attack": (12, 12, False, nev_attack)}),
}


def solid(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    e = t.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*color, 1)
    e.inputs[1].default_value = strength
    t.links.new(e.outputs[0], t.nodes.new("ShaderNodeOutputMaterial").inputs[0])
    return m


def mesh_co(body):
    co = np.zeros(len(body.data.vertices) * 3)
    body.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def cut_part(body, mask):
    """Quita las caras que unen una pieza con el resto, para que no se estiren al moverla."""
    bm = bmesh.new()
    bm.from_mesh(body.data)
    cut = [f for f in bm.faces if len({bool(mask[v.index]) for v in f.verts}) > 1]
    bmesh.ops.delete(bm, geom=cut, context="FACES_ONLY")
    bm.to_mesh(body.data)
    bm.free()
    log("pieza separada ({} caras)".format(len(cut)))


def bone_ends(rig, arm, name):
    """Cabeza y cola del hueso en el espacio de `rig`, con la pose actual."""
    pb = arm.pose.bones[name]
    m = rig.matrix_world.inverted() @ arm.matrix_world
    return m @ pb.head, m @ pb.tail


def make_armature(sc, bones):
    d = bpy.data.armatures.new("Rig")
    arm = bpy.data.objects.new("Rig", d)
    sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in bones.items():
        b = d.edit_bones.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = d.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def apply_pose(arm, pose):
    for pb in arm.pose.bones:
        spec = pose.get(pb.name)
        if not spec:
            pb.matrix_basis = Matrix.Identity(4)
            continue
        rest3 = pb.bone.matrix_local.to_3x3().to_4x4()
        r = rot(*spec[:3])
        t = Matrix.Translation(spec[3:]) if len(spec) > 3 else Matrix.Identity(4)
        # Giro y traslado en los ejes del modelo: se pasan al espacio del hueso.
        pb.matrix_basis = rest3.inverted() @ t @ r @ rest3


def main():
    a = sys.argv[sys.argv.index("--") + 1:]
    src, dst, cid = a[0], a[1], a[2]
    preview = len(a) > 3 and a[3] == "preview"
    spec = MODELS[cid]
    bones = spec["bones"]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene()
    sc = bpy.context.scene

    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=src)
    body = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
    for o in [o for o in bpy.data.objects if o not in before and o is not body]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if "prepare" in spec:
        spec["prepare"](body)

    co = mesh_co(body)
    names, w = spec["weights"](co)
    for j, name in enumerate(names):
        vg = body.vertex_groups.new(name=name)
        for i in np.nonzero(w[:, j])[0].tolist():
            vg.add([i], float(w[i, j]), "REPLACE")
    log("pesos listos ({} vértices)".format(len(co)))

    arm = make_armature(sc, bones)
    rig = bpy.data.objects.new("Pivot", None)  # gira para las 8 direcciones
    sc.collection.objects.link(rig)
    arm.parent = rig
    body.parent = arm
    body.modifiers.new("Rig", "ARMATURE").object = arm
    if spec.get("fit"):
        s = spec["fit"] / float(np.ptp(co[:, 1]))
        rig.scale = (s, s, s)
        log("escala {:.3f}".format(s))
    ctx = spec["setup"](sc, rig, body, arm) if "setup" in spec else {}

    out_frames = os.path.join(dst, "_frames")
    os.makedirs(out_frames, exist_ok=True)
    report = {}
    for anim, (count, fps, loop, pose_fn) in spec["anims"].items():
        ts = [i / count for i in range(count)] if loop else [i / (count - 1) for i in range(count)]
        if preview:
            ts = [ts[len(ts) // 3], ts[len(ts) // 2], ts[(len(ts) * 3) // 4]]
        ground = {}
        for dname, deg in DIRECTIONS:
            if preview and dname not in ("S", "NE", "E"):
                continue
            rig.rotation_euler = (0, 0, math.radians(deg))
            for i, t in enumerate(ts):
                random.seed(i * 31 + len(anim))
                pose = pose_fn(t)
                jit = pose.get("jit", 0.0)
                apply_pose(arm, pose)
                bpy.context.view_layer.update()
                if i not in ground:
                    ground[i] = lowest(body)
                # Lo más bajo de la pose, sobre el suelo.
                arm.location = (random.uniform(-jit, jit), random.uniform(-jit, jit),
                                -ground[i] + pose.get("lift", 0.0) + random.uniform(0, jit))
                bpy.context.view_layer.update()
                if "frame" in spec:
                    spec["frame"](ctx, rig, arm, anim, t)
                    bpy.context.view_layer.update()
                sc.render.filepath = os.path.join(out_frames, "{}_{}_{:02d}.png".format(anim, dname, i))
                bpy.ops.render.render(write_still=True)
            log("  {} {} listo".format(anim, dname))
        report[anim] = dict(frames=len(ts), fps=fps, loop=loop)

    with open(os.path.join(dst, "_render.json"), "w") as fh:
        json.dump(dict(id=cid, cell=CELL, pivot=PIVOT, directions=[d for d, _ in DIRECTIONS], anims=report), fh, indent=2)
    log("Frames renderizados en " + out_frames)


if __name__ == "__main__":
    main()
