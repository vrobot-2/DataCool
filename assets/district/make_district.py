import json, math, sys

# (cx, cy, sx, sy, height) in metres, converted to mm below
buildings_m = [
    (-96, -80, 28, 30, 42),
    (-66, -80, 26, 34, 26),
    (-20, -80, 16, 34, 58),
    (0, -78, 15, 28, 36),
    (20, -80, 16, 30, 22),
    (66, -80, 24, 36, 34),
    (96, -78, 30, 30, 52),
    (-96, 0, 28, 36, 66),
    (-66, 0, 26, 30, 20),
    (96, 0, 30, 38, 48),
    (64, 0, 24, 26, 12),
    (-96, 80, 26, 30, 30),
    (-66, 80, 24, 38, 70),
    (-20, 80, 14, 32, 44),
    (0, 82, 16, 26, 64),
    (20, 80, 14, 34, 18),
    (66, 80, 26, 34, 24),
    (96, 80, 28, 30, 40),
]
buildings = [(cx * 1000, cy * 1000, sx * 1000, sy * 1000, h * 1000)
             for (cx, cy, sx, sy, h) in buildings_m]

# --- sanity checks ---
for i, (cx, cy, sx, sy, h) in enumerate(buildings):
    assert 12000 <= min(sx, sy) and max(sx, sy) <= 40000, (i, sx, sy)
    assert 12000 <= h <= 70000, (i, h)
    # nearest point of footprint to origin
    nx = max(abs(cx) - sx / 2, 0)
    ny = max(abs(cy) - sy / 2, 0)
    d = math.hypot(nx, ny)
    assert d >= 30000, (i, d)
    assert abs(cx) + sx / 2 <= 115000 and abs(cy) + sy / 2 <= 115000, (i,)

for i in range(len(buildings)):
    for j in range(i + 1, len(buildings)):
        ax, ay, aw, ad, _ = buildings[i]
        bx, by, bw, bd, _ = buildings[j]
        gx = abs(ax - bx) - (aw + bw) / 2
        gy = abs(ay - by) - (ad + bd) / 2
        gap = max(gx, gy)
        assert gap >= 3000, (i, j, gap)
        # also not inside central plant
        for cx, cy, s in [(-96, -80, 0)]:
            pass

cmds = []


def box(length, width, height, center, name, op="new", targets=None,
        body_name=None):
    p = {"length": length, "width": width, "height": height,
         "center": center, "name": name, "operation": op,
         "body_name": body_name or name}
    if targets:
        p["targets"] = targets
        p["touching"] = "one_body"
    cmds.append({"command": "solid.box", "params": p})


def cyl(radius, height, base, axis, name):
    cmds.append({"command": "solid.cylinder", "params": {
        "radius": radius, "height": height, "base": base,
        "axis": axis, "name": name, "body_name": name, "operation": "new"}})


# Ground slab: top at z = 0
box(240000, 240000, 400, [0, 0, -200], "Ground")

for i, (cx, cy, sx, sy, h) in enumerate(buildings, 1):
    name = f"Building{i:02d}"
    main_h = round(h * 0.72)
    box(sx, sy, main_h, [cx, cy, main_h / 2], name)
    up_h = h - main_h
    up_sx = round(sx * 0.64)
    up_sy = round(sy * 0.64)
    box(up_sx, up_sy, up_h, [cx, cy, main_h + up_h / 2],
        f"Setback{i:02d}", "join", [name], body_name=name)
    # rooftop box, offset inside the upper footprint
    rb_sx = max(6000, round(up_sx * 0.38))
    rb_sy = max(6000, round(up_sy * 0.38))
    rb_h = 3000 + (i % 3) * 1000
    ox = (up_sx / 2 - rb_sx / 2) * (1 if i % 2 else -1)
    oy = (up_sy / 2 - rb_sy / 2) * (1 if i % 4 < 2 else -1)
    box(rb_sx, rb_sy, rb_h,
        [cx + ox, cy + oy, h + rb_h / 2], f"RoofBox{i:02d}", "join", [name],
        body_name=name)

# Central plant
box(30000, 30000, 15000, [0, 0, 7500], "Plant")
for k, (sx, sy) in enumerate([(-6000, -6000), (6000, -6000),
                              (6000, 6000), (-6000, 6000)], 1):
    cyl(1500, 8000, [sx, sy, 15000], "Z", f"Stack{k:02d}")

# Underground mains at z = -6000 (Ø1.6 m, 200 m long)
cyl(800, 200000, [-100000, 0, -6000], "X", "MainX")
cyl(800, 200000, [0, -100000, -6000], "Y", "MainY")

# Six branches Ø0.6 m from MainX toward buildings
branches = [(-66000, -62000), (-20000, -64000), (66000, -63000),
            (-66000, 62000), (20000, 64000), (66000, 63000)]
for k, (x, end_y) in enumerate(branches, 1):
    if end_y < 0:
        cyl(300, -end_y, [x, end_y, -6000], "Y", f"Branch{k:02d}")
    else:
        cyl(300, end_y, [x, 0, -6000], "Y", f"Branch{k:02d}")

# Eight manhole collars Ø1.2 x 0.2 at grade, in the streets
manholes = [(-40000, -40000), (40000, -40000), (-40000, 40000), (40000, 40000),
            (0, -40000), (0, 40000), (-40000, 0), (40000, 0)]
for k, (x, y) in enumerate(manholes, 1):
    cyl(600, 200, [x, y, -150], "Z", f"Manhole{k:02d}")

script = {"commands": cmds}
with open(r"C:\coding-project\datacool\assets\district\build_district.json",
          "w", encoding="utf-8", newline="\n") as f:
    json.dump(script, f, indent=1)
print(f"{len(cmds)} commands, {len(buildings)} buildings")
