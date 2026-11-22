"""Repaint the imported Kenney modules with Äonenreiche materials and export GLB."""

import sys
from pathlib import Path

import bpy

source, destination, textures = (Path(value).resolve() for value in sys.argv[sys.argv.index("--") + 1 :])


def material(name, filename, roughness):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes, links = result.node_tree.nodes, result.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    for suffix, role in (("", "albedo"), ("-normal", "normal")):
        image = bpy.data.images.load(str(textures / f"{filename}{suffix}.jpg"), check_existing=True)
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        if role == "albedo":
            links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        else:
            image.colorspace_settings.name = "Non-Color"
            normal = nodes.new("ShaderNodeNormalMap")
            normal.inputs["Strength"].default_value = 0.67
            links.new(texture.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    return result


for filename, output in (("wall-narrow-gate", "castle-gate"), ("tower-square", "castle-watch"), ("tree-log", "cut-timber")):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source / f"{filename}.glb"))
    timber_only = filename == "tree-log"
    masonry = material("Sandsteinquader", "medieval_blocks_05", 0.93)
    timber = material("Dunkle, gealterte Bohlen", "old_planks_02", 0.88)
    roof = material("Schiefer", "roof_slates_02", 0.91)
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        uv = mesh.uv_layers.active.data
        source_material = mesh.materials[0]
        palette = next(node.image for node in source_material.node_tree.nodes if node.type == "TEX_IMAGE")
        width, height = palette.size
        pixels = palette.pixels[:]
        mesh.materials.clear()
        for surface in (masonry, timber, roof):
            mesh.materials.append(surface)
        for polygon in mesh.polygons:
            loops = tuple(polygon.loop_indices)
            u = sum(uv[loop].uv.x for loop in loops) / len(loops)
            v = sum(uv[loop].uv.y for loop in loops) / len(loops)
            sample = 4 * (min(height - 1, max(0, int(v * height))) * width + min(width - 1, max(0, int(u * width))))
            red, green, blue = pixels[sample : sample + 3]
            warm = red > green * 1.12 and red > blue * 1.35
            polygon.material_index = 1 if timber_only or warm else 2 if blue > red * 1.28 else 0
            axis = max(range(3), key=lambda index: abs(polygon.normal[index]))
            a, b = ((1, 2), (0, 2), (0, 1))[axis]
            repeat = 1.45 if timber_only else 1.16
            for loop in loops:
                position = mesh.vertices[mesh.loops[loop].vertex_index].co
                uv[loop].uv = (position[a] * repeat, position[b] * repeat)
        mesh.update()
    bpy.ops.export_scene.gltf(filepath=str(destination / f"{output}.glb"), export_format="GLB")
