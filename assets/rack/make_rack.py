"""Generate build_rack.json (SolidCraft script) for the detailed server rack.

    python make_rack.py [out.json]        # default: build_rack.json next to this file
    solidcraft-cli run build_rack.json --out rack.step --out rack.obj --save rack.sc \
        --quality fine --validation off

Contract (docs/production-plan.md 3.1): 600 x 1000 x 2200 mm, front at -Y, ground z = 0,
named bodies RackFrame, Tray01..08, ColdPlate01..08, ManifoldL/R, Branch01..08, Door.
Detail bodies are extra, separate bodies whose names carry the material tokens used by
pipeline/scene_layout.json (Led* emissive, Hose*/Barb* accent pipe, Bezel/Fan/Psu/Port/
Pdu/Caster dark plastic, *Handle*/Hinge* stainless). Never name a detail body "Tray*".
Units: mm.
Polish pass adds: UQD quick-disconnect couplings with colored collars (blue/red), braided
hoses with S-bends, retention clips, manifold valves, gauges, flow arrows, cable bundles.
"""
import json
import os
import sys

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


FRONT = (0, -1, 0)
BODY_Z0 = 50          # uprights start above the casters

# ---------------------------------------------------------------- frame (RackFrame)
H = 2200 - BODY_Z0
ZC = BODY_Z0 + H / 2
first = True
for nm, x, y in (("UprightFL", -260, -460), ("UprightFR", 260, -460),
                 ("UprightRL", -260, 460), ("UprightRR", 260, 460)):
    box(nm, (40, 40, H), (x, y, ZC), "RackFrame", join=not first)
    first = False
for nm, y, z in (("BottomRailF", -460, 60), ("BottomRailR", 460, 60),
                 ("TopRailF", -460, 2180), ("TopRailR", 460, 2180)):
    box(nm, (560, 40, 40), (0, y, z), "RackFrame", join=True)
# side rails (top and bottom) for stiffness
for nm, x, z in (("SideRailBL", -260, 60), ("SideRailBR", 260, 60),
                 ("SideRailTL", -260, 2180), ("SideRailTR", 260, 2180)):
    box(nm, (40, 880, 40), (x, 0, z), "RackFrame", join=True)

# corner brackets for product look
for k, (x, y, z) in enumerate([
    (-260, -460, 80), (260, -460, 80), (-260, 460, 80), (260, 460, 80),
    (-260, -460, 2160), (260, -460, 2160), (-260, 460, 2160), (260, 460, 2160)
], 1):
    box(f"Bracket{k:02d}", (30, 30, 24), (x, y, z))

# grounding stud
cyl("GroundStud", 6, 12, (-260, -460, 40), (0, 0, 1))

# ---------------------------------------------------------------- casters
for k, (x, y) in enumerate(((-260, -460), (260, -460), (-260, 460), (260, 460)), 1):
    box(f"CasterPlate{k}", (80, 80, 6), (x, y, 47), join=False)
    for s, dx in (("A", -13), ("B", 13)):
        box(f"CasterFork{k}{s}", (4, 36, 34), (x + dx, y, 31))
    cyl(f"CasterWheel{k}", 22, 16, (x - 8, y, 22), (1, 0, 0))
    cyl(f"CasterHub{k}", 6, 30, (x - 15, y, 22), (1, 0, 0))

