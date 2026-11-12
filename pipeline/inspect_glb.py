"""Print a structural summary of a GLB: meshes, materials, textures, UV/normal presence,
bounding box (glTF Y-up metres) and extensions. Usage: python inspect_glb.py scene.glb"""
import json
import struct
import sys

path = sys.argv[1]
with open(path, "rb") as fh:
    data = fh.read()
magic, version, length = struct.unpack_from("<4sII", data, 0)
assert magic == b"glTF", "not a GLB"
off = 12
doc = None
while off < len(data):
    clen, ctype = struct.unpack_from("<II", data, off)
    if ctype == 0x4E4F534A:
        doc = json.loads(data[off + 8: off + 8 + clen])
    off += 8 + clen + 0
assert doc is not None
acc = doc["accessors"]
mn = [1e18] * 3
mx = [-1e18] * 3
tris = 0
uv_prims = 0
prims = 0
no_uv = 0
tex_prims = 0
for mesh in doc["meshes"]:
    for p in mesh["primitives"]:
        prims += 1
        a = acc[p["attributes"]["POSITION"]]
        for i in range(3):
            mn[i] = min(mn[i], a["min"][i])
            mx[i] = max(mx[i], a["max"][i])
        if "indices" in p:
            tris += acc[p["indices"]]["count"] // 3
        if "TEXCOORD_0" in p["attributes"]:
            uv_prims += 1
        mat = doc["materials"][p["material"]] if "material" in p else {}
        if "baseColorTexture" in mat.get("pbrMetallicRoughness", {}):
            tex_prims += 1
            if "TEXCOORD_0" not in p["attributes"]:
                no_uv += 1
print("file_bytes", length)
print("nodes", len(doc.get("nodes", [])), "meshes", len(doc["meshes"]), "primitives", prims, "triangles", tris)
print("materials", len(doc.get("materials", [])), "textures", len(doc.get("textures", [])), "images", len(doc.get("images", [])))
print("prims with TEXCOORD_0", uv_prims, "| prims whose material is textured", tex_prims, "| textured but no UV", no_uv)
print("extensionsUsed", doc.get("extensionsUsed"), "extensionsRequired", doc.get("extensionsRequired"))
print("bbox min", [round(v, 3) for v in mn], "max", [round(v, 3) for v in mx])
for m in doc.get("materials", []):
    pbr = m.get("pbrMetallicRoughness", {})
    maps = []
    if "baseColorTexture" in pbr:
        maps.append("base(uv%d)" % pbr["baseColorTexture"].get("texCoord", 0))
    if "metallicRoughnessTexture" in pbr:
        maps.append("mr(uv%d)" % pbr["metallicRoughnessTexture"].get("texCoord", 0))
    if "normalTexture" in m:
        maps.append("normal(uv%d)" % m["normalTexture"].get("texCoord", 0))
    if "emissiveTexture" in m:
        maps.append("emissiveMap(uv%d)" % m["emissiveTexture"].get("texCoord", 0))
    ef = m.get("emissiveFactor")
    if ef and "emissiveTexture" not in m and any(ef):
        maps.append("emissiveFactor=%s" % [round(c, 2) for c in ef])
    print("  material", m.get("name"), " ".join(maps) or "flat",
          "| factors metal", pbr.get("metallicFactor"), "rough", pbr.get("roughnessFactor"))
for i, im in enumerate(doc.get("images", [])):
    print("  image", i, im.get("mimeType"), im.get("name"))
# nodes with translation (asset roots)
for n in doc.get("nodes", []):
    if "mesh" not in n and ("translation" in n or "rotation" in n):
        print("  node", n.get("name"), n.get("translation"), n.get("rotation"))
