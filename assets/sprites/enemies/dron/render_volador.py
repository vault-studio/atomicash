# =====================================================================
#  Atomic Ash · render_volador.py
#  Sprites de un enemigo volador rígido (sin esqueleto): flota, se
#  inclina al avanzar, embiste y cae al morir. La llama del propulsor
#  se separa de la malla y se sustituye por fuego emisivo que parpadea.
#
#  Uso:
#    blender -b -P render_volador.py -- <modelo.fbx|glb> <carpeta_salida> <id> [preview]
#
#  Usa la MISMA cámara, escala y luz que render_sprites.py.
# =====================================================================

import bpy
import bmesh
import json
import math
import os
import random
import sys
from mathutils import Vector

# ----- común con render_sprites.py (no cambiar por personaje) -----
CELL = 256
PIVOT = (128, 200)
ORTHO = 2.8
PITCH = 60.0
SAMPLES = 24
DIRECTIONS = [("S", 0), ("SW", -45), ("W", -90), ("NW", -135),
              ("N", 180), ("NE", 135), ("E", 90), ("SE", 45)]

# ----- propio de este enemigo -----
TARGET_HEIGHT = 0.95     # altura total del modelo (cuerpo + llama), en metros
HOVER = 0.30             # altura de la punta de la llama sobre el suelo
FLAME_Z = 0.40           # en el modelo original (1,8 m): por debajo de esto es llama
FLAME_R = 0.14           # y con radio menor que esto
ANIMS = {
    # nombre: (frames, fps, loop)
    "move":   (8, 12, True),
    "attack": (8, 16, False),
    "death":  (12, 14, False),
}
# -----------------------------------------------------------


def log(m):
    print("[volador] " + m, flush=True)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(a) < 3:
        raise SystemExit("Uso: -- <modelo> <salida> <id> [preview]")
    return a[0], a[1], a[2], (len(a) > 3 and a[3] == "preview")


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
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


