"""Read one numerical, vertex-coloured VRML IndexedFaceSet without executing VRML nodes."""

from dataclasses import dataclass
import hashlib
from pathlib import Path
import re
import warnings

import numpy as np


_ARRAY = re.compile(r"\b(point|coordIndex|color)\s*\[")
_FLOAT = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")
_INTEGER = re.compile(r"[+-]?\d+")
_ENVELOPE = re.compile(
    r"\s*Shape\s*\{\s*geometry\s+IndexedFaceSet\s*\{\s*"
    r"coord\s+Coordinate\s*\{\s*point\s*\[\s*\]\s*\}\s*"
    r"coordIndex\s*\[\s*\]\s*colorPerVertex\s+TRUE\s*"
    r"color\s+Color\s*\{\s*color\s*\[\s*\]\s*\}\s*\}\s*\}\s*"
)


@dataclass
class ColoredFaceSet:
    coordinates: np.ndarray
    colors_srgb: np.ndarray
    loop_indices: np.ndarray
    loop_starts: np.ndarray
    loop_totals: np.ndarray
    metadata: dict


def _numbers(payload, integer=False):
    pattern = _INTEGER if integer else _FLOAT
    remainder, count = pattern.subn("", payload)
    if re.search(r"[^\s,]", remainder):
        raise ValueError("A VRML array contains unsupported or non-numerical data")
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        values = np.fromstring(payload.replace(",", " "), sep=" ",
                               dtype=np.int64 if integer else np.float32)
    if len(values) != count or not np.isfinite(values).all():
        raise ValueError("Malformed or non-finite VRML numbers")
    return values


def parse_colored_vrml(text, source_sha256=""):
    if not text.startswith("#VRML V2.0 utf8"):
        raise ValueError("Only UTF-8 VRML V2.0 is supported")
    text = re.sub(r"#[^\r\n]*", "", text)
    payloads, envelope, previous = {}, [], 0
    for match in _ARRAY.finditer(text):
        if match.start() < previous or match.group(1) in payloads:
            raise ValueError("Duplicate or nested VRML arrays are unsupported")
        end = text.find("]", match.end())
        if end < 0:
            raise ValueError("Unterminated VRML array")
        payloads[match.group(1)] = text[match.end():end]
        envelope.append(text[previous:match.end()] + "]")
        previous = end + 1
    envelope.append(text[previous:])
    if set(payloads) != {"point", "coordIndex", "color"} or not _ENVELOPE.fullmatch("".join(envelope)):
        raise ValueError(
            "Only one Shape/IndexedFaceSet with Coordinate, coordIndex and per-vertex Color is supported; "
            "scripts, external resources, transforms and other nodes are rejected"
        )
    coordinates = _numbers(payloads.pop("point"))
    colors = _numbers(payloads.pop("color"))
    indices = _numbers(payloads.pop("coordIndex"), integer=True)
    if not len(coordinates) or len(coordinates) % 3:
        raise ValueError("Coordinate points must contain complete XYZ triples")
    coordinates = coordinates.reshape(-1, 3)
    if len(colors) != coordinates.size:
        raise ValueError("Exactly one RGB colour per coordinate is required")
    colors = colors.reshape(-1, 3)
    if np.any((colors < 0) | (colors > 1)):
        raise ValueError("VRML colours must be within [0, 1]")
    if not len(indices):
        raise ValueError("At least one face is required")
    if np.any((indices < -1) | (indices >= len(coordinates))):
        raise ValueError("A face refers to an invalid coordinate")
    implicit_final_face = bool(indices[-1] != -1)
    if implicit_final_face:
        indices = np.append(indices, -1)
    ends = np.flatnonzero(indices == -1)
    counts = np.diff(np.concatenate(([-1], ends))) - 1
    if np.any((counts < 3) | (counts > 4)):
        raise ValueError("This restricted importer supports triangle and quad faces only")
    flat = indices[indices != -1].astype(np.int32)
    starts = (np.cumsum(counts) - counts).astype(np.int32)
    counts = counts.astype(np.int32)
    source_faces = len(counts)
    keep_faces = np.ones(len(counts), dtype=bool)
    for size in [3, 4]:
        selected = starts[counts == size]
        corners = flat[selected[:, None] + np.arange(size)]
        repeated = np.zeros(len(corners), dtype=bool)
        for a in range(size):
            for b in range(a + 1, size):
                repeated |= corners[:, a] == corners[:, b]
        retracing = ((corners[:, 0] == corners[:, 2]) |
                     (corners[:, 1] == corners[:, 3])) if size == 4 else np.zeros(len(corners), dtype=bool)
        if np.any(repeated & ~retracing):
            raise ValueError("Repeated adjacent vertices in a face are unsupported")
        keep_faces[np.flatnonzero(counts == size)[retracing]] = False
    dropped = int(np.count_nonzero(~keep_faces))
    if dropped:
        # Opposite duplicate corners traverse the same edges out and back, enclosing zero area.
        flat = flat[np.repeat(keep_faces, counts)]
        counts = counts[keep_faces]
        starts = (np.cumsum(counts) - counts).astype(np.int32)
    if not len(counts):
        raise ValueError("At least one non-degenerate face is required")
    return ColoredFaceSet(coordinates, colors, flat, starts, counts, {
        "source_sha256": source_sha256,
        "vertices": len(coordinates),
        "point_colors": len(colors),
        "faces": len(counts),
        "source_faces": source_faces,
        "discarded_zero_area_retracing_quads": dropped,
        "triangles_after_tessellation": int(np.sum(counts - 2)),
        "triangular_faces": int(np.count_nonzero(counts == 3)),
        "quad_faces": int(np.count_nonzero(counts == 4)),
        "final_face_terminated_by_array_end": implicit_final_face,
        "source_xyz_min": coordinates.min(axis=0).tolist(),
        "source_xyz_max": coordinates.max(axis=0).tolist(),
        "source_color_min": colors.min(axis=0).tolist(),
        "source_color_max": colors.max(axis=0).tolist(),
        "color_per_vertex": True,
        "external_resources_loaded": False,
        "geometry_decimated": False,
    })


