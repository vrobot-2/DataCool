# DataCool proof frame 2 — SolidCraft geometry, Blender render.
# No materials, no compositing: pure geometry + light.
# blender -b --factory-startup -P proof/render_clay.py

import bpy, bmesh, math, os
from mathutils import Vector

OBJ = r"C:\coding-project\datacool\proof\cad\heat_exchanger.obj"
OUT = r"C:\coding-project\datacool\proof\render"
os.makedirs(OUT, exist_ok=True)
QUALITY = os.environ.get("PROOF_QUALITY", "test").lower()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.context.collection

# ---------------------------------------------------------------- import

SOURCE = os.environ.get("PROOF_SOURCE", "step").lower()
if SOURCE == "step":
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.step_importer")
    bpy.ops.import_scene.step(filepath=OBJ.replace(".obj", ".step"))
else:
    bpy.ops.wm.obj_import(filepath=OBJ, global_scale=0.001,
                          forward_axis='Y', up_axis='Z')
meshes = [o for o in scene.objects if o.type == 'MESH']
print("IMPORTED", len(meshes), "from", SOURCE)

# weld tiny tessellation gaps and set angle-based smooth shading
for o in meshes:
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) <= math.radians(34)
        else:
            e.smooth = True
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True

# one neutral clay shader for everything: no textures, no part finishes
clay = bpy.data.materials.new("clay")
clay.use_nodes = True
bsdf = clay.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.30, 0.30, 0.31, 1)
bsdf.inputs["Roughness"].default_value = 0.72
for o in meshes:
    o.data.materials.clear()
    o.data.materials.append(clay)

# world bounds
mn = Vector((1e9, 1e9, 1e9))
mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w))
        mx = Vector(map(max, mx, w))
print("BBOX", mn, mx)
center = (mn + mx) / 2

# ---------------------------------------------------------------- stage

def box(name, sx, sy, sz, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.location = loc
    return o

floor = box("Floor", 60, 60, 0.01, (0, 0, -0.005))
floor.data.materials.append(clay)

# ---------------------------------------------------------------- lights

def aim(o, target):
    d = Vector(target) - o.location
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('-Z', 'Y')

def area(name, loc, target, size, energy, color=(1, 1, 1), shape='SQUARE', sy=None):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.color = color
    d.shape = shape
    d.size = size
    if sy:
        d.size_y = sy
    o = bpy.data.objects.new(name, d)
    col.objects.link(o)
    o.location = loc
    aim(o, target)
    return o

TGT = (center.x, center.y, center.z * 0.92)
area("key", (4.4, -1.0, 3.1), TGT, 1.25, 300)
area("rim", (-2.6, 2.7, 2.5), TGT, 1.5, 360, (0.70, 0.80, 1.0))
area("fill", (-2.8, -3.4, 1.0), (0, 0, 0.8), 2.2, 45, (1.0, 0.85, 0.70))
area("top", (0.0, 0.4, 3.6), (0, 0.1, 0.9), 2.6, 55, (0.9, 0.95, 1.0),
     shape='RECTANGLE', sy=0.6)

w = bpy.data.worlds.new("World")
scene.world = w
w.use_nodes = True
bg = w.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.055, 0.062, 0.075, 1)
bg.inputs[1].default_value = 1.0

# ---------------------------------------------------------------- camera

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 55
cam_data.sensor_width = 36
cam = bpy.data.objects.new("Cam", cam_data)
col.objects.link(cam)
cam.location = (3.30, -3.40, 1.36)
aim(cam, (0.0, 0.02, 0.86))
scene.camera = cam

# ---------------------------------------------------------------- render

scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
except Exception as e:
    print("GPU:", e)

if QUALITY == "test":
    scene.render.resolution_x, scene.render.resolution_y = 820, 600
    scene.cycles.samples = 32
else:
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1160
    scene.cycles.samples = 192

scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.01
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5

scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = -0.55
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

# deliberately no compositor
scene.use_nodes = False
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT, "clay_%s.png" % QUALITY)
bpy.ops.render.render(write_still=True)
print("WROTE", scene.render.filepath)
