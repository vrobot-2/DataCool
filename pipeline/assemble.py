# DataCool scene assembly: STEP/OBJ -> placed, shaded, lit scene.blend
# ENHANCED VERSION: Product-grade rack, exchanger, city diorama with instancing
# Blender 5.4 Alpha, headless:
#   blender.exe -b --factory-startup -P pipeline/assemble.py

import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Matrix, Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYOUT_PATH = os.path.join(HERE, "scene_layout.json")

with open(LAYOUT_PATH, "r", encoding="utf-8") as fh:
    LAYOUT = json.load(fh)

# Load scene.meta.json for instancing data
META_PATH = os.path.join(ROOT, "app", "public", "models", "scene.meta.json")
with open(META_PATH, "r", encoding="utf-8") as fh:
    META = json.load(fh)

def log(*args):
    print("[assemble]", *args, flush=True)

def abs_path(rel):
    return os.path.normpath(os.path.join(ROOT, rel))

OUT_ROOT = os.environ.get("DATACOOL_OUT")

def out_path(rel):
    if os.path.isabs(rel):
        return rel
    base = os.path.join(ROOT, OUT_ROOT) if OUT_ROOT and not os.path.isabs(OUT_ROOT) else (OUT_ROOT or ROOT)
    return os.path.normpath(os.path.join(base, rel))

def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4

def hex_rgba(value):
    value = value.lstrip("#")
    r, g, b = (int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)

# ------------------------------------------------------------------ scene reset

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "DataCool"

STEP_ADDON = "bl_ext.user_default.step_importer"
STEP_ENABLED = True
try:
    bpy.ops.preferences.addon_enable(module=STEP_ADDON)
    log("step importer enabled")
except Exception as exc:
    STEP_ENABLED = False
    log("WARNING step importer could not be enabled:", exc)

# ------------------------------------------------------------------ collections

def make_collection(name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col

COLS = {}
for key in ["rack", "exchanger", "district", "loops", "environment", "hall"]:
    COLS[key] = make_collection(key)

# ------------------------------------------------------------------ materials

MATS = {}

def build_material(key, spec):
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(spec["hex"])
    bsdf.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
    bsdf.inputs["Roughness"].default_value = spec.get("roughness", 0.5)
    mat["datacool_hex"] = spec["hex"]
    em = spec.get("emissive")
    if em:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(em["hex"])
        bsdf.inputs["Emission Strength"].default_value = float(em.get("strength", 1.0))
    return mat

for key, spec in LAYOUT["materials"].items():
    MATS[key] = build_material(key, spec)

def material_for(asset, name):
    lowered = name.lower()
    for rule in LAYOUT["material_rules"]:
        if rule["asset"] != asset:
            continue
        for token in rule["match"]:
            if token == "*" or token in lowered:
                return MATS[rule["material"]]
    return MATS.get("concrete", MATS["painted_steel"])

# ------------------------------------------------------------------ helpers

def weld_mesh(obj, dist=1e-5):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(me)
    bm.free()

def smooth_by_angle(obj, angle_deg=34):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for face in bm.faces:
        face.smooth = True
    edges_to_mark = []
    for edge in bm.edges:
        if len(edge.link_faces) == 2:
            angle = edge.calc_face_angle()
            if angle > math.radians(angle_deg):
                edges_to_mark.append(edge)
    for edge in edges_to_mark:
        edge.smooth = False
    bm.to_mesh(me)
    bm.free()

def apply_decimation(obj, target_tris, asset_factor=1.0):
    current_tris = len(obj.data.polygons)
    budget = int(target_tris * asset_factor)
    if current_tris <= budget:
        return current_tris
    
    ratio = budget / current_tris
    mod = obj.modifiers.new("Decimate", 'DECIMATE')
    mod.ratio = max(0.01, min(1.0, ratio))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    final_tris = len(obj.data.polygons)
    log(f"  decimated {obj.name}: {current_tris} -> {final_tris} tris")
    return final_tris

# ------------------------------------------------------------------ import

def import_obj(path, asset_key, col):
    if not os.path.exists(path):
        log(f"WARNING: {path} not found, skipping")
        return []
    
    log(f"importing OBJ: {path}")
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.obj_import(
            filepath=path,
            global_scale=0.001,  # mm to m
            forward_axis='Y',
            up_axis='Z'
        )
    except Exception as e:
        log(f"ERROR importing {path}: {e}")
        return []
    
    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == 'MESH']
    
    for obj in imported:
        # Move to collection
        for old_col in obj.users_collection:
            old_col.objects.unlink(obj)
        col.objects.link(obj)
        
        # Apply material
        mat = material_for(asset_key, obj.name)
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        
        # Prefix name with asset
        obj.name = f"{asset_key}__{obj.name}"
        
        # Weld and smooth
        weld_mesh(obj)
        smooth_by_angle(obj)
    
    log(f"  imported {len(imported)} objects from {asset_key}")
    return imported