def read_colored_vrml(path, expected_sha256=None):
    path = Path(path)
    if path.stat().st_size > 512 * 1024 * 1024:
        raise ValueError("The VRML file exceeds the restricted importer's 512 MiB limit")
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 and digest != expected_sha256:
        raise ValueError("The scan does not match the approved asset SHA-256")
    result = parse_colored_vrml(data.decode("utf-8"), digest)
    result.metadata["source_bytes"] = len(data)
    return result


def srgb_to_linear(colors):
    return np.where(colors <= .04045, colors / 12.92,
                    ((colors + .055) / 1.055) ** 2.4).astype(np.float32)


def create_blender_mesh(scan, name="Licensed coloured wedding scan"):
    import bpy

    geometry = bpy.data.meshes.new(name)
    geometry.vertices.add(len(scan.coordinates))
    geometry.vertices.foreach_set("co", scan.coordinates.ravel())
    geometry.loops.add(len(scan.loop_indices))
    geometry.loops.foreach_set("vertex_index", scan.loop_indices)
    geometry.polygons.add(len(scan.loop_totals))
    geometry.polygons.foreach_set("loop_start", scan.loop_starts)
    geometry.polygons.foreach_set("loop_total", scan.loop_totals)
    geometry.polygons.foreach_set("use_smooth", np.ones(len(scan.loop_totals), dtype=bool))
    colors = geometry.color_attributes.new(name="ScanColor", type="FLOAT_COLOR", domain="POINT")
    rgba = np.ones((len(scan.colors_srgb), 4), dtype=np.float32)
    rgba[:, :3] = srgb_to_linear(scan.colors_srgb)
    colors.data.foreach_set("color", rgba.ravel())
    geometry.update(calc_edges=True)
    obj = bpy.data.objects.new(name, geometry)
    bpy.context.collection.objects.link(obj)
    return obj
