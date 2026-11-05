# =====================================================================
#  Atomic Ash · render_mortero.py
#  Sprites del Mortero de chatarra. El modelo llega en T, de una sola
#  malla y sin esqueleto: aquí se le monta uno, se reparten los pesos por
#  distancia a cada hueso y se anima por código.
#
#  Uso:
#    blender -b -P tools/render_mortero.py -- <modelo.fbx> <carpeta_salida> [preview]
#
#  Deja los fotogramas en <salida>/_frames y un _render.json; las hojas
#  las monta tools/pack_frames.py. Misma cámara, escala y luz que
#  render_rigido.py.
# =====================================================================

import json
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_rigido import CELL, DIRECTIONS, PIVOT, log, setup_scene  # noqa: E402

# nombre -> (frames, fps, loop)
ANIMS = {"move": (8, 9, True), "attack": (12, 12, False), "death": (12, 12, False)}

# Huesos: cabeza y cola en metros, medidas sobre la malla. Lado A = x > 0 (el del tubo), B = x < 0.
Y = -0.04
BONES = {
    "hips": ((0, Y, 0.70), (0, Y, 0.85), None),
    "spine": ((0, Y, 0.85), (0, Y, 1.02), "hips"),
    "chest": ((0, Y, 1.02), (0, Y, 1.24), "spine"),
    "head": ((0, Y, 1.24), (0, Y, 1.50), "chest"),
}
for side, sx in (("A", 1), ("B", -1)):
    BONES["uarm" + side] = ((sx * 0.29, -0.05, 1.09), (sx * 0.47, -0.05, 1.08), "chest")
    BONES["farm" + side] = ((sx * 0.47, -0.05, 1.08), (sx * 0.80, -0.05, 1.04), "uarm" + side)
    BONES["thigh" + side] = ((sx * 0.14, -0.05, 0.72), (sx * 0.15, -0.08, 0.40), "hips")
    BONES["shin" + side] = ((sx * 0.15, -0.08, 0.40), (sx * 0.17, -0.09, 0.13), "thigh" + side)
    BONES["foot" + side] = ((sx * 0.17, -0.09, 0.13), (sx * 0.18, -0.26, 0.05), "shin" + side)

MUZZLE = Vector((0.247, 0.063, 1.77))
FLASH_R = 0.15


def segment_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def weights(co):
    """Pesos por hueso, de más cerca a más lejos; los trozos rígidos (tubo y caja) van enteros al pecho."""
    x, y, z = co.T
    names = list(BONES)
    idx = {n: i for i, n in enumerate(names)}
    d = np.stack([segment_dist(co, np.array(BONES[n][0], float), np.array(BONES[n][1], float)) for n in names], axis=1)
    allow = np.zeros_like(d, dtype=bool)

    def let(mask, *bones):
        for b in bones:
            allow[mask, idx[b]] = True

    side_a = x >= 0
    arm = (np.abs(x) > 0.26) & (z > 0.93) & (z < 1.22) & (y < 0.07)
    gear = ((y > 0.07) & (z > 0.78)) | ((z > 1.22) & (x > 0.13))
    arm &= ~gear
    legs = (z < 0.85) & ~gear
    torso = ~arm & ~gear & (z >= 0.72)
    let(gear, "chest")
    let(torso, "hips", "spine", "chest")
    let(torso & (z > 1.18), "head")
    for name, mask in (("A", side_a), ("B", ~side_a)):
        let(arm & mask, "chest", "uarm" + name, "farm" + name)
        let(legs & mask, "hips", "thigh" + name, "shin" + name, "foot" + name)
    w = np.where(allow, (1 / (d + 0.02)) ** 6, 0.0)
    order = np.argsort(-w, axis=1)
    w[np.arange(len(w))[:, None], order[:, 3:]] = 0
    w /= w.sum(axis=1, keepdims=True)
    return names, w


def rot(rx=0.0, ry=0.0, rz=0.0):
    """Giro en los ejes del modelo en T: primero z, luego y y por último x."""
    return (Matrix.Rotation(math.radians(rx), 4, "X") @ Matrix.Rotation(math.radians(ry), 4, "Y")
            @ Matrix.Rotation(math.radians(rz), 4, "Z"))