def flame_material():
    m = bpy.data.materials.new("Llama")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    # Generated Z: 0 = punta, 1 = tobera
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.75, 0.10, 0.01, 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (1.0, 0.78, 0.35, 1)
    mid = cr.elements.new(0.55)
    mid.color = (1.0, 0.42, 0.05, 1)
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    alpha = nt.nodes.new("ShaderNodeMapRange")
    alpha.inputs["From Min"].default_value = 0.0
    alpha.inputs["From Max"].default_value = 0.6
    alpha.inputs["To Min"].default_value = 0.0
    alpha.inputs["To Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], alpha.inputs["Value"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.name = "Emit"
    em.inputs["Strength"].default_value = 2.5
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(alpha.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def main():
    src, dst, cid, preview = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene()
    sc = bpy.context.scene
    random.seed(7)

    before = set(bpy.data.objects)
    if src.lower().endswith(".glb") or src.lower().endswith(".gltf"):
        bpy.ops.import_scene.gltf(filepath=src)
    else:
        bpy.ops.import_scene.fbx(filepath=src)
    body = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
    for o in [o for o in bpy.data.objects if o not in before and o is not body]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # separar la llama original y quitarla
    bm = bmesh.new()
    bm.from_mesh(body.data)
    zs = [v.co.z for v in bm.verts]
    zmin, zmax = min(zs), max(zs)
    k = (zmax - zmin) / 1.8           # el umbral está medido para un modelo de 1,8 m
    fz, fr = zmin + FLAME_Z * k, FLAME_R * k
    kill = [v for v in bm.verts if v.co.z < fz and math.hypot(v.co.x, v.co.y) < fr]
    nozzle_z = max(v.co.z for v in kill) if kill else zmin
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    log("Llama original quitada: {} vértices".format(len(kill)))

    # escalar el conjunto a TARGET_HEIGHT y colocar la llama a HOVER
    s = TARGET_HEIGHT / (zmax - zmin)
    flame_len = (nozzle_z - zmin) * s * 1.25       # llama algo más larga que la original

    rig = bpy.data.objects.new("Pivot", None)      # gira para las 8 direcciones
    sc.collection.objects.link(rig)
    ctrl = bpy.data.objects.new("Ctrl", None)      # flota, se inclina, cae
    sc.collection.objects.link(ctrl)
    ctrl.parent = rig
    c = (zmax - nozzle_z) * s / 2                   # centro del cuerpo sobre la tobera
    base_z = HOVER + flame_len + c                  # altura del centro del cuerpo
    body.parent = ctrl
    body.scale = (s, s, s)
    body.location = (0, 0, -nozzle_z * s - c)
    ctrl.location = (0, 0, base_z)

    # llama nueva: cono emisivo colgando de la tobera
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.0, radius2=fr * s * 1.0,
                                    depth=flame_len, location=(0, 0, 0))
    flame = bpy.context.object
    flame.name = "Llama"
    flame.data.materials.append(flame_material())
    flame.parent = ctrl
    flame.location = (0, 0, -c - flame_len / 2)
    for p in flame.data.polygons:
        p.use_smooth = True
    flame.visible_shadow = False
    # resplandor
    ld = bpy.data.lights.new("Glow", "POINT")
    ld.energy = 25
    ld.color = (1.0, 0.55, 0.15)
    ld.shadow_soft_size = 0.15
    glow = bpy.data.objects.new("Glow", ld)
    sc.collection.objects.link(glow)
    glow.parent = ctrl
    glow.location = (0, 0, -c - flame_len * 0.35)
    emit = flame.data.materials[0].node_tree.nodes["Emit"]

    def pose(anim, t):
        """t en [0,1). Devuelve (dz, tilt_x, roll_y, spin_z, flame_scale, glow)."""
        flick = 1.0 + 0.12 * math.sin(t * math.tau * 3 + 1.3) + random.uniform(-0.08, 0.08)
        if anim == "move":
            dz = 0.05 * math.sin(t * math.tau)
            return dz, -8, 4 * math.sin(t * math.tau), 0, flick, 1.0
        if anim == "attack":
            # coge impulso hacia atrás y embiste hacia delante
            if t < 0.35:
                u = t / 0.35
                return 0.04 * u, 10 * u, 0, 0, 0.8 * flick, 0.8
            u = (t - 0.35) / 0.65
            e = math.sin(min(1, u * 1.4) * math.pi / 2)
            back = max(0, (u - 0.7) / 0.3)
            return 0.04 - 0.06 * e, 10 - 40 * e + 25 * back, 0, 0, (1.0 + 0.8 * e - 0.6 * back) * flick, 1 + 0.8 * e
        if anim == "death":
            # chisporrotea, se ladea, gira y cae al suelo; la llama se apaga
            fall = max(0.0, (t - 0.15) / 0.85)
            g = fall ** 2
            dz = -(base_z - c - 0.02) * g
            tilt = -10 - 75 * g
            roll = 25 * math.sin(t * 9) * (1 - g) + 60 * g
            spin = 220 * g
            fl = max(0.0, 1 - fall * 1.6) * (0.6 + 0.4 * random.random())
            return dz, tilt, roll, spin, fl, fl
        return 0, 0, 0, 0, flick, 1.0

    out_frames = os.path.join(dst, "_frames")
    os.makedirs(out_frames, exist_ok=True)
    report = {}
    for anim, (n, fps, loop) in ANIMS.items():
        ts = [i / n for i in range(n)] if loop else [i / (n - 1) for i in range(n)]
        if preview:
            ts = [ts[len(ts) // 2]]
        for dname, deg in DIRECTIONS:
            rig.rotation_euler = (0, 0, math.radians(deg))
            random.seed(hash(anim) & 0xffff)
            for i, t in enumerate(ts):
                dz, tilt, roll, spin, fs, gl = pose(anim, t)
                ctrl.location = (0, 0, base_z + dz)
                # en pose(), tilt negativo = morro abajo; el frente mira a -Y,
                # así que morro abajo es rotación X positiva
                ctrl.rotation_euler = (math.radians(-tilt), math.radians(roll), math.radians(spin))
                flame.scale = (0.9 + 0.1 * fs, 0.9 + 0.1 * fs, max(0.001, fs))
                flame.location = (0, 0, -c - flame_len * max(0.001, fs) / 2)
                flame.hide_render = fs < 0.05
                emit.inputs["Strength"].default_value = 2.5 * max(0.2, fs)
                ld.energy = 25 * gl
                bpy.context.view_layer.update()
                sc.render.filepath = os.path.join(out_frames, "{}_{}_{:02d}.png".format(anim, dname, i))
                bpy.ops.render.render(write_still=True)
            log("  {} {} listo".format(anim, dname))
        report[anim] = dict(frames=len(ts), fps=fps, loop=loop)

    with open(os.path.join(dst, "_render.json"), "w") as fh:
        json.dump(dict(id=cid, cell=CELL, pivot=PIVOT, directions=[d for d, _ in DIRECTIONS], anims=report), fh, indent=2)
    log("Frames renderizados en " + out_frames)


main()
