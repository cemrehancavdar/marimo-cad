"""Tessellation module for converting build123d objects to three-cad-viewer format."""

from typing import Any

from marimo_cad.constants import (
    DEFAULT_ANGULAR_TOLERANCE,
    DEFAULT_DEVIATION,
    DEFAULT_LOCATION,
    DEFAULT_PART_COLOR,
    empty_shapes,
)


def tessellate_single(
    obj: Any,
    *,
    name: str | None = None,
    color: str | None = None,
    alpha: float | None = None,
    deviation: float = DEFAULT_DEVIATION,
    angular_tolerance: float = DEFAULT_ANGULAR_TOLERANCE,
) -> dict:
    """
    Tessellate a single CAD object and return a part dict.

    This is useful for caching individual parts with mo.cache.

    Args:
        obj: A CAD object (build123d Part, Solid, Sketch, etc.)
        name: Optional name for the part
        color: Optional hex color string
        alpha: Optional alpha value (0-1)
        deviation: Tessellation quality (lower = finer mesh)
        angular_tolerance: Angular tolerance for tessellation

    Returns:
        A part dictionary that can be combined with combine_parts()
    """
    result = to_viewer_format(
        obj,
        names=[name],
        colors=[color],
        alphas=[alpha],
        deviation=deviation,
        angular_tolerance=angular_tolerance,
    )
    # Return just the first part, but include the bounding box from top level
    parts = result.get("parts", [])
    if parts:
        part = parts[0]
        # Copy the top-level bounding box to the part
        part["bb"] = result.get("bb")
        return part
    return {}


def combine_parts(parts: list[dict], name: str = "Assembly") -> dict:
    """
    Combine multiple tessellated parts into a single shapes_data structure.

    This is useful when using mo.cache to cache individual parts.

    Args:
        parts: List of part dicts from tessellate_single()
        name: Name for the combined assembly

    Returns:
        A shapes_data dict suitable for CADViewer
    """
    if not parts:
        return empty_shapes()

    # Filter out empty parts
    valid_parts = [p for p in parts if p and p.get("shape")]

    if not valid_parts:
        return empty_shapes()

    # Calculate combined bounding box
    bb = _combine_bounding_boxes([p.get("bb") for p in valid_parts])

    return {
        "version": 3,
        "parts": valid_parts,
        "loc": DEFAULT_LOCATION.copy(),
        "name": name,
        "id": f"/{name}",
        "bb": bb,
    }


def _combine_bounding_boxes(bbs: list[dict | None]) -> dict:
    """Combine multiple bounding boxes into one encompassing box."""
    valid_bbs = [bb for bb in bbs if bb is not None]
    if not valid_bbs:
        return {"xmin": 0, "xmax": 0, "ymin": 0, "ymax": 0, "zmin": 0, "zmax": 0}

    return {
        "xmin": min(bb.get("xmin", 0) for bb in valid_bbs),
        "xmax": max(bb.get("xmax", 0) for bb in valid_bbs),
        "ymin": min(bb.get("ymin", 0) for bb in valid_bbs),
        "ymax": max(bb.get("ymax", 0) for bb in valid_bbs),
        "zmin": min(bb.get("zmin", 0) for bb in valid_bbs),
        "zmax": max(bb.get("zmax", 0) for bb in valid_bbs),
    }


def to_viewer_format(
    *objs: Any,
    names: list | None = None,
    colors: list | None = None,
    alphas: list | None = None,
    deviation: float = DEFAULT_DEVIATION,
    angular_tolerance: float = DEFAULT_ANGULAR_TOLERANCE,
) -> dict:
    """
    Convert build123d/CadQuery objects to three-cad-viewer JSON format.

    Args:
        objs: One or more CAD objects (build123d Part, Solid, Sketch, etc.)
        names: Optional list of names for each object
        colors: Optional list of hex color strings for each object
        alphas: Optional list of alpha values (0-1) for each object
        deviation: Tessellation quality (lower = finer mesh)
        angular_tolerance: Angular tolerance for tessellation

    Returns:
        Dictionary in three-cad-viewer shapes format
    """
    # Import here to avoid import errors if ocp-tessellate not installed
    from ocp_tessellate.convert import tessellate_group, to_ocpgroup

    if not objs:
        return empty_shapes()

    # Set up defaults
    num_objs = len(objs)
    if names is None:
        names = [None] * num_objs
    if colors is None:
        colors = [None] * num_objs
    if alphas is None:
        alphas = [None] * num_objs

    # Convert to OcpGroup
    ocp_group, instances = to_ocpgroup(
        *objs,
        names=names,
        colors=colors,
        alphas=alphas,
        progress=None,
    )

    # Tessellate
    shapes, states, _mapping = tessellate_group(
        ocp_group,
        instances,
        kwargs={
            "deviation": deviation,
            "angular_tolerance": angular_tolerance,
        },
        progress=None,
        timeit=False,
    )

    # Merge shapes data into states (states has refs, shapes has actual data)
    return _merge_shapes_into_states(shapes, states)