# ------------------------------------------------------------------ import enhanced assets

# RACK (enhanced)
rack_path = abs_path("assets/rack/rack.obj")
rack_objs = import_obj(rack_path, "rack", COLS["rack"])

if rack_objs:
    # Join all rack objects into one mesh for easier instancing
    bpy.context.view_layer.objects.active = rack_objs[0]
    for obj in rack_objs:
        obj.select_set(True)
    bpy.ops.object.join()
    rack_master = bpy.context.active_object
    rack_master.name = "rack__master"
    rack_master.location = LAYOUT["assets"]["rack"]["position"]
    rot = LAYOUT["assets"]["rack"]["rotation_deg"]
    rack_master.rotation_euler = [math.radians(r) for r in rot]
    
    # Apply decimation to rack
    bbox_diag = (Vector((0.6, 1.0, 2.2))).length
    target_tris = bbox_diag * LAYOUT["optimize"]["tris_per_metre"]
    apply_decimation(rack_master, target_tris, LAYOUT["optimize"]["asset_factor"].get("rack", 1.0))
    
    log(f"rack master created at {rack_master.location}, {len(rack_master.data.polygons)} tris")

# EXCHANGER (enhanced frame + existing core + ports)
exch_frame_path = abs_path("assets/exchanger/exchanger_frame_enhanced.obj")
exch_core_path = abs_path("assets/exchanger/exchanger_core.obj")
exch_ports_path = abs_path("assets/exchanger/exchanger_ports.obj")

exch_objs = []
exch_objs.extend(import_obj(exch_frame_path, "exchanger", COLS["exchanger"]))
exch_objs.extend(import_obj(exch_core_path, "exchanger", COLS["exchanger"]))
exch_objs.extend(import_obj(exch_ports_path, "exchanger", COLS["exchanger"]))

if exch_objs:
    bpy.context.view_layer.objects.active = exch_objs[0]
    for obj in exch_objs:
        obj.select_set(True)
    bpy.ops.object.join()
    exch_master = bpy.context.active_object
    exch_master.name = "exchanger__master"
    exch_master.location = LAYOUT["assets"]["exchanger"]["position"]
    
    bbox_diag = (Vector((0.868, 1.328, 1.62))).length
    target_tris = bbox_diag * LAYOUT["optimize"]["tris_per_metre"]
    apply_decimation(exch_master, target_tris, LAYOUT["optimize"]["asset_factor"].get("exchanger", 1.0))
    
    log(f"exchanger master created at {exch_master.location}, {len(exch_master.data.polygons)} tris")

# DISTRICT (city diorama)
district_path = abs_path("assets/district/district_diorama.obj")
district_objs = import_obj(district_path, "district", COLS["district"])

if district_objs:
    # Separate archetypes from infrastructure
    archetypes = {}
    infrastructure = []
    
    for obj in district_objs:
        name_lower = obj.name.lower()
        if "arch" in name_lower:
            # Extract archetype name
            arch_name = obj.name.split("__")[1] if "__" in obj.name else obj.name
            if arch_name not in archetypes:
                archetypes[arch_name] = obj
            else:
                # Duplicate archetype, keep first
                bpy.data.objects.remove(obj, do_unlink=True)
        else:
            infrastructure.append(obj)
    
    log(f"  found {len(archetypes)} archetypes, {len(infrastructure)} infrastructure pieces")
    
    # Join infrastructure
    if infrastructure:
        bpy.context.view_layer.objects.active = infrastructure[0]
        for obj in infrastructure:
            obj.select_set(True)
        bpy.ops.object.join()
        district_base = bpy.context.active_object
        district_base.name = "district__base"
        district_base.location = LAYOUT["assets"]["district"]["position"]
        
        bbox_diag = (Vector((400, 400, 7))).length
        target_tris = bbox_diag * LAYOUT["optimize"]["tris_per_metre"]
        apply_decimation(district_base, target_tris, LAYOUT["optimize"]["asset_factor"].get("district", 0.35))
        
        log(f"district base created, {len(district_base.data.polygons)} tris")

# ------------------------------------------------------------------ INSTANCING

# Hall: 10 rack instances  
# NOTE: Make the master rack single-user first so bake.py can join safely
if rack_objs:
    rack_master.data = rack_master.data.copy()  # Make mesh single-user
    rack_master.data.name = "rack__master_mesh"

if rack_objs and "hall" in META:
    log("creating hall rack instances...")
    for inst_data in META["hall"]["rackInstances"]:
        inst = rack_master.copy()
        inst.data = rack_master.data.copy()  # Make each instance have unique mesh data
        inst.name = f"rack__{inst_data['id']}"
        COLS["hall"].objects.link(inst)
        
        # Position in Blender coords (already metres)
        pos = inst_data["position"]
        inst.location = (pos[0], pos[1], pos[2])
        
        # Rotation
        rot = inst_data["rotation"]
        inst.rotation_euler = Euler((rot[0], rot[1], rot[2]), 'XYZ')
    
    log(f"  created {len(META['hall']['rackInstances'])} rack instances with unique meshes")

