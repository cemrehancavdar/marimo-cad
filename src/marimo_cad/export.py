"""Export functions for CAD objects to STEP and STL formats."""

from pathlib import Path
from typing import Any


def export_step(obj: Any, filename: str | Path) -> Path:
    """
    Export a CAD object to STEP format.

    STEP (Standard for the Exchange of Product Data) is a lossless format
    suitable for exchange with other CAD software.

    Args:
        obj: A build123d object (Part, Solid, Compound, etc.)
        filename: Path to save the STEP file

    Returns:
        Path to the exported file

    Example:
        ```python
        from build123d import *
        from marimo_cad import export_step

        box = Box(10, 10, 10)
        export_step(box, "my_box.step")
        ```
    """
    from build123d import export_step as b3d_export_step

    filepath = Path(filename)
    if filepath.suffix.lower() not in (".step", ".stp"):
        filepath = filepath.with_suffix(".step")

    b3d_export_step(obj, str(filepath))
    return filepath


def export_stl(
    obj: Any,
    filename: str | Path,
    tolerance: float = 0.001,
    angular_tolerance: float = 0.1,
) -> Path:
    """
    Export a CAD object to STL format.

    STL (Stereolithography) is a common format for 3D printing.
    Note that STL is a tessellated format and does not preserve
    exact geometry.

    Args:
        obj: A build123d object (Part, Solid, Compound, etc.)
        filename: Path to save the STL file
        tolerance: Linear tolerance for tessellation (lower = finer mesh)
        angular_tolerance: Angular tolerance in radians

    Returns:
        Path to the exported file

    Example:
        ```python
        from build123d import *
        from marimo_cad import export_stl

        box = Box(10, 10, 10)
        export_stl(box, "my_box.stl")
        ```
    """
    from build123d import export_stl as b3d_export_stl

    filepath = Path(filename)
    if not filepath.suffix.lower() == ".stl":
        filepath = filepath.with_suffix(".stl")

    b3d_export_stl(
        obj,
        str(filepath),
        tolerance=tolerance,
        angular_tolerance=angular_tolerance,
    )
    return filepath


def export_gltf(obj: Any, filename: str | Path) -> Path:
    """
    Export a CAD object to GLTF format.

    GLTF (GL Transmission Format) is a modern format for 3D models
    suitable for web viewers and 3D applications.

    Args:
        obj: A build123d object (Part, Solid, Compound, etc.)
        filename: Path to save the GLTF file (.glb or .gltf)

    Returns:
        Path to the exported file
    """
    from build123d import export_gltf as b3d_export_gltf

    filepath = Path(filename)
    if filepath.suffix.lower() not in (".gltf", ".glb"):
        filepath = filepath.with_suffix(".glb")

    b3d_export_gltf(obj, str(filepath))
    return filepath
