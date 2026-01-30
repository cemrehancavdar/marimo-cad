"""Shared constants for marimo-cad.

Single source of truth for colors, defaults, and configuration.
"""

from __future__ import annotations

# =============================================================================
# Named Colors
# =============================================================================

COLORS: dict[str, str] = {
    "blue": "#4a90d9",
    "red": "#e85454",
    "green": "#50e850",
    "yellow": "#e8b024",
    "orange": "#e87824",
    "purple": "#b024e8",
    "cyan": "#24e8b0",
    "pink": "#e824b0",
    "gray": "#888888",
    "white": "#ffffff",
    "black": "#333333",
}

# =============================================================================
# Default Colors
# =============================================================================

DEFAULT_PART_COLOR = "#e8b024"  # Yellow/gold - matches JS DEFAULT_PART_COLOR
DEFAULT_EDGE_COLOR = "#333333"  # Dark gray

# =============================================================================
# Default Transforms
# =============================================================================

# Identity transform: position [0,0,0], quaternion [0,0,0,1] (no rotation)
DEFAULT_LOCATION: list[list[float]] = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]]

# =============================================================================
# Widget Defaults
# =============================================================================

DEFAULT_WIDTH = "100%"
DEFAULT_HEIGHT = 600

# =============================================================================
# Tessellation Defaults
# =============================================================================

DEFAULT_DEVIATION = 0.1
DEFAULT_ANGULAR_TOLERANCE = 0.2

# =============================================================================
# Empty Shapes Structure
# =============================================================================


def empty_shapes() -> dict:
    """Return empty shapes structure for viewer."""
    return {
        "version": 3,
        "parts": [],
        "loc": DEFAULT_LOCATION.copy(),
        "name": "Empty",
        "id": "/Empty",
        "bb": {"xmin": 0, "xmax": 0, "ymin": 0, "ymax": 0, "zmin": 0, "zmax": 0},
    }