# ------------------------------------------------------------------ loop pipes (procedural)

def create_loop_pipes():
    loop_spec = LAYOUT.get("loop_pipes", {})
    if not loop_spec:
        return
    
    log("creating loop pipes...")
    
    for pipe_key in ["supply", "return"]:
        if pipe_key not in loop_spec:
            continue
        
        pipe_data = loop_spec[pipe_key]
        points = pipe_data["points"]
        diameter_m = loop_spec["diameter_mm"] / 1000.0
        radius = diameter_m / 2.0
        
        # Create curve
        curve = bpy.data.curves.new(pipe_data["name"], 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = radius
        curve.bevel_resolution = 12
        curve.resolution_u = 16
        
        spline = curve.splines.new('POLY')
        spline.points.add(len(points) - 1)
        
        for i, pt in enumerate(points):
            spline.points[i].co = (pt[0], pt[1], pt[2], 1.0)
        
        obj = bpy.data.objects.new(pipe_data["name"], curve)
        COLS["loops"].objects.link(obj)
        obj.data.materials.append(MATS["accent_pipe"])
        
        # Convert to mesh
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        obj.name = f"loops__{pipe_key}"
        
        log(f"  created {pipe_key} pipe, {len(obj.data.polygons)} tris")

create_loop_pipes()

# ------------------------------------------------------------------ environment ground

log("creating environment ground...")
ground = bpy.data.meshes.new("Ground")
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=300.0)
bm.to_mesh(ground)
bm.free()

ground_obj = bpy.data.objects.new("environment__Ground", ground)
COLS["environment"].objects.link(ground_obj)
ground_obj.location = (0, 0, -0.01)
ground_obj.data.materials.append(MATS["concrete"])

# District ground (copy)
district_ground = ground_obj.copy()
district_ground.data = ground_obj.data
district_ground.name = "district__Ground"
COLS["district"].objects.link(district_ground)
district_ground.location = LAYOUT["assets"]["district"]["position"]

# ------------------------------------------------------------------ lighting

log("setting up lights...")
light_data = bpy.data.lights.new("KeyLight", 'AREA')
light_data.energy = 800
light_data.size = 4.0
key_light = bpy.data.objects.new("KeyLight", light_data)
scene.collection.objects.link(key_light)
key_light.location = (5, -8, 12)
key_light.rotation_euler = (math.radians(60), 0, math.radians(145))

rim_data = bpy.data.lights.new("RimLight", 'AREA')
rim_data.energy = 400
rim_data.size = 3.0
rim_light = bpy.data.objects.new("RimLight", rim_data)
scene.collection.objects.link(rim_light)
rim_light.location = (-6, 5, 8)
rim_light.rotation_euler = (math.radians(45), 0, math.radians(-45))

# ------------------------------------------------------------------ camera

cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 39.2
cam_data.sensor_fit = 'VERTICAL'
cam_data.sensor_height = 24

camera = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(camera)
scene.camera = camera

# Set to establish waypoint
if "waypoints" in META:
    wp = next((w for w in META["waypoints"]["points"] if w["id"] == "establish"), None)
    if wp:
        camera.location = wp["position"]
        target = Vector(wp["target"])
        direction = target - Vector(camera.location)
        rot_quat = direction.to_track_quat('-Z', 'Y')
        camera.rotation_euler = rot_quat.to_euler()

# ------------------------------------------------------------------ world

if scene.world is None:
    scene.world = bpy.data.worlds.new("World")

scene.world.use_nodes = True
world_nodes = scene.world.node_tree.nodes
world_nodes.clear()

bg = world_nodes.new('ShaderNodeBackground')
bg.inputs[0].default_value = (0.055, 0.062, 0.075, 1.0)
bg.inputs[1].default_value = 0.3

output = world_nodes.new('ShaderNodeOutputWorld')
scene.world.node_tree.links.new(bg.outputs[0], output.inputs[0])

# ------------------------------------------------------------------ save

out = out_path(LAYOUT["outputs"]["blend"])
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=out)
log(f"WROTE {out}")

# Manifest
manifest = {
    "rack_tris": len(rack_master.data.polygons) if rack_objs else 0,
    "exchanger_tris": len(exch_master.data.polygons) if exch_objs else 0,
    "district_tris": len(district_base.data.polygons) if district_objs else 0,
    "hall_instances": len(META["hall"]["rackInstances"]) if "hall" in META else 0,
    "materials": len(MATS),
    "collections": len(COLS)
}

manifest_path = os.path.join(HERE, "logs", "assemble_manifest.json")
os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
with open(manifest_path, "w") as fh:
    json.dump(manifest, fh, indent=2)

log("MANIFEST:", manifest)
log("assembly complete")