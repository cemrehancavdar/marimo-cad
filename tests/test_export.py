"""Tests for export functions."""

import tempfile
from pathlib import Path

from build123d import Box, Cylinder


class TestExportStep:
    """Tests for STEP export."""

    def test_export_step_basic(self):
        """Export a box to STEP format."""
        from marimo_cad import export_step

        box = Box(10, 10, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_step(box, Path(tmpdir) / "test.step")

            assert filepath.exists()
            assert filepath.suffix == ".step"
            assert filepath.stat().st_size > 0

    def test_export_step_auto_extension(self):
        """Export adds .step extension if missing."""
        from marimo_cad import export_step

        box = Box(10, 10, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_step(box, Path(tmpdir) / "test")

            assert filepath.suffix == ".step"
            assert filepath.exists()

    def test_export_step_csg(self):
        """Export CSG result to STEP."""
        from marimo_cad import export_step

        box = Box(10, 10, 10)
        hole = Cylinder(3, 15)
        model = box - hole

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_step(model, Path(tmpdir) / "csg.step")

            assert filepath.exists()
            assert filepath.stat().st_size > 0


class TestExportStl:
    """Tests for STL export."""

    def test_export_stl_basic(self):
        """Export a box to STL format."""
        from marimo_cad import export_stl

        box = Box(10, 10, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_stl(box, Path(tmpdir) / "test.stl")

            assert filepath.exists()
            assert filepath.suffix == ".stl"
            assert filepath.stat().st_size > 0

    def test_export_stl_auto_extension(self):
        """Export adds .stl extension if missing."""
        from marimo_cad import export_stl

        box = Box(10, 10, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_stl(box, Path(tmpdir) / "test")

            assert filepath.suffix == ".stl"
            assert filepath.exists()

    def test_export_stl_with_tolerance(self):
        """Export STL with custom tolerance parameter."""
        from marimo_cad import export_stl

        cyl = Cylinder(5, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Export with custom tolerance (just verify it works)
            filepath = export_stl(cyl, Path(tmpdir) / "custom.stl", tolerance=0.01)

            assert filepath.exists()
            assert filepath.stat().st_size > 0


class TestExportGltf:
    """Tests for GLTF export."""

    def test_export_gltf_basic(self):
        """Export a box to GLTF format."""
        from marimo_cad import export_gltf

        box = Box(10, 10, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_gltf(box, Path(tmpdir) / "test.glb")

            assert filepath.exists()
            assert filepath.suffix == ".glb"
            assert filepath.stat().st_size > 0

    def test_export_gltf_auto_extension(self):
        """Export adds .glb extension if missing."""
        from marimo_cad import export_gltf

        box = Box(10, 10, 10)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = export_gltf(box, Path(tmpdir) / "test")

            assert filepath.suffix == ".glb"
            assert filepath.exists()
