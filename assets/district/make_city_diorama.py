"""Generate enhanced city diorama with streets, building archetypes, heat network.

This replaces the random 18 boxes with a proper tilt-shift diorama:
- Plinth base with cutaway earth section
- Street grid with crosswalks
- ~60-80 buildings from 8 archetypes (instanced in Blender)
- Heat network polylines on streets
- Trees, lamps, park, river with bridge
- Plant building at center with visible exchanger hall

Units: mm. Output JSON layout for Blender instancing.
"""
import json
import os
import math

cmds = []

def box(name, size, center, body=None, join=False):
    body = body or name
    p = {"length": size[0], "width": size[1], "height": size[2],
         "center": list(center), "name": name, "body_name": body}
    if join:
        p.update({"operation": "join", "targets": [body], "touching": "one_body"})
    cmds.append({"command": "solid.box", "params": p})

def cyl(name, radius, height, base, axis, body=None, join=False):
    body = body or name
    p = {"radius": radius, "height": height, "base": list(base), "axis": list(axis),
         "name": name, "body_name": body}
    if join:
        p.update({"operation": "join", "targets": [body], "touching": "one_body"})
    else:
        p["operation"] = "new"
    cmds.append({"command": "solid.cylinder", "params": p})

# ---------------------------------------------------------------- plinth base
# Rounded square plinth 400m across, 400mm thick, with earth cutaway visible
PLINTH_SIZE = 400000  # 400m
PLINTH_THICK = 400
box("Plinth", (PLINTH_SIZE, PLINTH_SIZE, PLINTH_THICK), (0, 0, -PLINTH_THICK/2))

# Earth section cutaway visible on edges (layered soil colors - will be materialed in Blender)
CUTAWAY_DEPTH = 6800  # to z=-6000 for mains, plus buffer
box("EarthTopsoil", (PLINTH_SIZE + 200, PLINTH_SIZE + 200, 800), (0, 0, -400 - 400))
box("EarthClay", (PLINTH_SIZE + 200, PLINTH_SIZE + 200, 2000), (0, 0, -1200 - 1000))
box("EarthGravel", (PLINTH_SIZE + 200, PLINTH_SIZE + 200, 4000), (0, 0, -3200 - 2000))

# ---------------------------------------------------------------- Building archetypes (instances placed by JSON)
# Archetype 1: Low-rise apartment (5 floors, 15m tall)
box("ArchLowRise", (18000, 14000, 15000), (0, 0, 7500), "ArchLowRise")

# Archetype 2: Mid-rise apartment (8 floors, 24m tall)
box("ArchMidRise", (20000, 16000, 24000), (0, 0, 12000), "ArchMidRise")

# Archetype 3: Tower (16 floors, 48m tall, with setback)
box("TowerBase", (16000, 16000, 32000), (0, 0, 16000), "ArchTower")
box("TowerTop", (12000, 12000, 16000), (0, 0, 40000), "ArchTower", join=True)

# Archetype 4: School (2 floors, L-shape)
box("SchoolWingA", (40000, 14000, 8000), (0, 0, 4000), "ArchSchool")
box("SchoolWingB", (14000, 26000, 8000), (13000, 6000, 4000), "ArchSchool", join=True)

# Archetype 5: Hospital (6 floors, cross shape)
box("HospitalCtr", (30000, 30000, 20000), (0, 0, 10000), "ArchHospital")
box("HospitalNS", (12000, 40000, 20000), (0, 0, 10000), "ArchHospital", join=True)
box("HospitalEW", (40000, 12000, 20000), (0, 0, 10000), "ArchHospital", join=True)

# Archetype 6: Civic hall (3 floors, wide footprint)
box("CivicBase", (36000, 24000, 12000), (0, 0, 6000), "ArchCivic")
box("CivicRoof", (28000, 18000, 4000), (0, 0, 14000), "ArchCivic", join=True)

# Archetype 7: Pool/Recreation (1-2 floors, glass facade - will get window texture)
box("PoolMain", (32000, 24000, 8000), (0, 0, 4000), "ArchPool")
box("PoolRoof", (34000, 26000, 3000), (0, 0, 9500), "ArchPool", join=True)

