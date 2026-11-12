"""Generate enhanced exchanger frame with nameplate, gaskets, and carrying bars.

Enhancements for product-grade look:
- Nameplate with DataCool logo and specifications
- Gasket lines around plate pack
- Top carrying bar and bottom guide bar
- Protective sleeves on tie rods
- Painted frame with flow direction labels
"""
import json
import os

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

# Original frame geometry (from build_frame.json)
# Fixed frame
box("FixedFrameL", (90, 1328, 1350), (-345, 0, 675), "FrameFixed")
box("FixedFrameR", (90, 1328, 1350), (345, 0, 675), "FrameFixed", join=True)
box("FixedFrameB", (780, 1328, 90), (0, 0, 45), "FrameFixed", join=True)
box("FixedFrameT", (780, 1328, 90), (0, 0, 1305), "FrameFixed", join=True)

# Moving frame
box("MovingFrameL", (90, 1328, 1350), (-345, 0, 675), "FrameMoving")
box("MovingFrameR", (90, 1328, 1350), (345, 0, 675), "FrameMoving", join=True)
box("MovingFrameB", (780, 1328, 90), (0, 0, 45), "FrameMoving", join=True)
box("MovingFrameT", (780, 1328, 90), (0, 0, 1305), "FrameMoving", join=True)

# Tie rods
for i, x in enumerate([(-280, -280), (280, -280), (-280, 280), (280, 280)], 1):
    cyl(f"TieRod{i}", 22, 1620, (x[0], x[1], 0), (0, 0, 1))
    # Nuts at both ends
    cyl(f"TieNut{i}B", 32, 18, (x[0], x[1], -9), (0, 0, 1))
    cyl(f"TieNut{i}T", 32, 18, (x[0], x[1], 1611), (0, 0, 1))
    # Washers
    cyl(f"TieWasher{i}B", 40, 6, (x[0], x[1], -3), (0, 0, 1))
    cyl(f"TieWasher{i}T", 40, 6, (x[0], x[1], 1617), (0, 0, 1))
    # Protective sleeves
    cyl(f"TieSleeve{i}", 28, 1580, (x[0], x[1], 20), (0, 0, 1))

# Skid rails
box("SkidRailL", (60, 1350, 120), (-350, 0, -60), "Skid")
box("SkidRailR", (60, 1350, 120), (350, 0, -60), "Skid", join=True)

# Cross members
for y in [-550, 0, 550]:
    box(f"CrossMember_{y}", (800, 80, 80), (0, y, -40), "Skid", join=True)

# Feet
for i, (x, y) in enumerate([(-350, -650), (350, -650), (-350, 650), (350, 650)], 1):
    box(f"Foot{i}", (100, 100, 20), (x, y, -10))

# Lifting lugs
for s, x in [("L", -390), ("R", 390)]:
    box(f"LiftLug{s}", (80, 160, 60), (x, 0, 1350))
    cyl(f"LiftHole{s}", 35, 85, (x, 0, 1350), (1, 0, 0))

# NEW: Carrying bar (top)
box("CarryBarTop", (780, 80, 60), (0, 0, 1390))
for x in [-300, -100, 100, 300]:
    box(f"CarryGrip{x}", (60, 80, 30), (x, 0, 1405))

# NEW: Guide bar (bottom)
box("GuideBarBot", (780, 80, 40), (0, 0, -20))

# NEW: Nameplate (riveted to fixed frame)
box("Nameplate", (280, 3, 180), (0, -668, 800))
# Mounting rivets
for dx, dz in [(-120, 70), (120, 70), (-120, -70), (120, -70)]:
    cyl(f"RivetNP{dx}{dz}", 4, 6, (dx, -670, 800 + dz), (0, 1, 0))

# NEW: Flow direction label plates (small rectangles for texture decals)
# Hot in/out, cold in/out on each side
for s, y in [("F", -670), ("R", 670)]:
    for i, (pos, z) in enumerate([("HI", 1050), ("HO", 500), ("CI", 1050), ("CO", 500)], 1):
        x = -200 if "C" in pos else 200
        box(f"Label{pos}{s}", (60, 2, 40), (x, y, z))

# NEW: Gasket strips (black EPDM) around plate pack edge
# Plate pack extends from y=-253 to y=+257 (510 mm)
# Add gasket strips on the perimeter
for s, x in [("L", -365), ("R", 365)]:
    box(f"Gasket{s}", (8, 514, 1270), (x, 0, 635))
for s, z in [("B", 0), ("T", 1270)]:
    box(f"Gasket{s}", (738, 514, 8), (0, 0, z))

# Compression dimension label (small plate)
box("CompLabel", (100, 2, 30), (0, -668, 1250))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_frame_enhanced.json")
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"commands": cmds}, fh, indent=1)
names = {c["params"]["body_name"] for c in cmds}
print(f"{len(cmds)} commands, {len(names)} bodies -> {out}")
