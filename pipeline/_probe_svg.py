
import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    bpy.ops.import_curve.svg(filepath=r"C:/coding-project/datacool/app/public/brand/datacool-logo.svg")
    objs=[o for o in bpy.data.objects if o.type=='CURVE']
    print("SVG_OK", len(objs), [ (o.name, tuple(round(v,4) for v in o.dimensions)) for o in objs][:5])
except Exception as e:
    print("SVG_FAIL", e)
import numpy; print("numpy", numpy.__version__)
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX'; prefs.get_devices(); print("DEV", [(d.name,d.type) for d in prefs.devices])
except Exception as e: print("GPU_FAIL", e)