# Archetype 8: Greenhouse (low, glass, heated)
box("Greenhouse", (28000, 18000, 6000), (0, 0, 3000), "ArchGreenhouse")
# Peaked roof
for i in range(5):
    w = 28000 - i * 5600
    box(f"GHRoof{i}", (w, 18000, 800), (0, 0, 6400 + i * 800), "ArchGreenhouse", join=True)

# ---------------------------------------------------------------- Plant building (real placement, not archetype)
# 30 x 30 x 15m with 4 stacks
box("PlantBody", (30000, 30000, 15000), (0, 0, 7500), "Plant")
# Windows/openings for exchanger hall visibility
for s, x, y in [("N", 0, -15500), ("S", 0, 15500), ("E", 15500, 0), ("W", -15500, 0)]:
    box(f"PlantWindow{s}", (8000, 4000, 10000), (x, y, 8000), f"Plant{s}Window")

# Stacks at corners
for i, (dx, dy) in enumerate([(8000, 8000), (-8000, 8000), (8000, -8000), (-8000, -8000)], 1):
    cyl(f"Stack{i:02d}", 1500, 8000, (dx, dy, 15000), (0, 0, 1))

# ---------------------------------------------------------------- Street grid and features
# Main streets (6m wide) in a grid, ~80m blocks
STREET_W = 6000
BLOCK = 80000
NUM_BLOCKS = 4  # 4x4 grid = 16 blocks, ~64 possible building sites

streets_ns = []
streets_ew = []

for i in range(5):
    x = -160000 + i * BLOCK
    box(f"StreetNS{i:02d}", (STREET_W, PLINTH_SIZE, 200), (x, 0, 100))
    streets_ns.append(x)

for i in range(5):
    y = -160000 + i * BLOCK
    box(f"StreetEW{i:02d}", (PLINTH_SIZE, STREET_W, 200), (0, y, 100))
    streets_ew.append(y)

# Crosswalk marks at intersections (texture detail, small boxes)
for x in streets_ns:
    for y in streets_ew:
        for k, dy in enumerate([-2000, -1000, 0, 1000, 2000], 1):
            box(f"Xwalk{abs(x)}_{abs(y)}_{k}", (STREET_W, 800, 20), (x, y + dy, 110))

# ---------------------------------------------------------------- Trees (simple cylinders, will be instanced)
# Tree archetype for layout
cyl("ArchTree", 300, 8000, (0, 0, 0), (0, 0, 1))

# ---------------------------------------------------------------- Street lamps
# Lamp archetype
cyl("ArchLampPole", 120, 4500, (0, 0, 0), (0, 0, 1), "ArchLamp")
box("ArchLampHead", (600, 400, 200), (0, 0, 4700), "ArchLamp", join=True)

# ---------------------------------------------------------------- Park (one large open space)
box("Park", (70000, 50000, 100), (-120000, 80000, 50))

# ---------------------------------------------------------------- River (simplified channel) and bridge
box("RiverChannel", (300000, 12000, 2000), (0, 140000, -1000))
box("BridgeRoad", (50000, 14000, 600), (0, 140000, 300))
# Bridge pillars
for x in [-18000, -6000, 6000, 18000]:
    cyl(f"BridgePillar{abs(x)}", 1000, 3000, (x, 140000, -1500), (0, 0, 1))

# ---------------------------------------------------------------- Heat network (simplified trunk for geometry)
# Actual polylines exported in scene.meta.json; this is just the physical duct
# Trunk X (east-west through plant)
cyl("TrunkX", 800, 280000, (0, 0, -6000), (1, 0, 0), "HeatNetwork")
# Trunk Y (north-south through plant)
cyl("TrunkY", 800, 280000, (0, 0, -6000), (0, 1, 0), "HeatNetwork", join=True)

