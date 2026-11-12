# Render one 1600x900 validation still per camera keyframe (phase 0..4).
# Cycles, AgX, neutral lighting, compositing off.
#
#   blender.exe -b --factory-startup -P pipeline/render_stills.py -- --samples 48
#   blender.exe -b --factory-startup -P pipeline/render_stills.py -- --phases 0,3
#
# Blender returns exit code 1 on this portable build (HIP warning) even on
# success; judge by the WROTE lines and the PNGs.

import bpy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
with open(os.path.join(HERE, "scene_layout.json"), "r", encoding="utf-8") as fh:
    LAYOUT = json.load(fh)

def abs_path(rel):
    return os.path.normpath(os.path.join(ROOT, rel))

# DATACOOL_OUT=build re-roots products (scene.blend, renders) under <ROOT>/build/.
OUT_ROOT = os.environ.get("DATACOOL_OUT")

def out_path(rel):
    if os.path.isabs(rel):
        return rel
    base = os.path.join(ROOT, OUT_ROOT) if OUT_ROOT and not os.path.isabs(OUT_ROOT) else (OUT_ROOT or ROOT)
    return os.path.normpath(os.path.join(base, rel))

def log(*args):
    print("[render_stills]", *args, flush=True)

def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {"samples": None, "phases": None, "blend": None, "out": None}
    i = 0
    while i < len(argv):
        if argv[i] == "--samples" and i + 1 < len(argv):
            opts["samples"] = int(argv[i + 1]); i += 2
        elif argv[i] == "--phases" and i + 1 < len(argv):
            opts["phases"] = [int(p) for p in argv[i + 1].split(",") if p.strip()]; i += 2
        elif argv[i] == "--blend" and i + 1 < len(argv):
            opts["blend"] = abs_path(argv[i + 1]); i += 2
        elif argv[i] == "--out" and i + 1 < len(argv):
            opts["out"] = abs_path(argv[i + 1]); i += 2
        else:
            i += 1
    return opts

def main():
    opts = parse_args()
    blend = opts["blend"] or out_path(LAYOUT["outputs"]["blend"])
    out_dir = opts["out"] or out_path(LAYOUT["outputs"]["renders"])
    os.makedirs(out_dir, exist_ok=True)
    if not os.path.isfile(blend):
        log("ERROR missing blend:", blend)
        sys.exit(2)
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene

    cam_name = LAYOUT["camera"]["name"]
    cam = bpy.data.objects.get(cam_name)
    if cam is None:
        log("ERROR camera not found:", cam_name)
        sys.exit(2)
    scene.camera = cam

    cfg = LAYOUT["render"]
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
    except Exception as exc:
        log("GPU unavailable, using CPU:", exc)
        scene.cycles.device = 'CPU'

    samples = opts["samples"] if opts["samples"] is not None else cfg["samples"]
    scene.render.resolution_x, scene.render.resolution_y = cfg["resolution"]
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.01
    scene.cycles.use_denoising = cfg["denoise"]
    # OptiX AI denoiser (fast, lets us drop to ~16-24 samples); fall back to OIDN.
    for denoiser in ('OPTIX', 'OPENIMAGEDENOISE'):
        try:
            scene.cycles.denoiser = denoiser
            scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
            try:
                scene.cycles.denoising_use_gpu = True
            except Exception:
                pass
            log("denoiser", denoiser)
            break
        except Exception as exc:
            log("denoiser", denoiser, "unavailable:", exc)
    scene.cycles.max_bounces = 6
    scene.view_settings.view_transform = cfg["view_transform"]
    scene.view_settings.exposure = cfg["exposure"]
    try:
        scene.view_settings.look = cfg["look"]
    except Exception:
        pass
    scene.use_nodes = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'

    wanted = opts["phases"]
    written = []
    for kf in LAYOUT["camera"]["keyframes"]:
        phase = kf["phase"]
        if wanted is not None and phase not in wanted:
            continue
        scene.frame_set(kf["frame"])
        path = os.path.join(out_dir, "phase_%d.png" % phase)
        scene.render.filepath = path
        log("rendering phase", phase, kf["name"], "frame", kf["frame"],
            "samples", samples)
        bpy.ops.render.render(write_still=True)
        log("WROTE", path)
        written.append(path)

    log("RENDER_MANIFEST " + json.dumps({"samples": samples, "files": written}, indent=2))

main()
