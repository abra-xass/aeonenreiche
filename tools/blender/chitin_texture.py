"""Bake tileable chitin color and tangent-space normal maps for the insectoid meshes."""

from pathlib import Path
import sys

import bpy
import numpy as np


output = Path(sys.argv[sys.argv.index("--") + 1])
size = 512
y, x = np.mgrid[0:size, 0:size] * (2 * np.pi / size)
ridges = np.cos(7 * y + 1.1 * np.sin(3 * x) + 0.28 * np.sin(11 * x + 3 * y))
scars = np.sin(53 * x + 12 * y) * np.cos(11 * x - 49 * y)
flecks = np.sin(89 * x - 38 * y) * np.sin(64 * x + 71 * y)
height = 0.28 * ridges + 0.085 * scars + 0.018 * flecks + 0.13 * np.sin(5 * x + 4 * y)
light = 0.52 + height * 0.51
color = np.stack((light * 0.78, light * 0.81, light * 0.54), axis=-1)
dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
normal = np.stack((-dx * 4.2, -dy * 4.2, np.ones_like(height)), axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)

output.mkdir(parents=True, exist_ok=True)
for name, rgb, colorspace in [
    ("insect_chitin", color, "sRGB"),
    ("insect_chitin-normal", normal * 0.5 + 0.5, "Non-Color"),
]:
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.colorspace_settings.name = colorspace
    rgba = np.concatenate((np.clip(rgb, 0, 1), np.ones((size, size, 1))), axis=-1)
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.file_format = "JPEG"
    image.filepath_raw = str((output / f"{name}.jpg").resolve())
    image.save()
