"""Resize embedded images in a GLB while preserving its meshes, rig and animation."""

import argparse
import io
import json
import struct
from pathlib import Path

from PIL import Image


def padded(data, byte=b"\0"):
    return data + byte * (-len(data) % 4)


def resize(source, destination, limit):
    data = source.read_bytes()
    magic, version, _, json_length, chunk_type = struct.unpack_from("<4s4I", data)
    if (magic, version, chunk_type) != (b"glTF", 2, 0x4E4F534A):
        raise ValueError("Expected a glTF 2.0 binary file")
    model = json.loads(data[20:20 + json_length])
    binary_length, binary_type = struct.unpack_from("<2I", data, 20 + json_length)
    if binary_type != 0x004E4942 or len(model["buffers"]) != 1 or "uri" in model["buffers"][0]:
        raise ValueError("Expected one embedded binary buffer")
    binary = memoryview(data)[28 + json_length:28 + json_length + binary_length]
    images = {image["bufferView"]: image for image in model.get("images", []) if "bufferView" in image}
    output = bytearray()
    for index, view in enumerate(model["bufferViews"]):
        start = view.get("byteOffset", 0)
        original = bytes(binary[start:start + view["byteLength"]])
        payload = original
        if index in images:
            with Image.open(io.BytesIO(payload)) as image:
                if max(image.size) > limit:
                    image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
                    encoded = io.BytesIO()
                    if images[index]["mimeType"] == "image/jpeg":
                        image.save(encoded, format="JPEG", quality=87, optimize=True)
                    else:
                        image.save(encoded, format="PNG", optimize=True)
                    payload = min((original, encoded.getvalue()), key=len)
        view["byteOffset"] = len(output)
        view["byteLength"] = len(payload)
        output.extend(padded(payload))
    model["buffers"][0]["byteLength"] = len(output)
    descriptor = padded(json.dumps(model, separators=(",", ":")).encode(), b" ")
    header = struct.pack("<4s4I", magic, version, 28 + len(descriptor) + len(output), len(descriptor), chunk_type)
    destination.write_bytes(header + descriptor + struct.pack("<2I", len(output), binary_type) + output)
    print(f"{destination.name}: {len(data):,} -> {destination.stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--size", type=int, default=512)
    args = parser.parse_args()
    resize(args.source, args.destination, args.size)