def smooth(a, b, t):
    u = min(1.0, max(0.0, (t - a) / (b - a)))
    return u * u * (3 - 2 * u)


# Giros en grados: x < 0 lleva el muslo o el brazo hacia delante y x > 0 inclina el tronco hacia delante.
def stance():
    return {"uarmA": (0, 74, 0), "uarmB": (0, -74, 0), "farmA": (0, 0, -24), "farmB": (0, 0, 24)}


def leg(p, side, thigh, knee, foot=None):
    p["thigh" + side] = (thigh, 0, 0)
    p["shin" + side] = (knee, 0, 0)
    p["foot" + side] = (-(thigh + knee) * 0.7 if foot is None else foot, 0, 0)


def pose_move(t):
    a = 2 * math.pi * t
    s, c = math.sin(a), math.cos(a)
    p = stance()
    # Paso corto y pesado: el tubo le tira hacia atrás y anda encorvado para compensar.
    leg(p, "A", -5 - 22 * s, 9 + 32 * max(0.0, c))
    leg(p, "B", -5 + 22 * s, 9 + 32 * max(0.0, -c))
    p["uarmA"] = (14 * s, 74, 0)
    p["uarmB"] = (-14 * s, -74, 0)
    p["hips"] = (2, 3 * s, 5 * s)
    p["spine"] = (5, 0, 0)
    p["chest"] = (5, -2 * s, -6 * s)
    p["head"] = (-5, 0, 3 * s)
    return p, 0.0


def pose_attack(t):
    k = smooth(0.0, 0.26, t) * (1 - smooth(0.8, 1.0, t))
    # Cuatro retrocesos, uno por proyectil.
    hit = sum(math.exp(-((t - s) ** 2) / 0.0012) for s in (0.32, 0.43, 0.54, 0.65))
    p = stance()
    leg(p, "A", -14 * k, 12 * k + 3)
    leg(p, "B", -48 * k, 62 * k + 3)
    p["hips"] = (6 * k, 0, 0)
    p["spine"] = (12 * k - 3 * hit, 0, 0)
    p["chest"] = (14 * k - 5 * hit, 0, 0)
    p["head"] = (-20 * k, 0, 0)
    # Una mano sujeta la correa del tubo y la otra se apoya en la rodilla.
    p["uarmA"] = (-38 * k, 74 - 44 * k, 0)
    p["farmA"] = (0, 0, -24 - 88 * k)
    p["uarmB"] = (-40 * k, -74, 0)
    p["farmB"] = (0, 0, 24 + 30 * k)
    return p, min(1.0, hit)


def pose_death(t):
    f = smooth(0.08, 0.72, t)
    bounce = math.sin(max(0.0, (t - 0.72) / 0.28) * math.pi) * 0.06
    p = stance()
    leg(p, "A", -24 * f, 34 * f, 12 * f)
    leg(p, "B", -10 * f, 12 * f, 8 * f)
    # El peso del tubo lo tira de espaldas.
    p["hips"] = (-80 * f + 40 * bounce, 0, 12 * f)
    p["spine"] = (-6 * f, 0, 0)
    p["chest"] = (-4 * f, 0, 0)
    p["head"] = (16 * f, 8 * f, 0)
    p["uarmA"] = (-24 * f, 74 - 30 * f, 0)
    p["uarmB"] = (-30 * f, -74 + 44 * f, 0)
    p["farmA"] = (0, 0, -24 - 30 * f)
    p["farmB"] = (0, 0, 24 + 10 * f)
    return p, 0.0


POSES = {"move": pose_move, "attack": pose_attack, "death": pose_death}


def make_armature(sc):
    d = bpy.data.armatures.new("Rig")
    arm = bpy.data.objects.new("Rig", d)
    sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in BONES.items():
        b = d.edit_bones.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = d.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def glow(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    e = t.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*color, 1)
    e.inputs[1].default_value = strength
    # Opaco en el centro y transparente en el borde, para que no parezca una bola.
    mix = t.nodes.new("ShaderNodeMixShader")
    t.links.new(t.nodes.new("ShaderNodeLayerWeight").outputs["Facing"], mix.inputs[0])
    t.links.new(e.outputs[0], mix.inputs[1])
    t.links.new(t.nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[2])
    t.links.new(mix.outputs[0], t.nodes.new("ShaderNodeOutputMaterial").inputs[0])
    return m


