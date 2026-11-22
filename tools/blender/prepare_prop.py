"""Bake an imported prop into a lightweight, upright GLB with its pivot at ground level."""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--triangles", type=int, default=1400)
    parser.add_argument("--texture-size", type=int, default=512)
    parser.add_argument("--mesh", help="Export a single named mesh from a pack of variations.")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if args.mesh:
        meshes = [obj for obj in meshes if obj.name == args.mesh]
    if not meshes:
        raise ValueError("The source asset contains no meshes.")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
        transform = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = transform
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh = bpy.context.object
    mesh.name = args.output.stem
    mesh.data.calc_loop_triangles()
    triangles = len(mesh.data.loop_triangles)
    if triangles > args.triangles:
        modifier = mesh.modifiers.new("Browser polygon budget", "DECIMATE")
        modifier.ratio = args.triangles / triangles
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    corners = [Vector(corner) for corner in mesh.bound_box]
    low = Vector(tuple(min(corner[axis] for corner in corners) for axis in range(3)))
    high = Vector(tuple(max(corner[axis] for corner in corners) for axis in range(3)))
    centre = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    width = max((high - low).x, (high - low).y)
    if width <= 0:
        raise ValueError("The source asset has no horizontal extent.")
    for vertex in mesh.data.vertices:
        vertex.co = (vertex.co - centre) / width
    mesh.data.update()

    for image in bpy.data.images:
        width, height = image.size
        longest = max(width, height)
        if longest > args.texture_size:
            scale = args.texture_size / longest
            image.scale(max(1, round(width * scale)), max(1, round(height * scale)))
            image.pack()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB", use_selection=True)
    mesh.data.calc_loop_triangles()
    print(f"{args.output.name}: {triangles} → {len(mesh.data.loop_triangles)} triangles")


if __name__ == "__main__":
    main()
