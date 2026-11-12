"""Tileable procedural detail textures (numpy only) used by bake.py.

All functions return float32 arrays shaped (H, W, 3) with values in 0..1 and row 0 at the
BOTTOM (Blender pixel order, v up). Colour arrays are returned in sRGB, data arrays
(metallic-roughness, normal) are linear/raw so they can be saved as Non-Color images.

glTF packing: metallic-roughness image = (R: 1.0, G: roughness, B: metallic).
"""
import numpy as np


def _rng(seed):
    return np.random.default_rng(seed)


def tileable_noise(h, w, sx, sy, seed):
    """Unit-variance noise, periodic in both axes. sx / sy = blur sigma in pixels along
    x / y (a large sx with small sy gives streaks running along x)."""
    white = _rng(seed).standard_normal((h, w))
    fx = np.fft.fftfreq(w)[None, :]
    fy = np.fft.fftfreq(h)[:, None]
    filt = np.exp(-2.0 * np.pi ** 2 * ((fx * sx) ** 2 + (fy * sy) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * filt))
    out -= out.mean()
    return out / (out.std() + 1e-9)


def mr_texture(size, kind, metal, rough, var, seed=1):
    """kind 'brushed' (streaks along u) or 'noise' (isotropic grain)."""
    if kind == "brushed":
        n = 0.75 * tileable_noise(size, size, size / 6.0, 0.7, seed) \
            + 0.25 * tileable_noise(size, size, 6.0, 1.0, seed + 7)
    else:
        n = 0.6 * tileable_noise(size, size, 1.2, 1.2, seed) \
            + 0.4 * tileable_noise(size, size, 9.0, 9.0, seed + 7)
    g = np.clip(rough + var * n, 0.04, 1.0)
    img = np.empty((size, size, 3), np.float32)
    img[..., 0] = 1.0
    img[..., 1] = g
    img[..., 2] = np.clip(metal + 0.02 * n, 0.0, 1.0)
    return img


def height_to_normal(height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    nx, ny, nz = -dx * strength, -dy * strength, np.ones_like(height)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    out = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
    return (out * 0.5 + 0.5).astype(np.float32)


def normal_texture(size, kind, strength, seed=3):
    if kind == "brushed":
        h = 0.8 * tileable_noise(size, size, size / 5.0, 0.6, seed) \
            + 0.2 * tileable_noise(size, size, 5.0, 0.8, seed + 5)
        return height_to_normal(h, strength * 1.4)
    if kind == "chevron":
        return chevron_normal(size, strength)
    h = tileable_noise(size, size, 1.0, 1.0, seed) * 0.5 \
        + tileable_noise(size, size, 6.0, 6.0, seed + 2) * 0.5
    return height_to_normal(h, strength * 1.2)


def chevron_normal(size, strength, ridges=5, shift=2.0):
    """Herringbone plate corrugation. One tile = one full zig-zag period in u and
    `ridges` ridges in v."""
    u = (np.arange(size)[None, :] + 0.5) / size
    v = (np.arange(size)[:, None] + 0.5) / size
    zig = np.abs(2.0 * u - 1.0)                       # triangle wave 0..1, periodic
    phase = v * ridges + shift * zig
    s = np.sin(2.0 * np.pi * phase)
    h = np.tanh(2.0 * s) * 0.5                        # rounded ridges
    # Normal from the analytic gradient is smoother than finite differences on a
    # coarse tile; but np.roll differences are fine at 512 px.
    return height_to_normal(h, strength * size / 64.0)


def facade_textures(size, cols, rows, lit_prob, wall_hex, glass_hex, seed=11):
    """Window grid for one tile (cols x rows window cells). Returns (albedo, emissive, mr).
    Window openings leave >= 19 % of each cell as wall so the tile corner (0, 0) is always
    wall - roofs sample that texel."""
    rng = _rng(seed)

    def hex_rgb(hx):
        hx = hx.lstrip("#")
        return np.array([int(hx[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)

    wall = hex_rgb(wall_hex)
    glass = hex_rgb(glass_hex)
    albedo = np.empty((size, size, 3), np.float32)
    emis = np.zeros((size, size, 3), np.float32)
    mr = np.empty((size, size, 3), np.float32)
    grain = tileable_noise(size, size, 1.5, 1.5, seed + 1)
    albedo[:] = np.clip(wall[None, None, :] * (1.0 + 0.05 * grain[..., None]), 0, 1)
    mr[..., 0] = 1.0
    mr[..., 1] = np.clip(0.9 + 0.04 * grain, 0.5, 1.0)
    mr[..., 2] = 0.0
    warm = np.array([1.0, 0.76, 0.46], np.float32)
    cw, ch = size / cols, size / rows
    for r in range(rows):
        for c in range(cols):
            x0 = int(c * cw + cw * 0.19)
            x1 = int(c * cw + cw * 0.81)
            y0 = int(r * ch + ch * 0.19)
            y1 = int(r * ch + ch * 0.81)
            albedo[y0:y1, x0:x1] = glass * (1.0 + 0.25 * np.linspace(0, 1, y1 - y0)[:, None, None])
            mr[y0:y1, x0:x1, 1] = 0.14
            mr[y0:y1, x0:x1, 2] = 0.2
            if rng.random() < lit_prob:
                level = 0.55 + 0.45 * rng.random()
                emis[y0:y1, x0:x1] = warm * level
                albedo[y0:y1, x0:x1] = np.clip(albedo[y0:y1, x0:x1] * 1.8, 0, 1)
    return albedo, emis, mr