def apply_pose(arm, pose):
    for pb in arm.pose.bones:
        spec = pose.get(pb.name)
        rest = pb.bone.matrix_local
        r = rot(*spec) if spec else Matrix.Identity(4)
        # El giro está en los ejes del modelo en T: se pasa al espacio del hueso.
        rest3 = rest.to_3x3().to_4x4()
        pb.matrix_basis = rest3.inverted() @ r @ rest3


def lowest(body):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    n = len(me.vertices)
    c = np.zeros(n * 3)
    me.vertices.foreach_get("co", c)
    ev.to_mesh_clear()
    return float(c[2::3].min())


def main():
    a = sys.argv[sys.argv.index("--") + 1:]
    src, dst = a[0], a[1]
    preview = len(a) > 2 and a[2] == "preview"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene()
    sc = bpy.context.scene

    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=src)
    body = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
    for o in [o for o in bpy.data.objects if o not in before and o is not body]:
        bpy.data.objects.remove(o, do_unlink=True)

    n = len(body.data.vertices)
    co = np.zeros(n * 3)
    body.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    names, w = weights(co)
    for j, name in enumerate(names):
        vg = body.vertex_groups.new(name=name)
        idx = np.nonzero(w[:, j])[0]
        for i in idx.tolist():
            vg.add([i], float(w[i, j]), "REPLACE")
    log("pesos listos ({} vértices)".format(n))

    arm = make_armature(sc)
    rig = bpy.data.objects.new("Pivot", None)  # gira para las 8 direcciones
    sc.collection.objects.link(rig)
    arm.parent = rig
    body.parent = arm
    body.modifiers.new("Rig", "ARMATURE").object = arm

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=FLASH_R)
    flash = bpy.context.active_object
    flash.data.materials.append(glow("Flash", (1.0, 0.68, 0.28), 1.25))

    out_frames = os.path.join(dst, "_frames")
    os.makedirs(out_frames, exist_ok=True)
    chest = arm.pose.bones["chest"]
    report = {}
    for anim, (count, fps, loop) in ANIMS.items():
        ts = [i / count for i in range(count)] if loop else [i / (count - 1) for i in range(count)]
        if preview:
            ts = [ts[len(ts) // 2]] if anim != "attack" else [ts[2], ts[3]]
        ground = {}
        for dname, deg in DIRECTIONS:
            if preview and dname not in ("S", "NE", "E"):
                continue
            rig.rotation_euler = (0, 0, math.radians(deg))
            for i, t in enumerate(ts):
                random.seed(hash((anim, i)) & 0xffff)
                pose, fire = POSES[anim](t)
                apply_pose(arm, pose)
                bpy.context.view_layer.update()
                if i not in ground:
                    ground[i] = lowest(body)
                # Los pies, o lo que quede más bajo, sobre el suelo.
                arm.location = (0, 0, -ground[i])
                bpy.context.view_layer.update()
                flash.hide_render = fire < 0.25
                flash.scale = [0.35 + 0.65 * fire] * 3
                flash.location = (arm.matrix_world @ chest.matrix @ chest.bone.matrix_local.inverted()) @ MUZZLE
                bpy.context.view_layer.update()
                sc.render.filepath = os.path.join(out_frames, "{}_{}_{:02d}.png".format(anim, dname, i))
                bpy.ops.render.render(write_still=True)
            log("  {} {} listo".format(anim, dname))
        report[anim] = dict(frames=len(ts), fps=fps, loop=loop)

    with open(os.path.join(dst, "_render.json"), "w") as fh:
        json.dump(dict(id="mortero", cell=CELL, pivot=PIVOT, directions=[d for d, _ in DIRECTIONS], anims=report), fh, indent=2)
    log("Frames renderizados en " + out_frames)


main()
