import bpy, json
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='app/public/models/scene.glb')
out = []
for o in bpy.context.scene.objects:
    out.append({'name': o.name, 'loc': [round(v,2) for v in o.location], 'dim': [round(v,1) for v in o.dimensions]})
open('pipeline/logs/glb_nodes.json', 'w').write(json.dumps(out, indent=1))
print('NODES_WROTE', len(out))