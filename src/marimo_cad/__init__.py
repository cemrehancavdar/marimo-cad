"""marimo-cad - Reactive Parametric CAD for marimo."""

from typing import TYPE_CHECKING

from marimo_cad.constants import COLORS
from marimo_cad.export import export_gltf, export_step, export_stl
from marimo_cad.widget import Viewer

if TYPE_CHECKING:
    from marimo_cad.widget import PartSpec

__all__ = [
    "Viewer",
    "COLORS",
    "PartSpec",
    "export_step",
    "export_stl",
    "export_gltf",
]
__version__ = "0.1.0"
