"""CAD Viewer widget for marimo - Reactive Parametric CAD."""

from __future__ import annotations

import logging
import pathlib
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

import anywidget
import traitlets

from marimo_cad.constants import DEFAULT_HEIGHT, DEFAULT_WIDTH
from marimo_cad.tessellate import to_viewer_format
from marimo_cad.utils import normalize_parts

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from typing import TypedDict

    class _PartSpecRequired(TypedDict):
        shape: Any

    class PartSpec(_PartSpecRequired, total=False):
        name: str
        color: str
        alpha: float


Shape = Any
STATIC_DIR = pathlib.Path(__file__).parent / "static"


def _tessellate(parts: Shape | PartSpec | Sequence[Shape | PartSpec]) -> dict:
    """Convert shapes to viewer format."""
    objects = normalize_parts(parts)

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


class _CADWidget(anywidget.AnyWidget):
    """Internal anywidget for 3D CAD viewing."""

    _esm = STATIC_DIR / "widget.js"
    _css = STATIC_DIR / "widget.css"

    shapes_data = traitlets.Dict().tag(sync=True)
    width = traitlets.Unicode(DEFAULT_WIDTH).tag(sync=True)
    height = traitlets.Int(DEFAULT_HEIGHT).tag(sync=True)
    selected = traitlets.Dict({}).tag(sync=True)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._pending_shapes: dict | None = None
        self._js_ready = False
        # Listen for "ready" message from JS
        self.on_msg(self._on_custom_msg)

    def _on_custom_msg(self, widget: Any, content: dict, buffers: list | None = None) -> None:
        """Handle custom messages from JS.

        Note: ipywidgets callback signature is (widget, content, buffers).
        The content IS the message payload sent from JS via model.send().
        """
        logger.debug("Received custom message: %s", content)
        if content.get("type") == "ready":
            logger.debug("JS ready signal received, pending=%s", self._pending_shapes is not None)
            self._js_ready = True
            # Send pending shapes now that JS is ready
            if self._pending_shapes is not None:
                self.shapes_data = self._pending_shapes
                self._pending_shapes = None
                logger.debug("Sending deferred shapes_data")
                try:
                    self.send_state("shapes_data")
                except Exception:
                    logger.exception("Failed to send_state")

    def set_shapes(self, data: dict) -> None:
        """Set shapes data, deferring if JS not ready."""
        if self._js_ready:
            # JS ready, send immediately
            self.shapes_data = data
            try:
                self.send_state("shapes_data")
            except Exception:
                logger.exception("Failed to send shapes_data state")
        else:
            # JS not ready yet - store in _pending_shapes for later delivery.
            # Also set shapes_data so marimo's anywidget wrapper captures it
            # during initial state sync. The "ready" signal will re-send it.
            self._pending_shapes = data
            self.shapes_data = data


class Viewer:
    """
    Reactive 3D CAD viewer for marimo.

    Camera position is preserved when shapes are updated via render().

    Example:
        viewer = cad.Viewer()
        viewer.render(Box(size.value, size.value, 10))
        mo.vstack([size_slider, viewer])
    """

    def __init__(
        self,
        *,
        width: str | int = DEFAULT_WIDTH,
        height: int = DEFAULT_HEIGHT,
    ) -> None:
        """
        Create a reactive CAD viewer.

        Args:
            width: CSS width ("100%", "800px") or int pixels
            height: Height in pixels
        """
        import marimo as mo

        # Create internal widget
        widget = _CADWidget()
        widget.width = f"{width}px" if isinstance(width, int) else width
        widget.height = height
        widget.shapes_data = {}

        # Wrap for marimo reactivity
        self._wrapped = mo.ui.anywidget(widget)

    def render(self, shapes: Shape | PartSpec | Sequence[Shape | PartSpec]) -> None:
        """
        Render shapes. Camera position is preserved.

        Args:
            shapes: Shape, list of shapes, or PartSpec dicts

        Example:
            viewer.render(box)
            viewer.render([box, cylinder])
            viewer.render({"shape": box, "name": "Base", "color": "blue"})
        """
        data = _tessellate(shapes)
        self._wrapped.widget.set_shapes(data)

    def _mime_(self) -> tuple[str, str]:
        """Allow marimo to display this directly."""
        return self._wrapped._mime_()

    def __repr__(self) -> str:
        n = len(self._wrapped.widget.shapes_data.get("parts", []))
        return f"Viewer({n} parts)"

    # Forward ipython display for notebook compatibility
    def _repr_mimebundle_(self, **kwargs: Any) -> dict:
        return self._wrapped._repr_mimebundle_(**kwargs)
