# Export pipeline/scene.blend to app/public/models/scene.glb (+Y up, metres)
# and validate the GLB by importing it back into a fresh Blender scene.
#
#   blender.exe -b --factory-startup -P pipeline/export_glb.py
#   blender.exe -b --factory-startup -P pipeline/export_glb.py -- --blend pipeline/scene.blend --out app/public/models/scene.glb
#
# Cameras and lights are excluded: the web app drives its own camera.
# Blender returns exit code 1 on this portable build (HIP warning) even on
# success; judge by the WROTE / GLB_VALIDATE lines.

import bpy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def abs_path(rel):
    if os.path.isabs(rel):
        return rel
    return os.path.normpath(os.path.join(ROOT, rel))

# DATACOOL_OUT=build re-roots products (scene.blend, scene.glb) under <ROOT>/build/.
OUT_ROOT = os.environ.get("DATACOOL_OUT")

def out_path(rel):
    if os.path.isabs(rel):
        return rel
    base = os.path.join(ROOT, OUT_ROOT) if OUT_ROOT and not os.path.isabs(OUT_ROOT) else (OUT_ROOT or ROOT)
    return os.path.normpath(os.path.join(base, rel))

def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {
        "blend": out_path("pipeline/scene.blend"),
        "out": out_path("pipeline/scene_unbaked.glb"),
    }
    i = 0
    while i < len(argv):
        if argv[i] == "--blend" and i + 1 < len(argv):
            opts["blend"] = abs_path(argv[i + 1]); i += 2
        elif argv[i] == "--out" and i + 1 < len(argv):
            opts["out"] = abs_path(argv[i + 1]); i += 2
        else:
            i += 1
    return opts

def log(*args):
    print("[export_glb]", *args, flush=True)

def scene_stats():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    tris = 0
    verts = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        tris += len(obj.data.loop_triangles)
        verts += len(obj.data.vertices)
    return {"objects": len(meshes), "triangles": tris, "vertices": verts,
            "materials": len(bpy.data.materials)}

def main():
    opts = parse_args()
    if not os.path.isfile(opts["blend"]):
        log("ERROR missing blend:", opts["blend"])
        sys.exit(2)
    bpy.ops.wm.open_mainfile(filepath=opts["blend"])
    os.makedirs(os.path.dirname(opts["out"]), exist_ok=True)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    before = scene_stats()
    log("scene", json.dumps(before))

    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]

    bpy.ops.export_scene.gltf(
        filepath=opts["out"],
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
    )
    size = os.path.getsize(opts["out"]) if os.path.isfile(opts["out"]) else 0
    log("WROTE", opts["out"], size, "bytes")

    # ---- validate by re-importing the GLB in a clean scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=opts["out"])
    after = scene_stats()
    after["file_bytes"] = size
    after["sources"] = before
    log("GLB_VALIDATE " + json.dumps(after, indent=2))
    if after["objects"] == 0:
        log("ERROR GLB re-import produced no meshes")
        sys.exit(3)
    log("OK")

main()