# ---------------------------------------------------------------- trays + front panel
for i in range(8):
    n = i + 1
    z0 = 250 + 180 * i
    zc = z0 + 35
    tag = f"{n:02d}"
    box(f"Tray{tag}", (480, 900, 70), (0, 0, zc))
    
    # cold plate with mounting screws
    zp = 329 + 180 * i
    box(f"Plate{tag}", (140, 140, 18), (0, -250, zp), f"ColdPlate{tag}")
    for sx, sz in [(-60, 60), (60, 60), (-60, -60), (60, -60)]:
        cyl(f"PlateScrew{tag}{sx}{sz}", 3, 10, (sx, -250 - 9, zp + sz), FRONT)
    
    # UQD quick disconnects with colored collars on each side
    for s, x, color in (("A", 40, "Blue"), ("B", -40, "Red")):
        # Base coupling body (stainless)
        cyl(f"UqdBase{s}{tag}", 9, 24, (x, -330, zp), FRONT)
        # Colored collar (blue for supply A, red for return B)
        cyl(f"UqdCollar{color}{s}{tag}", 12, 8, (x, -342, zp), FRONT)
        # Barb extending from coupling
        cyl(f"Barb{s}{tag}", 5, 16, (x, -354, zp), FRONT, f"ColdPlate{tag}")
    
    # Braided hoses with S-bend from coupling to manifold branch
    # Hose segments (will create braided texture in Blender)
    for s, x in (("A", 40), ("B", -40)):
        # Main hose body (larger radius for braided look)
        cyl(f"Hose{s}{tag}", 8, 50, (x, -370, zp), FRONT)
        # Crimp ferrules at ends
        cyl(f"HoseCrimp{s}{tag}F", 10, 6, (x, -364, zp), FRONT)
        cyl(f"HoseCrimp{s}{tag}R", 10, 6, (x, -415, zp), FRONT)
    
    # Retention clip/bracket under cold plate
    box(f"RetClip{tag}", (160, 6, 8), (0, -240, zp - 14))

    # branch (run to the rear manifold + drop)
    bx = 200 if i % 2 == 0 else -200
    cyl(f"BranchRun{tag}", 12, 720, (bx, -250, zc + 95), (0, 1, 0), f"Branch{tag}")
    cyl(f"BranchDrop{tag}", 12, 65, (bx, -250, zc + 30), (0, 0, 1), f"Branch{tag}", join=True)

    # bezel
    box(f"Bezel{tag}", (480, 4, 64), (0, -452, zc))
    yf = -454.0
    for s, x in (("L", -224), ("R", 224)):
        box(f"Handle{tag}{s}", (10, 5, 40), (x, yf - 2.5, zc))
    for k, dz in enumerate((14, 0, -14), 1):
        box(f"Grille{tag}{k}", (70, 3, 6), (-170, yf - 1.5, zc + dz))
    for s, x in (("A", -100), ("B", -40)):
        cyl(f"Fan{tag}{s}", 27, 10, (x, yf + 8, zc), FRONT)
        cyl(f"FanHub{tag}{s}", 9, 12, (x, yf + 8, zc), FRONT)
    for k, x in enumerate((8, 32), 1):
        box(f"Port{tag}{k}", (20, 3, 14), (x, yf - 1.5, zc + 4))
    for s, x in (("A", 78), ("B", 148)):
        box(f"Psu{tag}{s}", (62, 3, 52), (x, yf - 1.5, zc))
    box(f"LedG{tag}", (6, 3, 6), (196, yf - 1.5, zc + 12))
    box(f"LedA{tag}", (6, 3, 6), (196, yf - 1.5, zc - 12))
    
    # Tray ID label (small plate for texture)
    box(f"LabelTray{tag}", (60, 2, 12), (-220, yf - 1, zc + 22))

# ---------------------------------------------------------------- manifolds with valves and gauges
cyl("ManifoldL", 27, 2000, (-200, 470, 100), (0, 0, 1))
cyl("ManifoldR", 27, 2000, (200, 470, 100), (0, 0, 1))

# Ball valve handles at each branch height (8 pairs)
for i in range(8):
    z0 = 250 + 180 * i
    zv = z0 + 130  # valve at branch connection height
    for s, x in (("L", -200), ("R", 200)):
        # Valve body
        cyl(f"ValveBody{s}{i+1:02d}", 18, 40, (x, 470, zv), (0, 0, 1))
        # Lever handle
        box(f"ValveHandle{s}{i+1:02d}", (80, 8, 8), (x + 30, 470, zv))