# Branch ducts to key building positions (6 major branches)
branches = [
    (60000, 60000), (60000, -60000), (-60000, 60000),
    (-60000, -60000), (100000, 0), (0, 100000)
]
for i, (bx, by) in enumerate(branches, 1):
    length = math.sqrt((bx)**2 + (by)**2)
    angle = math.atan2(by, bx)
    # Simplified: vertical drop + horizontal run
    cyl(f"BranchRise{i:02d}", 600, 6000, (bx, by, -6000), (0, 0, 1), f"Branch{i:02d}")
    cyl(f"BranchRun{i:02d}", 600, 5000, (bx, by, 0), (0, 0, 1), f"Branch{i:02d}", join=True)

# Manholes at access points
for x in [-80000, 0, 80000]:
    for y in [-80000, 0, 80000]:
        cyl(f"Manhole{abs(x)}_{abs(y)}", 800, 200, (x, y, 0), (0, 0, 1))

# ---------------------------------------------------------------- Output
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_city_diorama.json")
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"commands": cmds}, fh, indent=1)

bodies = {c["params"]["body_name"] for c in cmds}
print(f"{len(cmds)} commands, {len(bodies)} bodies -> {out}")

# Also generate a layout JSON for instancing
layout = {
    "archetypes": {
        "low_rise": "ArchLowRise",
        "mid_rise": "ArchMidRise", 
        "tower": "ArchTower",
        "school": "ArchSchool",
        "hospital": "ArchHospital",
        "civic": "ArchCivic",
        "pool": "ArchPool",
        "greenhouse": "ArchGreenhouse",
        "tree": "ArchTree",
        "lamp": "ArchLamp"
    },
    "instances": {
        "buildings": [],
        "trees": [],
        "lamps": []
    },
    "heat_network": {
        "trunk_x": [-140000, 140000],
        "trunk_y": [-140000, 140000],
        "branches": []
    }
}

# Populate building instances in a semi-random but structured layout
# Distribute across the grid blocks, avoiding plant center and major streets
import random
random.seed(42)

# Buildings distributed across blocks
building_types = ["low_rise"] * 30 + ["mid_rise"] * 20 + ["tower"] * 8 +                  ["school", "hospital", "civic", "pool", "greenhouse"]

for i, btype in enumerate(building_types[:65]):  # Cap at 65 buildings
    # Place in grid cells, avoiding center plant area
    bx = random.randint(-2, 2)
    by = random.randint(-2, 2)
    if abs(bx) < 1 and abs(by) < 1:
        continue  # Skip center where plant is
    
    x = bx * BLOCK + random.randint(-25000, 25000)
    y = by * BLOCK + random.randint(-25000, 25000)
    rotation_z = random.choice([0, 90, 180, 270])
    
    layout["instances"]["buildings"].append({
        "id": f"bldg_{i:03d}",
        "archetype": btype,
        "position": [x, y, 0],
        "rotation_deg": [0, 0, rotation_z]
    })

# Trees along streets
for x in streets_ns:
    for offset in range(-180000, 180000, 15000):
        for side in [-4000, 4000]:
            layout["instances"]["trees"].append({
                "position": [x + side, offset, 0],
                "rotation_deg": [0, 0, 0]
            })

for y in streets_ew:
    for offset in range(-180000, 180000, 15000):
        for side in [-4000, 4000]:
            layout["instances"]["trees"].append({
                "position": [offset, y + side, 0],
                "rotation_deg": [0, 0, 0]
            })

# Lamps at regular intervals
for x in streets_ns:
    for offset in range(-180000, 180000, 30000):
        layout["instances"]["lamps"].append({
            "position": [x + 3500, offset, 0],
            "rotation_deg": [0, 0, 0]
        })

# Heat network polylines for animation
network_points = []
# Main trunk X
for x in range(-140, 141, 10):
    network_points.append({"x": x * 1000, "y": 0, "z": -6000, "distance": abs(x) * 1000})
# Main trunk Y  
for y in range(-140, 141, 10):
    network_points.append({"x": 0, "y": y * 1000, "z": -6000, "distance": abs(y) * 1000})

layout["heat_network"]["polyline_points"] = network_points

layout_out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "city_layout.json")
with open(layout_out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(layout, fh, indent=2)
print(f"Layout: {len(layout['instances']['buildings'])} buildings, {len(layout['instances']['trees'])} trees, {len(layout['instances']['lamps'])} lamps -> {layout_out}")