def _merge_shapes_into_states(shapes: list, states: dict) -> dict:
    """
    Merge shape mesh data into the states structure.

    The states dict has parts with shape: {ref: N} that reference
    the shapes list. We need to replace refs with actual mesh data.
    """
    result = {
        "version": states.get("version", 3),
        "parts": [],
        "loc": _convert_loc(states.get("loc")),
        "name": states.get("name", "Model"),
        "id": states.get("id", "/Model"),
        "bb": _convert_bb(states.get("bb", {})),
    }

    for part in states.get("parts", []):
        merged_part = _merge_part(part, shapes)
        if merged_part:
            result["parts"].append(merged_part)

    return result


def _merge_part(part: dict, shapes: list) -> dict | None:
    """Merge a single part with its shape data from shapes list."""
    if not part:
        return None

    # Get the shape ref
    shape_info = part.get("shape", {})
    ref = shape_info.get("ref")

    # Get the actual shape data from shapes list
    if ref is not None and ref < len(shapes):
        shape_data = shapes[ref]
    else:
        shape_data = {}

    # Convert numpy arrays to lists
    return {
        "id": part.get("id", "/Model/Part"),
        "type": part.get("type", "shapes"),
        "subtype": part.get("subtype", "solid"),
        "name": part.get("name", "Part"),
        "shape": {
            "vertices": _to_list(shape_data.get("vertices", [])),
            "triangles": _to_list(shape_data.get("triangles", [])),
            "normals": _to_list(shape_data.get("normals", [])),
            "edges": _to_list(shape_data.get("edges", [])),
            "obj_vertices": _to_list(shape_data.get("obj_vertices", [])),
            "face_types": _to_list(shape_data.get("face_types", [])),
            "edge_types": _to_list(shape_data.get("edge_types", [])),
            "triangles_per_face": _to_list(shape_data.get("triangles_per_face", [])),
            "segments_per_edge": _to_list(shape_data.get("segments_per_edge", [])),
        },
        "state": part.get("state", [1, 1]),
        "color": part.get("color", DEFAULT_PART_COLOR),
        "alpha": part.get("alpha", 1.0),
        "texture": part.get("texture"),
        "loc": _convert_loc(part.get("loc")),
        "renderback": part.get("renderback", False),
        "accuracy": part.get("accuracy"),
        "bb": _convert_bb(part.get("bb")),
    }


def _convert_bb(bb: dict | None) -> dict | None:
    """Convert bounding box, handling numpy types."""
    if bb is None:
        return None
    return {
        "xmin": float(bb.get("xmin", 0)),
        "xmax": float(bb.get("xmax", 0)),
        "ymin": float(bb.get("ymin", 0)),
        "ymax": float(bb.get("ymax", 0)),
        "zmin": float(bb.get("zmin", 0)),
        "zmax": float(bb.get("zmax", 0)),
    }


def _convert_loc(loc) -> list:
    """Convert location to [[x,y,z], [qx,qy,qz,qw]] format."""
    if loc is None:
        return [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]]

    # Handle numpy arrays
    if hasattr(loc, "tolist"):
        loc = loc.tolist()

    # Already in correct format [[pos], [quat]]
    if isinstance(loc, (list, tuple)) and len(loc) == 2:
        pos = loc[0]
        quat = loc[1]

        # Convert pos
        if hasattr(pos, "tolist"):
            pos = pos.tolist()
        elif isinstance(pos, (list, tuple)):
            pos = [float(x) for x in pos]
        else:
            pos = [0.0, 0.0, 0.0]

        # Convert quat
        if hasattr(quat, "tolist"):
            quat = quat.tolist()
        elif isinstance(quat, (list, tuple)):
            quat = [float(x) for x in quat]
        else:
            quat = [0.0, 0.0, 0.0, 1.0]

        return [pos, quat]

    return [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]]


def _to_list(arr) -> list:
    """Convert numpy array or other iterable to a flat Python list."""
    if arr is None:
        return []

    # Handle numpy arrays
    if hasattr(arr, "tolist"):
        result = arr.tolist()
        # Flatten if needed
        if result and isinstance(result[0], list):
            return [item for sublist in result for item in sublist]
        return result

    # Handle regular lists/tuples
    if isinstance(arr, (list, tuple)):
        result = []
        for item in arr:
            if hasattr(item, "tolist"):
                result.extend(item.tolist())
            elif isinstance(item, (list, tuple)):
                result.extend(item)
            else:
                result.append(item)
        return result

    return list(arr)
