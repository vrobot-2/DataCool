#!/usr/bin/env python3
"""Encode a rendered PNG frame directory to a WebP sequence (and AVIF when the
installed Pillow/ffmpeg can do it) plus manifest.json.

    python pipeline/encode.py pipeline/renders --out pipeline/sequence
    python pipeline/encode.py pipeline/renders --fps 30 --quality 85

AVIF is attempted with Pillow first (if built with libavif), then ffmpeg
(libaom-av1 / libsvtav1 / librav1e). If neither is available the WebP sequence
is still written and the manifest records why AVIF was skipped.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, features

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}

def log(*args):
    print("[encode]", *args, flush=True)

def find_ffmpeg():
    return shutil.which("ffmpeg")

def ffmpeg_avif_encoder():
    exe = find_ffmpeg()
    if not exe:
        return None, None
    try:
        out = subprocess.run([exe, "-hide_banner", "-encoders"],
                             capture_output=True, text=True, timeout=30)
    except Exception:
        return exe, None
    text = out.stdout + out.stderr
    for enc in ("libaom-av1", "libsvtav1", "librav1e"):
        if enc in text:
            return exe, enc
    return exe, None

def pil_avif_ok():
    try:
        return bool(features.check("avif"))
    except Exception:
        return False

def main():
    parser = argparse.ArgumentParser(description="frames -> WebP/AVIF sequence + manifest")
    parser.add_argument("frames", nargs="?", default=os.path.join(ROOT, "pipeline", "renders"),
                        help="input frame directory (default pipeline/renders)")
    parser.add_argument("--out", default=os.path.join(ROOT, "pipeline", "sequence"),
                        help="output directory (default pipeline/sequence)")
    parser.add_argument("--fps", type=float, default=24.0)
    parser.add_argument("--quality", type=int, default=82, help="WebP quality")
    parser.add_argument("--avif-quality", type=int, default=32, help="AVIF CRF")
    parser.add_argument("--no-avif", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="max frames (0 = all)")
    args = parser.parse_args()

    frames_dir = os.path.abspath(args.frames)
    out_dir = os.path.abspath(args.out)
    webp_dir = os.path.join(out_dir, "webp")
    avif_dir = os.path.join(out_dir, "avif")
    os.makedirs(webp_dir, exist_ok=True)

    if not os.path.isdir(frames_dir):
        log("ERROR missing frames directory:", frames_dir)
        sys.exit(2)
    names = sorted(n for n in os.listdir(frames_dir)
                   if os.path.splitext(n)[1].lower() in EXTS)
    if args.limit > 0:
        names = names[:args.limit]
    if not names:
        log("ERROR no image frames in", frames_dir)
        sys.exit(2)

    with Image.open(os.path.join(frames_dir, names[0])) as first:
        width, height = first.size
    log("frames", len(names), "%dx%d" % (width, height))

    use_pil_avif = (not args.no_avif) and pil_avif_ok()
    ffmpeg, avif_encoder = (None, None) if args.no_avif else ffmpeg_avif_encoder()
    do_avif = use_pil_avif or bool(avif_encoder)
    if do_avif:
        os.makedirs(avif_dir, exist_ok=True)

    records = []
    for idx, name in enumerate(names):
        src = os.path.join(frames_dir, name)
        stem = "%04d" % idx
        with Image.open(src) as im:
            im = im.convert("RGB")
            webp_path = os.path.join(webp_dir, stem + ".webp")
            im.save(webp_path, "WEBP", quality=args.quality, method=6)
            rec = {"index": idx, "source": name,
                   "webp": os.path.relpath(webp_path, out_dir).replace("\\", "/"),
                   "webp_bytes": os.path.getsize(webp_path)}

            if do_avif:
                avif_path = os.path.join(avif_dir, stem + ".avif")
                ok = False
                if use_pil_avif:
                    try:
                        im.save(avif_path, "AVIF", quality=max(1, 100 - args.avif_quality))
                        ok = os.path.isfile(avif_path) and os.path.getsize(avif_path) > 0
                    except Exception as exc:
                        log("Pillow AVIF failed, falling back to ffmpeg:", exc)
                        use_pil_avif = False
                if not ok and avif_encoder:
                    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                           "-i", src, "-c:v", avif_encoder,
                           "-crf", str(args.avif_quality), avif_path]
                    if avif_encoder == "libaom-av1":
                        cmd[cmd.index("-crf"):cmd.index("-crf")] = ["-still-picture", "1"]
                    try:
                        subprocess.run(cmd, check=True, timeout=120)
                        ok = os.path.isfile(avif_path) and os.path.getsize(avif_path) > 0
                    except Exception as exc:
                        log("ffmpeg AVIF failed for", name, exc)
                if ok:
                    rec["avif"] = os.path.relpath(avif_path, out_dir).replace("\\", "/")
                    rec["avif_bytes"] = os.path.getsize(avif_path)
        records.append(rec)
        if (idx + 1) % 10 == 0 or idx + 1 == len(names):
            log("encoded", idx + 1, "/", len(names))

    manifest = {
        "source_dir": frames_dir,
        "frame_count": len(records),
        "width": width,
        "height": height,
        "fps": args.fps,
        "duration_seconds": round(len(records) / args.fps, 3),
        "webp": {"dir": "webp", "quality": args.quality},
        "avif": {
            "enabled": do_avif,
            "dir": "avif" if do_avif else None,
            "encoder": ("pillow" if use_pil_avif else (avif_encoder or None)),
            "crf": args.avif_quality,
        },
        "frames": records,
    }
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    total_webp = sum(r["webp_bytes"] for r in records)
    total_avif = sum(r.get("avif_bytes", 0) for r in records)
    log("WROTE", manifest_path)
    log("webp", len(records), "frames", total_webp, "bytes")
    log("avif", ("yes" if do_avif else "no"), total_avif, "bytes",
        "encoder=" + str(manifest["avif"]["encoder"]))

if __name__ == "__main__":
    main()
