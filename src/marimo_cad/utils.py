"""Utility functions for marimo-cad."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from marimo_cad.constants import COLORS

if TYPE_CHECKING:
    from collections.abc import Sequence


def resolve_color(color: str | None) -> str | None:
    """Resolve a color name to hex value.

    Args:
        color: Color name ("blue", "red") or hex string ("#4a90d9")

    Returns:
        Hex color string or None if input is None
    """
    if color is None:
        return None
    return COLORS.get(color.lower(), color)


def is_part_spec(item: Any) -> bool:
    """Check if item is a PartSpec dict with 'shape' key."""
    return isinstance(item, dict) and "shape" in item


def is_sequence_of_parts(item: Any) -> bool:
    """Check if item is a sequence (list, tuple, or generator)."""
    if isinstance(item, (list, tuple)):
        return True
    if hasattr(item, "__iter__") and hasattr(item, "__next__"):
        return True
    return False


def unpack_part(item: Any) -> tuple[Any, str | None, str | None, float | None]:
    """Unpack a part item into (shape, name, color, alpha).

    Args:
        item: Shape object or PartSpec dict

    Returns:
        Tuple of (shape, name, color, alpha)
    """
    if is_part_spec(item):
        return (
            item["shape"],
            item.get("name"),
            resolve_color(item.get("color")),
            item.get("alpha"),
        )
    return (item, None, None, None)


def normalize_parts(
    parts: Any | Sequence[Any],
) -> list[tuple[Any, str | None, str | None, float | None]]:
    """Normalize input parts to a list of (shape, name, color, alpha) tuples.

    Handles single shapes, PartSpec dicts, and sequences of either.

    Args:
        parts: Shape, PartSpec, or sequence of shapes/PartSpecs

    Returns:
        List of (shape, name, color, alpha) tuples
    """
    if is_part_spec(parts) or not is_sequence_of_parts(parts):
        items = [parts]
    else:
        items = list(parts)

    return [unpack_part(item) for item in items]