# Pressure gauge at top of each manifold
for s, x in (("L", -200), ("R", 200)):
    cyl(f"GaugeBody{s}", 32, 16, (x, 470, 2080), (0, 1, 0))
    cyl(f"GaugeFace{s}", 30, 2, (x, 486, 2080), (0, 1, 0))

# Drain valve at bottom
for s, x in (("L", -200), ("R", 200)):
    cyl(f"DrainValve{s}", 14, 28, (x, 470, 80), (0, 0, -1))
    box(f"DrainHandle{s}", (50, 6, 6), (x + 20, 470, 66))

# ---------------------------------------------------------------- rack-U ear rails
for s, x in (("L", -232), ("R", 232)):
    box(f"Ear{s}", (16, 3, 2020), (x, -446.5, 1110))
    for k in range(22):
        z = 130 + k * 88.9
        w = 14 if k % 3 == 0 else 8
        box(f"UTick{s}{k:02d}", (w, 1.5, 3), (x, -449, z))

# ---------------------------------------------------------------- side louvre vents
for s, x in (("L", -283), ("R", 283)):
    for k in range(31):
        box(f"Vent{s}{k:02d}", (4, 820, 14), (x, 0, 120 + 66 * k))

# ---------------------------------------------------------------- top cable duct
box("CableDuctFloor", (360, 700, 4), (0, 0, 2110))
for s, x in (("L", -178), ("R", 178)):
    box(f"CableDuctWall{s}", (4, 700, 36), (x, 0, 2128))
# Cable bundle along duct
for k in range(6):
    cyl(f"Cable{k+1:02d}", 8, 650, (-140 + k * 12, 0, 2124), (0, 1, 0))

# ---------------------------------------------------------------- rear PDU strip with cable
box("PduStrip", (56, 36, 1500), (0, 468, 1000))
# Inlet cable
cyl("PduCable", 12, 300, (0, 468, 1750), (0, 0, 1))
for k in range(12):
    col, row = k % 2, k // 2
    box(f"PduSocket{k + 1:02d}", (24, 8, 26), (-15 + 30 * col, 490, 360 + 120 * row))
box("LedGPdu", (6, 3, 6), (0, 487.5, 1730))

# ---------------------------------------------------------------- front door (Door body)
DY = -468
DH = 2200 - 52
DZ = 52 + DH / 2
box("DoorFrameL", (40, 40, DH), (-260, DY, DZ), "Door")
box("DoorFrameR", (40, 40, DH), (260, DY, DZ), "Door", join=True)
box("DoorFrameB", (520, 40, 40), (0, DY, 72), "Door", join=True)
box("DoorFrameT", (520, 40, 40), (0, DY, 2180), "Door", join=True)
for k in range(6):
    box(f"Slat{k + 1:02d}", (520, 8, 20), (0, DY, 300 + 300 * k), "Door", join=True)

# Logo plate on door (will be textured with DataCool logo)
box("LogoPlate", (180, 3, 80), (0, DY - 1.5, 1600), "Door", join=True)

# Lock cylinder
cyl("LockCylinder", 8, 20, (262, -484, 1100), FRONT)

# handle (stays inside the 1000 mm envelope) + hinge barrels
box("DoorHandleGrip", (14, 8, 200), (262, -496, 1100))
for s, z in (("A", 1020), ("B", 1180)):
    box(f"DoorHandleStand{s}", (8, 4, 14), (262, -490, z))
for k, z in enumerate((200, 1100, 2000), 1):
    cyl(f"HingeBarrel{k}", 8, 70, (-282, -474, z - 35), (0, 0, 1))

# Status light bar on door top
box("StatusLightBar", (140, 4, 12), (0, DY - 2, 2100))
for k, x in enumerate([-50, -16, 16, 50], 1):
    box(f"StatusLed{k:02d}", (10, 2, 8), (x, DY - 3, 2100))

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_rack.json")
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"commands": cmds}, fh, indent=1)
names = {c["params"]["body_name"] for c in cmds}
print(f"{len(cmds)} commands, {len(names)} bodies -> {out}")