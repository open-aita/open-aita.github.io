#!/usr/bin/env python3
"""Generate AITA dot-matrix particle art assets (Prime Intellect style).

Renders deterministic point-cloud artwork:
  1. particle-infinity.png — lemniscate (∞) formed by dense dot-matrix
     particles with scattered ambient noise, gray-white body (96%) with a
     sparse brand steel-blue fraction (4%).
  2. particle-ribbon.png — vertical dot-stripes forming a flowing ribbon
     wave (compute-bg style), gray-white body (98%) with a sparse brand
     steel-blue fraction (2%).

Output: assets/images/. Deterministic (fixed seed). Requires Pillow.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images"

BRAND = (154, 167, 184)  # #9aa7b8 steel blue-gray, the only non-neutral hue
WHITE = (236, 238, 234)
PALE = (206, 209, 202)
GRAY = (158, 161, 154)


def pick_color(rng, hot=False, brand_ratio=0.04):
    r = rng.random()
    if hot or r > 0.965:
        return WHITE
    if r > 0.72:
        return PALE
    if r > brand_ratio:
        return GRAY
    return BRAND


def dash(draw, x, y, color, alpha, rng, scale=1.0):
    """Draw one dot-matrix unit: a tiny horizontal dash or square dot."""
    w = max(2, round(rng.choice((2, 2, 3, 3, 4)) * scale))
    h = 2 if scale >= 1 else 1
    draw.rectangle([x, y, x + w, y + h], fill=(*color, alpha))


def generate_infinity():
    rng = random.Random(20260901)
    W, H = 2200, 920
    cx, cy = W * 0.60, H * 0.52

    # Lemniscate of Bernoulli as the figure mask.
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    a = W * 0.235
    pts = []
    steps = 900
    for i in range(steps + 1):
        t = 2 * math.pi * i / steps
        d = 1 + math.sin(t) ** 2
        pts.append((cx + a * math.cos(t) / d, cy + a * 0.60 * math.sin(t) * math.cos(t) / d))
    md.line(pts, fill=255, width=int(H * 0.175), joint="curve")
    core = mask.filter(ImageFilter.GaussianBlur(6))
    halo = mask.filter(ImageFilter.GaussianBlur(34))

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    core_px = core.load()
    halo_px = halo.load()

    # Jittered grid sampling: density and brightness follow the mask.
    step = 7
    for gy in range(0, H, step):
        for gx in range(0, W, step):
            x = gx + rng.uniform(-2.4, 2.4)
            y = gy + rng.uniform(-2.4, 2.4)
            m = core_px[gx, gy] / 255
            h = halo_px[gx, gy] / 255
            p = m * 0.94 + h * 0.16
            if rng.random() > p:
                continue
            alpha = int(min(255, 34 + m * 215 + rng.uniform(0, 42)))
            dash(dr, x, y, pick_color(rng), alpha, rng)

    # Ambient scattered noise across the whole canvas.
    for _ in range(1350):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if halo_px[int(x), int(y)] > 40 and rng.random() < 0.78:
            continue  # keep the figure dominant
        alpha = int(rng.uniform(12, 68))
        dash(dr, x, y, pick_color(rng), alpha, rng, scale=0.8)

    # A handful of bright sparks inside the figure.
    for _ in range(160):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if core_px[int(x), int(y)] < 120:
            continue
        dash(dr, x, y, WHITE, int(rng.uniform(180, 255)), rng)

    img.save(OUT / "particle-infinity.png", optimize=True)


def generate_ribbon():
    rng = random.Random(20260902)
    W, H = 2400, 560
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)

    def envelope(x):
        u = x / W
        base = math.sin(u * math.pi * 1.35 - 0.45) * 0.5 + 0.5
        swell = math.exp(-((u - 0.62) ** 2) / 0.055) * 0.9
        return 0.14 + 0.5 * base + swell

    # Vertical dot-stripes; column height follows the ribbon envelope.
    col = 0
    x = 10.0
    while x < W - 10:
        env = envelope(x)
        half = H * 0.42 * env
        cy = H * 0.52 + math.sin(x / W * math.pi * 2.1) * H * 0.05
        step_y = 4
        for i, y in enumerate(range(int(cy - half), int(cy + half), step_y)):
            edge = abs(y - cy) / max(half, 1)
            if rng.random() < edge * 0.42:  # ragged edges
                continue
            alpha = int(120 * (1 - edge * 0.75) + rng.uniform(6, 46))
            color = pick_color(rng, brand_ratio=0.02)
            dr.rectangle([x, y, x + 1, y + 1], fill=(*color, min(255, alpha)))
        x += rng.uniform(5.5, 9.5) if col % 3 else rng.uniform(9, 16)
        col += 1

    # Sparse ambient specks outside the ribbon.
    for _ in range(500):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        dr.rectangle([x, y, x + 1, y + 1], fill=(*pick_color(rng, brand_ratio=0.02), int(rng.uniform(10, 60))))

    img.save(OUT / "particle-ribbon.png", optimize=True)


if __name__ == "__main__":
    generate_infinity()
    generate_ribbon()
    for name in ("particle-infinity.png", "particle-ribbon.png"):
        p = OUT / name
        print(f"{name}: {p.stat().st_size / 1024:.1f} KB")
