"""CAD Viewer widget for marimo using anywidget."""

from __future__ import annotations

import logging
import pathlib
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

import anywidget
import traitlets

from marimo_cad.tessellate import to_viewer_format

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from typing import TypedDict

    class _PartSpecRequired(TypedDict):
        shape: Any  # build123d Part, Solid, Sketch, etc.

    class PartSpec(_PartSpecRequired, total=False):
        name: str
        color: str  # "blue", "red", etc. or "#rrggbb"
        alpha: float  # 0.0-1.0


# Type alias
Shape = Any

STATIC_DIR = pathlib.Path(__file__).parent / "static"

# Named colors
COLORS = {
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


def _resolve_color(color: str | None) -> str | None:
    """Resolve named color to hex, or return as-is."""
    if color is None:
        return None
    return COLORS.get(color.lower(), color)


def _is_part_spec(item: Any) -> bool:
    """Check if item is a PartSpec dict (has 'shape' key)."""
    return isinstance(item, dict) and "shape" in item


def _is_sequence_of_parts(item: Any) -> bool:
    """Check if item is a sequence of parts (not a single CAD object)."""
    if isinstance(item, (list, tuple)):
        return True
    if hasattr(item, "__iter__") and hasattr(item, "__next__"):
        return True
    return False


def _unpack(item: Any) -> tuple[Any, str | None, str | None, float | None]:
    """Unpack Shape or PartSpec into (shape, name, color, alpha)."""
    if _is_part_spec(item):
        return (
            item["shape"],
            item.get("name"),
            _resolve_color(item.get("color")),
            item.get("alpha"),
        )
    return (item, None, None, None)


class CADViewer(anywidget.AnyWidget):
    """
    Interactive 3D CAD viewer widget.

    Use `view()` to create instances.
    """

    _esm = STATIC_DIR / "widget.js"
    _css = STATIC_DIR / "widget.css"

    shapes_data = traitlets.Dict().tag(sync=True)
    width = traitlets.Unicode("100%").tag(sync=True)  # CSS width (e.g., "100%", "800px")
    height = traitlets.Int(600).tag(sync=True)
    selected = traitlets.Dict({}).tag(sync=True)

    def __init__(
        self,
        *,
        width: str | int = "100%",
        height: int = 600,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        # Convert int to px string
        self.width = f"{width}px" if isinstance(width, int) else width
        self.height = height
        self.shapes_data = {}

    def render(self, shapes: Shape | PartSpec | Sequence[Shape | PartSpec]) -> None:
        """
        Render shapes in the viewer.

        Replaces any existing shapes. Pass all shapes you want to display.

        Args:
            shapes: A shape, list of shapes, or PartSpec dicts with metadata

        Examples:
            view.render(box)
            view.render([box, cylinder])
            view.render({"shape": box, "name": "Base", "color": "blue"})
        """
        self.shapes_data = self._tessellate(shapes)

    def _tessellate(self, parts: Shape | PartSpec | Sequence[Shape | PartSpec]) -> dict:
        """Convert shapes to viewer format."""
        if _is_part_spec(parts) or not _is_sequence_of_parts(parts):
            items = [parts]
        else:
            items = list(parts)

        objects = [_unpack(item) for item in items]

        if not objects:
            return {}

        shapes = [o[0] for o in objects]
        names = [o[1] for o in objects]
        colors = [o[2] for o in objects]
        alphas = [o[3] for o in objects]

        try:
            return to_viewer_format(
                *shapes,
                names=names,
                colors=colors,
                alphas=alphas,
            )
        except Exception:
            logger.exception("Failed to tessellate shapes")
            return {}

    def __repr__(self) -> str:
        n = len(self.shapes_data.get("parts", []))
        return f"CADViewer({n} parts, {self.width}x{self.height})"


def view(
    shapes: Shape | PartSpec | Sequence[Shape | PartSpec] | None = None,
    options: dict | None = None,
    *,
    width: str | int = "100%",
    height: int = 600,
) -> CADViewer:
    """
    Create a 3D CAD viewer.

    Note: For marimo notebooks, wrap with mo.ui.anywidget() for reactivity:
        viewer = mo.ui.anywidget(cad.view())

    Args:
        shapes: Optional shapes to render initially
        options: Optional dict with width, height
        width: Viewer width - "100%" (default), "800px", or int pixels
        height: Viewer height in pixels (default: 600)

    Returns:
        CADViewer widget

    Examples:
        # Empty viewer (fills container width)
        v = mo.ui.anywidget(cad.view())
        v.widget.render(box)

        # With initial shapes
        v = mo.ui.anywidget(cad.view([box, cylinder]))

        # With fixed size
        v = mo.ui.anywidget(cad.view({"width": 900, "height": 600}))
    """
    # Handle options dict
    if options is not None:
        width = options.get("width", width)
        height = options.get("height", height)

    # Handle case where first arg is options dict (no shapes)
    if isinstance(shapes, dict) and "shape" not in shapes:
        # It's an options dict, not a PartSpec
        width = shapes.get("width", width)
        height = shapes.get("height", height)
        shapes = None

    viewer = CADViewer(width=width, height=height)

    if shapes is not None:
        viewer.render(shapes)

    return viewer
